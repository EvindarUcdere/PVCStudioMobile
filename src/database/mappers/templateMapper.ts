import { DataCorruptionError } from '../../domain/designs/errors';
import { DesignNode } from '../../domain/designs/entities/DesignNode';
import { designNodeSchema } from '../../domain/designs/schemas/designNodeSchema';
import { DesignTemplate } from '../../domain/templates/entities/DesignTemplate';
import { designTemplateSchema } from '../../domain/templates/schemas/designTemplateSchema';

export type DesignTemplateRow = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  source: string;
  root_node_json: string;
  default_width: number;
  default_height: number;
  preview_aspect_ratio: number;
  is_favorite: number;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
};

function parseRootNode(value: string): DesignNode {
  try {
    return designNodeSchema.parse(JSON.parse(value));
  } catch (error) {
    throw new DataCorruptionError('Invalid template root node JSON.', { cause: error });
  }
}

export function templateToRow(template: DesignTemplate): DesignTemplateRow {
  const parsed = designTemplateSchema.parse(template);
  return {
    id: parsed.id,
    name: parsed.name,
    description: parsed.description,
    category: parsed.category,
    source: parsed.source,
    root_node_json: JSON.stringify(parsed.rootNode),
    default_width: parsed.defaultWidth,
    default_height: parsed.defaultHeight,
    preview_aspect_ratio: parsed.previewAspectRatio,
    is_favorite: parsed.isFavorite ? 1 : 0,
    sort_order: parsed.sortOrder,
    is_active: parsed.isActive ? 1 : 0,
    created_at: parsed.createdAt,
    updated_at: parsed.updatedAt,
  };
}

export function templateToDomain(row: DesignTemplateRow): DesignTemplate {
  return designTemplateSchema.parse({
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    source: row.source,
    rootNode: parseRootNode(row.root_node_json),
    defaultWidth: row.default_width,
    defaultHeight: row.default_height,
    previewAspectRatio: row.preview_aspect_ratio,
    isFavorite: row.is_favorite === 1,
    sortOrder: row.sort_order,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
