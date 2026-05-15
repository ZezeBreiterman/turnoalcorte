-- ============================================================
-- 001 — MVP extensions (safe to run on top of the base schema)
-- Run on Supabase dashboard: SQL Editor → paste → Run
--
-- The base schema.sql already created:
--   appointment_status enum (pending/confirmed/completed/cancelled/no_show)
--   barbers, services, clients, appointments tables with open RLS
--
-- This migration EXTENDS that schema without dropping anything.
-- ============================================================

-- ── Step 1: Extend the enum with new statuses ─────────────────────────────────
-- ADD VALUE is idempotent in Postgres 14+ via IF NOT EXISTS
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'checked_in';
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'rescheduled';

-- ── Step 2: Extend barbers ────────────────────────────────────────────────────
ALTER TABLE barbers
  ADD COLUMN IF NOT EXISTS email     TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS bio       TEXT,
  ADD COLUMN IF NOT EXISTS color     TEXT DEFAULT '#6366f1';

-- ── Step 3: Extend services ───────────────────────────────────────────────────
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS description           TEXT,
  ADD COLUMN IF NOT EXISTS color                 TEXT DEFAULT '#8b5cf6',
  ADD COLUMN IF NOT EXISTS buffer_before_minutes INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buffer_after_minutes  INT DEFAULT 10;

-- ── Step 4: Extend clients ────────────────────────────────────────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS email               TEXT,
  ADD COLUMN IF NOT EXISTS preferred_barber_id UUID REFERENCES barbers(id);

-- ── Step 5: Extend appointments ───────────────────────────────────────────────
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS notes               TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_in_at       TIMESTAMPTZ;

-- ── Step 6: New tables ────────────────────────────────────────────────────────

-- Shop config (currency, locale, timezone per shop)
CREATE TABLE IF NOT EXISTS barber_shops (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  currency   TEXT DEFAULT 'ARS',
  locale     TEXT DEFAULT 'es-AR',
  timezone   TEXT DEFAULT 'America/Argentina/Buenos_Aires',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Staff profiles (linked to Supabase Auth users)
-- Customers do NOT have profiles — they are anon.
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'barber')),
  barber_id  UUID REFERENCES barbers(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Weekly availability templates
CREATE TABLE IF NOT EXISTS barber_schedules (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  barber_id   UUID REFERENCES barbers(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  UNIQUE (barber_id, day_of_week)
);

-- Time-off blocks
CREATE TABLE IF NOT EXISTS time_off (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  barber_id UUID REFERENCES barbers(id) ON DELETE CASCADE,
  start_at  TIMESTAMPTZ NOT NULL,
  end_at    TIMESTAMPTZ NOT NULL,
  reason    TEXT
);

-- Audit trail (append-only)
CREATE TABLE IF NOT EXISTS audit_events (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id  UUID NOT NULL,
  action     TEXT NOT NULL,
  payload    JSONB,
  actor      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Step 7: RLS on new tables ─────────────────────────────────────────────────
ALTER TABLE barber_shops     ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events     ENABLE ROW LEVEL SECURITY;

-- Public read (booking flow needs schedules + time_off for availability)
CREATE POLICY "public read schedules" ON barber_schedules FOR SELECT USING (true);
CREATE POLICY "public read time_off"  ON time_off         FOR SELECT USING (true);

-- Staff full access
CREATE POLICY "staff all shops"     ON barber_shops     FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "staff all schedules" ON barber_schedules FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "staff all time_off"  ON time_off         FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "staff all audit"     ON audit_events     FOR ALL USING (auth.role() = 'authenticated');

-- Profiles: each user sees only their own row
CREATE POLICY "own profile read"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- ── Step 8: Auto-update profiles.updated_at ───────────────────────────────────
CREATE OR REPLACE FUNCTION update_profile_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_profile_updated_at();

-- ── Step 9: Seed default shop (idempotent) ────────────────────────────────────
INSERT INTO barber_shops (name, currency, locale, timezone)
SELECT 'Turnoalcorte', 'ARS', 'es-AR', 'America/Argentina/Buenos_Aires'
WHERE NOT EXISTS (SELECT 1 FROM barber_shops LIMIT 1);
