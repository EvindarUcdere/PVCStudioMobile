import { z } from 'zod';

import { DesignProject } from '../../designs/entities/DesignProject';
import { DomainValidationError } from '../../designs/errors';
import { designProjectSchema } from '../../designs/schemas/designProjectSchema';
import { createIsoTimestamp } from '../../designs/utils/date';
import { createId } from '../../designs/utils/id';
import { DesignTemplate } from '../entities/DesignTemplate';
import { cloneTemplateTree } from '../utils/cloneTemplateTree';

export type CreateDesignFromTemplateInput = {
  template: DesignTemplate;
  name: string;
  width: number;
  height: number;
  quantity: number;
  customerId?: string | null;
};

export const createDesignFromTemplateInputSchema = z.object({
  name: z.string().min(1, 'Tasarım adı zorunludur.'),
  width: z.number().min(200).max(10000),
  height: z.number().min(200).max(10000),
  quantity: z.number().int().min(1).max(999),
});

export function createDesignFromTemplate({
  template,
  name,
  width,
  height,
  quantity,
  customerId = null,
}: CreateDesignFromTemplateInput): DesignProject {
  const now = createIsoTimestamp();
  const project: DesignProject = {
    id: createId(),
    name,
    customerId,
    templateId: template.id,
    width,
    height,
    quantity,
    unit: 'mm',
    rootNode: cloneTemplateTree(template.rootNode),
    profileSystem: null,
    defaultGlass: null,
    accessories: [],
    notes: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local',
    version: 1,
  };

  const parsed = designProjectSchema.safeParse(project);
  if (!parsed.success) {
    throw new DomainValidationError(
      'Design from template validation failed.',
      parsed.error.issues.map((issue) => issue.message),
    );
  }

  return parsed.data;
}
