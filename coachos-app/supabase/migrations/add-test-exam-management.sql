-- Migration: Add Test & Exam Management module
-- Path: supabase/migrations/add-test-exam-management.sql

-- 1. Create tests table
create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  title text not null,
  subject text,
  test_date date not null,
  max_marks numeric(8,2) not null check (max_marks > 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'marks_entry', 'completed', 'archived')),
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tests is 'Stores test and exam schedules created for batches.';

-- 2. Create test_scores table
create table if not exists public.test_scores (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  marks_obtained numeric(8,2),
  status text not null default 'not_entered' check (status in ('not_entered', 'present', 'absent', 'excused')),
  remarks text,
  checked_by uuid references auth.users(id) on delete set null,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint test_scores_marks_obtained_check check (marks_obtained >= 0),
  constraint test_scores_test_student_unique unique (test_id, student_id)
);

comment on table public.test_scores is 'Stores marks obtained and presence statuses for student tests.';

-- 3. Create indexes
create index if not exists tests_institute_id_idx on public.tests (institute_id);
create index if not exists tests_branch_id_idx on public.tests (branch_id);
create index if not exists tests_batch_id_idx on public.tests (batch_id);
create index if not exists tests_test_date_idx on public.tests (test_date);
create index if not exists tests_status_idx on public.tests (status);

create index if not exists test_scores_institute_id_idx on public.test_scores (institute_id);
create index if not exists test_scores_branch_id_idx on public.test_scores (branch_id);
create index if not exists test_scores_test_id_idx on public.test_scores (test_id);
create index if not exists test_scores_student_id_idx on public.test_scores (student_id);
create index if not exists test_scores_status_idx on public.test_scores (status);

-- 4. Enable Row Level Security (RLS)
alter table public.tests enable row level security;
alter table public.test_scores enable row level security;

