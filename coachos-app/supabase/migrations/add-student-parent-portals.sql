-- CoachOS Student and Parent Portal foundation.
-- Portal users are read-only and do not receive dashboard memberships.

alter table public.students add column if not exists student_email text;
alter table public.students add column if not exists parent_email text;

create table if not exists public.student_portal_links (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  institute_id uuid not null references public.institutes(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  email text not null,
  status text not null default 'pending',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.student_portal_links is
  'Read-only student portal access links. Portal users do not receive dashboard memberships.';

create table if not exists public.parent_portal_links (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  institute_id uuid not null references public.institutes(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  parent_name text,
  email text not null,
  phone text,
  relationship text,
  status text not null default 'pending',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.parent_portal_links is
  'Read-only parent portal access links. One parent auth user can be linked to multiple students.';

alter table public.student_portal_links drop constraint if exists student_portal_links_status_check;
alter table public.student_portal_links
  add constraint student_portal_links_status_check
  check (status in ('pending', 'linked', 'disabled'));

alter table public.parent_portal_links drop constraint if exists parent_portal_links_status_check;
alter table public.parent_portal_links
  add constraint parent_portal_links_status_check
  check (status in ('pending', 'linked', 'disabled'));

create index if not exists students_student_email_idx
  on public.students (lower(student_email))
  where student_email is not null;

create index if not exists students_parent_email_idx
  on public.students (lower(parent_email))
  where parent_email is not null;

create index if not exists student_portal_links_student_id_idx
  on public.student_portal_links (student_id);

create index if not exists student_portal_links_auth_user_id_idx
  on public.student_portal_links (auth_user_id);

create index if not exists student_portal_links_institute_id_idx
  on public.student_portal_links (institute_id);

create index if not exists student_portal_links_branch_id_idx
  on public.student_portal_links (branch_id);

create index if not exists student_portal_links_email_idx
  on public.student_portal_links (lower(email));

create unique index if not exists student_portal_links_active_student_unique
  on public.student_portal_links (student_id)
  where status <> 'disabled';

create unique index if not exists student_portal_links_active_email_unique
  on public.student_portal_links (lower(email))
  where status <> 'disabled';

create index if not exists parent_portal_links_student_id_idx
  on public.parent_portal_links (student_id);

create index if not exists parent_portal_links_auth_user_id_idx
  on public.parent_portal_links (auth_user_id);

create index if not exists parent_portal_links_institute_id_idx
  on public.parent_portal_links (institute_id);

create index if not exists parent_portal_links_branch_id_idx
  on public.parent_portal_links (branch_id);

create index if not exists parent_portal_links_email_idx
  on public.parent_portal_links (lower(email));

create unique index if not exists parent_portal_links_active_student_email_unique
  on public.parent_portal_links (student_id, lower(email))
  where status <> 'disabled';

create or replace function public.current_user_can_access_student_portal(
  target_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_student_id is not null
    and exists (
      select 1
      from public.student_portal_links
      where student_portal_links.student_id = target_student_id
        and student_portal_links.auth_user_id = auth.uid()
        and student_portal_links.status = 'linked'
    )
$$;

comment on function public.current_user_can_access_student_portal(uuid) is
  'Returns true when the authenticated user is linked to the exact student portal record. Portal access is read-only and separate from dashboard memberships.';

create or replace function public.current_user_can_access_parent_student(
  target_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_student_id is not null
    and exists (
      select 1
      from public.parent_portal_links
      where parent_portal_links.student_id = target_student_id
        and parent_portal_links.auth_user_id = auth.uid()
        and parent_portal_links.status = 'linked'
    )
$$;

comment on function public.current_user_can_access_parent_student(uuid) is
  'Returns true when the authenticated user is linked as a parent for the target student. Parent portal access is read-only.';

create or replace function public.current_user_can_access_portal_student(
  target_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_can_access_student_portal(target_student_id)
      or public.current_user_can_access_parent_student(target_student_id)
$$;

comment on function public.current_user_can_access_portal_student(uuid) is
  'Shared read helper for student and parent portal visibility.';

create or replace function public.claim_student_portal_link_result()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  email_match_count integer;
  matched_link public.student_portal_links%rowtype;
begin
  if current_user_id is null then
    return 'unauthenticated';
  end if;

  if current_email is null then
    return 'no_match';
  end if;

  if exists (
    select 1
    from public.student_portal_links
    where auth_user_id = current_user_id
      and status = 'linked'
  ) then
    return 'linked';
  end if;

  if exists (
    select 1
    from public.student_portal_links
    where lower(email) = current_email
      and auth_user_id is not null
      and auth_user_id <> current_user_id
      and status <> 'disabled'
  ) then
    return 'already_claimed';
  end if;

  select count(*)
  into email_match_count
  from public.student_portal_links
  where auth_user_id is null
    and lower(email) = current_email
    and status = 'pending';

  if email_match_count = 0 then
    return 'no_match';
  end if;

  if email_match_count > 1 then
    return 'ambiguous';
  end if;

  select *
  into matched_link
  from public.student_portal_links
  where auth_user_id is null
    and lower(email) = current_email
    and status = 'pending'
  order by created_at asc
  limit 1;

  update public.student_portal_links
  set auth_user_id = current_user_id,
      status = 'linked',
      updated_at = now()
  where id = matched_link.id
    and auth_user_id is null
    and status = 'pending';

  return 'linked';
end;
$$;

comment on function public.claim_student_portal_link_result() is
  'Safely claims exactly one pending student portal link by authenticated email. Ambiguous matches are not linked.';

create or replace function public.claim_parent_portal_links_result()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  matched_institute_count integer;
  target_institute_id uuid;
begin
  if current_user_id is null then
    return 'unauthenticated';
  end if;

  if current_email is null then
    return 'no_match';
  end if;

  if exists (
    select 1
    from public.parent_portal_links
    where auth_user_id = current_user_id
      and status = 'linked'
  ) then
    return 'linked';
  end if;

  select count(distinct institute_id)
  into matched_institute_count
  from public.parent_portal_links
  where auth_user_id is null
    and lower(email) = current_email
    and status = 'pending';

  if matched_institute_count = 0 then
    if exists (
      select 1
      from public.parent_portal_links
      where lower(email) = current_email
        and auth_user_id is not null
        and auth_user_id <> current_user_id
        and status <> 'disabled'
    ) then
      return 'already_claimed';
    end if;

    return 'no_match';
  end if;

  if matched_institute_count > 1 then
    return 'ambiguous';
  end if;

  select institute_id
  into target_institute_id
  from public.parent_portal_links
  where auth_user_id is null
    and lower(email) = current_email
    and status = 'pending'
  order by created_at asc
  limit 1;

  update public.parent_portal_links
  set auth_user_id = current_user_id,
      status = 'linked',
      updated_at = now()
  where auth_user_id is null
    and lower(email) = current_email
    and institute_id = target_institute_id
    and status = 'pending';

  return 'linked';
end;
$$;

comment on function public.claim_parent_portal_links_result() is
  'Safely claims pending parent portal links by authenticated email for exactly one institute. Cross-institute ambiguity is not linked.';

create or replace function public.set_portal_link_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_student_portal_link_updated_at_trigger on public.student_portal_links;

create trigger set_student_portal_link_updated_at_trigger
  before update on public.student_portal_links
  for each row
  execute function public.set_portal_link_updated_at();

drop trigger if exists set_parent_portal_link_updated_at_trigger on public.parent_portal_links;

create trigger set_parent_portal_link_updated_at_trigger
  before update on public.parent_portal_links
  for each row
  execute function public.set_portal_link_updated_at();

alter table public.student_portal_links enable row level security;
alter table public.parent_portal_links enable row level security;

drop policy if exists student_portal_links_select_own_or_student_managers on public.student_portal_links;
drop policy if exists student_portal_links_insert_student_managers on public.student_portal_links;
drop policy if exists student_portal_links_update_student_managers on public.student_portal_links;
drop policy if exists student_portal_links_delete_student_managers on public.student_portal_links;
drop policy if exists parent_portal_links_select_own_or_student_managers on public.parent_portal_links;
drop policy if exists parent_portal_links_insert_student_managers on public.parent_portal_links;
drop policy if exists parent_portal_links_update_student_managers on public.parent_portal_links;
drop policy if exists parent_portal_links_delete_student_managers on public.parent_portal_links;
drop policy if exists institutes_select_portal_users on public.institutes;
drop policy if exists branches_select_portal_users on public.branches;
drop policy if exists students_select_portal_users on public.students;
drop policy if exists student_batches_select_portal_users on public.student_batches;
drop policy if exists batches_select_portal_users on public.batches;
drop policy if exists attendance_sessions_select_portal_users on public.attendance_sessions;
drop policy if exists attendance_records_select_portal_users on public.attendance_records;
drop policy if exists homework_assignments_select_portal_users on public.homework_assignments;
drop policy if exists homework_submissions_select_portal_users on public.homework_submissions;
drop policy if exists tests_select_portal_users on public.tests;
drop policy if exists test_scores_select_portal_users on public.test_scores;
drop policy if exists fee_records_select_parent_portal_users on public.fee_records;

create policy student_portal_links_select_own_or_student_managers
  on public.student_portal_links
  for select
  to authenticated
  using (
    auth_user_id = auth.uid()
    or public.current_user_can_access_student(student_id, 'students.update'::text)
  );

create policy student_portal_links_insert_student_managers
  on public.student_portal_links
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.students
      where students.id = student_portal_links.student_id
        and students.institute_id = student_portal_links.institute_id
        and students.branch_id = student_portal_links.branch_id
        and public.current_user_can_access_student(students.id, 'students.update'::text)
    )
  );

create policy student_portal_links_update_student_managers
  on public.student_portal_links
  for update
  to authenticated
  using (public.current_user_can_access_student(student_id, 'students.update'::text))
  with check (
    exists (
      select 1
      from public.students
      where students.id = student_portal_links.student_id
        and students.institute_id = student_portal_links.institute_id
        and students.branch_id = student_portal_links.branch_id
        and public.current_user_can_access_student(students.id, 'students.update'::text)
    )
  );

create policy student_portal_links_delete_student_managers
  on public.student_portal_links
  for delete
  to authenticated
  using (public.current_user_can_access_student(student_id, 'students.update'::text));

create policy parent_portal_links_select_own_or_student_managers
  on public.parent_portal_links
  for select
  to authenticated
  using (
    auth_user_id = auth.uid()
    or public.current_user_can_access_student(student_id, 'students.update'::text)
  );

create policy parent_portal_links_insert_student_managers
  on public.parent_portal_links
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.students
      where students.id = parent_portal_links.student_id
        and students.institute_id = parent_portal_links.institute_id
        and students.branch_id = parent_portal_links.branch_id
        and public.current_user_can_access_student(students.id, 'students.update'::text)
    )
  );

create policy parent_portal_links_update_student_managers
  on public.parent_portal_links
  for update
  to authenticated
  using (public.current_user_can_access_student(student_id, 'students.update'::text))
  with check (
    exists (
      select 1
      from public.students
      where students.id = parent_portal_links.student_id
        and students.institute_id = parent_portal_links.institute_id
        and students.branch_id = parent_portal_links.branch_id
        and public.current_user_can_access_student(students.id, 'students.update'::text)
    )
  );

create policy parent_portal_links_delete_student_managers
  on public.parent_portal_links
  for delete
  to authenticated
  using (public.current_user_can_access_student(student_id, 'students.update'::text));

create policy institutes_select_portal_users
  on public.institutes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.student_portal_links
      where student_portal_links.institute_id = institutes.id
        and student_portal_links.auth_user_id = auth.uid()
        and student_portal_links.status = 'linked'
    )
    or exists (
      select 1
      from public.parent_portal_links
      where parent_portal_links.institute_id = institutes.id
        and parent_portal_links.auth_user_id = auth.uid()
        and parent_portal_links.status = 'linked'
    )
  );

create policy branches_select_portal_users
  on public.branches
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.student_portal_links
      where student_portal_links.branch_id = branches.id
        and student_portal_links.auth_user_id = auth.uid()
        and student_portal_links.status = 'linked'
    )
    or exists (
      select 1
      from public.parent_portal_links
      where parent_portal_links.branch_id = branches.id
        and parent_portal_links.auth_user_id = auth.uid()
        and parent_portal_links.status = 'linked'
    )
  );

