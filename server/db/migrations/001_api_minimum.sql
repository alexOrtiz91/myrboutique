BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'categories'
      AND column_name = 'wholesale_price_cents'
  ) THEN
    ALTER TABLE categories ADD COLUMN wholesale_price_cents INTEGER;
  END IF;
END
$$;

UPDATE categories
SET
  wholesale_price_cents = price_cents
WHERE
  wholesale_price_cents IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'categories'
      AND column_name = 'wholesale_price_cents'
  ) THEN
    ALTER TABLE categories ALTER COLUMN wholesale_price_cents SET NOT NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'categories_wholesale_price_cents_nonneg'
  ) THEN
    ALTER TABLE categories
    ADD CONSTRAINT categories_wholesale_price_cents_nonneg
    CHECK (wholesale_price_cents >= 0);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'categories'
      AND column_name = 'size_profile_id'
  ) THEN
    ALTER TABLE categories ADD COLUMN size_profile_id TEXT;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'product_variants'
      AND column_name = 'tipo'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE product_variants ALTER COLUMN tipo DROP NOT NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'product_variants'
      AND column_name = 'genero'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE product_variants ALTER COLUMN genero DROP NOT NULL;
  END IF;
END
$$;

COMMIT;
