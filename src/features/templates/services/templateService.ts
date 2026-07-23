import { createDesignFromTemplate } from '../../../domain/templates/factories/createDesignFromTemplate';
import { DesignRepository } from '../../../database/repositories/DesignRepository';
import { TemplateRepository } from '../../../database/repositories/TemplateRepository';

export type CreateDesignFromTemplateFormInput = {
  templateId: string;
  name: string;
  width: number;
  height: number;
  quantity: number;
  customerId?: string | null | undefined;
  jobName?: string | null | undefined;
  jobId?: string | null | undefined;
};

export function createTemplateService(
  templateRepository: TemplateRepository,
  designRepository: DesignRepository,
) {
  return {
    async createDesign(input: CreateDesignFromTemplateFormInput) {
      const template = await templateRepository.getById(input.templateId);
      if (!template) {
        throw new Error('Template not found.');
      }

      const project = createDesignFromTemplate({
        template,
        name: input.name,
        width: input.width,
        height: input.height,
        quantity: input.quantity,
        customerId: input.customerId ?? null,
        jobName: input.jobName ?? null,
        jobId: input.jobId ?? null,
      });

      return designRepository.create(project);
    },
  };
}
