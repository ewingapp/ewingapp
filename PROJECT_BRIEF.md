# Project Brief: California State Scheduling Prototype

## What we're building

A local prototype of an online scheduling tool used by California State analysts/schedulers to book medical and psychological appointments at our practice's locations. It validates the workflows before investing in a production build.

This system will eventually pair with a separate HIPAA-compliant EMR, but **this prototype handles ONLY the placeholder/scheduling side**. It is intentionally NOT designed to hold PHI. The State only enters limited identifying info (case number, first letter of first name, first 5 letters of last name).

## Tech stack

- **Next.js 16+ with App Router** (TypeScript)
- **Tailwind CSS v4** + **shadcn/ui** components
- **Vercel Postgres** + **Prisma 7** (driver adapter for `pg`)
- **react-hook-form** + **zod** for form validation
- **date-fns** for date handling
- **No auth** — every user is a "State scheduler" for now

## Domain model (Prisma)

See `prisma/schema.prisma` for the source of truth.

- **Location** — our practice's offices
- **Specialty** — appointment types (Psych Eval, MSE Psych, Ortho IME, Internal Medicine IME, Neuro IME)
- **Doctor** — many-to-many with Specialty and Location, has `notes` field for scheduler context (e.g., "No EKG available")
- **Slot** — pre-generated availability tied to a (doctor, location, specialty, time) tuple, status `AVAILABLE` or `BOOKED`
- **Appointment** — bound to one Slot, holds case info + State branch + analyst/scheduler contact + status (`SCHEDULED`/`KEPT`/`NO_SHOW`/`CANCELLED`/`OTHER`), cancellation metadata
- **StateBranch** — list of State branches (DDS Sacramento, etc.)

### Slot generation rules
For each doctor, for each location they work at, generate slots Mon–Fri for the next 30 days:
- 8:00 AM – 9:00 AM: 30-minute slots (8:00, 8:30)
- 9:00 AM – 6:00 PM: 10-minute slots

Every slot starts as `AVAILABLE`.

## Screens to build

- **`/`** — Dashboard with cards linking to other sections
- **`/schedule`** — multi-section form (State info → Claimant info → Appointment details with slot picker)
- **`/appointments`** — filterable table with view/status/cancel/reschedule actions
- **`/reschedule/[id]`** — pick new slot for same location & specialty
- **`/reports`** — date-range totals + breakdowns by location/doctor/specialty/status
- **`/admin`** — CRUD for locations, doctors, specialties, branches, slot management

## Out of scope (for the prototype)

- Authentication / user accounts / roles
- HIPAA compliance (no PHI stored — only case # and minimal initials)
- SMS / email notifications
- EMR integration
- Billing
- Mobile app
