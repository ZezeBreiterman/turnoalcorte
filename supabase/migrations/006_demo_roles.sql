-- ============================================================
-- 006 — Demo role setup (for showcasing RBAC + analytics)
-- Run in Supabase SQL Editor AFTER 001–005. Idempotent.
--
-- Aligns the demo profiles with the app's role model so you can
-- log in and demo both roles:
--   admin@turnoalcorte.com      → admin  (full app + analytics)
--   zezebreiterman@gmail.com    → admin  (your account, kept admin)
--   barber@turnoalcorte.com     → barber, linked to "Martín Gómez"
--                                 (sees only his own calendar/today)
-- ============================================================

-- Ensure Martín Gómez barber row exists (FK target for barber profile).
-- If 002_seed_demo_data.sql has already been run this is a no-op.
INSERT INTO barbers (id, name, email, bio, color, active) VALUES
  ('b1000001-0000-0000-0000-000000000001', 'Martín Gómez', 'martin@turnoalcorte.com',
   'Especialista en degradados y barbas clásicas. 8 años de experiencia en el rubro.',
   '#6366f1', true)
ON CONFLICT (id) DO NOTHING;

-- The base schema's profiles_role_check only allowed ('admin','staff').
-- The app's model is ('admin','barber'). Re-point the constraint, updating
-- existing rows first so the re-add validates. Idempotent.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Admins: full access (analytics, barbers, services, settings)
UPDATE profiles
SET role = 'admin', barber_id = NULL
WHERE email IN ('admin@turnoalcorte.com', 'zezebreiterman@gmail.com');

-- Barber: scoped to Martín Gómez (b1000001) — has seeded appointments
UPDATE profiles
SET role = 'barber',
    barber_id = 'b1000001-0000-0000-0000-000000000001'
WHERE email = 'barber@turnoalcorte.com';

-- Any remaining legacy 'staff' rows → 'barber' so the new check validates
UPDATE profiles SET role = 'barber' WHERE role NOT IN ('admin', 'barber');

-- Re-add the constraint with the app's role model
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'barber'));

-- Sanity check — review the output:
--   every staff user must be 'admin' or 'barber' (never 'staff'/NULL),
--   and the barber must have a non-null barber_id.
SELECT u.email, p.role, p.barber_id
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
ORDER BY p.role;
