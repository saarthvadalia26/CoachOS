-- Migration to fix homework RLS recursion and prevent PostgreSQL compiler inlining
--
-- 1. Helper functions plpgsql conversion
create or replace function public.current_user_can_access_homework_batch(
  target_batch_id uuid,
  required_permission text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  has_access boolean;
begin
  select exists (
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
  ) into has_access;

  return coalesce(has_access, false);
end;
$$;

create or replace function public.current_user_can_access_homework_assignment(
  target_homework_id uuid,
  required_permission text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  has_access boolean;
begin
  select exists (
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
  ) into has_access;

  return coalesce(has_access, false);
end;
$$;

create or replace function public.current_user_can_access_homework_submission(
  target_submission_id uuid,
  required_permission text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  has_access boolean;
begin
  select exists (
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
  ) into has_access;

  return coalesce(has_access, false);
end;
$$;

-- 2. Drop and recreate policies for homework_assignments
drop policy if exists homework_assignments_select_members on public.homework_assignments;
drop policy if exists homework_assignments_insert_members on public.homework_assignments;
drop policy if exists homework_assignments_update_members on public.homework_assignments;
drop policy if exists homework_assignments_delete_members on public.homework_assignments;

create policy homework_assignments_select_members
  on public.homework_assignments
  for select
  to authenticated
  using (
    public.current_user_can_access_homework_batch(
      homework_assignments.batch_id,
      'homework.view'::text
    )
  );

create policy homework_assignments_insert_members
  on public.homework_assignments
  for insert
  to authenticated
  with check (
    public.current_user_can_access_homework_batch(
      homework_assignments.batch_id,
      'homework.create'::text
    )
    and exists (
      select 1
      from public.batches
      where batches.id = homework_assignments.batch_id
        and batches.institute_id = homework_assignments.institute_id
        and batches.branch_id = homework_assignments.branch_id
    )
  );

create policy homework_assignments_update_members
  on public.homework_assignments
  for update
  to authenticated
  using (
    public.current_user_can_access_homework_batch(
      homework_assignments.batch_id,
      'homework.update'::text
    )
  )
  with check (
    public.current_user_can_access_homework_batch(
      homework_assignments.batch_id,
      'homework.update'::text
    )
    and exists (
      select 1
      from public.batches
      where batches.id = homework_assignments.batch_id
        and batches.institute_id = homework_assignments.institute_id
        and batches.branch_id = homework_assignments.branch_id
    )
  );

create policy homework_assignments_delete_members
  on public.homework_assignments
  for delete
  to authenticated
  using (
    public.current_user_can_access_homework_batch(
      homework_assignments.batch_id,
      'homework.delete'::text
    )
  );

-- 3. Drop and recreate policies for homework_submissions
drop policy if exists homework_submissions_select_members on public.homework_submissions;
drop policy if exists homework_submissions_insert_members on public.homework_submissions;
drop policy if exists homework_submissions_update_members on public.homework_submissions;
drop policy if exists homework_submissions_delete_members on public.homework_submissions;

create policy homework_submissions_select_members
  on public.homework_submissions
  for select
  to authenticated
  using (
    public.current_user_can_access_homework_batch(
      (select batch_id from public.homework_assignments where id = homework_submissions.homework_id),
      'homework.view'::text
    )
  );

create policy homework_submissions_insert_members
  on public.homework_submissions
  for insert
  to authenticated
  with check (
    public.current_user_can_access_homework_batch(
      (select batch_id from public.homework_assignments where id = homework_submissions.homework_id),
      'homework.update'::text
    )
    and exists (
      select 1
      from public.homework_assignments
      where homework_assignments.id = homework_submissions.homework_id
        and homework_assignments.institute_id = homework_submissions.institute_id
        and homework_assignments.branch_id = homework_submissions.branch_id
    )
  );

create policy homework_submissions_update_members
  on public.homework_submissions
  for update
  to authenticated
  using (
    public.current_user_can_access_homework_batch(
      (select batch_id from public.homework_assignments where id = homework_submissions.homework_id),
      'homework.update'::text
    )
  )
  with check (
    public.current_user_can_access_homework_batch(
      (select batch_id from public.homework_assignments where id = homework_submissions.homework_id),
      'homework.update'::text
    )
    and exists (
      select 1
      from public.homework_assignments
      where homework_assignments.id = homework_submissions.homework_id
        and homework_assignments.institute_id = homework_submissions.institute_id
        and homework_assignments.branch_id = homework_submissions.branch_id
    )
  );

create policy homework_submissions_delete_members
  on public.homework_submissions
  for delete
  to authenticated
  using (
    public.current_user_can_access_homework_batch(
      (select batch_id from public.homework_assignments where id = homework_submissions.homework_id),
      'homework.delete'::text
    )
  );
