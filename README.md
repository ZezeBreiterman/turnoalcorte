# Turnoalcorte

Barber shop scheduling platform. Customers book in under 25 seconds; owners manage the day from a keyboard-driven dashboard.

**Live demo:** https://turnoalcorte.vercel.app

![Dashboard](docs/screenshot-dashboard.png)

---

## Features

- **Public booking flow** — no account required. Customer picks service, barber, and date; available slots are computed in real time. The booking itself is written through a `SECURITY DEFINER` Postgres function (`book_appointment`) — the anonymous client never touches the `clients` or `appointments` tables directly, and the price is read server-side so it cannot be spoofed.
- **Barber-column day calendar** — each barber gets a vertical lane. Appointments can be dragged to reschedule within or across barbers.
- **Real-time updates** — Supabase Realtime pushes appointment changes to every connected client instantly. Two staff members can work the same view without stepping on each other.
- **Command palette** — `Cmd+K` / `Ctrl+K` opens a full-text command palette (cmdk) for quick navigation and actions without touching the mouse.
- **Status workflow** — appointments move through `pending → confirmed → checked-in → in-progress → completed`. Each transition is a deliberate action, not an automatic timer.
- **Availability resolver** — a pure function that computes 15-minute slot candidates for a given barber, service, and date. Buffer minutes before and after each appointment are first-class inputs; no slot is offered if the padded window would overlap an existing booking or a blocked time range.
- **Role-based access** — barbers see today's schedule and their client list; admins additionally access analytics, barber management, service configuration, and settings. Enforced at three layers: route loaders, a centralized `lib/can.ts` permission matrix driving the UI, and Postgres RLS policies (the real boundary).
- **No double-booking** — a Postgres `EXCLUDE` constraint makes overlapping appointments for the same barber impossible at the database level, closing the check-then-write race; the UI surfaces a friendly "slot just taken" recovery if two customers race the same time.
- **Analytics** — revenue and appointment volume charts (Recharts) scoped to any date range.

---

## Tech stack

| Tool | Why |
|---|---|
| React 19 | Concurrent rendering and the new compiler reduce re-renders on the live calendar without manual memoization. |
| TypeScript 6 | Strict mode catches mismatched database shapes at compile time rather than runtime. |
| Vite 8 | Sub-second HMR during development; route-level code splitting is trivial with dynamic `import()`. |
| Tailwind v4 | CSS-first config eliminates `tailwind.config.js`; the new engine compiles only what the build uses. |
| React Router v7 | Loader-based data fetching keeps auth guards and redirects colocated with the route instead of scattered across components. |
| TanStack Query v5 | Server state, background refetching, and optimistic updates backed by a typed query-key factory for scoped cache invalidation. |
| Supabase | Postgres, magic-link auth, and Realtime subscriptions from a single client. No separate auth service to operate. |
| Framer Motion 12 | Layout animations on the calendar when appointments are added or moved; spring physics matched to interaction weight. |
| dnd-kit | Drag-to-reschedule on the day calendar. Accessible by default; operable without a mouse. |
| Zod v4 | Schema validation for booking form inputs and API response shapes. Single source of truth between the form and the database write. |
| Recharts | Composable SVG charts for the analytics page. Straightforward to theme against the design tokens. |
| sonner | Toast notifications for booking confirmations, status changes, and errors. Minimal API; no context provider required. |
| cmdk | Headless command palette primitive wrapped with navigation targets and quick actions. |
| Zustand | UI state that genuinely does not belong in the server cache (selected date, open panels). Kept to a small slice. |

---

## Architecture decisions

### Timezone discipline via `lib/time.ts`

`src/lib/time.ts` is the only file in the codebase that constructs raw `Date` objects or imports directly from `date-fns`. Every other module goes through the named exports from this file (`now()`, `today()`, `parseTimestamp()`, `toTimeOnDate()`, `formatTime()`, etc.). This makes timezone behaviour auditable in one place. If the app ever needs to support multiple time zones, the change surface is exactly one file.

### Query key factory

`src/lib/query-keys.ts` exports a single factory object that produces typed, hierarchical query keys — for example, `keys.appointments.byBarber(barberId, date)`. TanStack Query's cache invalidation is scoped by key prefix: invalidating `keys.appointments.all` resets every appointment query; invalidating `keys.appointments.byBarber(id)` resets only that barber's lane. This prevents stale-cache bugs when a drag-to-reschedule touches more than one barber.

### Pure availability resolver

