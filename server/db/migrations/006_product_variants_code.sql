BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'product_variants'
      AND column_name = 'barcode'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'product_variants'
      AND column_name = 'code'
  ) THEN
    ALTER TABLE product_variants RENAME COLUMN barcode TO code;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'product_variants'
      AND column_name = 'code'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE product_variants ALTER COLUMN code SET NOT NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_variants_barcode_key'
  ) THEN
    ALTER TABLE product_variants
    RENAME CONSTRAINT product_variants_barcode_key TO product_variants_code_key;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_variants_code_key'
  ) THEN
    ALTER TABLE product_variants
    ADD CONSTRAINT product_variants_code_key UNIQUE (code);
  END IF;
END
$$;

COMMIT;
