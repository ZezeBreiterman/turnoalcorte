# Security Model

This document describes every trust boundary in Turnoalcorte and the specific mechanism that enforces it.

---

## Actors

| Actor | Description | Supabase role |
|---|---|---|
| **Anon** | Any visitor — booking page, no login | `anon` |
| **Barber** | Authenticated staff — limited to own calendar | `authenticated` + `profiles.role = 'barber'` |
| **Admin** | Authenticated owner/manager — full access | `authenticated` + `profiles.role = 'admin'` |

---

## Database boundary (Postgres RLS)

RLS is enabled on every table. All policies are defined in `supabase/migrations/004_rls_hardening.sql`.

### Helper functions (SECURITY DEFINER)

```sql
is_admin()  -- profiles.role = 'admin' for the current auth.uid()
is_staff()  -- profiles.role IN ('admin','barber') for the current auth.uid()
```

These run with the permissions of the defining role (postgres), not the caller, so they cannot be spoofed by the authenticated user.

### Table-level policies

| Table | Anon | Barber | Admin |
|---|---|---|---|
| `barbers` | SELECT only | SELECT only | Full CRUD |
| `services` | SELECT only | SELECT only | Full CRUD |
| `clients` | No access | No access | Full CRUD |
| `appointments` | No access | SELECT + UPDATE (own barber_id) | Full CRUD |
| `barber_schedules` | SELECT only | INSERT/UPDATE own rows | Full CRUD |
| `time_off` | SELECT only | INSERT/UPDATE own rows | Full CRUD |
| `shop_config` | SELECT only | No write | Full CRUD |
| `audit_events` | No access | INSERT only | INSERT + SELECT |

### PII-free public view

```sql
CREATE VIEW appointments_public AS
  SELECT barber_id, start_time, end_time, status
  FROM appointments;
```

Anonymous availability checks query this view — no `client_id`, no names, no phone numbers are ever returned to the browser.

---

## Booking RPC (`book_appointment`)

The public booking flow **never writes directly to `clients` or `appointments`**. Instead it calls a `SECURITY DEFINER` stored procedure:

```sql
SELECT public.book_appointment(
  p_barber_id,   -- uuid
  p_service_id,  -- uuid
  p_start,       -- timestamptz
  p_end,         -- timestamptz
  p_name,        -- text
  p_phone,       -- text
  p_email        -- text DEFAULT NULL
);
```

Inside the RPC (runs as `postgres`):

1. Validates `p_name` (non-empty) and `p_phone` (≥ 6 chars)
2. Validates `p_email` format if provided
3. Reads the service `price` server-side — the client **cannot spoof the price**
4. Upserts the client by phone (INSERT if new, UPDATE name/email if existing)
5. Inserts the appointment — the `EXCLUDE` constraint fires here if the slot is taken

The RPC returns the new appointment UUID (not the client UUID or any PII).

`GRANT EXECUTE` is given to `anon` and `authenticated`; no other permissions are needed.

---

## Double-booking constraint

```sql
ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    barber_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  )
  WHERE (status NOT IN ('cancelled', 'no_show'));
```

This is a DB-level hard guarantee. No application code can create an overlapping appointment regardless of race conditions, timeouts, or bugs in the slot-checking logic. If two concurrent `book_appointment` calls race the same slot, exactly one succeeds; the other gets `exclusion_violation` which the RPC translates to `slot_taken`, and the UI shows a friendly recovery message.

---

## Slot holds (`slot_holds`)

Between availability check and booking confirmation, the browser holds a 10-minute reservation:

```sql
SELECT public.hold_slot(p_barber_id, p_service_id, p_start, p_end);
-- Returns: { hold_id, expires_at }
```

Unexpired holds are excluded from the availability query fed to the resolver. The hold is released on:
- Successful booking (`book_appointment` deletes it internally)
- Explicit `release_slot(p_hold_id)` call
- Expiry — a `WHERE expires_at > now()` filter means stale holds are ignored

`slot_holds` has no anon SELECT policy, so a user cannot enumerate other open holds.

---

## Auth flow

```
Browser → supabase.auth.signInWithOtp({ email })
        ← Supabase emails a one-time link
User clicks link → /auth/callback
        → supabase.auth.onAuthStateChange('SIGNED_IN')
        → getProfile() fetches profiles row
        → profile missing → signOut() + redirect /auth/login
        → profile present → navigate /app/today
```

**Critical invariant:** a valid Supabase session alone does not grant dashboard access. `getProfile()` must return a `profiles` row. Someone who receives a magic link without being provisioned in `profiles` is immediately signed out.

---

## Application-layer RBAC (`lib/can.ts`)

```ts
can('barber', 'read', 'client')   // → false
can('admin',  'read', 'client')   // → true
```

The matrix drives UI visibility (nav items, buttons). It is **not** the security boundary — that is RLS. Even if a bug exposed a button to a barber, the database write would be rejected by the `is_admin()` policy.

---

## Known limitations

| Item | Status |
|---|---|
| No client-facing cancellation (booking code lookup) | Planned — code is shown on ticket but no `/cancel` route exists |
| `settings/index.tsx` calls `supabase.auth.signOut()` directly instead of `auth.ts signOut()` | Minor — Sentry user not cleared on that path |
| No rate limiting on `book_appointment` | Supabase anon key is public; a script could spam bookings. Mitigated by the DB EXCLUDE constraint and hold expiry. True rate limiting requires an Edge Function wrapper. |
