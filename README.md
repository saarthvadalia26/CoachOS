# CoachOS

CoachOS is an institute management platform for coaching centers to manage students, batches, attendance, fees, staff roles, communication, homework, tests, and parent/student access from one secure dashboard.

## Feature Overview

- Multi-branch institute management for organizing physical or operational centers.
- Role-based dashboard access for owners, branch managers, staff, teachers, and accountants.
- Student management with profile, batch, attendance, fee, homework, and test context.
- Batch management with student and teacher assignment.
- Attendance tracking with locked records, audit history, and controlled reopen workflow.
- Fee management with payment status, summaries, reports, and CSV exports.
- Staff and permissions management with branch-scoped operational roles.
- Communication hub with announcements and an in-app notification bell.
- Homework assignments with student-level submission tracking.
- Test and exam management with student-level score tracking.
- Student portal for read-only access to assigned academic information.
- Parent portal for read-only access to linked child information.
- Contact/demo request form powered by Formspree.

## Role System

CoachOS uses role and permission based access so each user sees only the data and actions appropriate to their responsibility.

- **Owner**: Full institute access across all branches, including settings, branches, staff, students, batches, attendance, fees, homework, tests, and communication.
- **Branch Manager**: Branch-scoped operational access for managing students, batches, attendance, fees, homework, tests, and communication where allowed.
- **Operations Staff**: Branch-scoped operational access for day-to-day student, batch, attendance, and fee follow-up workflows.
- **Academic Coordinator**: Branch-scoped academic access for students, batches, attendance visibility, homework, and tests.
- **Teacher**: Assigned-batch academic access, including read-only student/batch context and allowed homework/test workflows.
- **Accountant**: Fee-focused access for assigned branch financial workflows.
- **Student Portal User**: Read-only portal access to their linked student information.
- **Parent Portal User**: Read-only portal access to linked child information, including fees where enabled.

Portal users are separate from staff dashboard users and do not receive dashboard memberships.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui style components
- Supabase Auth
- Supabase Postgres
- Supabase RLS
- Sonner
- Formspree
- Vercel

## Project Structure

```text
coachos-app/
  src/app/        App Router routes, dashboard pages, auth pages, and portals
  src/components/ Shared UI, dashboard, and marketing components
  src/lib/        Server actions, permissions, Supabase clients, and utilities
  supabase/       Schema and SQL migrations
  public/         Static assets
```

## Environment Variables

Create a local `.env.local` file inside `coachos-app/` and provide values for the required services.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_FORMSPREE_ENDPOINT=
NEXT_PUBLIC_SITE_URL=
```

Never commit `.env.local`, Supabase keys, Formspree endpoints, or private credentials.

## Local Development

Run commands from the app directory:

```bash
cd coachos-app
npm install
npm run dev
```

The app runs locally at:

```text
http://localhost:3000
```

Quality checks:

```bash
npm run lint
npm run build
```

On Windows PowerShell, use `npm.cmd` if your environment blocks `npm.ps1`.

## Supabase Setup

CoachOS requires Supabase Auth, Supabase Postgres, and Row Level Security.

- Create a Supabase project.
- Configure the required environment variables locally and in deployment.
- Run SQL migrations from `coachos-app/supabase/migrations`.
- Keep RLS enabled for institute, branch, dashboard, and portal data isolation.
- Store Supabase keys only in environment variables.

Do not commit production database details or credentials.

## Deployment

CoachOS is designed for deployment on Vercel.

1. Connect the GitHub repository to Vercel.
2. Set the Vercel root directory to `coachos-app` if the repository root contains this nested app folder.
3. Add the required environment variables in Vercel project settings.
4. Configure Supabase Auth redirect URLs for local development and the deployed Vercel domain.
5. Deploy through Vercel.

## Security Notes

- Supabase RLS protects institute, branch, staff, student, academic, fee, and portal data.
- Dashboard access is based on memberships, roles, and scoped permissions.
- Student and parent portal users are read-only and separate from dashboard staff users.
- Parent/student portal data is derived server-side from linked portal access records.
- Never commit secrets, `.env.local`, Supabase keys, Formspree endpoints, or private credentials.
- Keep production credentials and database details outside the repository.

## Current Status

This project is under active development and prepared for demo/pilot usage.

## License

License not specified.
