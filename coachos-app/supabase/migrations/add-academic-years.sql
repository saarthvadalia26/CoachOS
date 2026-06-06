-- CoachOS focused academic years migration.
-- Run this in Supabase SQL Editor when the main Phase 1 schema has already
-- created institutes, memberships, and attendance_sessions.
--
-- Idempotent by design:
-- - creates objects with if not exists where PostgreSQL supports it
-- - drops/recreates only the academic_years RLS policies and triggers managed here
-- - does not modify existing academic year data

create extension if not exists "pgcrypto";

do $$
begin
  if to_regclass('public.institutes') is null then
    raise exception 'Missing required table public.institutes. Run the core CoachOS schema before this migration.';
  end if;

  if to_regclass('public.memberships') is null then
    raise exception 'Missing required table public.memberships. Run the multi-branch membership migration before this migration.';
  end if;

  if to_regclass('public.attendance_sessions') is null then
    raise exception 'Missing required table public.attendance_sessions. Run the attendance foundation migration before this migration.';
  end if;
end;
$$;

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

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'academic_years_date_range_check'
      and conrelid = 'public.academic_years'::regclass
  ) then
    alter table public.academic_years
      add constraint academic_years_date_range_check
      check (start_date < end_date);
  end if;
end;
$$;

create index if not exists academic_years_institute_id_idx
  on public.academic_years (institute_id);

create index if not exists academic_years_institute_id_dates_idx
  on public.academic_years (institute_id, start_date, end_date);

do $$
begin
  if exists (
    select 1
    from (
      select institute_id, lower(name)
      from public.academic_years
      group by institute_id, lower(name)
      having count(*) > 1
    ) duplicate_academic_year_names
  ) then
    raise exception 'Cannot create academic year name uniqueness index: duplicate names exist within an institute. Rename duplicates first.';
  end if;
end;
$$;

create unique index if not exists academic_years_institute_id_lower_name_idx
  on public.academic_years (institute_id, lower(name));

do $$
begin
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
    raise exception 'Cannot create active academic year uniqueness index: more than one active academic year exists for an institute.';
  end if;
end;
$$;

create unique index if not exists academic_years_one_active_per_institute_idx
  on public.academic_years (institute_id)
  where is_active;

alter table public.attendance_sessions
  add column if not exists academic_year_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'attendance_sessions_academic_year_id_fk'
      and conrelid = 'public.attendance_sessions'::regclass
  ) then
    alter table public.attendance_sessions
      add constraint attendance_sessions_academic_year_id_fk
      foreign key (academic_year_id)
      references public.academic_years(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists attendance_sessions_academic_year_id_idx
  on public.attendance_sessions (academic_year_id);

-- Attendance sessions can be created without passing academic_year_id from the
-- app. This trigger attaches the active academic year when the session date is
-- inside that year's date range. If a value is supplied, it must belong to the
-- same institute and contain the session date.
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

drop trigger if exists set_attendance_session_academic_year_id_trigger
  on public.attendance_sessions;

create trigger set_attendance_session_academic_year_id_trigger
  before insert or update on public.attendance_sessions
  for each row
  execute function public.set_attendance_session_academic_year_id();

-- Protect existing attendance links when an academic year is edited.
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

drop trigger if exists validate_academic_year_attendance_links_trigger
  on public.academic_years;

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

drop trigger if exists prevent_academic_year_delete_with_attendance_trigger
  on public.academic_years;

create trigger prevent_academic_year_delete_with_attendance_trigger
  before delete on public.academic_years
  for each row
  execute function public.prevent_academic_year_delete_with_attendance();

-- Owner-only RPC used by the app's "Mark active" action. This avoids relying
-- on broader helper functions that may not exist yet in older databases.
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

  if not (
    exists (
      select 1
      from public.institutes
      where institutes.id = target_institute_id
        and institutes.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.memberships
      where memberships.user_id = auth.uid()
        and memberships.institute_id = target_institute_id
        and memberships.role = 'owner'
        and memberships.branch_id is null
    )
  ) then
    raise exception 'Only institute owners can set the active academic year.';
  end if;

  update public.academic_years
  set is_active = false
  where institute_id = target_institute_id
    and is_active
    and id <> target_academic_year_id;

  update public.academic_years
  set is_active = true
  where id = target_academic_year_id;
end;
$$;

comment on function public.set_active_academic_year(uuid) is
  'Owner-only helper that atomically marks one academic year active for an institute.';

-- Policy helpers are created here before policies use them. They avoid
-- depending on the broader CoachOS permission helper functions and avoid
-- membership-table RLS recursion while evaluating academic_years policies.
create or replace function public.current_user_has_academic_year_institute_access(
  target_institute_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_institute_id is not null
    and (
      exists (
        select 1
        from public.memberships
        where memberships.user_id = auth.uid()
          and memberships.institute_id = target_institute_id
      )
      or exists (
        select 1
        from public.institutes
        where institutes.id = target_institute_id
          and institutes.owner_id = auth.uid()
      )
    )
$$;

create or replace function public.current_user_owns_academic_year_institute(
  target_institute_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_institute_id is not null
    and (
      exists (
        select 1
        from public.institutes
        where institutes.id = target_institute_id
          and institutes.owner_id = auth.uid()
      )
      or exists (
        select 1
        from public.memberships
        where memberships.user_id = auth.uid()
          and memberships.institute_id = target_institute_id
          and memberships.role = 'owner'
          and memberships.branch_id is null
      )
    )
$$;

alter table public.academic_years enable row level security;

drop policy if exists academic_years_select_members on public.academic_years;
drop policy if exists academic_years_insert_owner on public.academic_years;
drop policy if exists academic_years_update_owner on public.academic_years;
drop policy if exists academic_years_delete_owner on public.academic_years;

-- Dashboard users with an institute membership can list academic years for
-- their institute. Existing owner accounts also work even if their owner
-- membership backfill has not run yet.
create policy academic_years_select_members
  on public.academic_years
  for select
  to authenticated
  using (
    public.current_user_has_academic_year_institute_access(
      academic_years.institute_id
    )
  );

-- Only institute owners can create academic years. The app still derives
-- institute_id server-side; this policy is the database backstop.
create policy academic_years_insert_owner
  on public.academic_years
  for insert
  to authenticated
  with check (
    public.current_user_owns_academic_year_institute(
      academic_years.institute_id
    )
  );

create policy academic_years_update_owner
  on public.academic_years
  for update
  to authenticated
  using (
    public.current_user_owns_academic_year_institute(
      academic_years.institute_id
    )
  )
  with check (
    public.current_user_owns_academic_year_institute(
      academic_years.institute_id
    )
  );

create policy academic_years_delete_owner
  on public.academic_years
  for delete
  to authenticated
  using (
    public.current_user_owns_academic_year_institute(
      academic_years.institute_id
    )
  );

grant select, insert, update, delete on public.academic_years to authenticated;
grant execute on function public.set_active_academic_year(uuid) to authenticated;
grant execute on function public.current_user_has_academic_year_institute_access(uuid) to authenticated;
grant execute on function public.current_user_owns_academic_year_institute(uuid) to authenticated;
