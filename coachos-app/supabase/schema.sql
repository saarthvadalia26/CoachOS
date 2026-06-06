-- CoachOS database schema.
-- Phase 1 foundation for multi-branch institutes and membership-based RBAC.
-- This intentionally does not add assignments, AI, parent communication,
-- reports, or payment gateway features.

create extension if not exists "pgcrypto";

-- Core tables
create table if not exists public.institutes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  institute_id uuid references public.institutes(id) on delete cascade,
  full_name text,
  role text default 'owner',
  created_at timestamptz default now()
);

comment on table public.profiles is
  'App identity rows. Dashboard permissions are authoritative in public.memberships; profiles.role is kept for MVP compatibility.';

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz default now()
);

comment on table public.branches is
  'Physical or operational centers under one institute.';

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean default false,
  created_at timestamptz default now()
);

comment on table public.academic_years is
  'Institute-level academic sessions used to group attendance and future reporting.';

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  institute_id uuid not null references public.institutes(id) on delete cascade,
  branch_id uuid,
  role text not null,
  created_at timestamptz default now()
);

comment on table public.memberships is
  'Authoritative RBAC table. Owners are institute-scoped; non-owner roles are branch-scoped.';

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid references public.institutes(id) on delete cascade,
  branch_id uuid,
  full_name text not null,
  phone text,
  parent_phone text,
  status text default 'active',
  created_at timestamptz default now()
);

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  branch_id uuid,
  name text not null,
  subject text,
  schedule text,
  created_at timestamptz default now()
);

create table if not exists public.student_batches (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  created_at timestamptz default now()
);

comment on table public.student_batches is
  'Join table connecting students to batches. A trigger enforces same-branch relationships.';

create table if not exists public.batch_teachers (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  created_at timestamptz default now()
);

comment on table public.batch_teachers is
  'Assigns teacher memberships to batches. Teacher access is view-only and batch-assigned.';

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  branch_id uuid,
  batch_id uuid not null references public.batches(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  session_date date not null,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'present',
  created_at timestamptz default now()
);

comment on table public.attendance_records is
  'Per-student attendance records. A trigger enforces that the student belongs to the session batch and branch.';

create table if not exists public.fee_records (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  branch_id uuid,
  student_id uuid not null references public.students(id) on delete cascade,
  amount_due numeric not null,
  amount_paid numeric not null default 0,
  due_date date,
  status text default 'pending',
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  branch_id uuid,
  auth_user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  role text not null default 'teacher',
  created_at timestamptz default now()
);

comment on table public.staff_members is
  'Owner-managed team directory. Linked auth users receive profiles and memberships.';
comment on column public.staff_members.role is
  'Legacy staff is accepted for MVP compatibility and maps to accountant membership.';

-- Existing database compatibility: add Phase 1 columns if this is run over an
-- MVP database.
alter table public.students add column if not exists branch_id uuid;
alter table public.batches add column if not exists branch_id uuid;
alter table public.attendance_sessions add column if not exists branch_id uuid;
alter table public.attendance_sessions add column if not exists academic_year_id uuid;
alter table public.fee_records add column if not exists branch_id uuid;
alter table public.staff_members add column if not exists branch_id uuid;

-- Preflight validation before strict constraints, unique indexes, and required
-- branch_id changes.
--
-- Cleanup guidance:
-- - Orphan rows: attach them to the correct institute, or deliberately delete
--   invalid rows before rerunning.
-- - Duplicate joins: keep one row for each expected unique pair and delete the
--   extras.
-- - Duplicate branch/staff/session records: rename, merge, or delete extras so
--   later unique indexes can be created cleanly.
-- - Invalid roles: map old staff to accountant, or choose one supported role.
-- - Invalid branch references: update branch_id to a branch in the same
--   institute, or set branch_id to null so Main Branch backfill can repair it.
-- - Cross-branch relationships: move the student/batch/session/fee to the
--   correct branch, or remove the invalid relationship.
do $$
begin
  if exists (select 1 from public.students where institute_id is null) then
    raise exception 'Preflight failed: students has rows with null institute_id.';
  end if;

  if exists (select 1 from public.batches where institute_id is null) then
    raise exception 'Preflight failed: batches has rows with null institute_id.';
  end if;

  if exists (select 1 from public.attendance_sessions where institute_id is null) then
    raise exception 'Preflight failed: attendance_sessions has rows with null institute_id.';
  end if;

  if exists (select 1 from public.fee_records where institute_id is null) then
    raise exception 'Preflight failed: fee_records has rows with null institute_id.';
  end if;

  if exists (
    select 1
    from public.staff_members
    where institute_id is null
      and coalesce(role, 'teacher') <> 'owner'
  ) then
    raise exception 'Preflight failed: staff_members has non-owner rows with null institute_id.';
  end if;

  if exists (
    select 1
    from public.profiles
    where role is not null
      and role not in (
        'owner',
        'branch_manager',
        'operations_staff',
        'accountant',
        'academic_coordinator',
        'teacher',
        'staff'
      )
  ) then
    raise exception 'Preflight failed: profiles has unsupported role values.';
  end if;

  if exists (
    select 1
    from public.staff_members
    where role not in (
      'owner',
      'branch_manager',
      'operations_staff',
      'accountant',
      'academic_coordinator',
      'teacher',
      'staff'
    )
  ) then
    raise exception 'Preflight failed: staff_members has unsupported role values.';
  end if;

  if exists (
    select 1
    from public.memberships
    where role not in (
      'owner',
      'branch_manager',
      'operations_staff',
      'accountant',
      'academic_coordinator',
      'teacher'
    )
  ) then
    raise exception 'Preflight failed: memberships has unsupported role values.';
  end if;

  if exists (
    select 1
    from public.memberships
    where role = 'owner'
      and branch_id is not null
  ) then
    raise exception 'Preflight failed: owner memberships must be institute-scoped with null branch_id.';
  end if;

  if exists (
    select 1
    from public.memberships
    where role <> 'owner'
      and branch_id is null
  ) then
    raise exception 'Preflight failed: non-owner memberships must have branch_id before role-scope constraints are applied.';
  end if;

  if exists (
    select 1
    from public.students
    where branch_id is not null
      and not exists (
        select 1
        from public.branches
        where branches.id = students.branch_id
          and branches.institute_id = students.institute_id
      )
  ) then
    raise exception 'Preflight failed: students has branch_id values outside the row institute.';
  end if;

  if exists (
    select 1
    from public.batches
    where branch_id is not null
      and not exists (
        select 1
        from public.branches
        where branches.id = batches.branch_id
          and branches.institute_id = batches.institute_id
      )
  ) then
    raise exception 'Preflight failed: batches has branch_id values outside the row institute.';
  end if;

  if exists (
    select 1
    from public.attendance_sessions
    where branch_id is not null
      and not exists (
        select 1
        from public.branches
        where branches.id = attendance_sessions.branch_id
          and branches.institute_id = attendance_sessions.institute_id
      )
  ) then
    raise exception 'Preflight failed: attendance_sessions has branch_id values outside the row institute.';
  end if;

  if exists (
    select 1
    from public.fee_records
    where branch_id is not null
      and not exists (
        select 1
        from public.branches
        where branches.id = fee_records.branch_id
          and branches.institute_id = fee_records.institute_id
      )
  ) then
    raise exception 'Preflight failed: fee_records has branch_id values outside the row institute.';
  end if;

  if exists (
    select 1
    from public.staff_members
    where branch_id is not null
      and not exists (
        select 1
        from public.branches
        where branches.id = staff_members.branch_id
          and branches.institute_id = staff_members.institute_id
      )
  ) then
    raise exception 'Preflight failed: staff_members has branch_id values outside the row institute.';
  end if;

  if exists (
    select 1
    from public.memberships
    where branch_id is not null
      and not exists (
        select 1
        from public.branches
        where branches.id = memberships.branch_id
          and branches.institute_id = memberships.institute_id
      )
  ) then
    raise exception 'Preflight failed: memberships has branch_id values outside the row institute.';
  end if;

  if exists (
    select 1
    from public.academic_years
    where institute_id is null
  ) then
    raise exception 'Preflight failed: academic_years has rows with null institute_id.';
  end if;

  if exists (
    select 1
    from public.academic_years
    where start_date >= end_date
  ) then
    raise exception 'Preflight failed: academic_years has rows where start_date is not before end_date.';
  end if;

  if exists (
    select 1
    from (
      select institute_id, lower(name)
      from public.academic_years
      group by institute_id, lower(name)
      having count(*) > 1
    ) duplicate_academic_year_names
  ) then
    raise exception 'Preflight failed: duplicate academic_years names exist within an institute. Rename duplicates before creating the unique index.';
  end if;

  if exists (
    select 1
    from (
      select institute_id
      from public.academic_years
      where is_active
      group by institute_id
      having count(*) > 1
    ) duplicate_active_academic_years
  ) then
    raise exception 'Preflight failed: more than one active academic year exists for an institute.';
  end if;

  if exists (
    select 1
    from public.attendance_sessions
    where academic_year_id is not null
      and not exists (
        select 1
        from public.academic_years
        where academic_years.id = attendance_sessions.academic_year_id
          and academic_years.institute_id = attendance_sessions.institute_id
          and attendance_sessions.session_date between academic_years.start_date and academic_years.end_date
      )
  ) then
    raise exception 'Preflight failed: attendance_sessions has academic_year_id values outside the session institute or date range.';
  end if;

  if exists (
    select 1
    from (
      select institute_id, lower(name) as normalized_name
      from public.branches
      group by institute_id, lower(name)
      having count(*) > 1
    ) duplicate_branch_names
  ) then
    raise exception 'Preflight failed: duplicate branch names exist within an institute.';
  end if;

  if exists (
    select 1
    from (
      select user_id, institute_id
      from public.memberships
      where branch_id is null
      group by user_id, institute_id
      having count(*) > 1
    ) duplicate_institute_memberships
  ) then
    raise exception 'Preflight failed: duplicate institute-scoped memberships exist.';
  end if;

  if exists (
    select 1
    from (
      select user_id, branch_id
      from public.memberships
      where branch_id is not null
      group by user_id, branch_id
      having count(*) > 1
    ) duplicate_branch_memberships
  ) then
    raise exception 'Preflight failed: duplicate branch-scoped memberships exist.';
  end if;

  if exists (
    select 1
    from (
      select student_id, batch_id
      from public.student_batches
      group by student_id, batch_id
      having count(*) > 1
    ) duplicate_student_batches
  ) then
    raise exception 'Preflight failed: duplicate student_batches student_id/batch_id pairs exist.';
  end if;

  if exists (
    select 1
    from (
      select batch_id, session_date
      from public.attendance_sessions
      group by batch_id, session_date
      having count(*) > 1
    ) duplicate_attendance_sessions
  ) then
    raise exception 'Preflight failed: duplicate attendance_sessions batch_id/session_date pairs exist.';
  end if;

  if exists (
    select 1
    from (
      select session_id, student_id
      from public.attendance_records
      group by session_id, student_id
      having count(*) > 1
    ) duplicate_attendance_records
  ) then
    raise exception 'Preflight failed: duplicate attendance_records session_id/student_id pairs exist.';
  end if;

  if exists (
    select 1
    from (
      select batch_id, membership_id
      from public.batch_teachers
      group by batch_id, membership_id
      having count(*) > 1
    ) duplicate_batch_teachers
  ) then
    raise exception 'Preflight failed: duplicate batch_teachers batch_id/membership_id pairs exist.';
  end if;

  if exists (
    select 1
    from (
      select institute_id, lower(email) as normalized_email
      from public.staff_members
      group by institute_id, lower(email)
      having count(*) > 1
    ) duplicate_staff_emails
  ) then
    raise exception 'Preflight failed: duplicate staff member emails exist within an institute.';
  end if;
