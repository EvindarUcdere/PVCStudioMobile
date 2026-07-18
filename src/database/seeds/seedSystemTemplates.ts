import { templateToRow } from '../mappers/templateMapper';
import { MigrationDatabase } from '../migrations/types';
import { systemTemplates } from './systemTemplates';

export async function seedSystemTemplates(database: MigrationDatabase): Promise<void> {
  for (const template of systemTemplates) {
    const row = templateToRow(template);
    await database.runAsync(
      `
        INSERT INTO design_templates
        (id, name, description, category, source, root_node_json, default_width, default_height,
         preview_aspect_ratio, is_favorite, sort_order, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          category = excluded.category,
          source = excluded.source,
          root_node_json = excluded.root_node_json,
          default_width = excluded.default_width,
          default_height = excluded.default_height,
          preview_aspect_ratio = excluded.preview_aspect_ratio,
          sort_order = excluded.sort_order,
          is_active = excluded.is_active,
          updated_at = excluded.updated_at;
      `,
      [
        row.id,
        row.name,
        row.description,
        row.category,
        row.source,
        row.root_node_json,
        row.default_width,
        row.default_height,
        row.preview_aspect_ratio,
        row.is_favorite,
        row.sort_order,
        row.is_active,
        row.created_at,
        row.updated_at,
      ],
    );
  }
}
