-- CoachOS Communication Hub v1 publish fix.
-- Keeps RLS enabled and aligns announcement read visibility with announcement
-- management rights. This prevents a valid branch-manager publish from failing
-- when the target audience is a different staff role.

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
          or announcements.created_by = auth.uid()
          or (
            announcements.branch_id is not null
            and memberships.branch_id = announcements.branch_id
            and public.role_has_permission(memberships.role, 'communications.update'::text)
          )
          or (
            (announcements.branch_id is null or memberships.branch_id = announcements.branch_id)
            and public.communication_audience_matches(memberships.role, announcements.audience)
          )
        )
    )
$$;

comment on function public.current_user_can_read_announcement(uuid) is
  'Returns true when the current membership can view the announcement by ownership, branch management rights, creator visibility, or audience membership.';

drop policy if exists announcements_insert_managers on public.announcements;

create policy announcements_insert_managers
  on public.announcements
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.institutes
      where institutes.id = announcements.institute_id
        and institutes.owner_id = auth.uid()
    )
    or public.has_institute_permission(announcements.institute_id, 'communications.create'::text)
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

drop policy if exists notification_items_insert_managers on public.notification_items;

create policy notification_items_insert_managers
  on public.notification_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.institutes
      where institutes.id = notification_items.institute_id
        and institutes.owner_id = auth.uid()
    )
    or public.has_institute_permission(notification_items.institute_id, 'communications.create'::text)
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
