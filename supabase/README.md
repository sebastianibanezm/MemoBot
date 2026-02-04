# MemoBot Supabase Setup

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In **Project Settings → API**, note:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret, server-only)

## 2. Enable pgvector

In the Supabase dashboard, go to **Database → Extensions** and enable **vector** (and ensure **uuid-ossp** is enabled).

## 3. Run the schema migration

**Option A – Supabase CLI (from repo root)**

1. Authenticate once: run `npx supabase login` in your terminal (or set `SUPABASE_ACCESS_TOKEN` from [account tokens](https://supabase.com/dashboard/account/tokens)).
2. For non-interactive link, set your database password: `SUPABASE_DB_PASSWORD` in env or in `apps/web/.env.local` (get it from Supabase Dashboard → Project Settings → Database).
3. From the repo root: `npm run db:migrate` (links using `NEXT_PUBLIC_SUPABASE_URL` from `apps/web/.env.local`, then runs `supabase db push`).

**Option B – SQL Editor**

1. Open **SQL Editor** in the Supabase dashboard.
2. Copy the contents of `migrations/20250203000000_initial_schema.sql`.
3. Run the script.

## 4. Environment variables

In `apps/web/.env.local` (create from `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

User sync from Clerk uses the **service_role** client so it can insert/update the `users` table; RLS is not enabled on `users` so backend sync works without setting `app.current_user_id`.
