import { createEmptyDesignProject } from '../../../domain/designs/factories/createEmptyDesignProject';
import { DesignRepository } from '../../../database/repositories/DesignRepository';

type CreateAndSaveDesignInput = {
  name: string;
  width?: number;
  height?: number;
  quantity?: number;
};

export function createDesignService(repository: DesignRepository) {
  return {
    createAndSaveDesign(input: CreateAndSaveDesignInput) {
      return repository.create(createEmptyDesignProject(input));
    },
    duplicateDesign(id: string, name?: string) {
      return repository.duplicate(id, name);
    },
  };
}