-- 5. Recreate role_has_permission with test permissions
create or replace function public.role_has_permission(
  member_role text,
  required_permission text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when member_role = 'owner' then true
    when member_role = 'branch_manager' then required_permission in (
      'dashboard.access',
      'branches.view',
      'academic_years.view',
      'students.view',
      'students.create',
      'students.update',
      'students.delete',
      'students.manage',
      'batches.view',
      'batches.create',
      'batches.update',
      'batches.delete',
      'batches.manage',
      'batch_teachers.manage',
      'homework.view',
      'homework.create',
      'homework.update',
      'homework.archive',
      'homework.delete',
      'homework.manage',
      'attendance.view',
      'attendance.create',
      'attendance.update',
      'attendance.alert',
      'attendance.delete',
      'attendance.manage',
      'fees.view',
      'fees.create',
      'fees.update',
      'fees.record_payment',
      'fees.mark_paid',
      'fees.apply_discount',
      'fees.export',
      'fees.delete',
      'fees.manage',
      'fees.send_reminder',
      'staff.view',
      'communications.view',
      'communications.create',
      'communications.update',
      'communications.delete',
      'notifications.view',
      'notifications.update',
      'tests.view',
      'tests.create',
      'tests.update',
      'tests.archive',
      'tests.delete'
    )
    when member_role = 'operations_staff' then required_permission in (
      'dashboard.access',
      'students.view',
      'students.create',
      'students.update',
      'batches.view',
      'homework.view',
      'attendance.view',
      'attendance.create',
      'attendance.update',
      'fees.view',
      'fees.send_reminder',
      'communications.view',
      'notifications.view',
      'notifications.update',
      'tests.view'
    )
    when member_role = 'accountant' then required_permission in (
      'dashboard.access',
      'students.view',
      'fees.view',
      'fees.create',
      'fees.update',
      'fees.record_payment',
      'fees.mark_paid',
      'fees.apply_discount',
      'fees.export',
      'fees.send_reminder',
      'fees.manage',
      'communications.view',
      'notifications.view',
      'notifications.update'
    )
    when member_role = 'academic_coordinator' then required_permission in (
      'dashboard.access',
      'students.view',
      'batches.view',
      'batches.create',
      'batches.update',
      'homework.view',
      'homework.create',
      'homework.update',
      'homework.archive',
      'homework.delete',
      'homework.manage',
      'attendance.view',
      'attendance.alert',
      'communications.view',
      'notifications.view',
      'notifications.update',
      'tests.view',
      'tests.create',
      'tests.update',
      'tests.archive',
      'tests.delete'
    )
    when member_role = 'teacher' then required_permission in (
      'dashboard.access',
      'students.view',
      'batches.view',
      'homework.view',
      'homework.create',
      'homework.update',
      'attendance.view',
      'communications.view',
      'notifications.view',
      'notifications.update',
      'tests.view',
      'tests.create',
      'tests.update',
      'tests.archive',
      'tests.delete'
    )
    else false
  end
$$;

-- 6. Helper functions for RLS
create or replace function public.current_user_can_access_test_batch(
  target_batch_id uuid,
  required_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_batch_id is not null
    and required_permission is not null
    and exists (
      select 1
      from public.batches
      join public.memberships
        on memberships.institute_id = batches.institute_id
       and memberships.user_id = auth.uid()
      where batches.id = target_batch_id
        and public.role_has_permission(memberships.role, required_permission)
        and (
          memberships.role = 'owner'
          or (
            memberships.role = 'teacher'
            and required_permission in ('tests.view', 'tests.create', 'tests.update', 'tests.archive', 'tests.delete')
            and exists (
              select 1
              from public.batch_teachers
              where batch_teachers.batch_id = batches.id
                and batch_teachers.membership_id = memberships.id
            )
          )
          or (
            memberships.role <> 'teacher'
            and (
              memberships.role = 'branch_manager'
              or memberships.role = 'academic_coordinator'
              or memberships.role = 'operations_staff'
            )
            and memberships.branch_id = batches.branch_id
          )
        )
    )
$$;

create or replace function public.current_user_can_access_test(
  target_test_id uuid,
  required_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_test_id is not null
    and required_permission is not null
    and exists (
      select 1
      from public.tests
      join public.batches
        on batches.id = tests.batch_id
      where tests.id = target_test_id
        and tests.institute_id = batches.institute_id
        and tests.branch_id = batches.branch_id
        and public.current_user_can_access_test_batch(
          batches.id,
          required_permission
        )
    )
$$;

-- 7. Define RLS Policies for tests
create policy tests_select_members
  on public.tests
  for select
  to authenticated
  using (
    public.current_user_can_access_test(
      tests.id,
      'tests.view'::text
    )
  );

create policy tests_insert_members
  on public.tests
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.batches
      where batches.id = tests.batch_id
        and batches.institute_id = tests.institute_id
        and batches.branch_id = tests.branch_id
        and public.current_user_can_access_test_batch(
          batches.id,
          'tests.create'::text
        )
    )
  );

create policy tests_update_members
  on public.tests
  for update
  to authenticated
  using (
    public.current_user_can_access_test(
      tests.id,
      'tests.update'::text
    )
  )
  with check (
    exists (
      select 1
      from public.batches
      where batches.id = tests.batch_id
        and batches.institute_id = tests.institute_id
        and batches.branch_id = tests.branch_id
        and public.current_user_can_access_test_batch(
          batches.id,
          'tests.update'::text
        )
    )
  );

create policy tests_delete_members
  on public.tests
  for delete
  to authenticated
  using (
    public.current_user_can_access_test(
      tests.id,
      'tests.delete'::text
    )
  );

-- 8. Define RLS Policies for test_scores
create policy test_scores_select_members
  on public.test_scores
  for select
  to authenticated
  using (
    public.current_user_can_access_test(
      test_scores.test_id,
      'tests.view'::text
    )
  );

create policy test_scores_insert_members
  on public.test_scores
  for insert
  to authenticated
  with check (
    public.current_user_can_access_test(
      test_scores.test_id,
      'tests.create'::text
    )
  );

create policy test_scores_update_members
  on public.test_scores
  for update
  to authenticated
  using (
    public.current_user_can_access_test(
      test_scores.test_id,
      'tests.update'::text
    )
  )
  with check (
    public.current_user_can_access_test(
      test_scores.test_id,
      'tests.update'::text
    )
  );

create policy test_scores_delete_members
  on public.test_scores
  for delete
  to authenticated
  using (
    public.current_user_can_access_test(
      test_scores.test_id,
      'tests.delete'::text
    )
  );

-- 9. Auto set updated_at triggers
create or replace function public.set_tests_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_tests_updated_at_trigger
  before update on public.tests
  for each row
  execute function public.set_tests_updated_at();

create or replace function public.set_test_scores_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_test_scores_updated_at_trigger
  before update on public.test_scores
  for each row
  execute function public.set_test_scores_updated_at();
