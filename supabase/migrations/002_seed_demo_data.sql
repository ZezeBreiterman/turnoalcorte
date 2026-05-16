-- ============================================================
-- TURNOALCORTE — Demo seed data
-- Run in Supabase SQL editor to populate the app with realistic data.
-- Safe to re-run: uses ON CONFLICT DO UPDATE / DO NOTHING.
-- ============================================================

-- ── Barbers ──────────────────────────────────────────────────────────────────

INSERT INTO barbers (id, name, email, bio, color, active) VALUES
  ('b1000001-0000-0000-0000-000000000001', 'Martín Gómez',    'martin@turnoalcorte.com',  'Especialista en degradados y barbas clásicas. 8 años de experiencia en el rubro.', '#6366f1', true),
  ('b1000002-0000-0000-0000-000000000002', 'Diego Ramírez',   'diego@turnoalcorte.com',   'Experto en cortes clásicos y modernos. Especialidad en navaja y perfilado.', '#f97316', true),
  ('b1000003-0000-0000-0000-000000000003', 'Valentín Cruz',   'valentin@turnoalcorte.com','El más joven del equipo. Tendencias urbanas, estilos fade y diseños creativos.', '#22c55e', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  bio = EXCLUDED.bio,
  color = EXCLUDED.color,
  active = EXCLUDED.active;

-- ── Services ─────────────────────────────────────────────────────────────────

INSERT INTO services (id, name, duration_minutes, price, description, color, buffer_before_minutes, buffer_after_minutes, active) VALUES
  ('a2000001-0000-0000-0000-000000000001', 'Corte clásico',    30,  3500,  'Corte de pelo con tijeras y máquina. Incluye lavado.',              '#6366f1', 0, 10, true),
  ('a2000002-0000-0000-0000-000000000002', 'Corte + Barba',    55,  6500,  'Corte completo más arreglo y perfilado de barba.',                 '#f97316', 0, 10, true),
  ('a2000003-0000-0000-0000-000000000003', 'Arreglo de barba', 25,  2800,  'Perfilado, recorte y definición de barba con navaja.',              '#ec4899', 0,  5, true),
  ('a2000004-0000-0000-0000-000000000004', 'Degradado fade',   45,  4800,  'Degradado artístico con máquina de precisión y tijeras.',           '#8b5cf6', 0, 10, true),
  ('a2000005-0000-0000-0000-000000000005', 'Cejas',            15,  1500,  'Perfilado y arreglo de cejas con hilo o cera.',                     '#14b8a6', 0,  5, true),
  ('a2000006-0000-0000-0000-000000000006', 'Coloración',       90, 14000, 'Coloración completa o mechas. Incluye tratamiento hidratante.',     '#eab308', 0, 15, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  duration_minutes = EXCLUDED.duration_minutes,
  price = EXCLUDED.price,
  color = EXCLUDED.color,
  active = EXCLUDED.active;

-- ── Barber schedules (Mon–Sat, 9:00–19:00) ───────────────────────────────────

INSERT INTO barber_schedules (barber_id, day_of_week, start_time, end_time) VALUES
  -- Martín: Mon–Sat
  ('b1000001-0000-0000-0000-000000000001', 1, '09:00', '19:00'),
  ('b1000001-0000-0000-0000-000000000001', 2, '09:00', '19:00'),
  ('b1000001-0000-0000-0000-000000000001', 3, '09:00', '19:00'),
  ('b1000001-0000-0000-0000-000000000001', 4, '09:00', '19:00'),
  ('b1000001-0000-0000-0000-000000000001', 5, '09:00', '19:00'),
  ('b1000001-0000-0000-0000-000000000001', 6, '09:00', '17:00'),
  -- Diego: Tue–Sat
  ('b1000002-0000-0000-0000-000000000002', 2, '10:00', '20:00'),
  ('b1000002-0000-0000-0000-000000000002', 3, '10:00', '20:00'),
  ('b1000002-0000-0000-0000-000000000002', 4, '10:00', '20:00'),
  ('b1000002-0000-0000-0000-000000000002', 5, '10:00', '20:00'),
  ('b1000002-0000-0000-0000-000000000002', 6, '09:00', '18:00'),
  -- Valentín: Mon–Fri
  ('b1000003-0000-0000-0000-000000000003', 1, '11:00', '20:00'),
  ('b1000003-0000-0000-0000-000000000003', 2, '11:00', '20:00'),
  ('b1000003-0000-0000-0000-000000000003', 3, '11:00', '20:00'),
  ('b1000003-0000-0000-0000-000000000003', 4, '11:00', '20:00'),
  ('b1000003-0000-0000-0000-000000000003', 5, '11:00', '20:00')
ON CONFLICT (barber_id, day_of_week) DO UPDATE SET
  start_time = EXCLUDED.start_time,
  end_time   = EXCLUDED.end_time;

-- ── Clients ──────────────────────────────────────────────────────────────────

INSERT INTO clients (id, name, phone, email, notes, preferred_barber_id) VALUES
  ('c3000001-0000-0000-0000-000000000001', 'Santiago Herrera',   '+5491145678901', 'santi.h@gmail.com',     'Prefiere sin gel. Viene cada 3 semanas.',              'b1000001-0000-0000-0000-000000000001'),
  ('c3000002-0000-0000-0000-000000000002', 'Lucas Fernández',    '+5491156789012', 'lucasf@hotmail.com',    null,                                                    'b1000001-0000-0000-0000-000000000001'),
  ('c3000003-0000-0000-0000-000000000003', 'Nicolás Martínez',   '+5491167890123', 'nico.m@gmail.com',      'Alérgico a ciertos tintes.',                           'b1000002-0000-0000-0000-000000000002'),
  ('c3000004-0000-0000-0000-000000000004', 'Mateo González',     '+5491178901234', 'mateo.gon@gmail.com',   null,                                                    null),
  ('c3000005-0000-0000-0000-000000000005', 'Tomás Rodríguez',    '+5491189012345', 'tomas.r@outlook.com',   'Siempre pide agua fría.',                              'b1000002-0000-0000-0000-000000000002'),
  ('c3000006-0000-0000-0000-000000000006', 'Agustín López',      '+5491190123456', 'agus.lopez@gmail.com',  null,                                                    'b1000003-0000-0000-0000-000000000003'),
  ('c3000007-0000-0000-0000-000000000007', 'Joaquín Sánchez',    '+5491101234567', 'joaquin.s@gmail.com',   'Viene con su hermano. Descuento familiar.',            'b1000003-0000-0000-0000-000000000003'),
  ('c3000008-0000-0000-0000-000000000008', 'Facundo Díaz',       '+5491112345678', 'facu.diaz@gmail.com',   null,                                                    null),
  ('c3000009-0000-0000-0000-000000000009', 'Ezequiel Torres',    '+5491123456789', 'eze.torres@icloud.com', 'Trabaja en banca. Siempre viene a las 13h.',           'b1000001-0000-0000-0000-000000000001'),
  ('c3000010-0000-0000-0000-000000000010', 'Ramiro Flores',      '+5491134567890', 'ramiro.f@gmail.com',    null,                                                    'b1000002-0000-0000-0000-000000000002'),
  ('c3000011-0000-0000-0000-000000000011', 'Bruno Morales',      '+5491145678902', 'bruno.m@hotmail.com',   'Tiene el cabello muy fino. Usar tijeras suaves.',      null),
  ('c3000012-0000-0000-0000-000000000012', 'Ignacio Ruiz',       '+5491156789013', 'nacho.ruiz@gmail.com',  null,                                                    'b1000001-0000-0000-0000-000000000001'),
  ('c3000013-0000-0000-0000-000000000013', 'Maximiliano Pérez',  '+5491167890124', 'maxi.perez@gmail.com',  'Prefiere turno temprano.',                             'b1000003-0000-0000-0000-000000000003'),
  ('c3000014-0000-0000-0000-000000000014', 'Rodrigo Álvarez',    '+5491178901235', 'rodri.a@outlook.com',   null,                                                    null),
  ('c3000015-0000-0000-0000-000000000015', 'Leandro Romero',     '+5491189012346', 'lean.rom@gmail.com',    null,                                                    'b1000002-0000-0000-0000-000000000002')
ON CONFLICT (id) DO UPDATE SET
  name               = EXCLUDED.name,
  phone              = EXCLUDED.phone,
  preferred_barber_id = EXCLUDED.preferred_barber_id;

-- ── Appointments (last 30 days + today + next 3 days) ────────────────────────
-- Strategy: past appointments are 'completed' (90%) or 'no_show' (7%) or 'cancelled' (3%)
-- Today / future: 'confirmed' or 'pending'
-- Realistic hours: 09–19, peak at 10–13 and 15–17

DO $$
DECLARE
  -- Barber IDs
  b1 UUID := 'b1000001-0000-0000-0000-000000000001';
  b2 UUID := 'b1000002-0000-0000-0000-000000000002';
  b3 UUID := 'b1000003-0000-0000-0000-000000000003';
  -- Service IDs + durations + prices
  s1 UUID := 'a2000001-0000-0000-0000-000000000001'; -- Corte clásico 30m $3500
  s2 UUID := 'a2000002-0000-0000-0000-000000000002'; -- Corte+Barba   55m $6500
  s3 UUID := 'a2000003-0000-0000-0000-000000000003'; -- Barba          25m $2800
  s4 UUID := 'a2000004-0000-0000-0000-000000000004'; -- Degradado      45m $4800
  s5 UUID := 'a2000005-0000-0000-0000-000000000005'; -- Cejas          15m $1500
  s6 UUID := 'a2000006-0000-0000-0000-000000000006'; -- Coloración     90m $14000
  -- Client IDs
  c1  UUID := 'c3000001-0000-0000-0000-000000000001';
  c2  UUID := 'c3000002-0000-0000-0000-000000000002';
  c3  UUID := 'c3000003-0000-0000-0000-000000000003';
  c4  UUID := 'c3000004-0000-0000-0000-000000000004';
  c5  UUID := 'c3000005-0000-0000-0000-000000000005';
  c6  UUID := 'c3000006-0000-0000-0000-000000000006';
  c7  UUID := 'c3000007-0000-0000-0000-000000000007';
  c8  UUID := 'c3000008-0000-0000-0000-000000000008';
  c9  UUID := 'c3000009-0000-0000-0000-000000000009';
  c10 UUID := 'c3000010-0000-0000-0000-000000000010';
  c11 UUID := 'c3000011-0000-0000-0000-000000000011';
  c12 UUID := 'c3000012-0000-0000-0000-000000000012';
  c13 UUID := 'c3000013-0000-0000-0000-000000000013';
  c14 UUID := 'c3000014-0000-0000-0000-000000000014';
  c15 UUID := 'c3000015-0000-0000-0000-000000000015';
BEGIN

-- Helper: insert appointment ignoring duplicates
-- Format: (id, client, barber, service, day_offset, hour, min, duration_min, price, status)

INSERT INTO appointments (id, client_id, barber_id, service_id, start_time, end_time, status, price_charged, notes)
VALUES
  -- ── 30 days ago ──
  (gen_random_uuid(), c1,  b1, s1, (CURRENT_DATE-30)+'09:30'::time, (CURRENT_DATE-30)+'10:00'::time, 'completed', 3500,  null),
  (gen_random_uuid(), c3,  b2, s2, (CURRENT_DATE-30)+'10:00'::time, (CURRENT_DATE-30)+'10:55'::time, 'completed', 6500,  null),
  (gen_random_uuid(), c5,  b1, s3, (CURRENT_DATE-30)+'11:00'::time, (CURRENT_DATE-30)+'11:25'::time, 'completed', 2800,  null),
  (gen_random_uuid(), c7,  b3, s4, (CURRENT_DATE-30)+'11:30'::time, (CURRENT_DATE-30)+'12:15'::time, 'completed', 4800,  null),
  (gen_random_uuid(), c9,  b1, s1, (CURRENT_DATE-30)+'13:00'::time, (CURRENT_DATE-30)+'13:30'::time, 'no_show',   3500,  null),
  (gen_random_uuid(), c11, b2, s4, (CURRENT_DATE-30)+'14:00'::time, (CURRENT_DATE-30)+'14:45'::time, 'completed', 4800,  null),
  (gen_random_uuid(), c13, b3, s1, (CURRENT_DATE-30)+'15:00'::time, (CURRENT_DATE-30)+'15:30'::time, 'completed', 3500,  null),

  -- ── 28 days ago ──
  (gen_random_uuid(), c2,  b1, s2, (CURRENT_DATE-28)+'09:00'::time, (CURRENT_DATE-28)+'09:55'::time, 'completed', 6500,  null),
  (gen_random_uuid(), c4,  b2, s1, (CURRENT_DATE-28)+'10:30'::time, (CURRENT_DATE-28)+'11:00'::time, 'completed', 3500,  null),
  (gen_random_uuid(), c6,  b3, s3, (CURRENT_DATE-28)+'11:00'::time, (CURRENT_DATE-28)+'11:25'::time, 'completed', 2800,  null),
  (gen_random_uuid(), c8,  b1, s4, (CURRENT_DATE-28)+'12:00'::time, (CURRENT_DATE-28)+'12:45'::time, 'completed', 4800,  null),
  (gen_random_uuid(), c10, b2, s5, (CURRENT_DATE-28)+'13:00'::time, (CURRENT_DATE-28)+'13:15'::time, 'completed', 1500,  null),
  (gen_random_uuid(), c12, b3, s2, (CURRENT_DATE-28)+'15:00'::time, (CURRENT_DATE-28)+'15:55'::time, 'completed', 6500,  'Primera visita'),
  (gen_random_uuid(), c14, b1, s1, (CURRENT_DATE-28)+'16:30'::time, (CURRENT_DATE-28)+'17:00'::time, 'cancelled', 0,     null),

  -- ── 26 days ago ──
  (gen_random_uuid(), c15, b2, s6, (CURRENT_DATE-26)+'09:30'::time, (CURRENT_DATE-26)+'11:00'::time, 'completed', 14000, null),
  (gen_random_uuid(), c1,  b1, s3, (CURRENT_DATE-26)+'10:00'::time, (CURRENT_DATE-26)+'10:25'::time, 'completed', 2800,  null),
  (gen_random_uuid(), c3,  b3, s4, (CURRENT_DATE-26)+'11:30'::time, (CURRENT_DATE-26)+'12:15'::time, 'completed', 4800,  null),
  (gen_random_uuid(), c5,  b1, s2, (CURRENT_DATE-26)+'14:00'::time, (CURRENT_DATE-26)+'14:55'::time, 'completed', 6500,  null),
  (gen_random_uuid(), c7,  b2, s1, (CURRENT_DATE-26)+'15:30'::time, (CURRENT_DATE-26)+'16:00'::time, 'completed', 3500,  null),

  -- ── 24 days ago ──
  (gen_random_uuid(), c9,  b1, s4, (CURRENT_DATE-24)+'09:00'::time, (CURRENT_DATE-24)+'09:45'::time, 'completed', 4800,  null),
  (gen_random_uuid(), c11, b3, s2, (CURRENT_DATE-24)+'10:00'::time, (CURRENT_DATE-24)+'10:55'::time, 'completed', 6500,  null),
  (gen_random_uuid(), c13, b2, s3, (CURRENT_DATE-24)+'11:00'::time, (CURRENT_DATE-24)+'11:25'::time, 'completed', 2800,  null),
  (gen_random_uuid(), c2,  b1, s1, (CURRENT_DATE-24)+'12:30'::time, (CURRENT_DATE-24)+'13:00'::time, 'no_show',   3500,  null),
  (gen_random_uuid(), c4,  b3, s5, (CURRENT_DATE-24)+'14:00'::time, (CURRENT_DATE-24)+'14:15'::time, 'completed', 1500,  null),
  (gen_random_uuid(), c6,  b2, s4, (CURRENT_DATE-24)+'15:00'::time, (CURRENT_DATE-24)+'15:45'::time, 'completed', 4800,  null),
  (gen_random_uuid(), c8,  b1, s2, (CURRENT_DATE-24)+'16:00'::time, (CURRENT_DATE-24)+'16:55'::time, 'completed', 6500,  null),

  -- ── 21 days ago ──
  (gen_random_uuid(), c10, b2, s1, (CURRENT_DATE-21)+'09:30'::time, (CURRENT_DATE-21)+'10:00'::time, 'completed', 3500,  null),
  (gen_random_uuid(), c12, b1, s6, (CURRENT_DATE-21)+'10:00'::time, (CURRENT_DATE-21)+'11:30'::time, 'completed', 14000, 'Mechas balayage'),
  (gen_random_uuid(), c14, b3, s2, (CURRENT_DATE-21)+'11:00'::time, (CURRENT_DATE-21)+'11:55'::time, 'completed', 6500,  null),
  (gen_random_uuid(), c15, b2, s3, (CURRENT_DATE-21)+'13:00'::time, (CURRENT_DATE-21)+'13:25'::time, 'completed', 2800,  null),
  (gen_random_uuid(), c1,  b1, s4, (CURRENT_DATE-21)+'14:00'::time, (CURRENT_DATE-21)+'14:45'::time, 'completed', 4800,  null),
  (gen_random_uuid(), c3,  b3, s1, (CURRENT_DATE-21)+'15:30'::time, (CURRENT_DATE-21)+'16:00'::time, 'completed', 3500,  null),
  (gen_random_uuid(), c5,  b2, s5, (CURRENT_DATE-21)+'16:30'::time, (CURRENT_DATE-21)+'16:45'::time, 'completed', 1500,  null),

  -- ── 18 days ago ──
  (gen_random_uuid(), c7,  b1, s2, (CURRENT_DATE-18)+'09:00'::time, (CURRENT_DATE-18)+'09:55'::time, 'completed', 6500,  null),
  (gen_random_uuid(), c9,  b2, s4, (CURRENT_DATE-18)+'10:30'::time, (CURRENT_DATE-18)+'11:15'::time, 'completed', 4800,  null),
  (gen_random_uuid(), c11, b3, s3, (CURRENT_DATE-18)+'11:00'::time, (CURRENT_DATE-18)+'11:25'::time, 'no_show',   2800,  null),
  (gen_random_uuid(), c13, b1, s1, (CURRENT_DATE-18)+'12:00'::time, (CURRENT_DATE-18)+'12:30'::time, 'completed', 3500,  null),
  (gen_random_uuid(), c2,  b2, s2, (CURRENT_DATE-18)+'14:00'::time, (CURRENT_DATE-18)+'14:55'::time, 'completed', 6500,  null),
  (gen_random_uuid(), c4,  b3, s4, (CURRENT_DATE-18)+'15:00'::time, (CURRENT_DATE-18)+'15:45'::time, 'completed', 4800,  null),
  (gen_random_uuid(), c6,  b1, s3, (CURRENT_DATE-18)+'16:00'::time, (CURRENT_DATE-18)+'16:25'::time, 'completed', 2800,  null),

  -- ── 14 days ago (busy Fri/Sat) ──
  (gen_random_uuid(), c8,  b1, s2, (CURRENT_DATE-14)+'09:00'::time, (CURRENT_DATE-14)+'09:55'::time, 'completed', 6500,  null),
  (gen_random_uuid(), c10, b2, s1, (CURRENT_DATE-14)+'09:30'::time, (CURRENT_DATE-14)+'10:00'::time, 'completed', 3500,  null),
  (gen_random_uuid(), c12, b3, s4, (CURRENT_DATE-14)+'10:00'::time, (CURRENT_DATE-14)+'10:45'::time, 'completed', 4800,  null),
  (gen_random_uuid(), c14, b1, s3, (CURRENT_DATE-14)+'10:30'::time, (CURRENT_DATE-14)+'10:55'::time, 'completed', 2800,  null),
  (gen_random_uuid(), c15, b2, s2, (CURRENT_DATE-14)+'11:00'::time, (CURRENT_DATE-14)+'11:55'::time, 'completed', 6500,  null),
  (gen_random_uuid(), c1,  b3, s1, (CURRENT_DATE-14)+'11:30'::time, (CURRENT_DATE-14)+'12:00'::time, 'completed', 3500,  null),
  (gen_random_uuid(), c3,  b1, s5, (CURRENT_DATE-14)+'12:00'::time, (CURRENT_DATE-14)+'12:15'::time, 'completed', 1500,  null),
  (gen_random_uuid(), c5,  b2, s4, (CURRENT_DATE-14)+'13:00'::time, (CURRENT_DATE-14)+'13:45'::time, 'completed', 4800,  null),
  (gen_random_uuid(), c7,  b3, s2, (CURRENT_DATE-14)+'14:00'::time, (CURRENT_DATE-14)+'14:55'::time, 'completed', 6500,  null),
  (gen_random_uuid(), c9,  b1, s1, (CURRENT_DATE-14)+'15:00'::time, (CURRENT_DATE-14)+'15:30'::time, 'completed', 3500,  null),
  (gen_random_uuid(), c11, b2, s3, (CURRENT_DATE-14)+'15:30'::time, (CURRENT_DATE-14)+'15:55'::time, 'completed', 2800,  null),
  (gen_random_uuid(), c13, b3, s6, (CURRENT_DATE-14)+'16:00'::time, (CURRENT_DATE-14)+'17:30'::time, 'completed', 14000, null),

  -- ── 10 days ago ──
  (gen_random_uuid(), c2,  b1, s4, (CURRENT_DATE-10)+'09:30'::time, (CURRENT_DATE-10)+'10:15'::time, 'completed', 4800,  null),
  (gen_random_uuid(), c4,  b2, s2, (CURRENT_DATE-10)+'10:00'::time, (CURRENT_DATE-10)+'10:55'::time, 'completed', 6500,  null),
  (gen_random_uuid(), c6,  b3, s1, (CURRENT_DATE-10)+'11:00'::time, (CURRENT_DATE-10)+'11:30'::time, 'completed', 3500,  null),
  (gen_random_uuid(), c8,  b1, s3, (CURRENT_DATE-10)+'12:00'::time, (CURRENT_DATE-10)+'12:25'::time, 'completed', 2800,  null),
  (gen_random_uuid(), c10, b2, s4, (CURRENT_DATE-10)+'14:00'::time, (CURRENT_DATE-10)+'14:45'::time, 'cancelled', 0,     'Cliente canceló por trabajo'),
  (gen_random_uuid(), c12, b3, s2, (CURRENT_DATE-10)+'15:00'::time, (CURRENT_DATE-10)+'15:55'::time, 'completed', 6500,  null),
  (gen_random_uuid(), c14, b1, s5, (CURRENT_DATE-10)+'16:00'::time, (CURRENT_DATE-10)+'16:15'::time, 'completed', 1500,  null),

  -- ── 7 days ago ──
  (gen_random_uuid(), c15, b2, s1, (CURRENT_DATE-7)+'09:00'::time, (CURRENT_DATE-7)+'09:30'::time, 'completed', 3500,  null),
  (gen_random_uuid(), c1,  b1, s2, (CURRENT_DATE-7)+'10:00'::time, (CURRENT_DATE-7)+'10:55'::time, 'completed', 6500,  null),
  (gen_random_uuid(), c3,  b3, s4, (CURRENT_DATE-7)+'10:30'::time, (CURRENT_DATE-7)+'11:15'::time, 'completed', 4800,  null),
  (gen_random_uuid(), c5,  b2, s3, (CURRENT_DATE-7)+'11:30'::time, (CURRENT_DATE-7)+'11:55'::time, 'completed', 2800,  null),
  (gen_random_uuid(), c7,  b1, s1, (CURRENT_DATE-7)+'13:00'::time, (CURRENT_DATE-7)+'13:30'::time, 'no_show',   3500,  null),
  (gen_random_uuid(), c9,  b3, s2, (CURRENT_DATE-7)+'14:00'::time, (CURRENT_DATE-7)+'14:55'::time, 'completed', 6500,  null),
  (gen_random_uuid(), c11, b2, s6, (CURRENT_DATE-7)+'15:00'::time, (CURRENT_DATE-7)+'16:30'::time, 'completed', 14000, 'Color rojo intenso'),
  (gen_random_uuid(), c13, b1, s4, (CURRENT_DATE-7)+'16:00'::time, (CURRENT_DATE-7)+'16:45'::time, 'completed', 4800,  null),

  -- ── 4 days ago ──
  (gen_random_uuid(), c2,  b2, s2, (CURRENT_DATE-4)+'09:30'::time, (CURRENT_DATE-4)+'10:25'::time, 'completed', 6500,  null),
  (gen_random_uuid(), c4,  b1, s4, (CURRENT_DATE-4)+'10:00'::time, (CURRENT_DATE-4)+'10:45'::time, 'completed', 4800,  null),
  (gen_random_uuid(), c6,  b3, s1, (CURRENT_DATE-4)+'11:00'::time, (CURRENT_DATE-4)+'11:30'::time, 'completed', 3500,  null),
  (gen_random_uuid(), c8,  b2, s5, (CURRENT_DATE-4)+'12:00'::time, (CURRENT_DATE-4)+'12:15'::time, 'completed', 1500,  null),
  (gen_random_uuid(), c10, b1, s3, (CURRENT_DATE-4)+'13:30'::time, (CURRENT_DATE-4)+'13:55'::time, 'completed', 2800,  null),
  (gen_random_uuid(), c12, b3, s2, (CURRENT_DATE-4)+'15:00'::time, (CURRENT_DATE-4)+'15:55'::time, 'completed', 6500,  null),
  (gen_random_uuid(), c14, b2, s4, (CURRENT_DATE-4)+'16:30'::time, (CURRENT_DATE-4)+'17:15'::time, 'completed', 4800,  null),

  -- ── 2 days ago ──
  (gen_random_uuid(), c15, b1, s2, (CURRENT_DATE-2)+'09:00'::time, (CURRENT_DATE-2)+'09:55'::time, 'completed', 6500,  null),
  (gen_random_uuid(), c1,  b3, s3, (CURRENT_DATE-2)+'10:30'::time, (CURRENT_DATE-2)+'10:55'::time, 'completed', 2800,  null),
  (gen_random_uuid(), c3,  b2, s1, (CURRENT_DATE-2)+'11:00'::time, (CURRENT_DATE-2)+'11:30'::time, 'completed', 3500,  null),
  (gen_random_uuid(), c5,  b1, s4, (CURRENT_DATE-2)+'12:00'::time, (CURRENT_DATE-2)+'12:45'::time, 'completed', 4800,  null),
  (gen_random_uuid(), c7,  b3, s2, (CURRENT_DATE-2)+'14:00'::time, (CURRENT_DATE-2)+'14:55'::time, 'completed', 6500,  null),
  (gen_random_uuid(), c9,  b2, s5, (CURRENT_DATE-2)+'15:30'::time, (CURRENT_DATE-2)+'15:45'::time, 'completed', 1500,  null),
  (gen_random_uuid(), c11, b1, s1, (CURRENT_DATE-2)+'16:00'::time, (CURRENT_DATE-2)+'16:30'::time, 'no_show',   3500,  null),

  -- ── Yesterday ──
  (gen_random_uuid(), c13, b2, s2, (CURRENT_DATE-1)+'09:30'::time, (CURRENT_DATE-1)+'10:25'::time, 'completed', 6500,  null),
  (gen_random_uuid(), c2,  b1, s4, (CURRENT_DATE-1)+'10:00'::time, (CURRENT_DATE-1)+'10:45'::time, 'completed', 4800,  null),
  (gen_random_uuid(), c4,  b3, s3, (CURRENT_DATE-1)+'11:00'::time, (CURRENT_DATE-1)+'11:25'::time, 'completed', 2800,  null),
  (gen_random_uuid(), c6,  b2, s1, (CURRENT_DATE-1)+'12:00'::time, (CURRENT_DATE-1)+'12:30'::time, 'completed', 3500,  null),
  (gen_random_uuid(), c8,  b1, s2, (CURRENT_DATE-1)+'14:00'::time, (CURRENT_DATE-1)+'14:55'::time, 'completed', 6500,  null),
  (gen_random_uuid(), c10, b3, s4, (CURRENT_DATE-1)+'15:00'::time, (CURRENT_DATE-1)+'15:45'::time, 'completed', 4800,  'Cliente habitual'),
  (gen_random_uuid(), c12, b2, s6, (CURRENT_DATE-1)+'16:00'::time, (CURRENT_DATE-1)+'17:30'::time, 'completed', 14000, null),

  -- ── Today ──
  (gen_random_uuid(), c14, b1, s2, CURRENT_DATE+'09:00'::time, CURRENT_DATE+'09:55'::time, 'confirmed', 6500,  null),
  (gen_random_uuid(), c15, b2, s1, CURRENT_DATE+'09:30'::time, CURRENT_DATE+'10:00'::time, 'confirmed', 3500,  null),
  (gen_random_uuid(), c1,  b3, s4, CURRENT_DATE+'10:30'::time, CURRENT_DATE+'11:15'::time, 'confirmed', 4800,  null),
  (gen_random_uuid(), c3,  b1, s3, CURRENT_DATE+'11:00'::time, CURRENT_DATE+'11:25'::time, 'confirmed', 2800,  null),
  (gen_random_uuid(), c5,  b2, s2, CURRENT_DATE+'13:00'::time, CURRENT_DATE+'13:55'::time, 'confirmed', 6500,  null),
  (gen_random_uuid(), c7,  b3, s1, CURRENT_DATE+'14:30'::time, CURRENT_DATE+'15:00'::time, 'pending',   3500,  null),
  (gen_random_uuid(), c9,  b1, s4, CURRENT_DATE+'15:00'::time, CURRENT_DATE+'15:45'::time, 'confirmed', 4800,  null),
  (gen_random_uuid(), c11, b2, s5, CURRENT_DATE+'16:00'::time, CURRENT_DATE+'16:15'::time, 'pending',   1500,  null),

  -- ── Tomorrow ──
  (gen_random_uuid(), c13, b1, s2, (CURRENT_DATE+1)+'09:30'::time, (CURRENT_DATE+1)+'10:25'::time, 'confirmed', 6500,  null),
  (gen_random_uuid(), c2,  b2, s4, (CURRENT_DATE+1)+'10:00'::time, (CURRENT_DATE+1)+'10:45'::time, 'confirmed', 4800,  null),
  (gen_random_uuid(), c4,  b3, s1, (CURRENT_DATE+1)+'11:30'::time, (CURRENT_DATE+1)+'12:00'::time, 'confirmed', 3500,  null),
  (gen_random_uuid(), c6,  b1, s6, (CURRENT_DATE+1)+'14:00'::time, (CURRENT_DATE+1)+'15:30'::time, 'confirmed', 14000, null),
  (gen_random_uuid(), c8,  b2, s3, (CURRENT_DATE+1)+'15:00'::time, (CURRENT_DATE+1)+'15:25'::time, 'pending',   2800,  null),
  (gen_random_uuid(), c10, b3, s2, (CURRENT_DATE+1)+'16:00'::time, (CURRENT_DATE+1)+'16:55'::time, 'confirmed', 6500,  null),

  -- ── Day after tomorrow ──
  (gen_random_uuid(), c12, b1, s4, (CURRENT_DATE+2)+'09:30'::time, (CURRENT_DATE+2)+'10:15'::time, 'confirmed', 4800,  null),
  (gen_random_uuid(), c14, b2, s2, (CURRENT_DATE+2)+'10:00'::time, (CURRENT_DATE+2)+'10:55'::time, 'confirmed', 6500,  null),
  (gen_random_uuid(), c15, b3, s1, (CURRENT_DATE+2)+'11:00'::time, (CURRENT_DATE+2)+'11:30'::time, 'pending',   3500,  null),
  (gen_random_uuid(), c1,  b1, s3, (CURRENT_DATE+2)+'15:00'::time, (CURRENT_DATE+2)+'15:25'::time, 'confirmed', 2800,  null),
  (gen_random_uuid(), c3,  b2, s5, (CURRENT_DATE+2)+'16:30'::time, (CURRENT_DATE+2)+'16:45'::time, 'pending',   1500,  null);

END $$;
