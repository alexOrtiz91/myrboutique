BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'branches'
      AND column_name = 'code'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'branches_code_key'
    ) THEN
      ALTER TABLE branches DROP CONSTRAINT branches_code_key;
    END IF;
    ALTER TABLE branches DROP COLUMN code;
  END IF;
END
$$;

COMMIT;
