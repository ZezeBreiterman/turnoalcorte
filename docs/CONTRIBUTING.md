# Contributing guide

## Prerequisites

- Node 20+
- A Supabase project (free tier is fine for dev)
- Migrations 001–007 run in order (see README)

## Development workflow

```bash
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev                  # Vite dev server → http://localhost:5173
```

Vite HMR handles most changes without a full reload. When you change `router.tsx` or any loader, do a manual page refresh to pick up the new loader data.

---

## Code conventions

### Date / time

**Never** use `new Date()` or import `date-fns` directly outside of `src/lib/time.ts`. Use the named helpers:

```ts
import { now, today, parseTimestamp, formatTime } from '@/lib/time'
```

This keeps timezone behaviour auditable in one file.

### TanStack Query keys

Always use the factory from `src/lib/query-keys.ts`. Never write ad-hoc string arrays:

```ts
// ✅ correct
const { data } = useQuery({ queryKey: keys.appointments.today() })

// ❌ wrong — bypasses scoped cache invalidation
const { data } = useQuery({ queryKey: ['appointments', 'today'] })
```

When adding a new entity, add a group to `keys` before writing the query.

### Permissions

Check `can(role, action, resource)` from `lib/can.ts` for any UI gating. When adding a new resource or action, update the matrix AND the `Action` / `Resource` types.

Do not rely on UI gating as the security boundary — always add the corresponding RLS policy in a migration.

### Component files

- One component per file for anything larger than ~50 lines
- Shared primitives → `src/components/ui/`
- Feature-specific components → colocate in the route file or a `components/` subfolder next to the route

### Supabase queries

- Anon queries must only touch `barbers`, `services`, `barber_schedules`, `time_off`, `appointments_public`, `slot_holds_public`, and `shop_config`
- Any write from an unauthenticated context must go through a SECURITY DEFINER RPC
- Never select `*` from `clients` or `appointments` in anon-accessible code paths

---

## Adding a database migration

1. Create `supabase/migrations/NNN_descriptive_name.sql`
2. Make it **idempotent** (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS` before `CREATE POLICY`, etc.)
3. Add a header comment explaining what the migration fixes and the order dependency
4. Update the migration table in `README.md`
5. Never edit a migration that has already been run in production — always add a new one

---

## Testing

```bash
npm test              # vitest unit tests
npm run test:watch    # watch mode
npm run test:coverage # coverage report (target: 80% on lib/ and features/)
```

### What to test

| Layer | Tool | Target |
|---|---|---|
| Pure functions (`lib/time.ts`, `lib/can.ts`, `features/availability/resolver.ts`) | Vitest | 100% |
| React components | Vitest + Testing Library | Critical paths only |
| Full booking flow | Playwright | End-to-end happy path + conflict recovery |
| Auth flow | Playwright | Magic link redirect, barber RBAC |

### Resolver tests

`src/features/availability/resolver.test.ts` is the template. When adding a new edge case to the resolver, add a corresponding test case. The tests are pure data-in / array-out and need no mocking.

---

## i18n

The app is ES-first with EN as a secondary language.

- Locale files live in `src/i18n/locales/{es,en}/`
- Namespaces: `auth`, `booking`, `calendar`, `common`, `dashboard`, `settings`
- Always add keys to **both** locale files at the same time
- Use `useTranslation('namespace')` at the top of the component
- **Known gap:** `src/routes/book/index.tsx` is currently hardcoded Spanish. The `booking.json` locale file exists but is not yet wired. This is the next i18n sprint.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `VITE_SENTRY_DSN` | No | Sentry DSN for error tracking |

Vite only exposes variables prefixed with `VITE_` to the browser bundle.

---

## Deployment

The project deploys automatically to Vercel on every push to `main`. Vercel is configured as a Vite SPA — no server-side rendering. The `dist/` folder is the build output.

**Required Vercel environment variables** (set in Project → Settings → Environment Variables):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

After adding or changing env vars, trigger a manual redeploy — Vercel bakes `VITE_*` variables into the bundle at build time, so a new build is required.
