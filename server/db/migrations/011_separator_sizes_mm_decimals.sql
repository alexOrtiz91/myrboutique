DO $$
BEGIN
  IF to_regclass('public.separator_sizes') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'separator_sizes'
      AND column_name = 'font_size_mm'
  ) THEN
    ALTER TABLE separator_sizes
      ALTER COLUMN font_size_mm TYPE NUMERIC USING font_size_mm::numeric;
    ALTER TABLE separator_sizes
      ALTER COLUMN font_size_mm SET DEFAULT 12;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'separator_sizes'
      AND column_name = 'line_gap_mm'
  ) THEN
    ALTER TABLE separator_sizes
      ALTER COLUMN line_gap_mm TYPE NUMERIC USING line_gap_mm::numeric;
    ALTER TABLE separator_sizes
      ALTER COLUMN line_gap_mm SET DEFAULT 5;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'separator_sizes'
      AND column_name = 'y_offset_mm'
  ) THEN
    ALTER TABLE separator_sizes
      ALTER COLUMN y_offset_mm TYPE NUMERIC USING y_offset_mm::numeric;
    ALTER TABLE separator_sizes
      ALTER COLUMN y_offset_mm SET DEFAULT 0;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'separator_sizes'
      AND column_name = 'side_offset_mm'
  ) THEN
    ALTER TABLE separator_sizes
      ALTER COLUMN side_offset_mm TYPE NUMERIC USING side_offset_mm::numeric;
    ALTER TABLE separator_sizes
      ALTER COLUMN side_offset_mm SET DEFAULT 0;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'separator_sizes'
      AND column_name = 'letter_spacing_mm'
  ) THEN
    ALTER TABLE separator_sizes
      ALTER COLUMN letter_spacing_mm TYPE NUMERIC USING letter_spacing_mm::numeric;
    ALTER TABLE separator_sizes
      ALTER COLUMN letter_spacing_mm SET DEFAULT 0;
  END IF;
END
$$;

