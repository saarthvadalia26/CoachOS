-- CoachOS attendance academic year backfill.
-- Read before running:
-- - This migration only fills attendance_sessions.academic_year_id when it is null.
-- - It matches by same institute_id and session_date between academic year dates.
-- - It refuses to run if any null-linked attendance session matches more than
--   one academic year, because that would make the backfill ambiguous.
-- - Fix overlapping academic year date ranges manually before rerunning if the
--   ambiguity preflight fails.

do $$
begin
  if to_regclass('public.academic_years') is null then
    raise exception 'Missing public.academic_years. Run add-academic-years.sql first.';
  end if;

  if to_regclass('public.attendance_sessions') is null then
    raise exception 'Missing public.attendance_sessions. Run the attendance foundation migration first.';
  end if;

  if exists (
    select 1
    from public.attendance_sessions
    where attendance_sessions.academic_year_id is null
      and (
        select count(*)
        from public.academic_years
        where academic_years.institute_id = attendance_sessions.institute_id
          and attendance_sessions.session_date between academic_years.start_date and academic_years.end_date
      ) > 1
  ) then
    raise exception 'Backfill aborted: at least one attendance session matches multiple academic years. Resolve overlapping academic year date ranges first.';
  end if;
end;
$$;

update public.attendance_sessions
set academic_year_id = matched_academic_year.id
from public.academic_years as matched_academic_year
where attendance_sessions.academic_year_id is null
  and matched_academic_year.institute_id = attendance_sessions.institute_id
  and attendance_sessions.session_date between matched_academic_year.start_date and matched_academic_year.end_date
  and not exists (
    select 1
    from public.academic_years as other_academic_year
    where other_academic_year.institute_id = attendance_sessions.institute_id
      and other_academic_year.id <> matched_academic_year.id
      and attendance_sessions.session_date between other_academic_year.start_date and other_academic_year.end_date
  );

-- Verification helpers. These SELECTs do not modify data.
select
  count(*) as remaining_unlinked_sessions_with_matching_year
from public.attendance_sessions
where attendance_sessions.academic_year_id is null
  and exists (
    select 1
    from public.academic_years
    where academic_years.institute_id = attendance_sessions.institute_id
      and attendance_sessions.session_date between academic_years.start_date and academic_years.end_date
  );

select
  academic_years.institute_id,
  academic_years.name as academic_year,
  count(attendance_sessions.id) as linked_attendance_sessions
from public.academic_years
left join public.attendance_sessions
  on attendance_sessions.academic_year_id = academic_years.id
group by academic_years.institute_id, academic_years.name
order by academic_years.name;
