-- ============================================================
-- 004 — RLS hardening + double-booking constraint + secure booking RPC
-- Run on Supabase dashboard: SQL Editor → paste → Run
-- Idempotent. Run AFTER 001, 002, 003.
--
-- Fixes (audit 2026-05-16):
--   * CRITICAL: clients/appointments/barbers/services had open RLS
--     (USING (true)) → anyone with the anon key could dump all client
--     PII or delete every appointment.
--   * HIGH: staff policies used auth.role()='authenticated' (any barber
--     could edit shop config / other barbers' schedules) → admin-gated.
--   * HIGH: no DB-level double-booking guard (TOCTOU race).
--   * Client supplied price_charged & raw inserts → moved server-side.
-- ============================================================

-- ── Step 0: Extensions ────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ── Step 1: Role helper functions ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- barber_id of the currently-authenticated staff user (NULL for admin/anon)
CREATE OR REPLACE FUNCTION public.my_barber_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT barber_id FROM profiles WHERE id = auth.uid();
$$;

-- ── Step 2: Enable RLS on core tables ─────────────────────────────────────────
ALTER TABLE barbers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE services     ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Drop any pre-existing open policies from the base schema (names vary; cover
-- the common ones the base schema / earlier work may have created).
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('barbers','services','clients','appointments')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- ── Step 3: barbers / services — public READ, admin WRITE ─────────────────────
CREATE POLICY "barbers_public_read"  ON barbers  FOR SELECT USING (true);
CREATE POLICY "barbers_admin_write"  ON barbers  FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "services_public_read" ON services FOR SELECT USING (true);
CREATE POLICY "services_admin_write" ON services FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── Step 4: clients — staff only, NO anon access ──────────────────────────────
-- Public booking never touches this table directly; it goes through the
-- book_appointment() SECURITY DEFINER RPC below.
CREATE POLICY "clients_staff_all" ON clients FOR ALL
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ── Step 5: appointments — staff manage; anon has NO direct access ────────────
-- Admin: everything. Barber: only their own column's rows.
CREATE POLICY "appointments_admin_all" ON appointments FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "appointments_barber_read" ON appointments FOR SELECT
  USING (public.is_staff() AND barber_id = public.my_barber_id());

CREATE POLICY "appointments_barber_update" ON appointments FOR UPDATE
  USING (public.is_staff() AND barber_id = public.my_barber_id())
  WITH CHECK (public.is_staff() AND barber_id = public.my_barber_id());

-- ── Step 6: PII-free public availability view ─────────────────────────────────
-- Anon needs to know which (barber, time) slots are taken to compute
-- availability — but must NEVER see client_id, price, notes, etc.
CREATE OR REPLACE VIEW public.appointments_public AS
  SELECT barber_id, start_time, end_time, status
  FROM public.appointments
  WHERE status NOT IN ('cancelled', 'no_show');

ALTER VIEW public.appointments_public SET (security_invoker = false);
REVOKE ALL   ON public.appointments_public FROM anon, authenticated;
GRANT  SELECT ON public.appointments_public TO   anon, authenticated;

-- ── Step 7: Double-booking exclusion constraint ───────────────────────────────
-- The real guarantee: no two non-cancelled appointments for the same barber
-- may overlap in time. Client-side checks are advisory only.
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_no_overlap;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    barber_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  )
  WHERE (status NOT IN ('cancelled', 'no_show'));