`src/features/availability/resolver.ts` is a pure function with no side effects and no Supabase calls. It receives schedule rows, time-off blocks, and booked appointments as plain objects, and returns an array of `{ startAt, endAt }` slots. Buffer math is applied symmetrically: the candidate window is `bufferBefore + serviceDuration + bufferAfter`; a slot is discarded if that window overlaps any existing booking's own buffered range. Because the resolver has no I/O, it is covered by unit tests that run in milliseconds without mocking. The Supabase queries that feed it live in the adjacent `resolver.queries.ts`.

### Security: RLS, server-side booking, double-booking constraint

Row-Level Security is enabled on every table. `clients` and `appointments` have
**no anonymous access** — the public booking flow goes through the
`book_appointment` `SECURITY DEFINER` function, which upserts the client, reads the
service price server-side, and inserts the appointment atomically. Anonymous
availability reads come from a PII-free view (`appointments_public`) that exposes
only `barber_id, start_time, end_time, status`. Staff write policies are
admin-gated (`is_admin()`); barbers can mutate only their own schedule and
time-off rows. A `btree_gist` `EXCLUDE` constraint guarantees no two non-cancelled
appointments overlap for the same barber. Migrations `001 → 004` must be run in
order (see Local setup).

### Supabase client without the Database generic

The project uses `createClient()` without the generated `Database` generic type. TypeScript 6 strict mode makes that generated generic incompatible with standard insert and update call signatures — the deep conditional types inferred for `from().insert()` resolve to `never` under certain narrowing paths. Instead, manually maintained interfaces in `src/types/database.ts` describe the rows and insert payloads for each table. This is more verbose but unambiguous and compiles without workarounds.

---

## Local setup

```bash
git clone https://github.com/your-handle/turnoalcorte.git
cd turnoalcorte
npm install
cp .env.example .env.local
# Open .env.local and fill in:
#   VITE_SUPABASE_URL=https://your-project.supabase.co
#   VITE_SUPABASE_ANON_KEY=your-anon-key
npm run dev
```

The app runs at `http://localhost:5173`.

**Database migrations** — in the Supabase SQL editor, run the files in
`supabase/migrations/` strictly in order: `001` (schema extensions), `002` (demo
seed data), `003` (shop config), `004` (RLS hardening + booking RPC +
double-booking constraint), `005` (slot holds). Later migrations depend on tables
from earlier ones; running out of order will error.

To run tests:

```bash
npm test                # single run
npm run test:watch      # watch mode
npm run test:coverage   # coverage report
```

---

## Demo credentials

This is a single-shop deployment.

```
Admin login:    your-email@example.com  (magic link — Supabase sends to your inbox)
Public booking: /book                   (no login required)
```

---

## Project structure

```
src/
├── components/       Shared UI primitives and layout shell (AppShell, sidebar, modals)
├── features/         Domain logic grouped by feature
│   ├── availability/ Slot resolver (pure function) + Supabase queries that feed it
│   ├── appointments/ CRUD, status transitions, optimistic updates
│   ├── barbers/      Barber list, schedule editor, time-off management
│   ├── clients/      Client profiles and appointment history
│   ├── services/     Service catalogue (name, duration, buffer, price)
│   └── analytics/    Revenue and volume aggregations
├── routes/           One file per route; thin wrappers over feature components
│   ├── book.tsx      Public booking flow (no auth)
│   ├── auth/         Magic-link login and Supabase callback
│   └── app/          Protected pages (today, calendar, clients, services, …)
├── lib/              Shared utilities with no UI dependencies
│   ├── time.ts       Single entry point for all date/time operations
│   ├── query-keys.ts Typed TanStack Query key factory
│   ├── supabase.ts   Singleton Supabase client
│   └── auth.ts       Session helpers used by route loaders
├── types/            Manual database row and insert interfaces
└── router.tsx        Route tree with loader-based auth guards
```

---

## What I would add next

- **Stripe deposits** — collect a partial payment at booking time to reduce no-shows.
- **SMS reminders** — send a Twilio message 24 hours and 1 hour before each appointment.
- **PWA + offline queue** — cache today's schedule in IndexedDB so the dashboard stays usable during a connection drop; sync writes when back online.
- **Multi-tenant support** — add a `shops` table and scope all queries by `shop_id` so the platform serves multiple barbershops from one deployment.
- **Customer portal** — let returning customers log in to view, reschedule, or cancel their own bookings without going through the owner.
