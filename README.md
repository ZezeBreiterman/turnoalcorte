# Turnoalcorte

Barbershop scheduling platform. Customers book in under 25 seconds; owners manage the full day from a keyboard-driven dashboard.

**Live:** https://turnoalcorte.vercel.app · **Booking:** https://turnoalcorte.vercel.app/book

---

## Table of contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Architecture](#architecture)
4. [Security model](#security-model)
5. [Local setup](#local-setup)
6. [Database migrations](#database-migrations)
7. [Demo credentials](#demo-credentials)
8. [Project structure](#project-structure)
9. [Testing](#testing)
10. [Roadmap](#roadmap)

---

## Features

### Public booking (`/book`)
- No account required — any customer can book
- Picks service → barber (or "any") → date + time in one unified view
- Available slots computed from live schedule, time-off, and existing bookings
- 10-minute server-side slot hold prevents two customers grabbing the same time
- Auto-assigns the least-loaded barber when "any" is chosen
- Booking confirmation ticket with a 6-character code; optional email receipt
- Friendly "slot just taken" recovery if two customers race the same window

### Staff dashboard (`/app`)
- **Today view** — KPI strip (appointments, revenue, pending), live appointment list with Supabase Realtime, add-appointment sheet
- **Calendar** — day, week, and month views; drag-to-reschedule within a day lane; right-click context menu (edit / duplicate / cancel)
- **Barbers** — add/edit barbers, assign service permissions, set weekly schedule, block vacation/time-off
- **Services** — service catalogue (name, duration, buffer minutes, price); per-service discount codes (% or fixed)
- **Clients** — searchable client list with notes and preferred barber
- **Analytics** — revenue trend, bookings by day, hourly heatmap, barber performance, top services (Recharts)
- **Settings** — shop name/address/phone/instagram, theme, language (ES/EN)
- **Command palette** — `Cmd+K` / `Ctrl+K` for instant navigation and actions

### Auth
- Magic-link login (no password required) via Supabase OTP
- Password fallback with forgot-password reset flow
- Role-based access: `admin` sees everything; `barber` sees only their own calendar and today view

---

## Tech stack

| Layer | Tool | Why |
|---|---|---|
| Framework | React 19 | Concurrent rendering and the new compiler cut re-renders on the live calendar |
| Language | TypeScript 5 strict | Mismatched database shapes caught at compile time |
| Build | Vite 8 | Sub-second HMR; manual chunk splitting for vendor bundles |
| Styling | Tailwind CSS v4 | CSS-first config, design tokens as custom properties |
| Routing | React Router v7 | Loader-based auth guards colocated with routes |
| Server state | TanStack Query v5 | Typed query-key factory, background refetch, optimistic updates |
| Backend | Supabase | Postgres + Auth + Realtime + Storage from one client |
| Animation | Framer Motion 12 | Spring-physics layout transitions; `layoutId` for shared-element moves |
| Drag & drop | dnd-kit | Accessible drag-to-reschedule; keyboard operable |
| Validation | Zod v4 | Single schema used by forms and API payloads |
| Charts | Recharts | Composable SVG charts themed against design tokens |
| Toasts | sonner | No context provider; fired from anywhere |
| Command palette | cmdk | Headless primitive wrapped with nav targets |
| Global UI state | Zustand + persist | Only UI state that doesn't belong in server cache |

---

## Architecture

### Directory layout

```
src/
├── components/         Shared UI primitives and layout shell
│   ├── layout/         AppShell, Sidebar, MobileMenu
│   ├── ui/             Button, Input, Card, Badge, Avatar, Tooltip …
│   └── command/        CommandPalette (cmdk wrapper)
├── features/           Domain logic grouped by capability
│   └── availability/   Slot resolver (pure fn) + Supabase queries
├── routes/             One file per route — thin orchestration layer
│   ├── book/           Public booking flow (no auth required)
│   ├── auth/           Login + Supabase OTP callback
│   └── app/            Protected pages (today, calendar, clients …)
├── lib/                Shared utilities — no UI dependencies
│   ├── auth.ts         Session + profile helpers used by route loaders
│   ├── can.ts          Role × action × resource permission matrix
│   ├── query-keys.ts   Typed TanStack Query key factory
│   ├── supabase.ts     Singleton Supabase client
│   └── time.ts         Single entry point for all date/time operations
├── store/
│   └── ui.store.ts     Zustand slice: theme, language, sidebar, calendar view
├── types/
│   └── database.ts     Manual row + insert interfaces (no generated types)
├── i18n/               react-i18next setup + EN/ES locale files
├── hooks/              useTheme, useDensity, useMediaQuery …
└── router.tsx          Route tree with loader-based auth guards
```

### Timezone discipline (`lib/time.ts`)

`lib/time.ts` is the **only** file that constructs raw `Date` objects or imports directly from `date-fns`. Every other module calls named exports from here (`now()`, `parseTimestamp()`, `toTimeOnDate()`, `formatTime()` …). Timezone behaviour is auditable in one place; supporting multiple time zones in the future requires changing one file.

### Query-key factory (`lib/query-keys.ts`)

All TanStack Query keys are produced by a single typed factory:

```ts
keys.appointments.byBarber(barberId, date)
keys.availability.slots(barberId, serviceId, date)
keys.shop.config
```

Cache invalidation is scoped by prefix: `invalidate(keys.appointments.all)` resets every appointment query; `invalidate(keys.appointments.today())` resets only the today feed. This prevents stale-cache bugs when a drag-to-reschedule touches more than one barber column.

### Pure availability resolver (`features/availability/resolver.ts`)

`resolveAvailableSlots()` is a **pure function with no Supabase calls**. It receives schedule rows, time-off blocks, and booked appointments as plain objects and returns `{ startAt, endAt }[]` slots. Buffer math is symmetrical: each candidate occupies `bufferBefore + duration + bufferAfter` and is discarded if that window overlaps any existing booking's own buffered range. Because there is no I/O, unit tests run in milliseconds without mocking.

The Supabase queries that feed the resolver live in the components that call it (currently `book/index.tsx` and `calendar/index.tsx`).

### Role-based access (`lib/can.ts`)

```ts
can(role, action, resource) // → boolean
```

Three-layer enforcement:
1. **Route loaders** — `router.tsx` redirects unauthenticated users before the component renders
2. **UI layer** — `can()` hides nav items and mutation buttons for the `barber` role
3. **Database (real boundary)** — Postgres RLS policies; `is_admin()` / `is_staff()` SECURITY DEFINER helpers

### UI state (`store/ui.store.ts`)

Zustand slice persisted to `localStorage` under the key `turnoalcorte-ui`. Persisted keys: `theme`, `density`, `language`, `sidebarCollapsed`, `calendarView`, `tutorialCompleted`, `recentCommands`. Transient keys (not persisted): `commandOpen`, `tutorialOpen`, `tutorialStep`.

---

## Security model

See [`docs/SECURITY.md`](docs/SECURITY.md) for the full writeup. Summary:

| Threat | Mitigation |
|---|---|
| Anon client dumping client PII | RLS on `clients` — no anon SELECT; booking goes through `book_appointment` SECURITY DEFINER RPC |
| Price spoofing | Price read server-side inside the RPC; client never touches `appointments` directly |
| Double-booking race | `btree_gist` EXCLUDE constraint on `(barber_id, tstzrange)` — DB-level, not application-level |
| Slot squatting | 10-minute server-side hold via `slot_holds` table; holds auto-expire |
| Horizontal privilege escalation (barber reads other barbers' clients) | RLS `is_admin()` policy on `clients`; `barber` role has `client: []` in `lib/can.ts` |
| Overprivileged barber mutations | Barber write policies are scoped to their own `barber_id` (schedules, time-off) |

---

## Local setup

```bash
git clone https://github.com/ZezeBreiterman/turnoalcorte.git
cd turnoalcorte
npm install

cp .env.example .env.local
# Edit .env.local:
#   VITE_SUPABASE_URL=https://wghrjhcuuhbrninznfyb.supabase.co
#   VITE_SUPABASE_ANON_KEY=<your anon public key>

npm run dev          # → http://localhost:5173
npm run build        # production build (runs tsc -b first)
npm test             # vitest unit tests
npm run test:watch   # watch mode
```

---

## Database migrations

Run files from `supabase/migrations/` **in order** in the Supabase SQL Editor. Each migration is idempotent — safe to re-run after a partial failure.

| File | What it does |
|---|---|
| `001_initial_schema.sql` | Core tables: `profiles`, `barbers`, `services`, `clients`, `appointments`, `barber_schedules`, `time_off`, `barber_shops` |
| `002_seed_demo_data.sql` | Demo shop, barbers, and services for local development |
| `003_shop_config.sql` | `shop_config` table (name, address, logo, phone, instagram) |
| `004_rls_hardening.sql` | **Critical.** Enables RLS on all core tables, drops open policies, adds `is_admin()` / `is_staff()` helpers, creates `book_appointment` SECURITY DEFINER RPC, adds `btree_gist` EXCLUDE double-booking constraint, creates `appointments_public` PII-free view |
| `005_slot_holds.sql` | `slot_holds` table + `hold_slot` / `release_slot` RPCs for the 10-minute booking reservation |
| `006_demo_roles.sql` | Sets `admin` / `barber` roles for demo accounts; fixes role constraint; seeds Martín Gómez barber row |
| `007_book_appointment_email.sql` | Adds `email` column to `clients`; replaces `book_appointment` with 7-argument version that accepts and stores an optional email |

> **Warning:** migrations 004+ depend on tables from 001. Running out of order will fail.

---

## Demo credentials

| Role | Email | Access |
|---|---|---|
| Admin | `admin@turnoalcorte.com` | Full app — analytics, barbers, services, settings |
| Barber | `barber@turnoalcorte.com` | Today view + calendar only (linked to Martín Gómez) |
| Public | — | `/book` — no login required |

Passwords are set in **Supabase Dashboard → Authentication → Users**. Magic-link login is also available for any email registered as a user.

---

## Project structure (detailed)

```
src/
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx          Protected app wrapper; mobile nav drawer
│   │   └── Sidebar.tsx           Collapsible desktop sidebar with role-gated nav
│   ├── ui/
│   │   ├── avatar.tsx            NamedAvatar (photo or coloured initial)
│   │   ├── badge.tsx             Status chips
│   │   ├── button.tsx            Primary / ghost / destructive variants
│   │   ├── card.tsx              Surface primitive
│   │   ├── input.tsx             Form input with error state
│   │   ├── label.tsx             Accessible form label
│   │   ├── select.tsx            Native select wrapper
│   │   ├── skeleton.tsx          Loading placeholders
│   │   ├── textarea.tsx          Multiline input
│   │   └── tooltip.tsx           Radix tooltip wrapper
│   └── command/
│       └── CommandPalette.tsx    ⌘K palette with recent commands + nav + actions
│
├── features/
│   └── availability/
│       ├── resolver.ts           Pure slot-resolution function (unit-tested)
│       └── resolver.test.ts      Vitest unit tests for the resolver
│
├── routes/
│   ├── book/
│   │   └── index.tsx             4-step public booking flow (service→pick→info→done)
│   ├── auth/
│   │   ├── login.tsx             Magic-link + password login; forgot-password flow
│   │   └── callback.tsx          Supabase OTP redirect handler → /app/today
│   └── app/
│       ├── today/index.tsx       KPI strip + live appointment list + add-appointment sheet
│       ├── calendar/index.tsx    Day/week/month calendar with DnD rescheduling
│       ├── barbers/index.tsx     Barber CRUD + schedule + time-off management
│       ├── services/index.tsx    Service catalogue + discount codes
│       ├── clients/index.tsx     Client list + search + edit
│       ├── analytics/index.tsx   Revenue + volume charts
│       └── settings/index.tsx    Shop config + theme + language
│
├── lib/
│   ├── auth.ts         getProfile(), getSession(), signOut() — used by route loaders
│   ├── can.ts          Role-based permission matrix
│   ├── query-keys.ts   Typed TanStack Query key factory
│   ├── supabase.ts     Singleton Supabase client (reads VITE_SUPABASE_*)
│   ├── time.ts         All date/time helpers (only file that uses date-fns directly)
│   ├── utils.ts        cn() class merger
│   └── sentry.ts       Sentry user identification helpers
│
├── store/
│   └── ui.store.ts     Zustand: theme, language, sidebar, calendar view, tutorial
│
├── types/
│   ├── database.ts     Row + insert interfaces for every table
│   └── supabase.ts     Generated / supplementary Supabase types
│
├── i18n/
│   ├── index.ts        i18next setup (ES default, EN fallback)
│   └── locales/
│       ├── es/         auth, booking, calendar, common, dashboard, settings
│       └── en/         (same namespaces)
│
├── hooks/
│   ├── useTheme.ts     Reads + applies CSS data-theme attribute
│   ├── useDensity.ts   Reads density from UI store (compact / cozy)
│   └── useMediaQuery.ts Reactive window.matchMedia
│
└── router.tsx          Route tree; loader-based session + profile guards
```

---

## Testing

```bash
npm test                # run all unit tests once
npm run test:watch      # watch mode (re-runs on file change)
npm run test:coverage   # Istanbul coverage report in /coverage
```

### Current coverage

| File | Type | Status |
|---|---|---|
| `features/availability/resolver.ts` | Unit | Covered |
| `lib/can.ts` | Unit | Not yet |
| `lib/time.ts` | Unit | Not yet |
| `routes/book` (full booking flow) | E2E (Playwright) | Not yet |
| `routes/auth` (magic link) | E2E | Not yet |

Playwright is installed and configured. No e2e tests exist yet — the `/book` booking flow is the highest-value target.

---

## Roadmap

| Feature | Priority |
|---|---|
| i18n the public booking page (`/book` is hardcoded Spanish) | High |
| E2E tests: booking flow, auth, RBAC | High |
| Client-facing cancellation page (`/appointment/:code`) | Medium |
| Stripe deposit at booking time to reduce no-shows | Medium |
| SMS reminders via Twilio (24h + 1h before) | Medium |
| Density toggle UI in Settings (hook + store already implemented) | Low |
| PWA + offline queue for today view | Low |
| Multi-tenant support (scope all queries by `shop_id`) | Future |
