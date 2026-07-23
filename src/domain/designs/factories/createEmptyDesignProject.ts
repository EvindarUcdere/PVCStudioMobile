import { DesignProject } from '../entities/DesignProject';
import { createIsoTimestamp } from '../utils/date';
import { createId } from '../utils/id';
import { createPanelNode } from './createPanelNode';

type CreateEmptyDesignProjectInput = {
  name: string;
  customerId?: string | null;
  jobName?: string | null;
  jobId?: string | null;
  width?: number;
  height?: number;
  quantity?: number;
};

export function createEmptyDesignProject({
  name,
  customerId = null,
  jobName = null,
  jobId = null,
  width = 1000,
  height = 1000,
  quantity = 1,
}: CreateEmptyDesignProjectInput): DesignProject {
  const now = createIsoTimestamp();

  return {
    id: createId(),
    name,
    customerId,
    templateId: null,
    width,
    height,
    quantity,
    jobStatus: 'draft',
    jobName,
    jobId,
    unit: 'mm',
    rootNode: {
      id: createId(),
      type: 'frame',
      child: createPanelNode(),
    },
    profileSystem: null,
    defaultGlass: null,
    accessories: [],
    notes: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    // Local is used until a future sync backend exists.
    syncStatus: 'local',
    version: 1,
  };
}
