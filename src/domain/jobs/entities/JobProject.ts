import { JobStatus } from '../../designs/enums/JobStatus';

export type JobProject = {
  id: string;
  name: string;
  customerId: string | null;
  status: JobStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: 'local' | 'pending' | 'synced' | 'conflict';
  version: number;
};
