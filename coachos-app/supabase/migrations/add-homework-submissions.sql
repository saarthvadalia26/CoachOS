-- CoachOS Homework submission tracking.
-- Tracks each student's assignment status without adding portals, file uploads,
-- external messaging, payment, PWA, or AI features.

create table if not exists public.homework_submissions (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  homework_id uuid not null references public.homework_assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'assigned',
  submitted_at timestamptz,
  checked_at timestamptz,
  checked_by uuid references auth.users(id) on delete set null,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.homework_submissions is
  'Student-level homework tracking. Existing rows are kept for history when students are archived.';

alter table public.homework_submissions drop constraint if exists homework_submissions_status_check;
alter table public.homework_submissions
  add constraint homework_submissions_status_check
  check (status in ('assigned', 'submitted', 'checked', 'late', 'missing', 'excused'));

alter table public.homework_submissions drop constraint if exists homework_submissions_homework_student_unique;
alter table public.homework_submissions
  add constraint homework_submissions_homework_student_unique
  unique (homework_id, student_id);

create index if not exists homework_submissions_institute_id_idx
  on public.homework_submissions (institute_id);

create index if not exists homework_submissions_branch_id_idx
  on public.homework_submissions (branch_id);

create index if not exists homework_submissions_homework_id_idx
  on public.homework_submissions (homework_id);

create index if not exists homework_submissions_student_id_idx
  on public.homework_submissions (student_id);

create index if not exists homework_submissions_status_idx
  on public.homework_submissions (status);

create index if not exists homework_submissions_submitted_at_idx
  on public.homework_submissions (submitted_at);

create index if not exists homework_submissions_checked_at_idx
  on public.homework_submissions (checked_at);

create or replace function public.validate_homework_submission_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_homework public.homework_assignments%rowtype;
  target_student public.students%rowtype;
begin
  select *
  into target_homework
  from public.homework_assignments
  where homework_assignments.id = new.homework_id;

  select *
  into target_student
  from public.students
  where students.id = new.student_id;

  if target_homework.id is null or target_student.id is null then
    raise exception 'Homework submission requires an existing homework assignment and student.';
  end if;

  if tg_op = 'INSERT' and target_student.archived_at is not null then
    raise exception 'Archived students cannot receive new homework submissions.';
  end if;

  if new.institute_id <> target_homework.institute_id
    or new.branch_id <> target_homework.branch_id
    or target_student.institute_id <> target_homework.institute_id
    or target_student.branch_id <> target_homework.branch_id
  then
    raise exception 'Homework submission branch must match its homework assignment and student.';
  end if;

  if not exists (
    select 1
    from public.student_batches
    where student_batches.batch_id = target_homework.batch_id
      and student_batches.student_id = target_student.id
  ) then
    raise exception 'Homework submission student must belong to the homework batch.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_homework_submission_scope_trigger
  on public.homework_submissions;

create trigger validate_homework_submission_scope_trigger
  before insert or update on public.homework_submissions
  for each row
  execute function public.validate_homework_submission_scope();

create or replace function public.set_homework_submission_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_homework_submission_updated_at_trigger
  on public.homework_submissions;

create trigger set_homework_submission_updated_at_trigger
  before update on public.homework_submissions
  for each row
  execute function public.set_homework_submission_updated_at();

create or replace function public.current_user_can_access_homework_submission(
  target_submission_id uuid,
  required_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_submission_id is not null
    and required_permission is not null
    and exists (
      select 1
      from public.homework_submissions
      join public.homework_assignments
        on homework_assignments.id = homework_submissions.homework_id
      where homework_submissions.id = target_submission_id
        and homework_submissions.institute_id = homework_assignments.institute_id
        and homework_submissions.branch_id = homework_assignments.branch_id
        and public.current_user_can_access_homework_assignment(
          homework_assignments.id,
          required_permission
        )
    )
$$;

comment on function public.current_user_can_access_homework_submission(uuid, text) is
  'Checks Homework submission permissions through the parent assignment and batch.';

alter table public.homework_submissions enable row level security;

drop policy if exists homework_submissions_select_members on public.homework_submissions;
drop policy if exists homework_submissions_insert_members on public.homework_submissions;
drop policy if exists homework_submissions_update_members on public.homework_submissions;
drop policy if exists homework_submissions_delete_members on public.homework_submissions;

create policy homework_submissions_select_members
  on public.homework_submissions
  for select
  to authenticated
  using (
    public.current_user_can_access_homework_submission(
      homework_submissions.id,
      'homework.view'::text
    )
  );

create policy homework_submissions_insert_members
  on public.homework_submissions
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.homework_assignments
      where homework_assignments.id = homework_submissions.homework_id
        and homework_assignments.institute_id = homework_submissions.institute_id
        and homework_assignments.branch_id = homework_submissions.branch_id
        and public.current_user_can_access_homework_assignment(
          homework_assignments.id,
          'homework.update'::text
        )
    )
  );

create policy homework_submissions_update_members
  on public.homework_submissions
  for update
  to authenticated
  using (
    public.current_user_can_access_homework_submission(
      homework_submissions.id,
      'homework.update'::text
    )
  )
  with check (
    exists (
      select 1
      from public.homework_assignments
      where homework_assignments.id = homework_submissions.homework_id
        and homework_assignments.institute_id = homework_submissions.institute_id
        and homework_assignments.branch_id = homework_submissions.branch_id
        and public.current_user_can_access_homework_assignment(
          homework_assignments.id,
          'homework.update'::text
        )
    )
  );

create policy homework_submissions_delete_members
  on public.homework_submissions
  for delete
  to authenticated
  using (
    public.current_user_can_access_homework_submission(
      homework_submissions.id,
      'homework.delete'::text
    )
  );
