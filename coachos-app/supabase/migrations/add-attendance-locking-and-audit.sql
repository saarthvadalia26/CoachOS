-- CoachOS attendance locking and audit trail migration.
--
-- Existing attendance sessions intentionally remain unlocked because locked_at
-- stays null. They become locked the next time attendance is submitted.
-- This migration expects the Phase 1 membership/branch permission helpers to
-- already exist, especially public.current_user_can_access_attendance_session().

alter table public.attendance_sessions add column if not exists locked_at timestamptz;
alter table public.attendance_sessions add column if not exists locked_by uuid;
alter table public.attendance_sessions add column if not exists reopened_at timestamptz;
alter table public.attendance_sessions add column if not exists reopened_by uuid;
alter table public.attendance_sessions add column if not exists reopen_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'attendance_sessions_locked_by_fk'
      and conrelid = 'public.attendance_sessions'::regclass
  ) then
    alter table public.attendance_sessions
      add constraint attendance_sessions_locked_by_fk
      foreign key (locked_by) references auth.users(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'attendance_sessions_reopened_by_fk'
      and conrelid = 'public.attendance_sessions'::regclass
  ) then
    alter table public.attendance_sessions
      add constraint attendance_sessions_reopened_by_fk
      foreign key (reopened_by) references auth.users(id) on delete set null;
  end if;
end $$;

create table if not exists public.attendance_audit_logs (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  changed_by uuid references auth.users(id) on delete set null,
  action text not null,
  old_status text,
  new_status text,
  reason text,
  created_at timestamptz default now()
);

comment on table public.attendance_audit_logs is
  'Append-only attendance audit trail for session creation, locking, reopening, notes changes, and status corrections.';

alter table public.attendance_audit_logs drop constraint if exists attendance_audit_logs_action_check;
alter table public.attendance_audit_logs
  add constraint attendance_audit_logs_action_check
  check (
    action in (
      'session_created',
      'session_locked',
      'session_reopened',
      'status_changed',
      'notes_changed'
    )
  );

alter table public.attendance_audit_logs drop constraint if exists attendance_audit_logs_old_status_check;
alter table public.attendance_audit_logs
  add constraint attendance_audit_logs_old_status_check
  check (old_status is null or old_status in ('present', 'absent', 'late'));

alter table public.attendance_audit_logs drop constraint if exists attendance_audit_logs_new_status_check;
alter table public.attendance_audit_logs
  add constraint attendance_audit_logs_new_status_check
  check (new_status is null or new_status in ('present', 'absent', 'late'));

create index if not exists attendance_audit_logs_session_id_idx
  on public.attendance_audit_logs (session_id);

create index if not exists attendance_audit_logs_student_id_idx
  on public.attendance_audit_logs (student_id);

create index if not exists attendance_audit_logs_branch_id_idx
  on public.attendance_audit_logs (branch_id);

create index if not exists attendance_audit_logs_created_at_idx
  on public.attendance_audit_logs (created_at);

create or replace function public.current_user_can_reopen_attendance_session(
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
      from public.attendance_sessions
      join public.memberships
        on memberships.institute_id = attendance_sessions.institute_id
       and memberships.user_id = auth.uid()
      where attendance_sessions.id = target_session_id
        and memberships.role in ('owner', 'branch_manager')
        and public.role_has_permission(memberships.role, 'attendance.update'::text)
        and (
          memberships.role = 'owner'
          or memberships.branch_id = attendance_sessions.branch_id
        )
    )
$$;

comment on function public.current_user_can_reopen_attendance_session(uuid) is
  'Allows only institute owners and assigned branch managers to reopen a locked attendance session.';

-- Locked attendance sessions are immutable until reopened. This trigger keeps
-- RLS-backed direct writes aligned with the server action flow: operations
-- staff can submit and edit reopened sessions, but cannot change locked records
-- or unlock sessions themselves.
create or replace function public.prevent_locked_attendance_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session_id uuid;
  session_locked_at timestamptz;
begin
  if tg_table_name = 'attendance_records' then
    if tg_op = 'DELETE' then
      target_session_id := old.session_id;
    else
      target_session_id := new.session_id;
    end if;

    select attendance_sessions.locked_at
    into session_locked_at
    from public.attendance_sessions
    where attendance_sessions.id = target_session_id;

    if session_locked_at is not null then
      raise exception 'Attendance record is locked. Reopen it before changing records.';
    end if;

    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if tg_table_name = 'attendance_sessions' and tg_op = 'UPDATE' then
    if old.locked_at is not null then
      if new.locked_at is null then
        if not public.current_user_can_reopen_attendance_session(old.id) then
          raise exception 'Only the owner or assigned branch manager can reopen attendance.';
        end if;

        return new;
      end if;

      if new.notes is distinct from old.notes
        or new.session_date is distinct from old.session_date
        or new.batch_id is distinct from old.batch_id
        or new.branch_id is distinct from old.branch_id
        or new.institute_id is distinct from old.institute_id
        or new.academic_year_id is distinct from old.academic_year_id
      then
        raise exception 'Attendance record is locked. Reopen it before changing attendance details.';
      end if;
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_locked_attendance_session_changes_trigger on public.attendance_sessions;

create trigger prevent_locked_attendance_session_changes_trigger
  before update on public.attendance_sessions
  for each row
  execute function public.prevent_locked_attendance_changes();

drop trigger if exists prevent_locked_attendance_record_changes_trigger on public.attendance_records;

create trigger prevent_locked_attendance_record_changes_trigger
  before insert or update or delete on public.attendance_records
  for each row
  execute function public.prevent_locked_attendance_changes();

alter table public.attendance_audit_logs enable row level security;

drop policy if exists attendance_audit_logs_select_institute_members on public.attendance_audit_logs;
drop policy if exists attendance_audit_logs_insert_institute_members on public.attendance_audit_logs;
drop policy if exists attendance_audit_logs_update_blocked on public.attendance_audit_logs;
drop policy if exists attendance_audit_logs_delete_blocked on public.attendance_audit_logs;

create policy attendance_audit_logs_select_institute_members
  on public.attendance_audit_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.attendance_sessions
      where attendance_sessions.id = attendance_audit_logs.session_id
        and attendance_sessions.institute_id = attendance_audit_logs.institute_id
        and attendance_sessions.branch_id = attendance_audit_logs.branch_id
        and public.current_user_can_access_attendance_session(
          attendance_sessions.id,
          'attendance.view'::text
        )
    )
  );

create policy attendance_audit_logs_insert_institute_members
  on public.attendance_audit_logs
  for insert
  to authenticated
  with check (
    changed_by = auth.uid()
    and exists (
      select 1
      from public.attendance_sessions
      left join public.students
        on students.id = attendance_audit_logs.student_id
      where attendance_sessions.id = attendance_audit_logs.session_id
        and attendance_sessions.institute_id = attendance_audit_logs.institute_id
        and attendance_sessions.branch_id = attendance_audit_logs.branch_id
        and (
          attendance_audit_logs.student_id is null
          or (
            students.institute_id = attendance_sessions.institute_id
            and students.branch_id = attendance_sessions.branch_id
          )
        )
        and public.current_user_can_access_attendance_session(
          attendance_sessions.id,
          'attendance.update'::text
        )
    )
  );

create policy attendance_audit_logs_update_blocked
  on public.attendance_audit_logs
  for update
  to authenticated
  using (false)
  with check (false);

create policy attendance_audit_logs_delete_blocked
  on public.attendance_audit_logs
  for delete
  to authenticated
  using (false);
