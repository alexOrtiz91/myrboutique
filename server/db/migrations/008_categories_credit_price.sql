BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'categories'
      AND column_name = 'credit_price_cents'
  ) THEN
    ALTER TABLE categories ADD COLUMN credit_price_cents INTEGER;
  END IF;
END
$$;

UPDATE categories
SET credit_price_cents = price_cents
WHERE credit_price_cents IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'categories'
      AND column_name = 'credit_price_cents'
  ) THEN
    ALTER TABLE categories ALTER COLUMN credit_price_cents SET NOT NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'categories_credit_price_cents_nonneg'
  ) THEN
    ALTER TABLE categories
    ADD CONSTRAINT categories_credit_price_cents_nonneg
    CHECK (credit_price_cents >= 0);
  END IF;
END
$$;

COMMIT;
