import { DatabaseMigration } from './types';

export const designTemplatesMigration: DatabaseMigration = {
  id: '003_design_templates',
  async up(database) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS design_templates (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        source TEXT NOT NULL,
        root_node_json TEXT NOT NULL,
        default_width REAL NOT NULL,
        default_height REAL NOT NULL,
        preview_aspect_ratio REAL NOT NULL,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_design_templates_category
      ON design_templates(category);

      CREATE INDEX IF NOT EXISTS idx_design_templates_source
      ON design_templates(source);

      CREATE INDEX IF NOT EXISTS idx_design_templates_sort_order
      ON design_templates(sort_order);
    `);
  },
};
