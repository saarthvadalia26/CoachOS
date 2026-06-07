-- CoachOS attendance reopen limit migration.
--
-- Run this after add-attendance-locking-and-audit.sql. Existing attendance
-- sessions default to reopen_count = 0. The counter limits branch-manager
-- reopen attempts; institute owners can still reopen without a numeric limit.

alter table public.attendance_sessions
  add column if not exists reopen_count integer not null default 0;

update public.attendance_sessions
set reopen_count = 0
where reopen_count is null;

alter table public.attendance_sessions alter column reopen_count set default 0;
alter table public.attendance_sessions alter column reopen_count set not null;

alter table public.attendance_sessions drop constraint if exists attendance_sessions_reopen_count_check;
alter table public.attendance_sessions
  add constraint attendance_sessions_reopen_count_check
  check (reopen_count >= 0);

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
          or (
            memberships.branch_id = attendance_sessions.branch_id
            and attendance_sessions.reopen_count < 2
          )
        )
    )
$$;

comment on function public.current_user_can_reopen_attendance_session(uuid) is
  'Allows institute owners to reopen attendance without a numeric limit and assigned branch managers to reopen while reopen_count is below two.';

-- Recreate the lock guard with branch-manager reopen-count enforcement.
create or replace function public.prevent_locked_attendance_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session_id uuid;
  session_locked_at timestamptz;
  is_owner_reopen boolean;
  is_branch_manager_reopen boolean;
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
        select exists (
          select 1
          from public.memberships
          where memberships.user_id = auth.uid()
            and memberships.institute_id = old.institute_id
            and memberships.role = 'owner'
            and public.role_has_permission(memberships.role, 'attendance.update'::text)
        )
        into is_owner_reopen;

        if is_owner_reopen then
          return new;
        end if;

        select exists (
          select 1
          from public.memberships
          where memberships.user_id = auth.uid()
            and memberships.institute_id = old.institute_id
            and memberships.branch_id = old.branch_id
            and memberships.role = 'branch_manager'
            and public.role_has_permission(memberships.role, 'attendance.update'::text)
        )
        into is_branch_manager_reopen;

        if not is_branch_manager_reopen then
          raise exception 'Only the institute owner or assigned branch manager can reopen attendance.';
        end if;

        if old.reopen_count >= 2 then
          raise exception 'This attendance record has reached the reopen limit. Please contact the institute owner for further changes.';
        end if;

        if new.reopen_count <> old.reopen_count + 1 then
          raise exception 'Branch manager reopen must increment reopen_count by one.';
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
