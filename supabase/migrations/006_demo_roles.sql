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

-- Admins: full access (analytics, barbers, services, settings)
UPDATE profiles
SET role = 'admin', barber_id = NULL
WHERE email IN ('admin@turnoalcorte.com', 'zezebreiterman@gmail.com');

-- Barber: scoped to Martín Gómez (b1000001) — has seeded appointments
UPDATE profiles
SET role = 'barber',
    barber_id = 'b1000001-0000-0000-0000-000000000001'
WHERE email = 'barber@turnoalcorte.com';

-- Sanity check — review the output:
--   every staff user must be 'admin' or 'barber' (never 'staff'/NULL),
--   and the barber must have a non-null barber_id.
SELECT u.email, p.role, p.barber_id
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
ORDER BY p.role;
