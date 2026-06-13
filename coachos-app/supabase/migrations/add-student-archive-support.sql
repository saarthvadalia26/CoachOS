-- CoachOS student archive support.
-- Archive keeps historical attendance, fee records, and audit logs intact.
-- It avoids hard-deleting students whose locked attendance records are protected
-- by prevent_locked_attendance_changes().

alter table public.students
  add column if not exists archived_at timestamptz;

alter table public.students
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

create index if not exists students_archived_at_idx
  on public.students (archived_at);

create index if not exists students_institute_archived_idx
  on public.students (institute_id, archived_at);

comment on column public.students.archived_at is
  'When set, the student is archived and hidden from the default active student list while history remains intact.';

comment on column public.students.archived_by is
  'Authenticated user who archived the student.';