end $$;

-- Check constraints
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (
    role in (
      'owner',
      'branch_manager',
      'operations_staff',
      'accountant',
      'academic_coordinator',
      'teacher',
      'staff'
    )
  );

alter table public.memberships drop constraint if exists memberships_role_check;
alter table public.memberships
  add constraint memberships_role_check
  check (
    role in (
      'owner',
      'branch_manager',
      'operations_staff',
      'accountant',
      'academic_coordinator',
      'teacher'
    )
  );

alter table public.memberships drop constraint if exists memberships_scope_check;
alter table public.memberships
  add constraint memberships_scope_check
  check (
    (role = 'owner' and branch_id is null)
    or (role <> 'owner' and branch_id is not null)
  );

alter table public.students drop constraint if exists students_status_check;
alter table public.students
  add constraint students_status_check
  check (status in ('active', 'inactive'));

alter table public.academic_years drop constraint if exists academic_years_date_range_check;
alter table public.academic_years
  add constraint academic_years_date_range_check
  check (start_date < end_date);

alter table public.attendance_records drop constraint if exists attendance_records_status_check;
alter table public.attendance_records
  add constraint attendance_records_status_check
  check (status in ('present', 'absent', 'late'));

alter table public.fee_records drop constraint if exists fee_records_amount_due_check;
alter table public.fee_records
  add constraint fee_records_amount_due_check
  check (amount_due >= 0);

alter table public.fee_records drop constraint if exists fee_records_amount_paid_check;
alter table public.fee_records
  add constraint fee_records_amount_paid_check
  check (amount_paid >= 0);

alter table public.fee_records drop constraint if exists fee_records_amount_paid_lte_due_check;
alter table public.fee_records
  add constraint fee_records_amount_paid_lte_due_check
  check (amount_paid <= amount_due);

alter table public.fee_records drop constraint if exists fee_records_status_check;
alter table public.fee_records
  add constraint fee_records_status_check
  check (status in ('pending', 'paid', 'overdue'));

alter table public.staff_members drop constraint if exists staff_members_role_check;
alter table public.staff_members
  add constraint staff_members_role_check
  check (
    role in (
      'owner',
      'branch_manager',
      'operations_staff',
      'accountant',
      'academic_coordinator',
      'teacher',
      'staff'
    )
  );

-- Indexes
create index if not exists institutes_owner_id_idx
  on public.institutes (owner_id);

create index if not exists profiles_institute_id_idx
  on public.profiles (institute_id);

create index if not exists profiles_role_idx
  on public.profiles (role);

create index if not exists branches_institute_id_idx
  on public.branches (institute_id);

create unique index if not exists branches_institute_id_lower_name_idx
  on public.branches (institute_id, lower(name));

create index if not exists academic_years_institute_id_idx
  on public.academic_years (institute_id);

create index if not exists academic_years_institute_id_dates_idx
  on public.academic_years (institute_id, start_date, end_date);

create unique index if not exists academic_years_institute_id_lower_name_idx
  on public.academic_years (institute_id, lower(name));

create unique index if not exists academic_years_one_active_per_institute_idx
  on public.academic_years (institute_id)
  where is_active;

create index if not exists memberships_user_id_idx
  on public.memberships (user_id);

create index if not exists memberships_institute_id_idx
  on public.memberships (institute_id);

create index if not exists memberships_branch_id_idx
  on public.memberships (branch_id);

create unique index if not exists memberships_owner_user_institute_idx
  on public.memberships (user_id, institute_id)
  where branch_id is null;

create unique index if not exists memberships_user_branch_idx
  on public.memberships (user_id, branch_id)
  where branch_id is not null;

create index if not exists students_institute_id_idx
  on public.students (institute_id);

create index if not exists students_branch_id_idx
  on public.students (branch_id);

create index if not exists batches_institute_id_idx
  on public.batches (institute_id);

create index if not exists batches_branch_id_idx
  on public.batches (branch_id);

create index if not exists student_batches_student_id_idx
  on public.student_batches (student_id);

create index if not exists student_batches_batch_id_idx
  on public.student_batches (batch_id);

create unique index if not exists student_batches_student_id_batch_id_idx
  on public.student_batches (student_id, batch_id);

create index if not exists batch_teachers_batch_id_idx
  on public.batch_teachers (batch_id);

create index if not exists batch_teachers_membership_id_idx
  on public.batch_teachers (membership_id);

create unique index if not exists batch_teachers_batch_id_membership_id_idx
  on public.batch_teachers (batch_id, membership_id);

create index if not exists attendance_sessions_institute_id_idx
  on public.attendance_sessions (institute_id);

create index if not exists attendance_sessions_branch_id_idx
  on public.attendance_sessions (branch_id);

create index if not exists attendance_sessions_batch_id_idx
  on public.attendance_sessions (batch_id);

create index if not exists attendance_sessions_academic_year_id_idx
  on public.attendance_sessions (academic_year_id);

create unique index if not exists attendance_sessions_batch_id_session_date_idx
  on public.attendance_sessions (batch_id, session_date);

create index if not exists attendance_records_session_id_idx
  on public.attendance_records (session_id);

create index if not exists attendance_records_student_id_idx
  on public.attendance_records (student_id);

create unique index if not exists attendance_records_session_id_student_id_idx
  on public.attendance_records (session_id, student_id);

create index if not exists fee_records_institute_id_idx
  on public.fee_records (institute_id);

create index if not exists fee_records_branch_id_idx
  on public.fee_records (branch_id);

create index if not exists fee_records_student_id_idx
  on public.fee_records (student_id);

create index if not exists fee_records_due_date_idx
  on public.fee_records (due_date);

create index if not exists staff_members_institute_id_idx
  on public.staff_members (institute_id);

create index if not exists staff_members_branch_id_idx
  on public.staff_members (branch_id);

