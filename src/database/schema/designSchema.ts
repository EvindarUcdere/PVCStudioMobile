export const createDesignDomainSql = `
  CREATE TABLE IF NOT EXISTS design_projects (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    customer_id TEXT,
    template_id TEXT,
    width REAL NOT NULL,
    height REAL NOT NULL,
    quantity INTEGER NOT NULL,
    unit TEXT NOT NULL,
    root_node_json TEXT NOT NULL,
    profile_system_json TEXT,
    default_glass_json TEXT,
    accessories_json TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    sync_status TEXT NOT NULL,
    version INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_design_projects_updated_at
  ON design_projects(updated_at);

  CREATE INDEX IF NOT EXISTS idx_design_projects_deleted_at
  ON design_projects(deleted_at);

  CREATE INDEX IF NOT EXISTS idx_design_projects_customer_id
  ON design_projects(customer_id);

  CREATE TABLE IF NOT EXISTS profile_brands (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS profile_series (
    id TEXT PRIMARY KEY NOT NULL,
    brand_id TEXT NOT NULL,
    name TEXT NOT NULL,
    profile_width REAL NOT NULL,
    chamber_count INTEGER,
    wall_class TEXT,
    gasket_count INTEGER,
    is_active INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_profile_series_brand_id
  ON profile_series(brand_id);

  CREATE TABLE IF NOT EXISTS profile_colors (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    hex_value TEXT NOT NULL,
    texture_asset TEXT,
    is_active INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS glass_types (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    default_formula TEXT,
    default_thickness REAL,
    is_active INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS accessory_types (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    is_active INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;
