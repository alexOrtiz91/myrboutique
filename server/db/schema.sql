CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE
  branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    name TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'America/Mexico_City',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now ()
  );

CREATE TABLE
  size_profiles (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    genero TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now ()
  );

CREATE TABLE
  size_profile_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    profile_id TEXT NOT NULL REFERENCES size_profiles (id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now (),
    UNIQUE (profile_id, value)
  );

CREATE TABLE
  categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    wholesale_price_cents INTEGER NOT NULL CHECK (wholesale_price_cents >= 0),
    size_profile_id TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now ()
  );

CREATE TABLE
  product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    category_id TEXT NOT NULL REFERENCES categories (id),
    tipo TEXT,
    genero TEXT,
    talla TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now ()
  );

CREATE TABLE
  inventory_counts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    branch_id UUID NOT NULL REFERENCES branches (id),
    product_variant_id UUID NOT NULL REFERENCES product_variants (id),
    qty INTEGER NOT NULL CHECK (qty >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now (),
    UNIQUE (branch_id, product_variant_id)
  );

CREATE TABLE
  stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    branch_id UUID NOT NULL REFERENCES branches (id),
    product_variant_id UUID NOT NULL REFERENCES product_variants (id),
    delta INTEGER NOT NULL,
    reason TEXT NOT NULL,
    ref TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now ()
  );

CREATE TABLE
  sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    branch_id UUID NOT NULL REFERENCES branches (id),
    terminal_id TEXT,
    receipt_number TEXT,
    subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
    total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
    payment_method TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now ()
  );

CREATE TABLE
  sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    sale_id UUID NOT NULL REFERENCES sales (id) ON DELETE CASCADE,
    product_variant_id UUID NOT NULL REFERENCES product_variants (id),
    category_id TEXT NOT NULL REFERENCES categories (id),
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
    qty INTEGER NOT NULL CHECK (qty > 0),
    line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0)
  );

INSERT INTO
  size_profiles (id, label, genero)
VALUES
  ('pantalon_dama', 'Pantalón Dama', 'Dama'),
  (
    'pantalon_caballero',
    'Pantalón Caballero',
    'Caballero'
  ),
  ('pantalon_nino', 'Pantalón Niño', 'Niño'),
  ('ropa_bebe', 'Ropa Bebé', 'Bebé'),
  ('calzado_dama', 'Calzado Dama', 'Dama'),
  (
    'calzado_caballero',
    'Calzado Caballero',
    'Caballero'
  );

INSERT INTO
  size_profile_values (profile_id, value, sort_order)
VALUES
  ('pantalon_dama', '28', 1),
  ('pantalon_dama', '30', 2),
  ('pantalon_dama', '32', 3),
  ('pantalon_dama', '34', 4),
  ('pantalon_dama', '36', 5),
  ('pantalon_dama', '38', 6),
  ('pantalon_dama', '40', 7),
  ('pantalon_caballero', '28', 1),
  ('pantalon_caballero', '30', 2),
  ('pantalon_caballero', '32', 3),
  ('pantalon_caballero', '34', 4),
  ('pantalon_caballero', '36', 5),
  ('pantalon_caballero', '38', 6),
  ('pantalon_caballero', '40', 7),
  ('pantalon_nino', '4', 1),
  ('pantalon_nino', '6', 2),
  ('pantalon_nino', '8', 3),
  ('pantalon_nino', '10', 4),
  ('pantalon_nino', '12', 5),
  ('pantalon_nino', '14', 6),
  ('pantalon_nino', '16', 7),
  ('ropa_bebe', '0-3M', 1),
  ('ropa_bebe', '3-6M', 2),
  ('ropa_bebe', '6-9M', 3),
  ('ropa_bebe', '9-12M', 4),
  ('ropa_bebe', '12-18M', 5),
  ('ropa_bebe', '18-24M', 6),
  ('calzado_dama', '22', 1),
  ('calzado_dama', '22.5', 2),
  ('calzado_dama', '23', 3),
  ('calzado_dama', '23.5', 4),
  ('calzado_dama', '24', 5),
  ('calzado_dama', '24.5', 6),
  ('calzado_dama', '25', 7),
  ('calzado_dama', '25.5', 8),
  ('calzado_dama', '26', 9),
  ('calzado_dama', '26.5', 10),
  ('calzado_dama', '27', 11),
  ('calzado_caballero', '25', 1),
  ('calzado_caballero', '25.5', 2),
  ('calzado_caballero', '26', 3),
  ('calzado_caballero', '26.5', 4),
  ('calzado_caballero', '27', 5),
  ('calzado_caballero', '27.5', 6),
  ('calzado_caballero', '28', 7),
  ('calzado_caballero', '28.5', 8),
  ('calzado_caballero', '29', 9),
  ('calzado_caballero', '29.5', 10),
  ('calzado_caballero', '30', 11);