create index if not exists staff_members_auth_user_id_idx
  on public.staff_members (auth_user_id);

drop index if exists public.staff_members_auth_user_id_unique_idx;

create unique index if not exists staff_members_auth_user_id_institute_id_idx
  on public.staff_members (auth_user_id, institute_id)
  where auth_user_id is not null;

create unique index if not exists staff_members_institute_id_email_idx
  on public.staff_members (institute_id, lower(email));

-- Role normalization helpers.
create or replace function public.normalize_membership_role(input_role text)
returns text
language sql
immutable
set search_path = public
as $$
  select case input_role
    when 'owner' then 'owner'
    when 'branch_manager' then 'branch_manager'
    when 'operations_staff' then 'operations_staff'
    when 'accountant' then 'accountant'
    when 'academic_coordinator' then 'academic_coordinator'
    when 'teacher' then 'teacher'
    when 'staff' then 'accountant'
    else 'teacher'
  end
$$;

create or replace function public.profile_role_for_membership(input_role text)
returns text
language sql
immutable
set search_path = public
as $$
  select case public.normalize_membership_role(input_role)
    when 'owner' then 'owner'
    when 'teacher' then 'teacher'
    else 'staff'
  end
$$;

-- Every institute needs a branch before operational rows can be required to
-- carry branch_id. This helper is used by migration backfill and compatibility
-- triggers while frontend forms are made branch-aware in later phases.
create or replace function public.get_or_create_main_branch(target_institute_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_branch_id uuid;
begin
  if target_institute_id is null then
    return null;
  end if;

  select branches.id
  into target_branch_id
  from public.branches
  where branches.institute_id = target_institute_id
  order by (branches.name = 'Main Branch') desc,
           branches.created_at asc,
           branches.id asc
  limit 1;

  if target_branch_id is not null then
    return target_branch_id;
  end if;

  insert into public.branches (institute_id, name)
  values (target_institute_id, 'Main Branch')
  on conflict do nothing;

  select branches.id
  into target_branch_id
  from public.branches
  where branches.institute_id = target_institute_id
  order by (branches.name = 'Main Branch') desc,
           branches.created_at asc,
           branches.id asc
  limit 1;

  return target_branch_id;
end;
$$;

-- Create one Main Branch per existing institute.
do $$
declare
  institute_record record;
begin
  for institute_record in
    select institutes.id from public.institutes
  loop
    perform public.get_or_create_main_branch(institute_record.id);
  end loop;
end $$;

-- Backfill existing operational rows.
update public.students
set branch_id = public.get_or_create_main_branch(students.institute_id)
where branch_id is null
  and institute_id is not null;

update public.batches
set branch_id = public.get_or_create_main_branch(batches.institute_id)
where branch_id is null
  and institute_id is not null;

update public.attendance_sessions
set branch_id = batches.branch_id
from public.batches
where attendance_sessions.batch_id = batches.id
  and attendance_sessions.branch_id is null;

update public.attendance_sessions
set branch_id = public.get_or_create_main_branch(attendance_sessions.institute_id)
where branch_id is null
  and institute_id is not null;

update public.fee_records
set branch_id = students.branch_id
from public.students
where fee_records.student_id = students.id
  and fee_records.branch_id is null;

update public.fee_records
set branch_id = public.get_or_create_main_branch(fee_records.institute_id)
where branch_id is null
  and institute_id is not null;

update public.staff_members
set branch_id = public.get_or_create_main_branch(staff_members.institute_id)
where branch_id is null
  and institute_id is not null
  and public.normalize_membership_role(role) <> 'owner';

-- Post-backfill branch integrity preflight. These checks catch relationships
-- that normal single-column foreign keys cannot express.
--
-- Expected errors:
-- - student_batches connects a student to a batch in another branch.
-- - attendance_records connects a student to a session in another branch.
-- - attendance_records points at a student who is not assigned to the session batch.
-- - fee_records points at a student whose branch differs from fee_records.
-- Fix by moving one side to the correct branch or deleting the invalid join.
do $$
begin
  if exists (
    select 1
    from public.student_batches
    join public.students
      on students.id = student_batches.student_id
    join public.batches
      on batches.id = student_batches.batch_id
    where students.institute_id is distinct from batches.institute_id
       or students.branch_id is distinct from batches.branch_id
  ) then
    raise exception 'Preflight failed: student_batches contains cross-branch or cross-institute relationships.';
  end if;

  if exists (
    select 1
    from public.attendance_sessions
    join public.batches
      on batches.id = attendance_sessions.batch_id
    where attendance_sessions.institute_id is distinct from batches.institute_id
       or attendance_sessions.branch_id is distinct from batches.branch_id
  ) then
    raise exception 'Preflight failed: attendance_sessions contains branch values that do not match the linked batch.';
  end if;

  if exists (
    select 1
    from public.attendance_records
    join public.attendance_sessions
      on attendance_sessions.id = attendance_records.session_id
    join public.students
      on students.id = attendance_records.student_id
    where students.institute_id is distinct from attendance_sessions.institute_id
       or students.branch_id is distinct from attendance_sessions.branch_id
  ) then
    raise exception 'Preflight failed: attendance_records contains students whose branch does not match the attendance session.';
  end if;

  if exists (
    select 1
    from public.attendance_records
    join public.attendance_sessions
      on attendance_sessions.id = attendance_records.session_id
    where not exists (
      select 1
      from public.student_batches
      where student_batches.batch_id = attendance_sessions.batch_id
        and student_batches.student_id = attendance_records.student_id
    )
  ) then
    raise exception 'Preflight failed: attendance_records contains students who are not assigned to the attendance session batch.';
  end if;

  if exists (
    select 1
    from public.fee_records
    join public.students
      on students.id = fee_records.student_id
    where students.institute_id is distinct from fee_records.institute_id
       or students.branch_id is distinct from fee_records.branch_id
  ) then
    raise exception 'Preflight failed: fee_records contains students whose branch does not match the fee record.';
  end if;
end $$;

-- Backfill memberships from existing owner/profile/staff data.
insert into public.memberships (user_id, institute_id, branch_id, role)
select institutes.owner_id,
       institutes.id,
       null,
       'owner'
from public.institutes
where institutes.owner_id is not null
on conflict do nothing;

insert into public.memberships (user_id, institute_id, branch_id, role)
select staff_members.auth_user_id,
       staff_members.institute_id,
       case
         when public.normalize_membership_role(staff_members.role) = 'owner'
           then null
         else coalesce(
           staff_members.branch_id,
           public.get_or_create_main_branch(staff_members.institute_id)
         )
       end,
       public.normalize_membership_role(staff_members.role)
from public.staff_members
where staff_members.auth_user_id is not null
  and staff_members.institute_id is not null
on conflict do nothing;

insert into public.memberships (user_id, institute_id, branch_id, role)
select profiles.id,
       profiles.institute_id,
       case
         when public.normalize_membership_role(profiles.role) = 'owner'
           then null
         else public.get_or_create_main_branch(profiles.institute_id)
       end,
       public.normalize_membership_role(profiles.role)
from public.profiles
left join public.institutes
  on institutes.id = profiles.institute_id
where profiles.institute_id is not null
  and profiles.role is not null
  and (
    public.normalize_membership_role(profiles.role) <> 'owner'
    or profiles.id = institutes.owner_id
  )
on conflict do nothing;

-- Require branch_id only after preflight and backfill have succeeded.
do $$
begin
  if exists (select 1 from public.students where branch_id is null) then
    raise exception 'Cannot require students.branch_id: at least one student has no branch after backfill.';
  end if;

  if exists (select 1 from public.batches where branch_id is null) then
    raise exception 'Cannot require batches.branch_id: at least one batch has no branch after backfill.';
  end if;

  if exists (select 1 from public.attendance_sessions where branch_id is null) then
    raise exception 'Cannot require attendance_sessions.branch_id: at least one attendance session has no branch after backfill.';
  end if;

  if exists (select 1 from public.fee_records where branch_id is null) then
    raise exception 'Cannot require fee_records.branch_id: at least one fee record has no branch after backfill.';
  end if;
end $$;

alter table public.students alter column branch_id set not null;
alter table public.batches alter column branch_id set not null;
alter table public.attendance_sessions alter column branch_id set not null;
alter table public.fee_records alter column branch_id set not null;

-- Branch foreign keys are added after backfill so existing MVP data can be
-- repaired before enforcement.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'memberships_branch_id_fk'
      and conrelid = 'public.memberships'::regclass
  ) then
    alter table public.memberships
      add constraint memberships_branch_id_fk
      foreign key (branch_id) references public.branches(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'students_branch_id_fk'
      and conrelid = 'public.students'::regclass
  ) then
    alter table public.students
      add constraint students_branch_id_fk
      foreign key (branch_id) references public.branches(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'batches_branch_id_fk'
      and conrelid = 'public.batches'::regclass
  ) then
    alter table public.batches
      add constraint batches_branch_id_fk
      foreign key (branch_id) references public.branches(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'attendance_sessions_branch_id_fk'
      and conrelid = 'public.attendance_sessions'::regclass
  ) then
    alter table public.attendance_sessions
      add constraint attendance_sessions_branch_id_fk
      foreign key (branch_id) references public.branches(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'attendance_sessions_academic_year_id_fk'
      and conrelid = 'public.attendance_sessions'::regclass
  ) then
    alter table public.attendance_sessions
      add constraint attendance_sessions_academic_year_id_fk
      foreign key (academic_year_id) references public.academic_years(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'fee_records_branch_id_fk'
      and conrelid = 'public.fee_records'::regclass
  ) then
    alter table public.fee_records
      add constraint fee_records_branch_id_fk
      foreign key (branch_id) references public.branches(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'staff_members_branch_id_fk'
      and conrelid = 'public.staff_members'::regclass
  ) then
    alter table public.staff_members
      add constraint staff_members_branch_id_fk
      foreign key (branch_id) references public.branches(id) on delete set null;
  end if;
