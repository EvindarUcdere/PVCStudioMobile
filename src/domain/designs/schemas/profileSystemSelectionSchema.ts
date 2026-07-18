import { z } from 'zod';

import { ProfileSystemSelection } from '../entities/ProfileSystemSelection';

export const profileSystemSelectionSchema: z.ZodType<ProfileSystemSelection> = z.object({
  brandId: z.string().min(1),
  seriesId: z.string().min(1),
  profileWidth: z.number().positive(),
  chamberCount: z.number().int().positive().nullable(),
  wallClass: z.enum(['A', 'B', 'C']).nullable(),
  gasketCount: z.number().int().positive().nullable(),
  gasketColor: z.string().nullable(),
  steelThickness: z.number().positive().nullable(),
  interiorColorId: z.string().min(1),
  exteriorColorId: z.string().min(1),
});
