DO $$
BEGIN
  IF to_regclass('public.separator_sizes') IS NULL THEN
    RETURN;
  END IF;

  UPDATE separator_sizes
  SET name = btrim(name)
  WHERE name IS NOT NULL AND name <> btrim(name);

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT lower(btrim(name)) AS k, COUNT(*) AS c
      FROM separator_sizes
      GROUP BY lower(btrim(name))
    ) t
    WHERE t.c > 1
  ) THEN
    RAISE EXCEPTION 'Existen tallas duplicadas (ignorando mayúsculas/minúsculas). Elimina o renombra antes de aplicar esta migración.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND n.nspname = 'public'
      AND c.relname = 'separator_sizes_name_unique'
  ) THEN
    DROP INDEX separator_sizes_name_unique;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND n.nspname = 'public'
      AND c.relname = 'separator_sizes_name_unique_ci'
  ) THEN
    CREATE UNIQUE INDEX separator_sizes_name_unique_ci
      ON separator_sizes (lower(btrim(name)));
  END IF;
END
$$;

