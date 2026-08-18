# FBIT Committee Portal

A secure university committee governance application built with Next.js, Supabase Auth/Postgres/Realtime, TypeScript, and Tailwind CSS. The original [PRD.txt](./PRD.txt) and [prototype.html](./prototype.html) are preserved as design references.

## Local setup

Prerequisites: Node.js 20.19+ (Node 22 recommended), npm, and a current Docker Desktop/Engine.

1. Install dependencies: `npm ci`
2. Start Supabase: `npm run supabase:start`
3. Reset and seed the database: `npm run supabase:reset`
4. Copy `.env.example` to `.env.local` and replace the Supabase keys using `npm exec supabase status -o env`:
   - `API_URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `ANON_KEY` or the publishable key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SERVICE_ROLE_KEY` or the secret key → `SUPABASE_SECRET_KEY`
5. Start Next.js: `npm run dev`
6. Open <http://localhost:3000>. Mailpit is available at <http://localhost:54324>.

Local fixtures use password `FbitPortal123!`:

- `admin@fbit.test`, `dean@fbit.test`, `chair@fbit.test`, `staff@fbit.test`, `member@fbit.test`
- `unassigned@fbit.test`, `pending@fbit.test`, and `suspended@fbit.test` exercise denial states.

## Verification

- `npm run verify` — formatting, lint, types, unit tests, and production build
- `npm run supabase:test` — database/RLS tests (local Supabase must be running)
- `npm run test:e2e` — browser flows (local Supabase must be seeded)

Production setup and operations are documented in [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) and [docs/OPERATIONS.md](./docs/OPERATIONS.md).
