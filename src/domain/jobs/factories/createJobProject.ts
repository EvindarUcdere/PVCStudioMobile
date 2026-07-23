import { JobProject } from '../entities/JobProject';
import { createIsoTimestamp } from '../../designs/utils/date';
import { createId } from '../../designs/utils/id';

export function createJobProject({
  name,
  customerId = null,
  notes = null,
}: {
  name: string;
  customerId?: string | null;
  notes?: string | null;
}): JobProject {
  const now = createIsoTimestamp();

  return {
    id: createId(),
    name: name.trim(),
    customerId,
    status: 'draft',
    notes,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local',
    version: 1,
  };
}
