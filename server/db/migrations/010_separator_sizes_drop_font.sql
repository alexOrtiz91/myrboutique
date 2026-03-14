DO $$
BEGIN
  IF to_regclass('public.separator_sizes') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE separator_sizes
    DROP COLUMN IF EXISTS font_family;
  ALTER TABLE separator_sizes
    DROP COLUMN IF EXISTS font_weight;
END
$$;

