# 📱 CoachOS Application

This directory contains the main web application workspace for CoachOS, built using Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, and Supabase.

---

## 📖 Main Documentation

For detailed information on system architecture, the RBAC permissions matrix, local database initialization, and deployment instructions, please refer to the main project documentation:

👉 **[Root README.md](../README.md)**

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env.local` and configure your Supabase credentials:
```bash
cp .env.example .env.local
```

### 3. Run Development Server
```bash
npm run dev
```
The application will be accessible at [http://localhost:3000](http://localhost:3000).

### 4. Build and Lint
```bash
# Run ESLint validation
npm run lint

# Build production distribution
npm run build
```
