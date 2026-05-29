-- CoachOS first database schema.
-- This file creates only the foundation tables needed to connect app users
-- to coaching institutes. Students, batches, attendance, fees, and UI are
-- intentionally not included yet.

create extension if not exists "pgcrypto";

-- Table: institutes
-- Stores one coaching institute or tuition class workspace.
-- owner_id links the institute to the Supabase Auth user who created/owns it.
create table if not exists public.institutes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

comment on table public.institutes is
  'CoachOS institute workspaces. Each row represents one coaching institute or tuition class.';
comment on column public.institutes.id is
  'Primary key for the institute.';
comment on column public.institutes.name is
  'Institute or tuition class display name.';
comment on column public.institutes.owner_id is
  'Supabase Auth user id for the owner of this institute.';
comment on column public.institutes.created_at is
  'Timestamp when the institute row was created.';

-- Table: profiles
-- Stores app-level user profile data.
-- id is the same UUID as auth.users.id, which links each app profile to a
-- Supabase Auth user. institute_id connects the user to an institute.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  institute_id uuid references public.institutes(id) on delete cascade,
  full_name text,
  role text default 'owner',
  created_at timestamptz default now()
);

comment on table public.profiles is
  'CoachOS app profiles. Each profile links one auth.users account to one institute.';
comment on column public.profiles.id is
  'Primary key and Supabase Auth user id from auth.users.';
comment on column public.profiles.institute_id is
  'Institute this app user belongs to.';
comment on column public.profiles.full_name is
  'Display name for the app user.';
comment on column public.profiles.role is
  'Simple app role for the institute. Defaults to owner for the first version.';
comment on column public.profiles.created_at is
  'Timestamp when the profile row was created.';

create index if not exists institutes_owner_id_idx
  on public.institutes (owner_id);

create index if not exists profiles_institute_id_idx
  on public.profiles (institute_id);

-- Enable Row Level Security so table access is controlled by policies below.
alter table public.institutes enable row level security;
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own_profile on public.profiles;
drop policy if exists profiles_insert_own_profile on public.profiles;
drop policy if exists profiles_update_own_profile on public.profiles;
drop policy if exists institutes_select_owner_or_member on public.institutes;
drop policy if exists institutes_insert_owner on public.institutes;
drop policy if exists institutes_update_owner on public.institutes;

-- Policy: users can read only their own profile row.
create policy profiles_select_own_profile
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

comment on policy profiles_select_own_profile on public.profiles is
  'Users can select only the profile whose id matches their authenticated user id.';

-- Policy: users can create only their own profile.
-- The linked institute must be an institute they own, which prevents users
-- from joining another institute by guessing its id.
create policy profiles_insert_own_profile
  on public.profiles
  for insert
  to authenticated
  with check (
    id = auth.uid()
    and exists (
      select 1
      from public.institutes
      where institutes.id = profiles.institute_id
        and institutes.owner_id = auth.uid()
    )
  );

comment on policy profiles_insert_own_profile on public.profiles is
  'Users can insert only their own profile and only attach it to an institute they own.';

-- Policy: users can update only their own profile.
-- For this first version, changing the linked institute is allowed only when
-- the user owns that institute.
create policy profiles_update_own_profile
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and exists (
      select 1
      from public.institutes
      where institutes.id = profiles.institute_id
        and institutes.owner_id = auth.uid()
    )
  );

comment on policy profiles_update_own_profile on public.profiles is
  'Users can update only their own profile and keep it linked to an institute they own.';

-- Policy: users can read institutes where they are the owner or a member.
-- Membership is represented by the user's own profile.institute_id.
create policy institutes_select_owner_or_member
  on public.institutes
  for select
  to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.institute_id = institutes.id
    )
  );

comment on policy institutes_select_owner_or_member on public.institutes is
  'Users can select institutes they own or institutes connected to their own profile.';

-- Policy: users can create institutes only when they set themselves as owner.
create policy institutes_insert_owner
  on public.institutes
  for insert
  to authenticated
  with check (owner_id = auth.uid());

comment on policy institutes_insert_owner on public.institutes is
  'Users can insert an institute only if owner_id is their authenticated user id.';

-- Policy: only institute owners can update institute details.
create policy institutes_update_owner
  on public.institutes
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

comment on policy institutes_update_owner on public.institutes is
  'Only the owner can update an institute, and the row must remain owned by that user.';
