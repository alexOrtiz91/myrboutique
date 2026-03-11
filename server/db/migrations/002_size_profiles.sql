BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
    CREATE EXTENSION "uuid-ossp";
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;

DO $$
BEGIN
  CREATE TABLE size_profiles (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    genero TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now ()
  );
EXCEPTION
  WHEN duplicate_table THEN
    NULL;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'size_profiles' AND column_name = 'genero'
  ) THEN
    ALTER TABLE size_profiles ADD COLUMN genero TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'size_profiles' AND column_name = 'active'
  ) THEN
    ALTER TABLE size_profiles ADD COLUMN active BOOLEAN;
    UPDATE size_profiles SET active = TRUE WHERE active IS NULL;
    ALTER TABLE size_profiles ALTER COLUMN active SET NOT NULL;
    ALTER TABLE size_profiles ALTER COLUMN active SET DEFAULT TRUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'size_profiles' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE size_profiles ADD COLUMN created_at TIMESTAMPTZ;
    UPDATE size_profiles SET created_at = now() WHERE created_at IS NULL;
    ALTER TABLE size_profiles ALTER COLUMN created_at SET NOT NULL;
    ALTER TABLE size_profiles ALTER COLUMN created_at SET DEFAULT now();
  END IF;
END
$$;

DO $$
BEGIN
  CREATE TABLE size_profile_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    profile_id TEXT NOT NULL REFERENCES size_profiles (id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now (),
    UNIQUE (profile_id, value)
  );
EXCEPTION
  WHEN duplicate_table THEN
    NULL;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'size_profile_values' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE size_profile_values ADD COLUMN sort_order INTEGER;
    UPDATE size_profile_values SET sort_order = 0 WHERE sort_order IS NULL;
    ALTER TABLE size_profile_values ALTER COLUMN sort_order SET NOT NULL;
    ALTER TABLE size_profile_values ALTER COLUMN sort_order SET DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'size_profile_values' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE size_profile_values ADD COLUMN created_at TIMESTAMPTZ;
    UPDATE size_profile_values SET created_at = now() WHERE created_at IS NULL;
    ALTER TABLE size_profile_values ALTER COLUMN created_at SET NOT NULL;
    ALTER TABLE size_profile_values ALTER COLUMN created_at SET DEFAULT now();
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'size_profile_values_profile_id_value_unique'
  ) THEN
    ALTER TABLE size_profile_values
    ADD CONSTRAINT size_profile_values_profile_id_value_unique UNIQUE (profile_id, value);
  END IF;
END
$$;

INSERT INTO size_profiles (id, label, genero)
SELECT 'pantalon_dama', 'Pantalón Dama', 'Dama'
WHERE NOT EXISTS (SELECT 1 FROM size_profiles WHERE id = 'pantalon_dama');
INSERT INTO size_profiles (id, label, genero)
SELECT 'pantalon_caballero', 'Pantalón Caballero', 'Caballero'
WHERE NOT EXISTS (SELECT 1 FROM size_profiles WHERE id = 'pantalon_caballero');
INSERT INTO size_profiles (id, label, genero)
SELECT 'pantalon_nino', 'Pantalón Niño', 'Niño'
WHERE NOT EXISTS (SELECT 1 FROM size_profiles WHERE id = 'pantalon_nino');
INSERT INTO size_profiles (id, label, genero)
SELECT 'ropa_bebe', 'Ropa Bebé', 'Bebé'
WHERE NOT EXISTS (SELECT 1 FROM size_profiles WHERE id = 'ropa_bebe');
INSERT INTO size_profiles (id, label, genero)
SELECT 'calzado_dama', 'Calzado Dama', 'Dama'
WHERE NOT EXISTS (SELECT 1 FROM size_profiles WHERE id = 'calzado_dama');
INSERT INTO size_profiles (id, label, genero)
SELECT 'calzado_caballero', 'Calzado Caballero', 'Caballero'
WHERE NOT EXISTS (SELECT 1 FROM size_profiles WHERE id = 'calzado_caballero');

INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'pantalon_dama', '28', 1
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'pantalon_dama' AND value = '28');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'pantalon_dama', '30', 2
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'pantalon_dama' AND value = '30');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'pantalon_dama', '32', 3
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'pantalon_dama' AND value = '32');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'pantalon_dama', '34', 4
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'pantalon_dama' AND value = '34');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'pantalon_dama', '36', 5
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'pantalon_dama' AND value = '36');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'pantalon_dama', '38', 6
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'pantalon_dama' AND value = '38');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'pantalon_dama', '40', 7
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'pantalon_dama' AND value = '40');

INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'pantalon_caballero', '28', 1
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'pantalon_caballero' AND value = '28');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'pantalon_caballero', '30', 2
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'pantalon_caballero' AND value = '30');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'pantalon_caballero', '32', 3
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'pantalon_caballero' AND value = '32');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'pantalon_caballero', '34', 4
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'pantalon_caballero' AND value = '34');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'pantalon_caballero', '36', 5
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'pantalon_caballero' AND value = '36');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'pantalon_caballero', '38', 6
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'pantalon_caballero' AND value = '38');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'pantalon_caballero', '40', 7
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'pantalon_caballero' AND value = '40');

INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'pantalon_nino', '4', 1
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'pantalon_nino' AND value = '4');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'pantalon_nino', '6', 2
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'pantalon_nino' AND value = '6');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'pantalon_nino', '8', 3
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'pantalon_nino' AND value = '8');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'pantalon_nino', '10', 4
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'pantalon_nino' AND value = '10');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'pantalon_nino', '12', 5
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'pantalon_nino' AND value = '12');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'pantalon_nino', '14', 6
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'pantalon_nino' AND value = '14');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'pantalon_nino', '16', 7
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'pantalon_nino' AND value = '16');

INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'ropa_bebe', '0-3M', 1
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'ropa_bebe' AND value = '0-3M');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'ropa_bebe', '3-6M', 2
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'ropa_bebe' AND value = '3-6M');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'ropa_bebe', '6-9M', 3
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'ropa_bebe' AND value = '6-9M');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'ropa_bebe', '9-12M', 4
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'ropa_bebe' AND value = '9-12M');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'ropa_bebe', '12-18M', 5
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'ropa_bebe' AND value = '12-18M');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'ropa_bebe', '18-24M', 6
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'ropa_bebe' AND value = '18-24M');

INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'calzado_dama', '22', 1
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'calzado_dama' AND value = '22');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'calzado_dama', '22.5', 2
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'calzado_dama' AND value = '22.5');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'calzado_dama', '23', 3
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'calzado_dama' AND value = '23');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'calzado_dama', '23.5', 4
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'calzado_dama' AND value = '23.5');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'calzado_dama', '24', 5
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'calzado_dama' AND value = '24');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'calzado_dama', '24.5', 6
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'calzado_dama' AND value = '24.5');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'calzado_dama', '25', 7
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'calzado_dama' AND value = '25');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'calzado_dama', '25.5', 8
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'calzado_dama' AND value = '25.5');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'calzado_dama', '26', 9
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'calzado_dama' AND value = '26');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'calzado_dama', '26.5', 10
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'calzado_dama' AND value = '26.5');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'calzado_dama', '27', 11
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'calzado_dama' AND value = '27');

INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'calzado_caballero', '25', 1
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'calzado_caballero' AND value = '25');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'calzado_caballero', '25.5', 2
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'calzado_caballero' AND value = '25.5');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'calzado_caballero', '26', 3
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'calzado_caballero' AND value = '26');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'calzado_caballero', '26.5', 4
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'calzado_caballero' AND value = '26.5');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'calzado_caballero', '27', 5
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'calzado_caballero' AND value = '27');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'calzado_caballero', '27.5', 6
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'calzado_caballero' AND value = '27.5');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'calzado_caballero', '28', 7
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'calzado_caballero' AND value = '28');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'calzado_caballero', '28.5', 8
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'calzado_caballero' AND value = '28.5');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'calzado_caballero', '29', 9
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'calzado_caballero' AND value = '29');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'calzado_caballero', '29.5', 10
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'calzado_caballero' AND value = '29.5');
INSERT INTO size_profile_values (profile_id, value, sort_order)
SELECT 'calzado_caballero', '30', 11
WHERE NOT EXISTS (SELECT 1 FROM size_profile_values WHERE profile_id = 'calzado_caballero' AND value = '30');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'categories'
      AND column_name = 'size_profile_id'
  ) THEN
    UPDATE categories
    SET size_profile_id = 'pantalon_dama'
    WHERE size_profile_id IS NULL;
  END IF;
END
$$;

COMMIT;