end $$;

-- Compatibility trigger: creating a new institute from the current onboarding
-- flow also creates Main Branch and owner membership.
create or replace function public.ensure_institute_foundation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.get_or_create_main_branch(new.id);

  insert into public.memberships (user_id, institute_id, branch_id, role)
  values (new.owner_id, new.id, null, 'owner')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists ensure_institute_foundation_trigger on public.institutes;

create trigger ensure_institute_foundation_trigger
  after insert on public.institutes
  for each row
  execute function public.ensure_institute_foundation();

create or replace function public.set_student_branch_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.branch_id is null then
    new.branch_id := public.get_or_create_main_branch(new.institute_id);
  end if;

  if not exists (
    select 1
    from public.branches
    where branches.id = new.branch_id
      and branches.institute_id = new.institute_id
  ) then
    raise exception 'Student branch must belong to the same institute.';
  end if;

  return new;
end;
$$;

drop trigger if exists set_student_branch_id_trigger on public.students;

create trigger set_student_branch_id_trigger
  before insert or update on public.students
  for each row
  execute function public.set_student_branch_id();

create or replace function public.set_batch_branch_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.branch_id is null then
    new.branch_id := public.get_or_create_main_branch(new.institute_id);
  end if;

  if not exists (
    select 1
    from public.branches
    where branches.id = new.branch_id
      and branches.institute_id = new.institute_id
  ) then
    raise exception 'Batch branch must belong to the same institute.';
  end if;

  return new;
end;
$$;

drop trigger if exists set_batch_branch_id_trigger on public.batches;

create trigger set_batch_branch_id_trigger
  before insert or update on public.batches
  for each row
  execute function public.set_batch_branch_id();

-- Branch integrity matters because row-level security is branch-scoped. This
-- trigger prevents a student from being joined to a batch in another branch.
-- Invalid writes raise: Student and batch must belong to the same branch.
create or replace function public.validate_student_batch_branch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  student_institute_id uuid;
  student_branch_id uuid;
  batch_institute_id uuid;
  batch_branch_id uuid;
begin
  select students.institute_id, students.branch_id
  into student_institute_id, student_branch_id
  from public.students
  where students.id = new.student_id;

  select batches.institute_id, batches.branch_id
  into batch_institute_id, batch_branch_id
  from public.batches
  where batches.id = new.batch_id;

  if student_institute_id is null or batch_institute_id is null then
    raise exception 'Student-batch relationship requires an existing student and batch.';
  end if;

  if student_institute_id <> batch_institute_id
    or student_branch_id <> batch_branch_id
  then
    raise exception 'Student and batch must belong to the same branch.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_student_batch_branch_trigger on public.student_batches;

create trigger validate_student_batch_branch_trigger
  before insert or update on public.student_batches
  for each row
  execute function public.validate_student_batch_branch();

create or replace function public.set_attendance_session_branch_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  batch_institute_id uuid;
  batch_branch_id uuid;
begin
  select batches.institute_id, batches.branch_id
  into batch_institute_id, batch_branch_id
  from public.batches
  where batches.id = new.batch_id;

  if batch_institute_id is null then
    raise exception 'Attendance session batch does not exist.';
  end if;

  if new.branch_id is null then
    new.branch_id := batch_branch_id;
  end if;

  if new.institute_id <> batch_institute_id
    or new.branch_id <> batch_branch_id
  then
    raise exception 'Attendance session branch must match its batch branch.';
  end if;

  return new;
end;
$$;

drop trigger if exists set_attendance_session_branch_id_trigger on public.attendance_sessions;

create trigger set_attendance_session_branch_id_trigger
  before insert or update on public.attendance_sessions
  for each row
  execute function public.set_attendance_session_branch_id();

-- Academic year integrity is institute-scoped. New attendance sessions are
-- automatically linked to the active academic year when the session date falls
-- inside its date range. If an explicit academic_year_id is supplied, it must
-- belong to the same institute and contain the session date.
create or replace function public.set_attendance_session_academic_year_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_academic_year_id uuid;
begin
  if new.academic_year_id is null then
    select academic_years.id
    into active_academic_year_id
    from public.academic_years
    where academic_years.institute_id = new.institute_id
      and academic_years.is_active
      and new.session_date between academic_years.start_date and academic_years.end_date
    limit 1;

    new.academic_year_id := active_academic_year_id;
  elsif not exists (
    select 1
    from public.academic_years
    where academic_years.id = new.academic_year_id
      and academic_years.institute_id = new.institute_id
      and new.session_date between academic_years.start_date and academic_years.end_date
  ) then
    raise exception 'Attendance session academic year must belong to the same institute and contain the session date.';
  end if;

  return new;
end;
$$;

drop trigger if exists set_attendance_session_academic_year_id_trigger on public.attendance_sessions;

create trigger set_attendance_session_academic_year_id_trigger
  before insert or update on public.attendance_sessions
  for each row
  execute function public.set_attendance_session_academic_year_id();

create or replace function public.validate_academic_year_attendance_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.attendance_sessions
    where attendance_sessions.academic_year_id = new.id
      and (
        attendance_sessions.institute_id <> new.institute_id
        or attendance_sessions.session_date not between new.start_date and new.end_date
      )
  ) then
    raise exception 'Academic year dates must contain all linked attendance sessions.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_academic_year_attendance_links_trigger on public.academic_years;

create trigger validate_academic_year_attendance_links_trigger
  before update on public.academic_years
  for each row
  execute function public.validate_academic_year_attendance_links();

create or replace function public.prevent_academic_year_delete_with_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.attendance_sessions
    where attendance_sessions.academic_year_id = old.id
  ) then
    raise exception 'This academic year has attendance records and cannot be deleted.';
  end if;

  return old;
end;
$$;

drop trigger if exists prevent_academic_year_delete_with_attendance_trigger on public.academic_years;

create trigger prevent_academic_year_delete_with_attendance_trigger
  before delete on public.academic_years
  for each row
  execute function public.prevent_academic_year_delete_with_attendance();

-- Branch integrity matters for attendance because a session represents one
-- branch-scoped batch. This trigger prevents recording attendance for a student
-- outside the session batch or branch. Invalid writes raise one of:
-- - Attendance record student branch must match the attendance session branch.
-- - Attendance record student must be assigned to the attendance session batch.
create or replace function public.validate_attendance_record_branch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  session_batch_id uuid;
  session_institute_id uuid;
  session_branch_id uuid;
  student_institute_id uuid;
  student_branch_id uuid;
begin
  select attendance_sessions.institute_id,
         attendance_sessions.branch_id,
         attendance_sessions.batch_id
  into session_institute_id,
       session_branch_id,
       session_batch_id
  from public.attendance_sessions
  where attendance_sessions.id = new.session_id;

  select students.institute_id, students.branch_id
  into student_institute_id, student_branch_id
  from public.students
  where students.id = new.student_id;

  if session_institute_id is null or student_institute_id is null then
    raise exception 'Attendance record requires an existing session and student.';
  end if;

  if session_institute_id <> student_institute_id
    or session_branch_id <> student_branch_id
  then
    raise exception 'Attendance record student branch must match the attendance session branch.';
  end if;

  if not exists (
    select 1
    from public.student_batches
    where student_batches.batch_id = session_batch_id
      and student_batches.student_id = new.student_id
  ) then
    raise exception 'Attendance record student must be assigned to the attendance session batch.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_attendance_record_branch_trigger on public.attendance_records;

create trigger validate_attendance_record_branch_trigger
  before insert or update on public.attendance_records
  for each row
  execute function public.validate_attendance_record_branch();

