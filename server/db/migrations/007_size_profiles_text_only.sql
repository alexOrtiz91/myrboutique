BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'size_profiles'
      AND column_name = 'value_type'
  ) THEN
    UPDATE size_profiles SET value_type = 'text';
    ALTER TABLE size_profiles DROP COLUMN value_type;
  END IF;
END
$$;

COMMIT;