create policy students_select_portal_users
  on public.students
  for select
  to authenticated
  using (public.current_user_can_access_portal_student(students.id));

create policy student_batches_select_portal_users
  on public.student_batches
  for select
  to authenticated
  using (public.current_user_can_access_portal_student(student_batches.student_id));

create policy batches_select_portal_users
  on public.batches
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.student_batches
      where student_batches.batch_id = batches.id
        and public.current_user_can_access_portal_student(student_batches.student_id)
    )
  );

create policy attendance_sessions_select_portal_users
  on public.attendance_sessions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.attendance_records
      where attendance_records.session_id = attendance_sessions.id
        and public.current_user_can_access_portal_student(attendance_records.student_id)
    )
  );

create policy attendance_records_select_portal_users
  on public.attendance_records
  for select
  to authenticated
  using (public.current_user_can_access_portal_student(attendance_records.student_id));

create policy homework_assignments_select_portal_users
  on public.homework_assignments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.student_batches
      where student_batches.batch_id = homework_assignments.batch_id
        and public.current_user_can_access_portal_student(student_batches.student_id)
    )
  );

create policy homework_submissions_select_portal_users
  on public.homework_submissions
  for select
  to authenticated
  using (public.current_user_can_access_portal_student(homework_submissions.student_id));

create policy tests_select_portal_users
  on public.tests
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.student_batches
      where student_batches.batch_id = tests.batch_id
        and public.current_user_can_access_portal_student(student_batches.student_id)
    )
  );

create policy test_scores_select_portal_users
  on public.test_scores
  for select
  to authenticated
  using (public.current_user_can_access_portal_student(test_scores.student_id));

create policy fee_records_select_parent_portal_users
  on public.fee_records
  for select
  to authenticated
  using (public.current_user_can_access_parent_student(fee_records.student_id));
