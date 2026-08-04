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
  productionProfileSystemId: z.string().min(1).optional(),
  productionProfileSystemName: z.string().min(1).optional(),
  productionProfileSystemVersion: z.string().min(1).optional(),
  productionProfileSystemStatus: z.enum(['DRAFT', 'VERIFIED', 'ARCHIVED']).optional(),
  productionFrameProfileCode: z.string().min(1).optional(),
  productionSashProfileCode: z.string().min(1).optional(),
  productionMullionProfileCode: z.string().min(1).optional(),
  productionTransomProfileCode: z.string().min(1).optional(),
  productionGlazingBeadProfileCode: z.string().min(1).optional(),
  productionGasketCode: z.string().min(1).optional(),
  productionHardwareSetCode: z.string().min(1).optional(),
});
