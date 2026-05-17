-- 007 — Add email to clients + update book_appointment RPC
-- Run on Supabase dashboard: SQL Editor → paste → Run
-- Idempotent. Run AFTER 001–006.
--
-- Changes:
--   * Add nullable email column to clients table
--   * Replace book_appointment() to accept an optional p_email parameter
--     and store / update it on the client record
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Step 1: Add email column to clients (idempotent) ─────────────────────────
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email text;

-- ── Step 2: Drop the old 6-argument function signature ───────────────────────
-- (PostgreSQL treats different signatures as different functions, so we must
-- drop the old one before creating the new 7-argument version.)
DROP FUNCTION IF EXISTS public.book_appointment(uuid, uuid, timestamptz, timestamptz, text, text);

-- ── Step 3: Create updated book_appointment RPC with optional email ───────────
CREATE OR REPLACE FUNCTION public.book_appointment(
  p_barber_id  uuid,
  p_service_id uuid,
  p_start      timestamptz,
  p_end        timestamptz,
  p_name       text,
  p_phone      text,
  p_email      text DEFAULT NULL
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

  -- Validate email format if provided
  IF p_email IS NOT NULL AND trim(p_email) <> ''
     AND trim(p_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = 'check_violation';
  END IF;

  SELECT price INTO v_price FROM services WHERE id = p_service_id AND active = true;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'service_unavailable' USING ERRCODE = 'no_data_found';
  END IF;

  -- Upsert client by phone
  SELECT id INTO v_client_id FROM clients WHERE phone = trim(p_phone) LIMIT 1;
  IF v_client_id IS NULL THEN
    INSERT INTO clients (name, phone, email)
      VALUES (trim(p_name), trim(p_phone), NULLIF(trim(coalesce(p_email, '')), ''))
    RETURNING id INTO v_client_id;
  ELSE
    -- Update name and email if provided (never overwrite email with NULL)
    UPDATE clients
      SET name  = trim(p_name),
          email = COALESCE(NULLIF(trim(coalesce(p_email, '')), ''), email)
      WHERE id = v_client_id;
  END IF;

  INSERT INTO appointments (
    client_id, barber_id, service_id, start_time, end_time, status, price_charged
  ) VALUES (
    v_client_id, p_barber_id, p_service_id, p_start, p_end, 'pending', v_price
  )
  RETURNING id INTO v_appt_id;

  RETURN v_appt_id;

EXCEPTION
  WHEN exclusion_violation THEN
    -- Slot was taken between availability check and confirm.
    RAISE EXCEPTION 'slot_taken' USING ERRCODE = 'exclusion_violation';
END;
$$;

-- ── Step 4: Grant execution to anon and authenticated ────────────────────────
REVOKE ALL ON FUNCTION public.book_appointment(uuid, uuid, timestamptz, timestamptz, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.book_appointment(uuid, uuid, timestamptz, timestamptz, text, text, text) TO anon, authenticated;