-- Fee branch integrity protects branch-scoped financial access. This trigger
-- sets missing branch_id from the student and prevents moving a fee record to a
-- different branch than its student. Invalid writes raise: Fee record branch
-- must match its student branch.
create or replace function public.set_fee_record_branch_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  student_institute_id uuid;
  student_branch_id uuid;
begin
  select students.institute_id, students.branch_id
  into student_institute_id, student_branch_id
  from public.students
  where students.id = new.student_id;

  if student_institute_id is null then
    raise exception 'Fee record student does not exist.';
  end if;

  if new.branch_id is null then
    new.branch_id := student_branch_id;
  end if;

  if new.institute_id <> student_institute_id
    or new.branch_id <> student_branch_id
  then
    raise exception 'Fee record branch must match its student branch.';
  end if;

  return new;
end;
$$;

drop trigger if exists set_fee_record_branch_id_trigger on public.fee_records;

create trigger set_fee_record_branch_id_trigger
  before insert or update on public.fee_records
  for each row
  execute function public.set_fee_record_branch_id();

create or replace function public.set_staff_member_branch_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.normalize_membership_role(new.role) = 'owner' then
    new.branch_id := null;
  elsif new.branch_id is null then
    new.branch_id := public.get_or_create_main_branch(new.institute_id);
  end if;

  if new.branch_id is not null
    and not exists (
      select 1
      from public.branches
      where branches.id = new.branch_id
        and branches.institute_id = new.institute_id
    )
  then
    raise exception 'Staff branch must belong to the same institute.';
  end if;

  return new;
end;
$$;

drop trigger if exists set_staff_member_branch_id_trigger on public.staff_members;

create trigger set_staff_member_branch_id_trigger
  before insert or update on public.staff_members
  for each row
  execute function public.set_staff_member_branch_id();

create or replace function public.validate_batch_teacher_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_batch public.batches%rowtype;
  target_membership public.memberships%rowtype;
begin
  select *
  into target_batch
  from public.batches
  where batches.id = new.batch_id;

  select *
  into target_membership
  from public.memberships
  where memberships.id = new.membership_id;

  if target_batch.id is null or target_membership.id is null then
    raise exception 'Batch teacher assignment requires an existing batch and membership.';
  end if;

  if target_membership.role <> 'teacher' then
    raise exception 'Only teacher memberships can be assigned to batches.';
  end if;

  if target_membership.institute_id <> target_batch.institute_id
    or target_membership.branch_id <> target_batch.branch_id
  then
    raise exception 'Teacher membership must belong to the same branch as the batch.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_batch_teacher_assignment_trigger on public.batch_teachers;

create trigger validate_batch_teacher_assignment_trigger
  before insert or update on public.batch_teachers
  for each row
  execute function public.validate_batch_teacher_assignment();

-- Staff account linking. Staff records start pending with auth_user_id = null.
-- When an authenticated user signs in with the same email, this security
-- definer function atomically claims exactly one pending staff row, creates the
-- compatibility profile, and creates the authoritative membership.
--
-- Expected return values:
-- - linked: profile and membership are ready for dashboard access.
-- - no_match: no pending staff row exists for the authenticated email.
-- - ambiguous: more than one pending staff row uses this email, so the app must
--   not silently choose an institute.
-- - profile_conflict/already_claimed/failed: safe failure states shown as
--   generic user-facing messages in the app.
create or replace function public.claim_staff_member_profile_result()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  existing_profile_institute_id uuid;
  email_match_count integer;
  matched_staff public.staff_members%rowtype;
  target_role text;
  target_branch_id uuid;
begin
  if current_user_id is null then
    return 'unauthenticated';
  end if;

  if current_email is null then
    return 'no_match';
  end if;

  select *
  into matched_staff
  from public.staff_members
  where staff_members.auth_user_id = current_user_id
    and lower(staff_members.email) = current_email
  order by staff_members.created_at asc
  limit 1;

  if not found then
    select count(*)
    into email_match_count
    from public.staff_members
    where lower(staff_members.email) = current_email;

    if email_match_count = 0 then
      return 'no_match';
    end if;

    if email_match_count > 1 then
      return 'ambiguous';
    end if;

    select *
    into matched_staff
    from public.staff_members
    where staff_members.auth_user_id is null
      and lower(staff_members.email) = current_email
    order by staff_members.created_at asc
    limit 1;

    if not found then
      return 'already_claimed';
    end if;
  end if;

  if not found then
    return 'no_match';
  end if;

  select profiles.institute_id
  into existing_profile_institute_id
  from public.profiles
  where profiles.id = current_user_id;

  if existing_profile_institute_id is not null
    and existing_profile_institute_id <> matched_staff.institute_id
  then
    return 'profile_conflict';
  end if;

  if matched_staff.auth_user_id is null then
    update public.staff_members
    set auth_user_id = current_user_id
    where staff_members.id = matched_staff.id
      and staff_members.auth_user_id is null
      and lower(staff_members.email) = current_email;

    if not found then
      return 'already_claimed';
    end if;
  elsif matched_staff.auth_user_id <> current_user_id then
    return 'already_claimed';
  end if;

  target_role := public.normalize_membership_role(matched_staff.role);
  target_branch_id := case
    when target_role = 'owner' then null
    else coalesce(
      matched_staff.branch_id,
      public.get_or_create_main_branch(matched_staff.institute_id)
    )
  end;

  insert into public.profiles (id, institute_id, full_name, role)
  values (
    current_user_id,
    matched_staff.institute_id,
    matched_staff.full_name,
    public.profile_role_for_membership(target_role)
  )
  on conflict (id) do update
    set institute_id = excluded.institute_id,
        full_name = excluded.full_name,
        role = excluded.role
    where profiles.institute_id is null
       or profiles.institute_id = excluded.institute_id;

  insert into public.memberships (user_id, institute_id, branch_id, role)
  values (
    current_user_id,
    matched_staff.institute_id,
    target_branch_id,
    target_role
  )
  on conflict do nothing;

  if exists (
    select 1
    from public.memberships
    where memberships.user_id = current_user_id
      and memberships.institute_id = matched_staff.institute_id
      and memberships.role = target_role
      and (
        (target_role = 'owner' and memberships.branch_id is null)
        or memberships.branch_id = target_branch_id
      )
  ) then
    return 'linked';
  end if;

  return 'failed';
end;
$$;

create or replace function public.claim_staff_member_profile()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.claim_staff_member_profile_result() = 'linked'
$$;

create or replace function public.sync_staff_member_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_role text;
  new_branch_id uuid;
  old_role text;
  old_branch_id uuid;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    if new.auth_user_id is not null then
      if exists (
        select 1
        from public.profiles
        where profiles.id = new.auth_user_id
          and profiles.institute_id is distinct from new.institute_id
      ) then
        raise exception 'Linked auth user already belongs to another institute.';
      end if;

      new_role := public.normalize_membership_role(new.role);
      new_branch_id := case
        when new_role = 'owner' then null
        else coalesce(new.branch_id, public.get_or_create_main_branch(new.institute_id))
      end;

      if tg_op = 'UPDATE'
        and old.auth_user_id is not null
        and (
          old.auth_user_id is distinct from new.auth_user_id
          or old.institute_id is distinct from new.institute_id
          or old.branch_id is distinct from new.branch_id
          or old.role is distinct from new.role
        )
      then
        old_role := public.normalize_membership_role(old.role);
        old_branch_id := case
          when old_role = 'owner' then null
          else coalesce(old.branch_id, public.get_or_create_main_branch(old.institute_id))
        end;

        delete from public.memberships
        where memberships.user_id = old.auth_user_id
          and memberships.institute_id = old.institute_id
          and memberships.role = old_role
          and (
            (old_role = 'owner' and memberships.branch_id is null)
            or memberships.branch_id = old_branch_id
          )
          and not exists (
            select 1
            from public.institutes
            where institutes.id = old.institute_id
              and institutes.owner_id = old.auth_user_id
          );
      end if;

      insert into public.profiles (id, institute_id, full_name, role)
      values (
        new.auth_user_id,
        new.institute_id,
        new.full_name,
        public.profile_role_for_membership(new_role)
      )
      on conflict (id) do update
        set institute_id = excluded.institute_id,
            full_name = excluded.full_name,
            role = excluded.role;

      insert into public.memberships (user_id, institute_id, branch_id, role)
      values (new.auth_user_id, new.institute_id, new_branch_id, new_role)
      on conflict do nothing;
    end if;

    if tg_op = 'UPDATE'
      and old.auth_user_id is not null
      and old.auth_user_id is distinct from new.auth_user_id
    then
      delete from public.profiles
      where profiles.id = old.auth_user_id
        and profiles.institute_id = old.institute_id
        and not exists (
          select 1
          from public.institutes
          where institutes.id = old.institute_id
            and institutes.owner_id = old.auth_user_id
        )
        and not exists (
          select 1
          from public.staff_members
          where staff_members.auth_user_id = old.auth_user_id
        );
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' and old.auth_user_id is not null then
    old_role := public.normalize_membership_role(old.role);
    old_branch_id := case
      when old_role = 'owner' then null
      else coalesce(old.branch_id, public.get_or_create_main_branch(old.institute_id))
    end;

    delete from public.memberships
    where memberships.user_id = old.auth_user_id
      and memberships.institute_id = old.institute_id
      and memberships.role = old_role
      and (
        (old_role = 'owner' and memberships.branch_id is null)
        or memberships.branch_id = old_branch_id
      )
      and not exists (
        select 1
        from public.institutes
        where institutes.id = old.institute_id
          and institutes.owner_id = old.auth_user_id
      );

    delete from public.profiles
    where profiles.id = old.auth_user_id
      and profiles.institute_id = old.institute_id
      and not exists (
        select 1
        from public.institutes
        where institutes.id = old.institute_id
          and institutes.owner_id = old.auth_user_id
      )
      and not exists (
        select 1
        from public.staff_members
        where staff_members.auth_user_id = old.auth_user_id
      );
  end if;

  return old;