-- ── Step 8: Secure public booking RPC ─────────────────────────────────────────
-- Replaces the client-side clients-select + clients-insert + appointments-insert.
-- * price is read server-side from services (client cannot spoof it)
-- * client upsert-by-phone happens here (anon has no clients access)
-- * the exclusion constraint makes double-booking atomic; we surface a clean
--   error code the UI can detect.
CREATE OR REPLACE FUNCTION public.book_appointment(
  p_barber_id  uuid,
  p_service_id uuid,
  p_start      timestamptz,
  p_end        timestamptz,
  p_name       text,
  p_phone      text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client_id uuid;
  v_price     numeric;
  v_appt_id   uuid;
BEGIN
  IF p_name IS NULL OR length(trim(p_name)) = 0
     OR p_phone IS NULL OR length(trim(p_phone)) < 6 THEN
    RAISE EXCEPTION 'invalid_contact' USING ERRCODE = 'check_violation';
  END IF;

  SELECT price INTO v_price FROM services WHERE id = p_service_id AND active = true;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'service_unavailable' USING ERRCODE = 'no_data_found';
  END IF;

  -- Upsert client by phone
  SELECT id INTO v_client_id FROM clients WHERE phone = trim(p_phone) LIMIT 1;
  IF v_client_id IS NULL THEN
    INSERT INTO clients (name, phone) VALUES (trim(p_name), trim(p_phone))
    RETURNING id INTO v_client_id;
  END IF;

  INSERT INTO appointments (
    client_id, barber_id, service_id, start_time, end_time, status, price_charged
  ) VALUES (
    v_client_id, p_barber_id, p_service_id, p_start, p_end, 'confirmed', v_price
  )
  RETURNING id INTO v_appt_id;

  RETURN v_appt_id;
EXCEPTION
  WHEN exclusion_violation THEN
    -- Slot was taken between availability check and confirm.
    RAISE EXCEPTION 'slot_taken' USING ERRCODE = 'exclusion_violation';
END;
$$;

REVOKE ALL ON FUNCTION public.book_appointment(uuid,uuid,timestamptz,timestamptz,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.book_appointment(uuid,uuid,timestamptz,timestamptz,text,text) TO anon, authenticated;

-- ── Step 9: Replace blanket auth.role()='authenticated' policies ──────────────
-- (barber_shops, barber_schedules, time_off, audit_events, shop_config)
-- Fully idempotent: every new policy is dropped-if-exists before create, so
-- this whole file is safe to re-run after a partial failure.
DROP POLICY IF EXISTS "staff all shops"        ON barber_shops;
DROP POLICY IF EXISTS "staff all schedules"    ON barber_schedules;
DROP POLICY IF EXISTS "staff all time_off"     ON time_off;
DROP POLICY IF EXISTS "staff all audit"        ON audit_events;

-- barber_shops: admin-only write, public read
DROP POLICY IF EXISTS "barber_shops_read"  ON barber_shops;
DROP POLICY IF EXISTS "barber_shops_admin" ON barber_shops;
CREATE POLICY "barber_shops_read"  ON barber_shops FOR SELECT USING (true);
CREATE POLICY "barber_shops_admin" ON barber_shops FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- shop_config: created by migration 003. Guarded so 004 still completes if
-- 003 hasn't been run yet (you must still run 003 for the booking page).
DO $$
BEGIN
  IF to_regclass('public.shop_config') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE shop_config ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "shop_config_write_auth"  ON shop_config';
    EXECUTE 'DROP POLICY IF EXISTS "shop_config_read_all"    ON shop_config';
    EXECUTE 'DROP POLICY IF EXISTS "shop_config_admin_write" ON shop_config';
    EXECUTE 'CREATE POLICY "shop_config_read_all"    ON shop_config FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "shop_config_admin_write" ON shop_config FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
  ELSE
    RAISE NOTICE 'shop_config not found — run migration 003_shop_config.sql, then re-run this file.';
  END IF;
END $$;

-- barber_schedules: public read kept; admin full; barber only own rows
DROP POLICY IF EXISTS "schedules_admin_all"  ON barber_schedules;
DROP POLICY IF EXISTS "schedules_barber_own" ON barber_schedules;
CREATE POLICY "schedules_admin_all" ON barber_schedules FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "schedules_barber_own" ON barber_schedules FOR ALL
  USING (public.is_staff() AND barber_id = public.my_barber_id())
  WITH CHECK (public.is_staff() AND barber_id = public.my_barber_id());

-- time_off: public read kept; admin full; barber only own rows
DROP POLICY IF EXISTS "time_off_admin_all"  ON time_off;
DROP POLICY IF EXISTS "time_off_barber_own" ON time_off;
CREATE POLICY "time_off_admin_all" ON time_off FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "time_off_barber_own" ON time_off FOR ALL
  USING (public.is_staff() AND barber_id = public.my_barber_id())
  WITH CHECK (public.is_staff() AND barber_id = public.my_barber_id());

-- audit_events: append-only. Staff may INSERT and SELECT; nobody UPDATE/DELETE.
DROP POLICY IF EXISTS "audit_staff_insert" ON audit_events;
DROP POLICY IF EXISTS "audit_staff_read"   ON audit_events;
CREATE POLICY "audit_staff_insert" ON audit_events FOR INSERT
  WITH CHECK (public.is_staff());
CREATE POLICY "audit_staff_read"   ON audit_events FOR SELECT
  USING (public.is_staff());
-- (no UPDATE/DELETE policies ⇒ denied for everyone, even staff)
