DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'separator_sizes'
  ) THEN
    CREATE TABLE separator_sizes (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
      name TEXT NOT NULL,
      lines TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      font_family TEXT NOT NULL DEFAULT 'ui-sans-serif',
      font_weight INTEGER NOT NULL DEFAULT 900,
      font_size_mm NUMERIC NOT NULL DEFAULT 12,
      line_gap_mm NUMERIC NOT NULL DEFAULT 5,
      y_offset_mm NUMERIC NOT NULL DEFAULT 0,
      side_offset_mm NUMERIC NOT NULL DEFAULT 0,
      letter_spacing_mm NUMERIC NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now (),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now ()
    );
    CREATE UNIQUE INDEX separator_sizes_name_unique ON separator_sizes (name);
    CREATE INDEX separator_sizes_active_idx ON separator_sizes (active);
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'separator_sizes'
      AND column_name = 'name'
  ) THEN
    INSERT INTO separator_sizes (name, lines)
    SELECT 'S', ARRAY['S']::TEXT[]
    WHERE NOT EXISTS (SELECT 1 FROM separator_sizes WHERE name = 'S');
    INSERT INTO separator_sizes (name, lines)
    SELECT 'M', ARRAY['M']::TEXT[]
    WHERE NOT EXISTS (SELECT 1 FROM separator_sizes WHERE name = 'M');
    INSERT INTO separator_sizes (name, lines)
    SELECT 'L', ARRAY['L']::TEXT[]
    WHERE NOT EXISTS (SELECT 1 FROM separator_sizes WHERE name = 'L');
    INSERT INTO separator_sizes (name, lines)
    SELECT 'XL', ARRAY['XL']::TEXT[]
    WHERE NOT EXISTS (SELECT 1 FROM separator_sizes WHERE name = 'XL');
    INSERT INTO separator_sizes (name, lines)
    SELECT '8 - 10', ARRAY['8','-','10']::TEXT[]
    WHERE NOT EXISTS (SELECT 1 FROM separator_sizes WHERE name = '8 - 10');
  END IF;
END
$$;

