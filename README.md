# 🎓 CoachOS

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-green?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployment-black?style=for-the-badge&logo=vercel)](https://vercel.com/)

CoachOS is a professional, enterprise-ready institute management platform tailored for coaching centers, test prep institutes, and private academies. It provides a secure, single-dashboard command center to organize students, batches, attendance registries, fee tracking, academic assignments, staff operations, and parent/student portals.

---

## 🚀 Key Value Propositions

*   **Multi-Branch Management:** Segment and isolate data cleanly across physical or operational branches under one central corporate ownership.
*   **Granular RBAC System:** Ensure staff, teachers, accountants, and portal users have highly tailored view and action permissions.
*   **Audit-Tracked Attendance:** Track daily presence with attendance locks, change logs, and a structured supervisor approval flow for modifications.
*   **Billing & Fee Tracking:** Monitor fee structures, track payments, export financial reports, and identify outstanding dues.
*   **Integrated Academics:** Assign homework, record test scores, and organize students into specific batches with assigned teachers.
*   **Dedicated Portals:** Separate, secure, read-only portals for students and parents to check progress, schedules, homework, and fees.

---

## 🛡️ Role-Based Access Control (RBAC) Matrix

CoachOS enforces strict Row Level Security (RLS) and view-level permissions. Here is how operational features map to user roles:

| Feature Area | Owner | Branch Manager | Operations Staff | Academic Coordinator | Teacher | Accountant | Student/Parent |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Global Settings & Branches** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Staff & Role Management** | ✅ | Scoped | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Student Profiles & Batches** | ✅ | ✅ | ✅ | ✅ | 📖 | ❌ | ❌ |
| **Attendance Registries** | ✅ | ✅ | ✅ | ✅ | ✅ (Assigned) | ❌ | 📖 (Read-Only) |
| **Fee & Payment Invoices** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | 📖 (Read-Only) |
| **Homework Assignments** | ✅ | ✅ | ❌ | ✅ | ✅ (Assigned) | ❌ | 📖 / Submit |
| **Test Scores & Exams** | ✅ | ✅ | ❌ | ✅ | ✅ (Assigned) | ❌ | 📖 (Read-Only) |
| **Announcements Hub** | ✅ | ✅ | ✅ | ✅ | 📖 | ❌ | 📖 (Read-Only) |

> 💡 *Note: **Student and Parent Portal Users** access a separate, read-only experience and do not have access to administrative dashboards.*

---

## 📁 Repository Structure

```text
coachos/
├── coachos-app/
│   ├── src/
│   │   ├── app/             # Next.js App Router (pages, API routes, portals, auth layouts)
│   │   ├── components/      # Reusable UI components (shadcn/ui, dashboard cards, tables)
│   │   ├── lib/             # Shared utilities (Supabase clients, RBAC hooks, formatting helper functions)
│   │   └── proxy.ts         # Middleware & proxy routing helpers
│   ├── supabase/
│   │   ├── migrations/      # DB Schema, functions, triggers, and RLS policies
│   │   └── schema.sql       # Complete database schema snapshot
│   ├── public/              # Static assets, branding logos, icons, and sitemaps
│   ├── package.json         # Node.js workspace metadata and direct dependencies
│   └── tsconfig.json        # TypeScript configuration settings
└── README.md                # Project introduction and root configuration
```

---

## 🛠️ Tech Stack & Architecture

*   **Front-End Framework:** Next.js 16 (using App Router features, React Server Components, and Actions)
*   **Type Safety:** TypeScript for strict codebase contracts and interface mapping
*   **Styling & Components:** Tailwind CSS v4 alongside modular Radix UI primitives configured through shadcn/ui
*   **Backend & DB Integration:** Supabase (Auth management, Postgres Database, and Row Level Security)
*   **Notifications:** Sonner for elegant toast notifications
*   **Marketing & Demos:** Formspree for handling landing/contact form submissions

---

## 💻 Local Development Setup

Follow these steps to run CoachOS locally on your environment:

### Prerequisites
*   Node.js (v18.x or newer recommended)
*   npm (v10.x or newer) or yarn/pnpm

### 1. Clone & Install Dependencies
Navigate into the application folder and install package packages:
```bash
git clone https://github.com/saarthvadalia26/coachos.git
cd coachos/coachos-app
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root of the `coachos-app/` directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
NEXT_PUBLIC_FORMSPREE_ENDPOINT=your-formspree-endpoint-id
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```
> ⚠️ **Important:** Do not commit `.env.local` files or private Supabase credentials to production branches.

### 3. Initialize Supabase Database
1. Set up a new project on [Supabase Console](https://database.new).
2. Go to the **SQL Editor** in your Supabase project dashboard.
3. Copy and run the schema setup from `supabase/schema.sql` to initialize tables, relationships, and custom triggers.
4. Execute any outstanding migrations located under `supabase/migrations/` sequentially.

### 4. Start the Application
Boot the Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

---

## 🔬 Code Quality & Build Checks

Ensure code standards and production bundle readiness using these linting and compiler steps:

```bash
# Run code analysis and linting checks
npm run lint

# Build production bundle to verify compilation and React Server components compilation
npm run build
```

---

## ☁️ Deployment Checklist (Vercel)

CoachOS is optimized for zero-configuration deployments on Vercel:

1. **Import Project:** Link your GitHub repository in your Vercel Dashboard.
2. **Root Directory:** Configure the root directory settings on Vercel to point directly to `coachos-app`.
3. **Environment variables:** Copy the keys from your `.env.local` file over to the project's deployment settings on Vercel.
4. **Auth Redirects:** Register your deployed Vercel domain URLs within the Supabase Auth settings (**Authentication -> URL Configuration -> Redirect URLs**) to prevent login callback issues.

---

## 🔒 Security & Data Compliance

*   **Row Level Security (RLS):** Policies are configured at the Postgres level ensuring data for one branch is completely inaccessible by staff members from another branch.
*   **Secure API Scope:** Mutations are guarded using backend authorization helpers that cross-examine the Supabase session token role claims prior to code execution.
*   **Protected Portals:** Read-only structures prevent student/parent portal users from modifying grades, billing statuses, or attendance logs.
