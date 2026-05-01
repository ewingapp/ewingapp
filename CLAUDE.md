@AGENTS.md

# CLAUDE.md — California State Scheduling

> Read **`PROJECT_BRIEF.md`** for the full requirements.
> This file is the running status / orientation doc for Claude sessions.
> Also read **`AGENTS.md`** — Next.js 16 has breaking changes from older training data.

## What this project is

A prototype scheduling tool for California State analysts to book medical/psych appointments at our practice. Deployed to Vercel, backed by Vercel Postgres. Pairs eventually with a separate HIPAA-compliant EMR — **this side stores no PHI** (only case # + first initial + 5-char last name prefix).

## Stack

- **Next.js 16** (App Router, TypeScript) + **Tailwind v4** + **shadcn/ui**
- **Prisma 7** with **`@prisma/adapter-pg`** (Prisma 7 requires a driver adapter; URL lives in `prisma.config.ts`, not the schema file)
- **react-hook-form** + **zod** for forms
- **Vercel Postgres** (production) — local dev uses the same connection string or a separate dev branch DB

## Repo layout

```
app/                      Next.js App Router pages (server components by default)
  page.tsx                Home / dashboard
  schedule/page.tsx       Booking flow (TODO)
  appointments/page.tsx   Listing + filters (TODO)
  reschedule/[id]/page.tsx (TODO)
  reports/page.tsx        (TODO)
  admin/                  CRUD pages (TODO)
  api/                    Route handlers (TODO)
components/ui/            shadcn primitives (button, input, dialog, card, etc.)
lib/
  db.ts                   PrismaClient singleton with pg adapter
  utils.ts                shadcn cn() helper
  generated/prisma/       Auto-generated Prisma client (gitignored)
prisma/
  schema.prisma           Source of truth for DB schema
  seed.ts                 Seed locations / specialties / doctors / branches / 30 days of slots
prisma.config.ts          Prisma CLI config (loads DATABASE_URL via dotenv)
PROJECT_BRIEF.md          Original product brief
CLAUDE.md                 This file
```

## Resume on a different machine

1. **Clone:** `git clone https://github.com/ewingapp/ewingapp.git && cd ewingapp`
2. **Install:** `npm install` (this also runs `prisma generate` via the postinstall hook)
3. **Env:** create `.env` with a `DATABASE_URL`:
   - On Vercel dashboard → project → Storage → your Postgres DB → `.env.local` tab → copy the `DATABASE_URL`
   - Or use a separate dev branch DB to avoid touching prod data
4. **Migrate:** `npm run db:push` (or `npx prisma migrate deploy` if migrations exist)
5. **Seed:** `npm run db:seed` (only seeds if `Location` table is empty — safe to re-run)
6. **Run:** `npm run dev` → http://localhost:3000

## Key scripts

- `npm run dev` — Next.js dev server
- `npm run build` — production build
- `npm run db:push` — push current schema to DB without creating migration files (good for prototyping)
- `npm run db:migrate` — apply existing migrations (production)
- `npm run db:seed` — populate seed data (idempotent — checks if locations exist first)

## Environment variables

| Var | Where set | Purpose |
|-----|-----------|---------|
| `DATABASE_URL` | `.env` (local) / Vercel project settings | Postgres connection string |

## Conventions

- **Server Components by default**; Client Components only for forms / interactive UI (`"use client"`).
- **API mutations** via Route Handlers under `app/api/`.
- All forms use **react-hook-form + zod** (zodResolver) for validation.
- **Phone numbers** stored as digits-only strings; format on display.
- **No PHI** — never add fields beyond what the brief specifies for claimant identity.
- Use **`prisma`** singleton from `lib/db.ts` — never instantiate `PrismaClient` elsewhere.

## Build progress

| Step | Status |
|---|---|
| Next.js scaffold (TS, Tailwind, App Router) | done |
| shadcn/ui (button, input, label, select, dialog, card, textarea, checkbox) | done |
| Prisma schema + adapter setup | done |
| Seed script | done |
| Home page (dashboard) | TODO |
| Admin section (locations, doctors, specialties, branches, slot mgmt) | TODO |
| `/schedule` (the core screen) | TODO |
| `/appointments` (list + filters + status/cancel) | TODO |
| `/reschedule/[id]` | TODO |
| `/reports` | TODO |
| Vercel Postgres provisioned + connected | TODO |
| First deploy to ewingapp.com | TODO |

## Notes on Prisma 7

- Schema file does **not** specify `url` in the datasource block. Prisma 7 reads the URL from `prisma.config.ts` (which uses `dotenv` to load `.env`).
- At runtime, the `PrismaClient` is constructed with a driver adapter (`PrismaPg`) — see `lib/db.ts`.
- Generated client lives at `lib/generated/prisma/` (gitignored).
- After any schema change: `npm run db:push` (dev) or write a migration with `npx prisma migrate dev --name <description>`.