end;
$$;

drop trigger if exists sync_staff_member_profile_trigger on public.staff_members;

create trigger sync_staff_member_profile_trigger
  after insert or update or delete on public.staff_members
  for each row
  execute function public.sync_staff_member_profile();

-- Compatibility helpers still used by existing app code.
create or replace function public.current_profile_institute_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select profiles.institute_id
  from public.profiles
  where profiles.id = auth.uid()
$$;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select profiles.role
  from public.profiles
  where profiles.id = auth.uid()
$$;

-- Permission map. Teachers remain view-only in Phase 1.
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
      'attendance.view',
      'attendance.create',
      'attendance.update',
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
      'staff.view'
    )
    when member_role = 'operations_staff' then required_permission in (
      'dashboard.access',
      'students.view',
      'students.create',
      'students.update',
      'batches.view',
      'attendance.view',
      'attendance.create',
      'attendance.update',
      'fees.view',
      'fees.send_reminder'
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
      'fees.manage'
    )
    when member_role = 'academic_coordinator' then required_permission in (
      'dashboard.access',
      'students.view',
      'batches.view',
      'batches.create',
      'batches.update',
      'attendance.view'
    )
    when member_role = 'teacher' then required_permission in (
      'dashboard.access',
      'students.view',
      'batches.view',
      'attendance.view'
    )
    else false
  end
$$;

-- Institute-level permission helper. Branch-scoped memberships intentionally
-- do not satisfy this helper; branch permissions use has_branch_permission().
create or replace function public.has_institute_permission(
  target_institute_id uuid,
  required_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_institute_id is not null
    and required_permission is not null
    and exists (
      select 1
      from public.memberships
      where memberships.user_id = auth.uid()
        and memberships.institute_id = target_institute_id
        and memberships.branch_id is null
        and public.role_has_permission(memberships.role, required_permission)
    )
$$;

comment on function public.has_institute_permission(uuid, text) is
  'Membership-aware institute permission helper. Accepts text string literals and returns false for anonymous users.';

create or replace function public.has_branch_permission(
  target_branch_id uuid,
  required_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_branch_id is not null
    and required_permission is not null
    and exists (
      select 1
      from public.branches
      join public.memberships
        on memberships.institute_id = branches.institute_id
       and memberships.user_id = auth.uid()
      where branches.id = target_branch_id
        and public.role_has_permission(memberships.role, required_permission)
        and (
          memberships.role = 'owner'
          or memberships.branch_id = branches.id
        )
    )
$$;

comment on function public.has_branch_permission(uuid, text) is
  'Membership-aware branch permission helper. Accepts text string literals and returns false for anonymous users.';

create or replace function public.current_user_can_view_academic_year(
  target_academic_year_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_academic_year_id is not null
    and exists (
      select 1
      from public.academic_years
      join public.memberships
        on memberships.institute_id = academic_years.institute_id
       and memberships.user_id = auth.uid()
      where academic_years.id = target_academic_year_id
        and (
          public.role_has_permission(memberships.role, 'academic_years.view'::text)
          or (
            academic_years.is_active
            and public.role_has_permission(memberships.role, 'dashboard.access'::text)
          )
        )
    )
$$;

comment on function public.current_user_can_view_academic_year(uuid) is
  'Academic year visibility helper. Owners and branch managers can view all institute years; other dashboard members can view the active year.';

create or replace function public.set_active_academic_year(
  target_academic_year_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_institute_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to set an active academic year.';
  end if;

  select academic_years.institute_id
  into target_institute_id
  from public.academic_years
  where academic_years.id = target_academic_year_id;

  if target_institute_id is null then
    raise exception 'Academic year does not exist.';
  end if;

  if not public.has_institute_permission(target_institute_id, 'academic_years.update'::text) then
    raise exception 'Only institute owners can set the active academic year.';
  end if;

  update public.academic_years
  set is_active = false
  where institute_id = target_institute_id
    and is_active;

  update public.academic_years
  set is_active = true
  where id = target_academic_year_id;
end;
$$;

comment on function public.set_active_academic_year(uuid) is
  'Owner-only helper that atomically marks one academic year active for an institute.';

create or replace function public.current_user_can_access_batch(
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
            and required_permission in ('students.view', 'batches.view', 'attendance.view')
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

create or replace function public.current_user_can_access_student(
  target_student_id uuid,
  required_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_student_id is not null
    and required_permission is not null
    and exists (
      select 1
      from public.students
      join public.memberships
        on memberships.institute_id = students.institute_id
       and memberships.user_id = auth.uid()
      where students.id = target_student_id
        and public.role_has_permission(memberships.role, required_permission)
        and (
          memberships.role = 'owner'
          or (
            memberships.role = 'teacher'
            and required_permission = 'students.view'
            and exists (
              select 1
              from public.student_batches
              join public.batch_teachers
                on batch_teachers.batch_id = student_batches.batch_id
              where student_batches.student_id = students.id
                and batch_teachers.membership_id = memberships.id
            )
          )
          or (
            memberships.role <> 'teacher'
            and memberships.branch_id = students.branch_id
          )
        )
    )
$$;

create or replace function public.current_user_can_access_attendance_session(
  target_session_id uuid,
  required_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.attendance_sessions
    join public.batches
      on batches.id = attendance_sessions.batch_id
    where attendance_sessions.id = target_session_id
      and attendance_sessions.branch_id = batches.branch_id
      and attendance_sessions.institute_id = batches.institute_id
      and public.current_user_can_access_batch(batches.id, required_permission)
  )
$$;

-- Enable RLS after helpers exist.
alter table public.institutes enable row level security;
alter table public.profiles enable row level security;
alter table public.branches enable row level security;
alter table public.academic_years enable row level security;
alter table public.memberships enable row level security;
alter table public.students enable row level security;
alter table public.batches enable row level security;
alter table public.student_batches enable row level security;
alter table public.batch_teachers enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.fee_records enable row level security;
alter table public.staff_members enable row level security;

-- Drop old policies before recreating membership-aware policies.
drop policy if exists profiles_select_own_profile on public.profiles;
drop policy if exists profiles_insert_own_profile on public.profiles;
drop policy if exists profiles_update_own_profile on public.profiles;
drop policy if exists profiles_delete_owner_managed on public.profiles;
drop policy if exists institutes_select_owner_or_member on public.institutes;
drop policy if exists institutes_insert_owner on public.institutes;
drop policy if exists institutes_update_owner on public.institutes;
drop policy if exists branches_select_members on public.branches;
drop policy if exists branches_insert_owner on public.branches;
drop policy if exists branches_update_owner on public.branches;
drop policy if exists branches_delete_owner on public.branches;
drop policy if exists academic_years_select_members on public.academic_years;
drop policy if exists academic_years_insert_owner on public.academic_years;
drop policy if exists academic_years_update_owner on public.academic_years;
drop policy if exists academic_years_delete_owner on public.academic_years;
drop policy if exists memberships_select_owner_or_self on public.memberships;
drop policy if exists memberships_insert_owner on public.memberships;
drop policy if exists memberships_update_owner on public.memberships;
drop policy if exists memberships_delete_owner on public.memberships;
drop policy if exists students_select_institute_members on public.students;
drop policy if exists students_insert_institute_members on public.students;
drop policy if exists students_update_institute_members on public.students;
drop policy if exists students_delete_institute_members on public.students;
drop policy if exists batches_select_institute_members on public.batches;
drop policy if exists batches_insert_institute_members on public.batches;
drop policy if exists batches_update_institute_members on public.batches;
drop policy if exists batches_delete_institute_members on public.batches;
drop policy if exists student_batches_select_institute_members on public.student_batches;
drop policy if exists student_batches_insert_institute_members on public.student_batches;
drop policy if exists student_batches_update_institute_members on public.student_batches;
drop policy if exists student_batches_delete_institute_members on public.student_batches;
drop policy if exists batch_teachers_select_members on public.batch_teachers;
drop policy if exists batch_teachers_insert_manager on public.batch_teachers;
drop policy if exists batch_teachers_update_manager on public.batch_teachers;
drop policy if exists batch_teachers_delete_manager on public.batch_teachers;
drop policy if exists attendance_sessions_select_institute_members on public.attendance_sessions;
drop policy if exists attendance_sessions_insert_institute_members on public.attendance_sessions;
drop policy if exists attendance_sessions_update_institute_members on public.attendance_sessions;
drop policy if exists attendance_sessions_delete_institute_members on public.attendance_sessions;
drop policy if exists attendance_records_select_institute_members on public.attendance_records;
drop policy if exists attendance_records_insert_institute_members on public.attendance_records;
drop policy if exists attendance_records_update_institute_members on public.attendance_records;
drop policy if exists attendance_records_delete_institute_members on public.attendance_records;
drop policy if exists fee_records_select_institute_members on public.fee_records;
drop policy if exists fee_records_insert_institute_members on public.fee_records;
drop policy if exists fee_records_update_institute_members on public.fee_records;
drop policy if exists fee_records_delete_institute_members on public.fee_records;
drop policy if exists staff_members_select_owner_or_self on public.staff_members;
drop policy if exists staff_members_insert_owner on public.staff_members;
drop policy if exists staff_members_update_owner on public.staff_members;
drop policy if exists staff_members_delete_owner on public.staff_members;

create policy profiles_select_own_profile
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.has_institute_permission(profiles.institute_id, 'staff.manage'::text)
  );

create policy profiles_insert_own_profile
  on public.profiles
  for insert
  to authenticated
  with check (
    (
      id = auth.uid()
      and role = 'owner'
      and exists (
        select 1
        from public.institutes
        where institutes.id = profiles.institute_id
          and institutes.owner_id = auth.uid()
      )
    )
    or public.has_institute_permission(profiles.institute_id, 'staff.manage'::text)
  );

create policy profiles_update_own_profile
  on public.profiles
  for update
  to authenticated
  using (
    id = auth.uid()
    or public.has_institute_permission(profiles.institute_id, 'staff.manage'::text)
  )
  with check (
    (
      id = auth.uid()
      and profiles.institute_id = public.current_profile_institute_id()
      and profiles.role = public.current_profile_role()
    )
    or public.has_institute_permission(profiles.institute_id, 'staff.manage'::text)
  );

create policy profiles_delete_owner_managed
  on public.profiles
  for delete
  to authenticated
  using (public.has_institute_permission(profiles.institute_id, 'staff.manage'::text));

create policy institutes_select_owner_or_member
  on public.institutes
  for select
  to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1
      from public.memberships
      where memberships.user_id = auth.uid()
        and memberships.institute_id = institutes.id
    )
  );

create policy institutes_insert_owner
  on public.institutes
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy institutes_update_owner
  on public.institutes
  for update
  to authenticated
  using (public.has_institute_permission(institutes.id, 'institutes.update'::text))
  with check (
    owner_id = auth.uid()
    and public.has_institute_permission(institutes.id, 'institutes.update'::text)
  );

create policy branches_select_members
  on public.branches
  for select
  to authenticated
  using (
    public.has_institute_permission(branches.institute_id, 'branches.manage'::text)
    or public.has_branch_permission(branches.id, 'branches.view'::text)
  );

create policy branches_insert_owner
  on public.branches
  for insert
  to authenticated
  with check (public.has_institute_permission(branches.institute_id, 'branches.manage'::text));

create policy branches_update_owner
  on public.branches
  for update
  to authenticated
  using (public.has_institute_permission(branches.institute_id, 'branches.manage'::text))
  with check (public.has_institute_permission(branches.institute_id, 'branches.manage'::text));

create policy branches_delete_owner
  on public.branches
  for delete
  to authenticated
  using (public.has_institute_permission(branches.institute_id, 'branches.manage'::text));

create policy academic_years_select_members
  on public.academic_years
  for select
  to authenticated
  using (public.current_user_can_view_academic_year(academic_years.id));

create policy academic_years_insert_owner
  on public.academic_years
  for insert
  to authenticated
  with check (public.has_institute_permission(academic_years.institute_id, 'academic_years.create'::text));

create policy academic_years_update_owner
  on public.academic_years
  for update
  to authenticated
  using (public.has_institute_permission(academic_years.institute_id, 'academic_years.update'::text))
  with check (public.has_institute_permission(academic_years.institute_id, 'academic_years.update'::text));

create policy academic_years_delete_owner
  on public.academic_years
  for delete
  to authenticated
  using (public.has_institute_permission(academic_years.institute_id, 'academic_years.delete'::text));

create policy memberships_select_owner_or_self
  on public.memberships
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.has_institute_permission(memberships.institute_id, 'staff.manage'::text)
    or (
      memberships.branch_id is not null
      and public.has_branch_permission(memberships.branch_id, 'staff.view'::text)
    )
  );

create policy memberships_insert_owner
  on public.memberships
  for insert
  to authenticated
  with check (public.has_institute_permission(memberships.institute_id, 'staff.manage'::text));

create policy memberships_update_owner
  on public.memberships
  for update
  to authenticated
  using (public.has_institute_permission(memberships.institute_id, 'staff.manage'::text))
  with check (public.has_institute_permission(memberships.institute_id, 'staff.manage'::text));

create policy memberships_delete_owner
  on public.memberships
  for delete
  to authenticated
  using (public.has_institute_permission(memberships.institute_id, 'staff.manage'::text));

create policy students_select_institute_members
  on public.students
  for select
  to authenticated
  using (public.current_user_can_access_student(students.id, 'students.view'::text));

create policy students_insert_institute_members
  on public.students
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.branches
      where branches.id = students.branch_id
        and branches.institute_id = students.institute_id
        and public.has_branch_permission(students.branch_id, 'students.create'::text)
    )
  );

