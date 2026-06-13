-- CoachOS Homework module.
-- Adds branch-scoped homework assignments without student/parent portals,
-- file uploads, external messaging, payment, PWA, or AI features.

create table if not exists public.homework_assignments (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  title text not null,
  description text,
  subject text,
  due_date date,
  status text not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.homework_assignments is
  'Homework assigned to batches. Access is branch-scoped, and teacher access is limited to assigned batches.';

alter table public.homework_assignments drop constraint if exists homework_assignments_status_check;
alter table public.homework_assignments
  add constraint homework_assignments_status_check
  check (status in ('active', 'completed', 'archived'));

create index if not exists homework_assignments_institute_id_idx
  on public.homework_assignments (institute_id);

create index if not exists homework_assignments_branch_id_idx
  on public.homework_assignments (branch_id);

create index if not exists homework_assignments_batch_id_idx
  on public.homework_assignments (batch_id);

create index if not exists homework_assignments_due_date_idx
  on public.homework_assignments (due_date);

create index if not exists homework_assignments_status_idx
  on public.homework_assignments (status);

create or replace function public.validate_homework_assignment_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_batch public.batches%rowtype;
begin
  select *
  into target_batch
  from public.batches
  where batches.id = new.batch_id;

  if target_batch.id is null then
    raise exception 'Homework assignment requires an existing batch.';
  end if;

  if new.institute_id <> target_batch.institute_id
    or new.branch_id <> target_batch.branch_id
  then
    raise exception 'Homework assignment branch must match its batch branch.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_homework_assignment_scope_trigger
  on public.homework_assignments;

create trigger validate_homework_assignment_scope_trigger
  before insert or update on public.homework_assignments
  for each row
  execute function public.validate_homework_assignment_scope();

create or replace function public.set_homework_assignment_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_homework_assignment_updated_at_trigger
  on public.homework_assignments;

create trigger set_homework_assignment_updated_at_trigger
  before update on public.homework_assignments
  for each row
  execute function public.set_homework_assignment_updated_at();

-- Refresh the membership permission map with Homework permissions.
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
      'notifications.update'
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
      'notifications.update'
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
      'notifications.update'
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
      'notifications.update'
    )
    else false
  end
$$;

create or replace function public.current_user_can_access_homework_batch(
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
            and required_permission in ('homework.view', 'homework.create', 'homework.update')
            and exists (
              select 1
              from public.batch_teachers
              where batch_teachers.batch_id = batches.id
                and batch_teachers.membership_id = memberships.id
            )
          )
          or (
            memberships.role <> 'teacher'
            and memberships.branch_id = batches.branch_id
          )
        )
    )
$$;

comment on function public.current_user_can_access_homework_batch(uuid, text) is
  'Checks Homework permissions for a batch. Teachers are limited to batches assigned through batch_teachers.';

create or replace function public.current_user_can_access_homework_assignment(
  target_homework_id uuid,
  required_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_homework_id is not null
    and required_permission is not null
    and exists (
      select 1
      from public.homework_assignments
      join public.batches
        on batches.id = homework_assignments.batch_id
      where homework_assignments.id = target_homework_id
        and homework_assignments.institute_id = batches.institute_id
        and homework_assignments.branch_id = batches.branch_id
        and public.current_user_can_access_homework_batch(
          batches.id,
          required_permission
        )
    )
$$;

comment on function public.current_user_can_access_homework_assignment(uuid, text) is
  'Checks Homework permissions for an assignment using branch scope and teacher batch assignment.';

alter table public.homework_assignments enable row level security;

drop policy if exists homework_assignments_select_members on public.homework_assignments;
drop policy if exists homework_assignments_insert_members on public.homework_assignments;
drop policy if exists homework_assignments_update_members on public.homework_assignments;
drop policy if exists homework_assignments_delete_members on public.homework_assignments;

create policy homework_assignments_select_members
  on public.homework_assignments
  for select
  to authenticated
  using (
    public.current_user_can_access_homework_assignment(
      homework_assignments.id,
      'homework.view'::text
    )
  );

create policy homework_assignments_insert_members
  on public.homework_assignments
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.batches
      where batches.id = homework_assignments.batch_id
        and batches.institute_id = homework_assignments.institute_id
        and batches.branch_id = homework_assignments.branch_id
        and public.current_user_can_access_homework_batch(
          batches.id,
          'homework.create'::text
        )
    )
  );

create policy homework_assignments_update_members
  on public.homework_assignments
  for update
  to authenticated
  using (
    public.current_user_can_access_homework_assignment(
      homework_assignments.id,
      'homework.update'::text
    )
  )
  with check (
    exists (
      select 1
      from public.batches
      where batches.id = homework_assignments.batch_id
        and batches.institute_id = homework_assignments.institute_id
        and batches.branch_id = homework_assignments.branch_id
        and public.current_user_can_access_homework_batch(
          batches.id,
          'homework.update'::text
        )
    )
  );

create policy homework_assignments_delete_members
  on public.homework_assignments
  for delete
  to authenticated
  using (
    public.current_user_can_access_homework_assignment(
      homework_assignments.id,
      'homework.delete'::text
    )
  );
