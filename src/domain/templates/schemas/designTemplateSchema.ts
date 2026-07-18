import { z } from 'zod';

import { DesignTemplate } from '../entities/DesignTemplate';
import { designNodeSchema } from '../../designs/schemas/designNodeSchema';

export const designTemplateSchema: z.ZodType<DesignTemplate> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  category: z.enum(['window', 'door', 'balcony', 'sliding', 'tilt', 'special']),
  source: z.enum(['system', 'user']),
  rootNode: designNodeSchema,
  defaultWidth: z.number().positive(),
  defaultHeight: z.number().positive(),
  previewAspectRatio: z.number().positive(),
  isFavorite: z.boolean(),
  sortOrder: z.number().int().min(1),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
