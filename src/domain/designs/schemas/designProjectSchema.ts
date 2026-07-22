import { z } from 'zod';

import { DesignProject } from '../entities/DesignProject';
import { accessorySelectionSchema } from './accessorySelectionSchema';
import { designNodeSchema } from './designNodeSchema';
import { glassSelectionSchema } from './glassSelectionSchema';
import { profileSystemSelectionSchema } from './profileSystemSelectionSchema';

export const isoDateStringSchema = z.string().datetime();

export const designProjectSchema: z.ZodType<DesignProject> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  customerId: z.string().min(1).nullable(),
  templateId: z.string().min(1).nullable(),
  width: z.number().positive(),
  height: z.number().positive(),
  quantity: z.number().int().positive(),
  jobStatus: z.enum(['draft', 'quoted', 'approved', 'production', 'installation', 'done', 'canceled']),
  unit: z.enum(['mm']),
  rootNode: designNodeSchema,
  profileSystem: profileSystemSelectionSchema.nullable(),
  defaultGlass: glassSelectionSchema.nullable(),
  accessories: z.array(accessorySelectionSchema),
  notes: z.string().nullable(),
  createdAt: isoDateStringSchema,
  updatedAt: isoDateStringSchema,
  deletedAt: isoDateStringSchema.nullable(),
  // New records start as local because there is no remote sync target in Faz 1.
  syncStatus: z.enum(['local', 'pending', 'synced', 'conflict']),
  version: z.number().int().positive(),
});
