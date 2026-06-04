-- CoachOS attendance save diagnostic.
-- Read-only by design: this script uses SELECT statements only.
--
-- Replace these placeholders everywhere before running:
-- - USER_EMAIL: authenticated user's email address
-- - BATCH_NAME: selected batch name
-- - SESSION_DATE: attendance date in YYYY-MM-DD format

-- 1. Auth/profile/membership for USER_EMAIL.
with inputs as (
  select
    'USER_EMAIL'::text as user_email,
    'BATCH_NAME'::text as batch_name,
    'SESSION_DATE'::date as session_date
)
select
  auth_users.id as auth_user_id,
  auth_users.email,
  profiles.institute_id as profile_institute_id,
  profiles.full_name as profile_full_name,
  profiles.role as profile_role,
  memberships.id as membership_id,
  memberships.institute_id as membership_institute_id,
  memberships.branch_id as membership_branch_id,
  branches.name as membership_branch_name,
  memberships.role as membership_role,
  memberships.created_at as membership_created_at
from inputs
join auth.users auth_users
  on lower(auth_users.email) = lower(inputs.user_email)
left join public.profiles
  on profiles.id = auth_users.id
left join public.memberships
  on memberships.user_id = auth_users.id
left join public.branches
  on branches.id = memberships.branch_id
order by memberships.created_at nulls last;

-- 2. User role, institute_id, branch_id.
with inputs as (
  select
    'USER_EMAIL'::text as user_email,
    'BATCH_NAME'::text as batch_name,
    'SESSION_DATE'::date as session_date
)
select
  auth_users.email,
  memberships.role,
  memberships.institute_id,
  institutes.name as institute_name,
  memberships.branch_id,
  branches.name as branch_name
from inputs
join auth.users auth_users
  on lower(auth_users.email) = lower(inputs.user_email)
join public.memberships
  on memberships.user_id = auth_users.id
join public.institutes
  on institutes.id = memberships.institute_id
left join public.branches
  on branches.id = memberships.branch_id
order by memberships.role, branches.name nulls first;

-- 3. Selected batch id, institute_id, branch_id.
with inputs as (
  select
    'USER_EMAIL'::text as user_email,
    'BATCH_NAME'::text as batch_name,
    'SESSION_DATE'::date as session_date
)
select
  batches.id as batch_id,
  batches.name as batch_name,
  batches.institute_id,
  institutes.name as institute_name,
  batches.branch_id,
  branches.name as branch_name,
  batches.subject,
  batches.schedule
from inputs
join public.batches
  on batches.name = inputs.batch_name
join public.institutes
  on institutes.id = batches.institute_id
left join public.branches
  on branches.id = batches.branch_id
order by batches.created_at desc, batches.id;

-- 4. Whether membership branch matches batch branch.
with inputs as (
  select
    'USER_EMAIL'::text as user_email,
    'BATCH_NAME'::text as batch_name,
    'SESSION_DATE'::date as session_date
)
select
  auth_users.email,
  memberships.id as membership_id,
  memberships.role,
  memberships.institute_id as membership_institute_id,
  memberships.branch_id as membership_branch_id,
  batches.id as batch_id,
  batches.name as batch_name,
  batches.institute_id as batch_institute_id,
  batches.branch_id as batch_branch_id,
  case
    when memberships.role = 'owner'
      and memberships.institute_id = batches.institute_id
      and memberships.branch_id is null
      then true
    when memberships.institute_id = batches.institute_id
      and memberships.branch_id = batches.branch_id
      then true
    else false
  end as membership_scope_matches_batch
from inputs
join auth.users auth_users
  on lower(auth_users.email) = lower(inputs.user_email)
join public.memberships
  on memberships.user_id = auth_users.id
join public.batches
  on batches.name = inputs.batch_name
order by membership_scope_matches_batch desc, memberships.role;

-- 5. Students assigned to selected batch.
with inputs as (
  select
    'USER_EMAIL'::text as user_email,
    'BATCH_NAME'::text as batch_name,
    'SESSION_DATE'::date as session_date
)
select
  batches.id as batch_id,
  batches.name as batch_name,
  students.id as student_id,
  students.full_name,
  students.institute_id as student_institute_id,
  students.branch_id as student_branch_id,
  branches.name as student_branch_name,
  student_batches.created_at as assigned_at
from inputs
join public.batches
  on batches.name = inputs.batch_name
join public.student_batches
  on student_batches.batch_id = batches.id
join public.students
  on students.id = student_batches.student_id
