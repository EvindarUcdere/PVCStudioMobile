import { createEmptyDesignProject } from '../../domain/designs/factories/createEmptyDesignProject';
import { DesignRepository } from '../repositories/DesignRepository';

export async function runDesignRepositoryDemo(repository: DesignRepository): Promise<void> {
  const project = createEmptyDesignProject({
    name: 'Salon Penceresi',
    width: 1700,
    height: 1400,
    quantity: 1,
  });

  const saved = await repository.create(project);
  await repository.getById(saved.id);
  await repository.duplicate(saved.id);
  await repository.list();
  await repository.softDelete(saved.id);
  await repository.restore(saved.id);
}
