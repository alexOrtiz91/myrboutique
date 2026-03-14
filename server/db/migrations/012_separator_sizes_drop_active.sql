DO $$
BEGIN
  IF to_regclass('public.separator_sizes') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'separator_sizes'
      AND column_name = 'active'
  ) THEN
    DELETE FROM separator_sizes WHERE active = FALSE;

    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'i'
        AND n.nspname = 'public'
        AND c.relname = 'separator_sizes_active_idx'
    ) THEN
      DROP INDEX separator_sizes_active_idx;
    END IF;

    ALTER TABLE separator_sizes DROP COLUMN active;
  END IF;
END
$$;

