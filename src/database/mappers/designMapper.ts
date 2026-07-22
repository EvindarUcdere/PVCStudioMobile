import { z } from 'zod';

import { DataCorruptionError } from '../../domain/designs/errors';
import { AccessorySelection } from '../../domain/designs/entities/AccessorySelection';
import { DesignNode } from '../../domain/designs/entities/DesignNode';
import { DesignProject } from '../../domain/designs/entities/DesignProject';
import { GlassSelection } from '../../domain/designs/entities/GlassSelection';
import { ProfileSystemSelection } from '../../domain/designs/entities/ProfileSystemSelection';
import { accessorySelectionSchema } from '../../domain/designs/schemas/accessorySelectionSchema';
import { designNodeSchema } from '../../domain/designs/schemas/designNodeSchema';
import { designProjectSchema } from '../../domain/designs/schemas/designProjectSchema';
import { glassSelectionSchema } from '../../domain/designs/schemas/glassSelectionSchema';
import { profileSystemSelectionSchema } from '../../domain/designs/schemas/profileSystemSelectionSchema';

export type DesignProjectRow = {
  id: string;
  name: string;
  customer_id: string | null;
  template_id: string | null;
  width: number;
  height: number;
  quantity: number;
  job_status: string;
  job_name: string | null;
  unit: string;
  root_node_json: string;
  profile_system_json: string | null;
  default_glass_json: string | null;
  accessories_json: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: string;
  version: number;
};

function parseJson<T>(value: string, schema: z.ZodType<T>, fieldName: string): T {
  try {
    return schema.parse(JSON.parse(value));
  } catch (error) {
    throw new DataCorruptionError(`Invalid JSON field: ${fieldName}`, { cause: error });
  }
}

function parseNullableJson<T>(
  value: string | null,
  schema: z.ZodType<T>,
  fieldName: string,
): T | null {
  if (value === null) {
    return null;
  }

  return parseJson(value, schema, fieldName);
}

export function toDatabaseRow(project: DesignProject): DesignProjectRow {
  const parsed = designProjectSchema.parse(project);

  return {
    id: parsed.id,
    name: parsed.name,
    customer_id: parsed.customerId,
    template_id: parsed.templateId,
    width: parsed.width,
    height: parsed.height,
    quantity: parsed.quantity,
    job_status: parsed.jobStatus,
    job_name: parsed.jobName,
    unit: parsed.unit,
    root_node_json: JSON.stringify(parsed.rootNode),
    profile_system_json:
      parsed.profileSystem === null ? null : JSON.stringify(parsed.profileSystem),
    default_glass_json: parsed.defaultGlass === null ? null : JSON.stringify(parsed.defaultGlass),
    accessories_json: JSON.stringify(parsed.accessories),
    notes: parsed.notes,
    created_at: parsed.createdAt,
    updated_at: parsed.updatedAt,
    deleted_at: parsed.deletedAt,
    sync_status: parsed.syncStatus,
    version: parsed.version,
  };
}

export function toDomain(row: DesignProjectRow): DesignProject {
  const rootNode = parseJson<DesignNode>(row.root_node_json, designNodeSchema, 'root_node_json');
  const profileSystem = parseNullableJson<ProfileSystemSelection>(
    row.profile_system_json,
    profileSystemSelectionSchema,
    'profile_system_json',
  );
  const defaultGlass = parseNullableJson<GlassSelection>(
    row.default_glass_json,
    glassSelectionSchema,
    'default_glass_json',
  );
  const accessories = parseJson<AccessorySelection[]>(
    row.accessories_json,
    z.array(accessorySelectionSchema),
    'accessories_json',
  );

  return designProjectSchema.parse({
    id: row.id,
    name: row.name,
    customerId: row.customer_id,
    templateId: row.template_id,
    width: row.width,
    height: row.height,
    quantity: row.quantity,
    jobStatus: row.job_status ?? 'draft',
    jobName: row.job_name,
    unit: row.unit,
    rootNode,
    profileSystem,
    defaultGlass,
    accessories,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncStatus: row.sync_status,
    version: row.version,
  });
}
