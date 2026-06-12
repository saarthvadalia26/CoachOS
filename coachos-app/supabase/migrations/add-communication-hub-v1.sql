-- CoachOS Communication Hub v1.
-- Adds in-app announcements and notifications only. This migration does not
-- add PWA, WhatsApp, SMS, email sending, payment gateway, parent portal, or AI.

create extension if not exists "pgcrypto";

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  title text not null,
  body text not null,
  audience text not null default 'all_staff',
  priority text not null default 'normal',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.announcements is
  'In-app institute and branch announcements for staff communication. External SMS, email, and WhatsApp delivery are intentionally not part of v1.';

create table if not exists public.notification_items (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null default 'announcement',
  priority text not null default 'normal',
  source_table text,
  source_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.notification_items is
  'In-app notification feed. Broad notifications are scoped by institute or branch; per-user read state is stored in notification_reads.';

create table if not exists public.notification_reads (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notification_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now()
);

comment on table public.notification_reads is
  'Per-user read receipts for broad notification_items rows.';

alter table public.announcements drop constraint if exists announcements_audience_check;
alter table public.announcements
  add constraint announcements_audience_check
  check (
    audience in (
      'all_staff',
      'branch_staff',
      'owners',
      'branch_managers',
      'operations_staff',
      'accountants',
      'academic_coordinators',
      'teachers'
    )
  );

alter table public.announcements drop constraint if exists announcements_priority_check;
alter table public.announcements
  add constraint announcements_priority_check
  check (priority in ('low', 'normal', 'high', 'urgent'));

alter table public.notification_items drop constraint if exists notification_items_type_check;
alter table public.notification_items
  add constraint notification_items_type_check
  check (type in ('announcement', 'fee_reminder', 'attendance_alert', 'system'));

alter table public.notification_items drop constraint if exists notification_items_priority_check;
alter table public.notification_items
  add constraint notification_items_priority_check
  check (priority in ('low', 'normal', 'high', 'urgent'));

create index if not exists announcements_institute_id_idx
  on public.announcements (institute_id);

create index if not exists announcements_branch_id_idx
  on public.announcements (branch_id);

create index if not exists announcements_created_at_idx
  on public.announcements (created_at desc);

create index if not exists notification_items_institute_id_idx
  on public.notification_items (institute_id);

create index if not exists notification_items_branch_id_idx
  on public.notification_items (branch_id);

create index if not exists notification_items_user_id_idx
  on public.notification_items (user_id);

create index if not exists notification_items_created_at_idx
  on public.notification_items (created_at desc);

create index if not exists notification_reads_user_id_idx
  on public.notification_reads (user_id);

create unique index if not exists notification_reads_notification_id_user_id_idx
  on public.notification_reads (notification_id, user_id);

-- Refresh the shared permission helper so SQL policies and server helpers agree.
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
      'notifications.update'
    )
    when member_role = 'operations_staff' then required_permission in (
      'dashboard.access',
      'students.view',
      'students.create',
      'students.update',
      'batches.view',
      'attendance.view',
      'attendance.create',
      'attendance.update',
      'fees.view',
      'fees.send_reminder',
      'communications.view',
      'notifications.view',
      'notifications.update'
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
      'notifications.update'
    )
    when member_role = 'academic_coordinator' then required_permission in (
      'dashboard.access',
      'students.view',
      'batches.view',
      'batches.create',
      'batches.update',
      'attendance.view',
      'attendance.alert',
      'communications.view',
      'notifications.view',
      'notifications.update'
    )
    when member_role = 'teacher' then required_permission in (
      'dashboard.access',
      'students.view',
      'batches.view',
      'attendance.view',
      'communications.view',
      'notifications.view',
      'notifications.update'
    )
    else false
  end
$$;

