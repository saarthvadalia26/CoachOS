-- Fix portal RLS policies that caused dashboard SELECT regressions.
--
-- Root cause:
-- The first portal migration added additive SELECT policies, but some policy
-- expressions queried other RLS-protected tables directly. PostgreSQL can
-- evaluate those policy expressions for dashboard users too, which may recurse
-- through policies such as batches <-> student_batches or
-- attendance_sessions <-> attendance_records.
--
-- This migration preserves dashboard policies and portal security. It only
-- replaces portal SELECT policy bodies with security-definer helper functions.

create or replace function public.current_user_can_access_portal_batch(
  target_batch_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_batch_id is not null
    and exists (
      select 1
      from public.student_batches
      where student_batches.batch_id = target_batch_id
        and public.current_user_can_access_portal_student(student_batches.student_id)
    )
$$;

comment on function public.current_user_can_access_portal_batch(uuid) is
  'Security-definer portal batch read helper. Keeps portal RLS additive without policy recursion through student_batches.';

create or replace function public.current_user_can_access_portal_attendance_session(
  target_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_session_id is not null
    and exists (
      select 1
      from public.attendance_records
      where attendance_records.session_id = target_session_id
        and public.current_user_can_access_portal_student(attendance_records.student_id)
    )
$$;

comment on function public.current_user_can_access_portal_attendance_session(uuid) is
  'Security-definer portal attendance-session read helper. Avoids RLS recursion between attendance_sessions and attendance_records.';

create or replace function public.current_user_can_access_portal_homework_assignment(
  target_homework_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_homework_id is not null
    and exists (
      select 1
      from public.homework_assignments
      join public.student_batches
        on student_batches.batch_id = homework_assignments.batch_id
      where homework_assignments.id = target_homework_id
        and public.current_user_can_access_portal_student(student_batches.student_id)
    )
$$;

comment on function public.current_user_can_access_portal_homework_assignment(uuid) is
  'Security-definer portal homework read helper. Portal users can read homework for linked student batches only.';

create or replace function public.current_user_can_access_portal_test(
  target_test_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_test_id is not null
    and exists (
      select 1
      from public.tests
      join public.student_batches
        on student_batches.batch_id = tests.batch_id
      where tests.id = target_test_id
        and public.current_user_can_access_portal_student(student_batches.student_id)
    )
$$;

comment on function public.current_user_can_access_portal_test(uuid) is
  'Security-definer portal test read helper. Portal users can read tests for linked student batches only.';

drop policy if exists batches_select_portal_users on public.batches;
drop policy if exists attendance_sessions_select_portal_users on public.attendance_sessions;
drop policy if exists homework_assignments_select_portal_users on public.homework_assignments;
drop policy if exists tests_select_portal_users on public.tests;

create policy batches_select_portal_users
  on public.batches
  for select
  to authenticated
  using (public.current_user_can_access_portal_batch(batches.id));

create policy attendance_sessions_select_portal_users
  on public.attendance_sessions
  for select
  to authenticated
  using (
    public.current_user_can_access_portal_attendance_session(
      attendance_sessions.id
    )
  );

create policy homework_assignments_select_portal_users
  on public.homework_assignments
  for select
  to authenticated
  using (
    public.current_user_can_access_portal_homework_assignment(
      homework_assignments.id
    )
  );

create policy tests_select_portal_users
  on public.tests
  for select
  to authenticated
  using (public.current_user_can_access_portal_test(tests.id));
