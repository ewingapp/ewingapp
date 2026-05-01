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

## Hosting and deploys

| Resource | Value |
|---|---|
| Production URL | https://ewingapp.vercel.app |
| Custom domain (TODO) | https://ewingapp.com |
| GitHub | https://github.com/ewingapp/ewingapp |
| Vercel team | `foroutlookemail-8350s-projects` |
| Vercel project | `ewingapp` |
| Database | Neon Postgres (free tier, via Vercel marketplace integration), region `us-east-1` |
| Auto-deploy trigger | `git push origin main` → Vercel rebuilds and deploys |

The DB is shared across `development` / `preview` / `production` Vercel environments — no separate dev DB. Be careful when destructive (don't truncate tables without warning the user).

## Resume on a different machine (or new shell)

```bash
# Prereqs: git, node 20+, vercel CLI (npm install -g vercel) and you're logged in (vercel login)

git clone https://github.com/ewingapp/ewingapp.git
cd ewingapp
npm install                      # also runs `prisma generate` via postinstall
vercel link                      # → Set up "C:\path\to\ewingapp"? Y
                                 #   Scope?  foroutlookemail-8350's projects
                                 #   Link to existing project? Y → name: ewingapp
vercel env pull .env             # writes DATABASE_URL etc. into .env (gitignored)
npm run dev                      # http://localhost:3000
```

If the database has never been migrated/seeded (e.g., a fresh DB), also run:
```bash
npm run db:push      # creates tables from schema.prisma
npm run db:seed      # seeds — idempotent, skips if Locations exist
```

## How a fresh Claude session should orient

1. **Read this file.** It is the source of truth for project state.
2. **Read `PROJECT_BRIEF.md`** for the full product spec.
3. **Read `AGENTS.md`** — Next.js 16 has breaking changes from older training data; check `node_modules/next/dist/docs/` before writing Next.js code.
4. **Check the build progress table below** to see what's done vs. TODO.
5. **Don't re-scaffold.** This project is already initialized. Edit existing files; add new files as needed.
6. **Don't run destructive DB ops** without confirming with the user.

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
| Seed script (3 locations, 5 specialties, 6 doctors, 8 branches, ~16k slots over 30 weekdays) | done |
| Home page (dashboard cards) | done |
| Vercel Postgres (Neon) provisioned + connected to project | done |
| First deploy live at ewingapp.vercel.app | done |
| Admin section (locations, doctors, specialties, branches, slot mgmt) | TODO |
| `/schedule` (the core screen) | TODO |
| `/appointments` (list + filters + status/cancel) | TODO |
| `/reschedule/[id]` | TODO |
| `/reports` | TODO |
| Custom domain ewingapp.com attached | TODO |

## Notes on Prisma 7

- Schema file does **not** specify `url` in the datasource block. Prisma 7 reads the URL from `prisma.config.ts` (which uses `dotenv` to load `.env`).
- At runtime, the `PrismaClient` is constructed with a driver adapter (`PrismaPg`) — see `lib/db.ts`.
- Generated client lives at `lib/generated/prisma/` (gitignored).
- After any schema change: `npm run db:push` (dev) or write a migration with `npx prisma migrate dev --name <description>`.