create or replace function public.communication_audience_matches(
  member_role text,
  target_audience text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when member_role = 'owner' then true
    when target_audience = 'all_staff' then member_role in (
      'branch_manager',
      'operations_staff',
      'accountant',
      'academic_coordinator',
      'teacher'
    )
    when target_audience = 'branch_staff' then member_role in (
      'branch_manager',
      'operations_staff',
      'accountant',
      'academic_coordinator',
      'teacher'
    )
    when target_audience = 'owners' then member_role = 'owner'
    when target_audience = 'branch_managers' then member_role = 'branch_manager'
    when target_audience = 'operations_staff' then member_role = 'operations_staff'
    when target_audience = 'accountants' then member_role = 'accountant'
    when target_audience = 'academic_coordinators' then member_role = 'academic_coordinator'
    when target_audience = 'teachers' then member_role = 'teacher'
    else false
  end
$$;

comment on function public.communication_audience_matches(text, text) is
  'Checks whether a membership role belongs to an announcement audience. Owners are allowed to view all announcements.';

create or replace function public.current_user_can_read_announcement(
  target_announcement_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_announcement_id is not null
    and exists (
      select 1
      from public.announcements
      join public.memberships
        on memberships.institute_id = announcements.institute_id
       and memberships.user_id = auth.uid()
      where announcements.id = target_announcement_id
        and public.role_has_permission(memberships.role, 'communications.view'::text)
        and (
          memberships.role = 'owner'
          or (
            (announcements.branch_id is null or memberships.branch_id = announcements.branch_id)
            and public.communication_audience_matches(memberships.role, announcements.audience)
          )
        )
    )
$$;

comment on function public.current_user_can_read_announcement(uuid) is
  'Returns true when the current membership can view the announcement for its institute, branch, and audience.';

create or replace function public.current_user_can_manage_announcement(
  target_announcement_id uuid,
  required_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_announcement_id is not null
    and required_permission is not null
    and exists (
      select 1
      from public.announcements
      join public.memberships
        on memberships.institute_id = announcements.institute_id
       and memberships.user_id = auth.uid()
      where announcements.id = target_announcement_id
        and public.role_has_permission(memberships.role, required_permission)
        and (
          memberships.role = 'owner'
          or (
            announcements.branch_id is not null
            and memberships.branch_id = announcements.branch_id
          )
        )
    )
$$;

comment on function public.current_user_can_manage_announcement(uuid, text) is
  'Returns true for owner institute management or branch-manager scoped announcement management.';

create or replace function public.current_user_can_read_notification(
  target_notification_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and target_notification_id is not null
    and exists (
      select 1
      from public.notification_items
      join public.memberships
        on memberships.institute_id = notification_items.institute_id
       and memberships.user_id = auth.uid()
      where notification_items.id = target_notification_id
        and public.role_has_permission(memberships.role, 'notifications.view'::text)
        and (
          notification_items.user_id = auth.uid()
          or memberships.role = 'owner'
          or (
            (notification_items.branch_id is null or memberships.branch_id = notification_items.branch_id)
            and (
              (
                notification_items.type = 'announcement'
                and notification_items.source_table = 'announcements'
                and public.current_user_can_read_announcement(notification_items.source_id)
              )
              or (
                notification_items.type = 'fee_reminder'
                and public.role_has_permission(memberships.role, 'fees.view'::text)
              )
              or (
                notification_items.type = 'attendance_alert'
                and public.role_has_permission(memberships.role, 'attendance.view'::text)
              )
              or notification_items.type = 'system'
            )
          )
        )
    )
$$;

comment on function public.current_user_can_read_notification(uuid) is
  'Returns true when a notification is directly assigned to the user or visible through institute, branch, role, and source rules.';

alter table public.announcements enable row level security;
alter table public.notification_items enable row level security;
alter table public.notification_reads enable row level security;

drop policy if exists announcements_select_visible on public.announcements;
drop policy if exists announcements_insert_managers on public.announcements;
drop policy if exists announcements_update_managers on public.announcements;
drop policy if exists announcements_delete_managers on public.announcements;
drop policy if exists notification_items_select_visible on public.notification_items;
drop policy if exists notification_items_insert_managers on public.notification_items;
drop policy if exists notification_items_update_managers on public.notification_items;
drop policy if exists notification_items_delete_managers on public.notification_items;
drop policy if exists notification_reads_select_own on public.notification_reads;
drop policy if exists notification_reads_insert_own_visible on public.notification_reads;
drop policy if exists notification_reads_update_own on public.notification_reads;
drop policy if exists notification_reads_delete_own on public.notification_reads;

create policy announcements_select_visible
  on public.announcements
  for select
  to authenticated
  using (public.current_user_can_read_announcement(announcements.id));

create policy announcements_insert_managers
  on public.announcements
  for insert
  to authenticated
  with check (
    public.has_institute_permission(announcements.institute_id, 'communications.create'::text)
    or (
      announcements.branch_id is not null
      and exists (
        select 1
        from public.branches
        where branches.id = announcements.branch_id
          and branches.institute_id = announcements.institute_id
          and public.has_branch_permission(announcements.branch_id, 'communications.create'::text)
      )
    )
  );

create policy announcements_update_managers
  on public.announcements
  for update
  to authenticated
  using (
    public.current_user_can_manage_announcement(
      announcements.id,
      'communications.update'::text
    )
  )
  with check (
    public.has_institute_permission(announcements.institute_id, 'communications.update'::text)
    or (
      announcements.branch_id is not null
      and exists (
        select 1
        from public.branches
        where branches.id = announcements.branch_id
          and branches.institute_id = announcements.institute_id
          and public.has_branch_permission(announcements.branch_id, 'communications.update'::text)
      )
    )
  );

create policy announcements_delete_managers
  on public.announcements
  for delete
  to authenticated
  using (
    public.current_user_can_manage_announcement(
      announcements.id,
      'communications.delete'::text
    )
  );

create policy notification_items_select_visible
  on public.notification_items
  for select
  to authenticated
  using (public.current_user_can_read_notification(notification_items.id));

create policy notification_items_insert_managers
  on public.notification_items
  for insert
  to authenticated
  with check (
    public.has_institute_permission(notification_items.institute_id, 'communications.create'::text)
    or (
      notification_items.branch_id is not null
      and exists (
        select 1
        from public.branches
        where branches.id = notification_items.branch_id
          and branches.institute_id = notification_items.institute_id
          and (
            public.has_branch_permission(notification_items.branch_id, 'communications.create'::text)
            or (
              notification_items.type = 'fee_reminder'
              and public.has_branch_permission(notification_items.branch_id, 'fees.send_reminder'::text)
            )
            or (
              notification_items.type = 'attendance_alert'
              and public.has_branch_permission(notification_items.branch_id, 'attendance.alert'::text)
            )
          )
      )
    )
  );

create policy notification_items_update_managers
  on public.notification_items
  for update
  to authenticated
  using (
    public.has_institute_permission(notification_items.institute_id, 'communications.update'::text)
    or (
      notification_items.branch_id is not null
      and public.has_branch_permission(notification_items.branch_id, 'communications.update'::text)
    )
  )
  with check (
    public.has_institute_permission(notification_items.institute_id, 'communications.update'::text)
    or (
      notification_items.branch_id is not null
      and public.has_branch_permission(notification_items.branch_id, 'communications.update'::text)
    )
  );

create policy notification_items_delete_managers
  on public.notification_items
  for delete
  to authenticated
  using (
    public.has_institute_permission(notification_items.institute_id, 'communications.delete'::text)
    or (
      notification_items.branch_id is not null
      and public.has_branch_permission(notification_items.branch_id, 'communications.delete'::text)
    )
  );

create policy notification_reads_select_own
  on public.notification_reads
  for select
  to authenticated
  using (notification_reads.user_id = auth.uid());

create policy notification_reads_insert_own_visible
  on public.notification_reads
  for insert
  to authenticated
  with check (
    notification_reads.user_id = auth.uid()
    and public.current_user_can_read_notification(notification_reads.notification_id)
  );

create policy notification_reads_update_own
  on public.notification_reads
  for update
  to authenticated
  using (notification_reads.user_id = auth.uid())
  with check (notification_reads.user_id = auth.uid());

create policy notification_reads_delete_own
  on public.notification_reads
  for delete
  to authenticated
  using (notification_reads.user_id = auth.uid());
