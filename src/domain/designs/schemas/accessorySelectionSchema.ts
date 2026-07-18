import { z } from 'zod';

import { AccessorySelection } from '../entities/AccessorySelection';

export const accessorySelectionSchema: z.ZodType<AccessorySelection> = z
  .object({
    id: z.string().min(1),
    accessoryTypeId: z.string().min(1),
    scope: z.enum(['design', 'panel']),
    targetNodeId: z.string().min(1).nullable(),
    quantity: z.number().int().positive(),
    notes: z.string().nullable(),
  })
  .refine((value) => value.scope !== 'design' || value.targetNodeId === null, {
    message: 'Design scoped accessories cannot target a panel',
  })
  .refine((value) => value.scope !== 'panel' || value.targetNodeId !== null, {
    message: 'Panel scoped accessories must target a panel',
  });
