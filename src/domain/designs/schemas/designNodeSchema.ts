import { z } from 'zod';

import { DesignNode } from '../entities/DesignNode';
import { PanelNode } from '../entities/PanelNode';
import { accessorySelectionSchema } from './accessorySelectionSchema';
import { glassSelectionSchema } from './glassSelectionSchema';

export const panelNodeSchema: z.ZodType<PanelNode> = z.object({
  id: z.string().min(1),
  type: z.literal('panel'),
  openingType: z.enum([
    'fixed',
    'open-left',
    'open-right',
    'tilt',
    'tilt-top',
    'tilt-bottom',
    'tilt-turn-left',
    'tilt-turn-right',
    'double-sash',
    'sliding-left',
    'sliding-right',
    'door-left',
    'door-right',
  ]),
  glass: glassSelectionSchema.nullable(),
  accessories: z.array(accessorySelectionSchema),
  notes: z.string().nullable(),
});

const frameShapeSchema = z.union([
  z.enum(['rect', 'arch-top']),
  z.object({
    type: z.literal('arch-top'),
    archHeight: z.number().positive(),
  }),
]);

export const designNodeSchema: z.ZodType<DesignNode> = z.lazy(() => {
  const frameNodeSchema = z.object({
    id: z.string().min(1),
    type: z.literal('frame'),
    shape: frameShapeSchema.optional(),
    child: designNodeSchema,
  });

  const splitNodeSchema = z.object({
    id: z.string().min(1),
    type: z.literal('split'),
    direction: z.enum(['horizontal', 'vertical']),
    ratio: z.number().min(0.05).max(0.95),
    first: designNodeSchema,
    second: designNodeSchema,
  });

  return z.union([frameNodeSchema, splitNodeSchema, panelNodeSchema]) as z.ZodType<DesignNode>;
});

export const frameNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('frame'),
  shape: frameShapeSchema.optional(),
  child: designNodeSchema,
});

export const splitNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('split'),
  direction: z.enum(['horizontal', 'vertical']),
  ratio: z.number().min(0.05).max(0.95),
  first: designNodeSchema,
  second: designNodeSchema,
});