create policy students_update_institute_members
  on public.students
  for update
  to authenticated
  using (public.current_user_can_access_student(students.id, 'students.update'::text))
  with check (
    exists (
      select 1
      from public.branches
      where branches.id = students.branch_id
        and branches.institute_id = students.institute_id
        and public.has_branch_permission(students.branch_id, 'students.update'::text)
    )
  );

create policy students_delete_institute_members
  on public.students
  for delete
  to authenticated
  using (public.current_user_can_access_student(students.id, 'students.delete'::text));

create policy batches_select_institute_members
  on public.batches
  for select
  to authenticated
  using (public.current_user_can_access_batch(batches.id, 'batches.view'::text));

create policy batches_insert_institute_members
  on public.batches
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.branches
      where branches.id = batches.branch_id
        and branches.institute_id = batches.institute_id
        and public.has_branch_permission(batches.branch_id, 'batches.create'::text)
    )
  );

create policy batches_update_institute_members
  on public.batches
  for update
  to authenticated
  using (public.current_user_can_access_batch(batches.id, 'batches.update'::text))
  with check (
    exists (
      select 1
      from public.branches
      where branches.id = batches.branch_id
        and branches.institute_id = batches.institute_id
        and public.has_branch_permission(batches.branch_id, 'batches.update'::text)
    )
  );

create policy batches_delete_institute_members
  on public.batches
  for delete
  to authenticated
  using (public.current_user_can_access_batch(batches.id, 'batches.delete'::text));

create policy student_batches_select_institute_members
  on public.student_batches
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.batches
      join public.students
        on students.id = student_batches.student_id
      where batches.id = student_batches.batch_id
        and students.institute_id = batches.institute_id
        and students.branch_id = batches.branch_id
        and public.current_user_can_access_batch(batches.id, 'batches.view'::text)
    )
  );

create policy student_batches_insert_institute_members
  on public.student_batches
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.batches
      join public.students
        on students.id = student_batches.student_id
      where batches.id = student_batches.batch_id
        and students.institute_id = batches.institute_id
        and students.branch_id = batches.branch_id
        and public.current_user_can_access_batch(batches.id, 'batches.update'::text)
    )
  );

create policy student_batches_update_institute_members
  on public.student_batches
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.batches
      join public.students
        on students.id = student_batches.student_id
      where batches.id = student_batches.batch_id
        and students.institute_id = batches.institute_id
        and students.branch_id = batches.branch_id
        and public.current_user_can_access_batch(batches.id, 'batches.update'::text)
    )
  )
  with check (
    exists (
      select 1
      from public.batches
      join public.students
        on students.id = student_batches.student_id
      where batches.id = student_batches.batch_id
        and students.institute_id = batches.institute_id
        and students.branch_id = batches.branch_id
        and public.current_user_can_access_batch(batches.id, 'batches.update'::text)
    )
  );

