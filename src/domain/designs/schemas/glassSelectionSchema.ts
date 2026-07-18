import { z } from 'zod';

import { DecorativeBarConfig, GlassSelection } from '../entities/GlassSelection';

export const decorativeBarConfigSchema: z.ZodType<DecorativeBarConfig> = z.object({
  type: z.enum([
    'none',
    'single-horizontal',
    'single-vertical',
    'grid',
    'triple-horizontal',
    'triple-vertical',
  ]),
  horizontalCount: z.number().int().min(0),
  verticalCount: z.number().int().min(0),
});

export const glassSelectionSchema: z.ZodType<GlassSelection> = z.object({
  glassTypeId: z.string().min(1),
  formula: z.string().nullable(),
  thickness: z.number().positive().nullable(),
  color: z.string().nullable(),
  pattern: z.string().nullable(),
  lowE: z.boolean(),
  tempered: z.boolean(),
  laminated: z.boolean(),
  decorativeBar: decorativeBarConfigSchema.nullable(),
});
