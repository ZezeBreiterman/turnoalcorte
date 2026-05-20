# E2E tests (Playwright)

End-to-end suite for the Turnoalcorte booking flow and staff app.

## Prerequisites

- Node deps installed: `npm install`
- Chromium browser: `npx playwright install chromium`
- A clean Supabase **demo** database. The booking specs create real rows
  (clients, appointments, slot holds) via the public `book_appointment` /
  `hold_slot` RPCs, so do **not** point them at production.
- The dev server is started automatically by Playwright (`npm run dev` on
  port 5173). Override with `PLAYWRIGHT_BASE_URL=...` if you already have
  the app running elsewhere.

## Environment variables

| Variable           | Purpose                                                   | Required by                          |
|--------------------|-----------------------------------------------------------|--------------------------------------|
| `ADMIN_PASSWORD`   | Password for `admin@turnoalcorte.com`                     | future admin specs / `auth.setup.ts` |
| `BARBER_PASSWORD`  | Password for `barber@turnoalcorte.com`                    | `rbac-barber-redirect.spec.ts`       |
| `TEST_USER_EMAIL`  | Triggers the stored-session fixture in `fixtures.ts`      | existing authenticated specs         |
| `PLAYWRIGHT_BASE_URL` | Override the default `http://localhost:5173`           | optional                             |

Specs that need a password env var will `test.skip` with a clear message if
it's missing — the suite still runs without staff credentials, it just
skips the RBAC test.

## Running

```bash
# Discover specs and verify they parse — fast, no browser needed.
npx playwright test --list

# Run everything headless.
npx playwright test

# Interactive UI mode (recommended while iterating).
npx playwright test --ui

# Single file.
npx playwright test e2e/booking-happy-path.spec.ts

# Single file in a single project.
npx playwright test e2e/booking-happy-path.spec.ts --project=chromium
```

## What each spec covers

- `booking-happy-path.spec.ts` — TEST-3 — full anonymous booking flow
  (service → pick → info → done) and asserts the 6-char booking code.
- `booking-conflict.spec.ts` — TEST-4 — two browser contexts race for the
  same slot; exactly one must succeed.
- `rbac-barber-redirect.spec.ts` — TEST-5 — barber-role users hitting
  `/app/clients` must be redirected to `/app/today`.
- `auth-callback.spec.ts` — TEST-6 — `/auth/callback` mounts cleanly and
  settles on `/auth/login` or `/app/today`. See the comment in that file
  for the limitation around real magic-link tokens.

## Assumptions about the demo database

- At least one active `services` row.
- At least one active `barbers` row whose `barber_schedules` cover one or
  more of the next 14 days.
- The `book_appointment` and `hold_slot` SECURITY DEFINER RPCs are
  deployed.
- `admin@turnoalcorte.com` and `barber@turnoalcorte.com` exist in Supabase
  Auth with the passwords supplied via env.
