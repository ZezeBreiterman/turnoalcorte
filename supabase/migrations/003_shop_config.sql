-- Shop configuration table (single row, one shop MVP)
CREATE TABLE IF NOT EXISTS shop_config (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT 'Turno al Corte',
  logo_url    TEXT,
  address     TEXT,
  phone       TEXT,
  description TEXT,
  instagram   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Seed default row
INSERT INTO shop_config (name, address, phone, description, instagram)
VALUES (
  'Turno al Corte',
  'Av. Corrientes 1234, CABA',
  '+54 11 4567-8901',
  'La mejor barbería del barrio.',
  '@turnoalcorte'
)
ON CONFLICT DO NOTHING;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shop_config_updated_at
  BEFORE UPDATE ON shop_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: anyone can read (public booking page needs it), only authenticated admins can write
ALTER TABLE shop_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_config_read_all"  ON shop_config FOR SELECT USING (true);
CREATE POLICY "shop_config_write_auth" ON shop_config FOR UPDATE USING (auth.role() = 'authenticated');
