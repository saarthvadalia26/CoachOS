-- CoachOS Phase 1 multi-branch migration verification.
-- Read-only by design: this script uses SELECT statements only.

-- Summary: every row should return status = pass and issue_count = 0.
select
  '1' as check_no,
  'Each institute has at least one branch' as check_name,
  case when count(*) = 0 then 'pass' else 'fail' end as status,
  count(*) as issue_count
from (
  select institutes.id
  from public.institutes
  where not exists (
    select 1
    from public.branches
    where branches.institute_id = institutes.id
  )
) issues
union all
select
  '2',
  'Each institute owner has an owner membership',
  case when count(*) = 0 then 'pass' else 'fail' end,
  count(*)
from (
  select institutes.id
  from public.institutes
  where not exists (
    select 1
    from public.memberships
    where memberships.institute_id = institutes.id
      and memberships.user_id = institutes.owner_id
      and memberships.role = 'owner'
      and memberships.branch_id is null
  )
) issues
union all
select
  '3',
  'students.branch_id is not null',
  case when count(*) = 0 then 'pass' else 'fail' end,
  count(*)
from public.students
where branch_id is null
union all
select
  '4',
  'batches.branch_id is not null',
  case when count(*) = 0 then 'pass' else 'fail' end,
  count(*)
from public.batches
where branch_id is null
union all
select
  '5',
  'attendance_sessions.branch_id is not null',
  case when count(*) = 0 then 'pass' else 'fail' end,
  count(*)
from public.attendance_sessions
where branch_id is null
union all
select
  '6',
  'fee_records.branch_id is not null',
  case when count(*) = 0 then 'pass' else 'fail' end,
  count(*)
from public.fee_records
where branch_id is null
union all
select
  '7',
  'No student_batches connect students and batches from different branches',
  case when count(*) = 0 then 'pass' else 'fail' end,
  count(*)
from public.student_batches
join public.students
  on students.id = student_batches.student_id
join public.batches
  on batches.id = student_batches.batch_id
where students.institute_id is distinct from batches.institute_id
   or students.branch_id is distinct from batches.branch_id
union all
select
  '8',
  'No attendance_records connect students from a different branch than the session',
  case when count(*) = 0 then 'pass' else 'fail' end,
  count(*)
from public.attendance_records
join public.attendance_sessions
  on attendance_sessions.id = attendance_records.session_id
join public.students
  on students.id = attendance_records.student_id
where students.institute_id is distinct from attendance_sessions.institute_id
   or students.branch_id is distinct from attendance_sessions.branch_id
union all
select
  '9',
  'No fee_records connect students from a different branch than the fee record',
  case when count(*) = 0 then 'pass' else 'fail' end,
  count(*)
from public.fee_records
join public.students
  on students.id = fee_records.student_id
where students.institute_id is distinct from fee_records.institute_id
   or students.branch_id is distinct from fee_records.branch_id
order by check_no;

-- Detail rows for failed checks. Each query should return zero rows.

select
  institutes.id as institute_id,
  institutes.name as institute_name
from public.institutes
where not exists (
  select 1
  from public.branches
  where branches.institute_id = institutes.id
)
order by institutes.created_at, institutes.id;

select
  institutes.id as institute_id,
  institutes.name as institute_name,
  institutes.owner_id
from public.institutes
where not exists (
  select 1
  from public.memberships
  where memberships.institute_id = institutes.id
    and memberships.user_id = institutes.owner_id
    and memberships.role = 'owner'
    and memberships.branch_id is null
)
order by institutes.created_at, institutes.id;

select
  students.id as student_id,
  students.institute_id,
  students.full_name
from public.students
where students.branch_id is null
order by students.created_at, students.id;

select
  batches.id as batch_id,
  batches.institute_id,
  batches.name
from public.batches
where batches.branch_id is null
order by batches.created_at, batches.id;

select
  attendance_sessions.id as attendance_session_id,
  attendance_sessions.institute_id,
  attendance_sessions.batch_id,
  attendance_sessions.session_date
from public.attendance_sessions
where attendance_sessions.branch_id is null
order by attendance_sessions.session_date, attendance_sessions.id;

select
  fee_records.id as fee_record_id,
  fee_records.institute_id,
  fee_records.student_id,
  fee_records.amount_due,
  fee_records.amount_paid,
  fee_records.status
from public.fee_records
where fee_records.branch_id is null
order by fee_records.created_at, fee_records.id;

select
  student_batches.id as student_batch_id,
  student_batches.student_id,
  students.branch_id as student_branch_id,
  student_batches.batch_id,
  batches.branch_id as batch_branch_id,
  students.institute_id as student_institute_id,
  batches.institute_id as batch_institute_id
from public.student_batches
join public.students
  on students.id = student_batches.student_id
join public.batches
  on batches.id = student_batches.batch_id
where students.institute_id is distinct from batches.institute_id
   or students.branch_id is distinct from batches.branch_id
order by student_batches.created_at, student_batches.id;

select
  attendance_records.id as attendance_record_id,
  attendance_records.session_id,
  attendance_sessions.branch_id as session_branch_id,
  attendance_records.student_id,
  students.branch_id as student_branch_id,
  attendance_sessions.institute_id as session_institute_id,
  students.institute_id as student_institute_id
from public.attendance_records
join public.attendance_sessions
  on attendance_sessions.id = attendance_records.session_id
join public.students
  on students.id = attendance_records.student_id
where students.institute_id is distinct from attendance_sessions.institute_id
   or students.branch_id is distinct from attendance_sessions.branch_id
order by attendance_records.created_at, attendance_records.id;

select
  fee_records.id as fee_record_id,
  fee_records.branch_id as fee_record_branch_id,
  fee_records.student_id,
  students.branch_id as student_branch_id,
  fee_records.institute_id as fee_record_institute_id,
  students.institute_id as student_institute_id,
  fee_records.amount_due,
  fee_records.amount_paid,
  fee_records.status
from public.fee_records
join public.students
  on students.id = fee_records.student_id
where students.institute_id is distinct from fee_records.institute_id
   or students.branch_id is distinct from fee_records.branch_id
order by fee_records.created_at, fee_records.id;

-- Membership distribution by role.
select
  memberships.role,
  count(*) as membership_count
from public.memberships
group by memberships.role
order by memberships.role;
