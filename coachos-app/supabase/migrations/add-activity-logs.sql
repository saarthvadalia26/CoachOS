-- CoachOS activity logs.
-- Adds an append-only dashboard audit feed for important institute actions.

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  entity_label text,
  description text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

comment on table public.activity_logs is
  'Append-only dashboard activity feed for important institute actions. Portal users do not receive dashboard activity access.';

create index if not exists activity_logs_institute_id_idx
  on public.activity_logs (institute_id);

create index if not exists activity_logs_branch_id_idx
  on public.activity_logs (branch_id);

create index if not exists activity_logs_actor_user_id_idx
  on public.activity_logs (actor_user_id);

create index if not exists activity_logs_entity_type_idx
  on public.activity_logs (entity_type);

create index if not exists activity_logs_created_at_idx
  on public.activity_logs (created_at desc);

alter table public.activity_logs enable row level security;

create or replace function public.role_has_permission(
  member_role text,
  required_permission text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when member_role = 'owner' then true
    when member_role = 'branch_manager' then required_permission in (
      'dashboard.access',
      'branches.view',
      'academic_years.view',
      'students.view',
      'students.create',
      'students.update',
      'students.delete',
      'students.manage',
      'batches.view',
      'batches.create',
      'batches.update',
      'batches.delete',
      'batches.manage',
      'batch_teachers.manage',
      'homework.view',
      'homework.create',
      'homework.update',
      'homework.archive',
      'homework.delete',
      'homework.manage',
      'attendance.view',
      'attendance.create',
      'attendance.update',
      'attendance.alert',
      'attendance.delete',
      'attendance.manage',
      'fees.view',
      'fees.create',
      'fees.update',
      'fees.record_payment',
      'fees.mark_paid',
      'fees.apply_discount',
      'fees.export',
      'fees.delete',
      'fees.manage',
      'fees.send_reminder',
      'staff.view',
      'communications.view',
      'communications.create',
      'communications.update',
      'communications.delete',
      'notifications.view',
      'notifications.update',
      'activity.view',
      'tests.view',
      'tests.create',
      'tests.update',
      'tests.archive',
      'tests.delete'
    )
    when member_role = 'operations_staff' then required_permission in (
      'dashboard.access',
      'students.view',
      'students.create',
      'students.update',
      'batches.view',
      'homework.view',
      'attendance.view',
      'attendance.create',
      'attendance.update',
      'fees.view',
      'fees.send_reminder',
      'communications.view',
      'notifications.view',
      'notifications.update',
      'activity.view',
      'tests.view'
    )
    when member_role = 'accountant' then required_permission in (
      'dashboard.access',
      'students.view',
      'fees.view',
      'fees.create',
      'fees.update',
      'fees.record_payment',
      'fees.mark_paid',
      'fees.apply_discount',
      'fees.export',
      'fees.send_reminder',
      'fees.manage',
      'communications.view',
      'notifications.view',
      'notifications.update',
      'activity.view'
    )
    when member_role = 'academic_coordinator' then required_permission in (
      'dashboard.access',
      'students.view',
      'batches.view',
      'batches.create',
      'batches.update',
      'homework.view',
      'homework.create',
      'homework.update',
      'homework.archive',
      'homework.delete',
      'homework.manage',
      'attendance.view',
      'attendance.alert',
      'communications.view',
      'notifications.view',
      'notifications.update',
      'activity.view',
      'tests.view',
      'tests.create',
      'tests.update',
      'tests.archive',
      'tests.delete'
    )
    when member_role = 'teacher' then required_permission in (
      'dashboard.access',
      'students.view',
      'batches.view',
      'homework.view',
      'homework.create',
      'homework.update',
      'attendance.view',
      'communications.view',
      'notifications.view',
      'notifications.update',
      'tests.view',
      'tests.create',
      'tests.update',
      'tests.archive',
      'tests.delete'
    )
    else false
  end
$$;

drop policy if exists activity_logs_select_dashboard_members on public.activity_logs;
drop policy if exists activity_logs_insert_dashboard_members on public.activity_logs;
drop policy if exists activity_logs_update_blocked on public.activity_logs;
drop policy if exists activity_logs_delete_blocked on public.activity_logs;

create policy activity_logs_select_dashboard_members
  on public.activity_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships
      where memberships.user_id = auth.uid()
        and memberships.institute_id = activity_logs.institute_id
        and public.role_has_permission(memberships.role, 'activity.view'::text)
        and (
          memberships.role = 'owner'
          or (
            activity_logs.branch_id is not null
            and memberships.branch_id = activity_logs.branch_id
            and (
              memberships.role = 'branch_manager'
              or (
                memberships.role = 'operations_staff'
                and activity_logs.entity_type in (
                  'student',
                  'batch',
                  'attendance',
                  'homework',
                  'test',
                  'communication'
                )
              )
              or (
                memberships.role = 'academic_coordinator'
                and activity_logs.entity_type in (
                  'student',
                  'batch',
                  'attendance',
                  'homework',
                  'test',
                  'communication'
                )
              )
              or (
                memberships.role = 'accountant'
                and activity_logs.entity_type = 'fee'
              )
            )
          )
        )
    )
  );

create policy activity_logs_insert_dashboard_members
  on public.activity_logs
  for insert
  to authenticated
  with check (
    actor_user_id = auth.uid()
    and exists (
      select 1
      from public.memberships
      where memberships.user_id = auth.uid()
        and memberships.institute_id = activity_logs.institute_id
        and public.role_has_permission(memberships.role, 'dashboard.access'::text)
        and (
          memberships.role = 'owner'
          or (
            activity_logs.branch_id is not null
            and memberships.branch_id = activity_logs.branch_id
          )
        )
    )
  );

create policy activity_logs_update_blocked
  on public.activity_logs
  for update
  to authenticated
  using (false)
  with check (false);

create policy activity_logs_delete_blocked
  on public.activity_logs
  for delete
  to authenticated
  using (false);
