-- CoachOS academic year cleanup controls.
-- Run this after add-academic-years.sql for projects that already have the
-- academic_years table. It prevents duplicate academic year names per institute
-- and reinforces safe owner-only deletes.

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

-- Verification helper: this should return zero rows before/after the migration.
select institute_id, lower(name) as normalized_name, count(*) as duplicate_count
from public.academic_years
group by institute_id, lower(name)
having count(*) > 1;
