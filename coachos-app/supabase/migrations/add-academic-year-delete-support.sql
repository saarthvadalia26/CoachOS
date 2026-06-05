-- CoachOS focused academic year delete support.
-- Run this after add-academic-years.sql if your Supabase project already has
-- public.academic_years but lacks the delete policy/trigger.

do $$
begin
  if to_regclass('public.academic_years') is null then
    raise exception 'Missing public.academic_years. Run add-academic-years.sql first.';
  end if;

  if to_regclass('public.attendance_sessions') is null then
    raise exception 'Missing public.attendance_sessions. Run the attendance foundation migration first.';
  end if;

  if to_regclass('public.institutes') is null then
    raise exception 'Missing public.institutes. Run the core CoachOS schema first.';
  end if;

  if to_regclass('public.memberships') is null then
    raise exception 'Missing public.memberships. Run the membership migration first.';
  end if;
end;
$$;

-- Policy helper is defined here so this migration does not depend on the
-- broader CoachOS permission helpers being present in older databases.
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

-- Database backstop: the app checks this before deleting, but this trigger
-- prevents direct deletes from unlinking attendance sessions as well.
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

alter table public.academic_years enable row level security;

drop policy if exists academic_years_delete_owner on public.academic_years;

create policy academic_years_delete_owner
  on public.academic_years
  for delete
  to authenticated
  using (
    public.current_user_owns_academic_year_institute(
      academic_years.institute_id
    )
  );

grant delete on public.academic_years to authenticated;
grant execute on function public.current_user_owns_academic_year_institute(uuid) to authenticated;
