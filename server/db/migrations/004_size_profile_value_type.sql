BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'size_profiles'
      AND column_name = 'value_type'
  ) THEN
    ALTER TABLE size_profiles ADD COLUMN value_type TEXT;
    UPDATE size_profiles SET value_type = 'text' WHERE value_type IS NULL;
    ALTER TABLE size_profiles ALTER COLUMN value_type SET NOT NULL;
    ALTER TABLE size_profiles ALTER COLUMN value_type SET DEFAULT 'text';
  END IF;
END
$$;

UPDATE size_profiles
SET value_type = 'numeric'
WHERE id IN ('pantalon_dama', 'pantalon_caballero', 'pantalon_nino', 'calzado_dama', 'calzado_caballero');

COMMIT;
