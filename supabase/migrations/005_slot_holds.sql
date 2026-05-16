-- ============================================================
-- 005 — Slot holds (10-min reservation while the customer fills the form)
-- Run on Supabase dashboard: SQL Editor → paste → Run
-- Idempotent. Run AFTER 004.
--
-- Closes the "I picked 10:00, took 2 min to type my name, someone else
-- booked 10:00" gap. A hold is created the moment a slot is selected and
-- expires after 10 minutes. Availability excludes active holds.
-- ============================================================

CREATE TABLE IF NOT EXISTS slot_holds (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  barber_id  uuid NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time   timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS slot_holds_barber_time ON slot_holds (barber_id, start_time);
CREATE INDEX IF NOT EXISTS slot_holds_expires     ON slot_holds (expires_at);

-- RLS on: no direct anon/auth table access — everything via RPCs + view
ALTER TABLE slot_holds ENABLE ROW LEVEL SECURITY;

-- PII-free public view of *active* holds (for availability computation)
CREATE OR REPLACE VIEW public.slot_holds_public AS
  SELECT barber_id, start_time, end_time
  FROM public.slot_holds
  WHERE expires_at > now();
ALTER VIEW public.slot_holds_public SET (security_invoker = false);
REVOKE ALL   ON public.slot_holds_public FROM anon, authenticated;
GRANT  SELECT ON public.slot_holds_public TO   anon, authenticated;

-- ── hold_slot: purge expired, reject if booked/held, create a 10-min hold ─────
CREATE OR REPLACE FUNCTION public.hold_slot(
  p_barber_id uuid,
  p_start     timestamptz,
  p_end       timestamptz
) RETURNS TABLE (hold_id uuid, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id  uuid;
  v_exp timestamptz;
BEGIN
  DELETE FROM slot_holds WHERE slot_holds.expires_at <= now();

  IF EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.barber_id = p_barber_id
      AND a.status NOT IN ('cancelled', 'no_show')
      AND tstzrange(a.start_time, a.end_time) && tstzrange(p_start, p_end)
  ) THEN
    RAISE EXCEPTION 'slot_taken' USING ERRCODE = 'exclusion_violation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM slot_holds h
    WHERE h.barber_id = p_barber_id
      AND h.expires_at > now()
      AND tstzrange(h.start_time, h.end_time) && tstzrange(p_start, p_end)
  ) THEN
    RAISE EXCEPTION 'slot_taken' USING ERRCODE = 'exclusion_violation';
  END IF;

  v_exp := now() + interval '10 minutes';
  INSERT INTO slot_holds (barber_id, start_time, end_time, expires_at)
  VALUES (p_barber_id, p_start, p_end, v_exp)
  RETURNING slot_holds.id INTO v_id;

  RETURN QUERY SELECT v_id, v_exp;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_slot(p_hold_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM slot_holds WHERE id = p_hold_id;
$$;

REVOKE ALL ON FUNCTION public.hold_slot(uuid,timestamptz,timestamptz) FROM public;
REVOKE ALL ON FUNCTION public.release_slot(uuid)                       FROM public;
GRANT EXECUTE ON FUNCTION public.hold_slot(uuid,timestamptz,timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_slot(uuid)                       TO anon, authenticated;