left join public.branches
  on branches.id = students.branch_id
order by students.full_name;

-- 6. Whether all assigned students have the same branch_id as the batch.
with inputs as (
  select
    'USER_EMAIL'::text as user_email,
    'BATCH_NAME'::text as batch_name,
    'SESSION_DATE'::date as session_date
)
select
  batches.id as batch_id,
  batches.name as batch_name,
  batches.branch_id as batch_branch_id,
  count(students.id) as assigned_student_count,
  count(*) filter (
    where students.institute_id is distinct from batches.institute_id
       or students.branch_id is distinct from batches.branch_id
  ) as mismatched_student_count,
  case
    when count(*) filter (
      where students.institute_id is distinct from batches.institute_id
         or students.branch_id is distinct from batches.branch_id
    ) = 0 then true
    else false
  end as all_students_match_batch_branch
from inputs
join public.batches
  on batches.name = inputs.batch_name
left join public.student_batches
  on student_batches.batch_id = batches.id
left join public.students
  on students.id = student_batches.student_id
group by batches.id, batches.name, batches.branch_id
order by batches.name;

-- 7. Existing attendance session for that batch/date.
with inputs as (
  select
    'USER_EMAIL'::text as user_email,
    'BATCH_NAME'::text as batch_name,
    'SESSION_DATE'::date as session_date
)
select
  attendance_sessions.id as session_id,
  attendance_sessions.institute_id,
  attendance_sessions.branch_id,
  attendance_sessions.batch_id,
  attendance_sessions.session_date,
  attendance_sessions.notes,
  attendance_sessions.created_at,
  batches.branch_id as batch_branch_id,
  (
    attendance_sessions.institute_id = batches.institute_id
    and attendance_sessions.branch_id = batches.branch_id
  ) as session_scope_matches_batch
from inputs
join public.batches
  on batches.name = inputs.batch_name
left join public.attendance_sessions
  on attendance_sessions.batch_id = batches.id
 and attendance_sessions.session_date = inputs.session_date
order by attendance_sessions.created_at nulls last;

-- 8. Existing attendance records for that session.
with inputs as (
  select
    'USER_EMAIL'::text as user_email,
    'BATCH_NAME'::text as batch_name,
    'SESSION_DATE'::date as session_date
)
select
  attendance_sessions.id as session_id,
  attendance_records.id as attendance_record_id,
  attendance_records.student_id,
  students.full_name,
  attendance_records.status,
  students.branch_id as student_branch_id,
  attendance_sessions.branch_id as session_branch_id,
  exists (
    select 1
    from public.student_batches
    where student_batches.batch_id = attendance_sessions.batch_id
      and student_batches.student_id = attendance_records.student_id
  ) as student_is_assigned_to_session_batch,
  (
    students.institute_id = attendance_sessions.institute_id
    and students.branch_id = attendance_sessions.branch_id
  ) as student_scope_matches_session
from inputs
join public.batches
  on batches.name = inputs.batch_name
join public.attendance_sessions
  on attendance_sessions.batch_id = batches.id
 and attendance_sessions.session_date = inputs.session_date
left join public.attendance_records
  on attendance_records.session_id = attendance_sessions.id
left join public.students
  on students.id = attendance_records.student_id
order by students.full_name nulls last;

-- 9. Attendance session unique indexes.
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'attendance_sessions'
  and indexdef ilike '%unique%'
order by indexname;

-- 10. Attendance record unique indexes.
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'attendance_records'
  and indexdef ilike '%unique%'
order by indexname;

-- 11. Attendance RLS policies.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('attendance_sessions', 'attendance_records')
order by tablename, policyname;

-- 12. Attendance-related trigger names.
select
  event_object_schema,
  event_object_table,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in ('attendance_sessions', 'attendance_records')
order by event_object_table, trigger_name, event_manipulation;

-- 13. role_has_permission results.
select
  checks.role,
  checks.permission,
  public.role_has_permission(checks.role, checks.permission) as allowed
from (
  values
    ('owner', 'attendance.create'),
    ('owner', 'attendance.update'),
    ('branch_manager', 'attendance.create'),
    ('branch_manager', 'attendance.update'),
    ('operations_staff', 'attendance.create'),
    ('operations_staff', 'attendance.update'),
    ('teacher', 'attendance.update'),
    ('academic_coordinator', 'attendance.update'),
    ('accountant', 'attendance.view')
) as checks(role, permission)
order by checks.role, checks.permission;
