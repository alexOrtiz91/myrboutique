DO $$
BEGIN
  IF to_regclass('public.sales') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'sales'
      AND column_name = 'canceled_at'
  ) THEN
    ALTER TABLE sales ADD COLUMN canceled_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'sales'
      AND column_name = 'canceled_reason'
  ) THEN
    ALTER TABLE sales ADD COLUMN canceled_reason TEXT;
  END IF;
END
$$;