create policy student_batches_delete_institute_members
  on public.student_batches
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.batches
      join public.students
        on students.id = student_batches.student_id
      where batches.id = student_batches.batch_id
        and students.institute_id = batches.institute_id
        and students.branch_id = batches.branch_id
        and public.current_user_can_access_batch(batches.id, 'batches.update'::text)
    )
  );

create policy batch_teachers_select_members
  on public.batch_teachers
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.batches
      join public.memberships
        on memberships.id = batch_teachers.membership_id
      where batches.id = batch_teachers.batch_id
        and (
          memberships.user_id = auth.uid()
          or public.current_user_can_access_batch(batches.id, 'batches.view'::text)
        )
    )
  );

create policy batch_teachers_insert_manager
  on public.batch_teachers
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.batches
      join public.memberships
        on memberships.id = batch_teachers.membership_id
      where batches.id = batch_teachers.batch_id
        and memberships.role = 'teacher'
        and memberships.institute_id = batches.institute_id
        and memberships.branch_id = batches.branch_id
        and public.has_branch_permission(batches.branch_id, 'batch_teachers.manage'::text)
    )
  );

create policy batch_teachers_update_manager
  on public.batch_teachers
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.batches
      where batches.id = batch_teachers.batch_id
        and public.has_branch_permission(batches.branch_id, 'batch_teachers.manage'::text)
    )
  )
  with check (
    exists (
      select 1
      from public.batches
      join public.memberships
        on memberships.id = batch_teachers.membership_id
      where batches.id = batch_teachers.batch_id
        and memberships.role = 'teacher'
        and memberships.institute_id = batches.institute_id
        and memberships.branch_id = batches.branch_id
        and public.has_branch_permission(batches.branch_id, 'batch_teachers.manage'::text)
    )
  );

create policy batch_teachers_delete_manager
  on public.batch_teachers
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.batches
      where batches.id = batch_teachers.batch_id
        and public.has_branch_permission(batches.branch_id, 'batch_teachers.manage'::text)
    )
  );

create policy attendance_sessions_select_institute_members
  on public.attendance_sessions
  for select
  to authenticated
  using (
    public.current_user_can_access_attendance_session(
      attendance_sessions.id,
      'attendance.view'::text
    )
  );

create policy attendance_sessions_insert_institute_members
  on public.attendance_sessions
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.batches
      where batches.id = attendance_sessions.batch_id
        and batches.institute_id = attendance_sessions.institute_id
        and batches.branch_id = attendance_sessions.branch_id
        and public.current_user_can_access_batch(batches.id, 'attendance.create'::text)
    )
  );

create policy attendance_sessions_update_institute_members
  on public.attendance_sessions
  for update
  to authenticated
  using (
    public.current_user_can_access_attendance_session(
      attendance_sessions.id,
      'attendance.update'::text
    )
  )
  with check (
    exists (
      select 1
      from public.batches
      where batches.id = attendance_sessions.batch_id
        and batches.institute_id = attendance_sessions.institute_id
        and batches.branch_id = attendance_sessions.branch_id
        and public.current_user_can_access_batch(batches.id, 'attendance.update'::text)
    )
  );

create policy attendance_sessions_delete_institute_members
  on public.attendance_sessions
  for delete
  to authenticated
  using (
    public.current_user_can_access_attendance_session(
      attendance_sessions.id,
      'attendance.delete'::text
    )
  );

create policy attendance_records_select_institute_members
  on public.attendance_records
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.attendance_sessions
      join public.students
        on students.id = attendance_records.student_id
      where attendance_sessions.id = attendance_records.session_id
        and students.institute_id = attendance_sessions.institute_id
        and students.branch_id = attendance_sessions.branch_id
        and exists (
          select 1
          from public.student_batches
          where student_batches.batch_id = attendance_sessions.batch_id
            and student_batches.student_id = attendance_records.student_id
        )
        and public.current_user_can_access_attendance_session(
          attendance_sessions.id,
          'attendance.view'::text
        )
    )
  );

create policy attendance_records_insert_institute_members
  on public.attendance_records
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.attendance_sessions
      join public.students
        on students.id = attendance_records.student_id
      where attendance_sessions.id = attendance_records.session_id
        and students.institute_id = attendance_sessions.institute_id
        and students.branch_id = attendance_sessions.branch_id
        and exists (
          select 1
          from public.student_batches
          where student_batches.batch_id = attendance_sessions.batch_id
            and student_batches.student_id = attendance_records.student_id
        )
        and public.current_user_can_access_attendance_session(
          attendance_sessions.id,
          'attendance.update'::text
        )
    )
  );

create policy attendance_records_update_institute_members
  on public.attendance_records
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.attendance_sessions
      join public.students
        on students.id = attendance_records.student_id
      where attendance_sessions.id = attendance_records.session_id
        and students.institute_id = attendance_sessions.institute_id
        and students.branch_id = attendance_sessions.branch_id
        and exists (
          select 1
          from public.student_batches
          where student_batches.batch_id = attendance_sessions.batch_id
            and student_batches.student_id = attendance_records.student_id
        )
        and public.current_user_can_access_attendance_session(
          attendance_sessions.id,
          'attendance.update'::text
        )
    )
  )
  with check (
    exists (
      select 1
      from public.attendance_sessions
      join public.students
        on students.id = attendance_records.student_id
      where attendance_sessions.id = attendance_records.session_id
        and students.institute_id = attendance_sessions.institute_id
        and students.branch_id = attendance_sessions.branch_id
        and exists (
          select 1
          from public.student_batches
          where student_batches.batch_id = attendance_sessions.batch_id
            and student_batches.student_id = attendance_records.student_id
        )
        and public.current_user_can_access_attendance_session(
          attendance_sessions.id,
          'attendance.update'::text
        )
    )
  );

create policy attendance_records_delete_institute_members
  on public.attendance_records
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.attendance_sessions
      join public.students
        on students.id = attendance_records.student_id
      where attendance_sessions.id = attendance_records.session_id
        and students.institute_id = attendance_sessions.institute_id
        and students.branch_id = attendance_sessions.branch_id
        and exists (
          select 1
          from public.student_batches
          where student_batches.batch_id = attendance_sessions.batch_id
            and student_batches.student_id = attendance_records.student_id
        )
        and public.current_user_can_access_attendance_session(
          attendance_sessions.id,
          'attendance.delete'::text
        )
    )
  );

create policy fee_records_select_institute_members
  on public.fee_records
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.students
      where students.id = fee_records.student_id
        and students.institute_id = fee_records.institute_id
        and students.branch_id = fee_records.branch_id
        and public.has_branch_permission(fee_records.branch_id, 'fees.view'::text)
    )
  );

create policy fee_records_insert_institute_members
  on public.fee_records
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.students
      where students.id = fee_records.student_id
        and students.institute_id = fee_records.institute_id
        and students.branch_id = fee_records.branch_id
        and public.has_branch_permission(fee_records.branch_id, 'fees.create'::text)
    )
  );

create policy fee_records_update_institute_members
  on public.fee_records
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.students
      where students.id = fee_records.student_id
        and students.institute_id = fee_records.institute_id
        and students.branch_id = fee_records.branch_id
        and public.has_branch_permission(fee_records.branch_id, 'fees.update'::text)
    )
  )
  with check (
    exists (
      select 1
      from public.students
      where students.id = fee_records.student_id
        and students.institute_id = fee_records.institute_id
        and students.branch_id = fee_records.branch_id
        and public.has_branch_permission(fee_records.branch_id, 'fees.update'::text)
    )
  );

create policy fee_records_delete_institute_members
  on public.fee_records
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.students
      where students.id = fee_records.student_id
        and students.institute_id = fee_records.institute_id
        and students.branch_id = fee_records.branch_id
        and public.has_branch_permission(fee_records.branch_id, 'fees.delete'::text)
    )
  );

create policy staff_members_select_owner_or_self
  on public.staff_members
  for select
  to authenticated
  using (
    auth_user_id = auth.uid()
    or public.has_institute_permission(staff_members.institute_id, 'staff.manage'::text)
    or (
      staff_members.branch_id is not null
      and public.has_branch_permission(staff_members.branch_id, 'staff.view'::text)
    )
  );

create policy staff_members_insert_owner
  on public.staff_members
  for insert
  to authenticated
  with check (public.has_institute_permission(staff_members.institute_id, 'staff.manage'::text));

create policy staff_members_update_owner
  on public.staff_members
  for update
  to authenticated
  using (public.has_institute_permission(staff_members.institute_id, 'staff.manage'::text))
  with check (public.has_institute_permission(staff_members.institute_id, 'staff.manage'::text));

create policy staff_members_delete_owner
  on public.staff_members
  for delete
  to authenticated
  using (public.has_institute_permission(staff_members.institute_id, 'staff.manage'::text));
