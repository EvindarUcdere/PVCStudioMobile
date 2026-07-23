import { JobProject } from '../../domain/jobs/entities/JobProject';

export type SaveJobProjectInput = {
  id?: string;
  name: string;
  customerId?: string | null;
  status?: JobProject['status'];
  notes?: string | null;
  deletedAt?: string | null;
  syncStatus?: JobProject['syncStatus'];
  version?: number;
};

export type ListJobProjectsOptions = {
  includeDeleted?: boolean;
  customerId?: string;
  limit?: number;
  offset?: number;
  search?: string;
  status?: JobProject['status'];
};

export interface JobRepository {
  save(input: SaveJobProjectInput): Promise<JobProject>;
  getById(id: string): Promise<JobProject | null>;
  list(options?: ListJobProjectsOptions): Promise<JobProject[]>;
  updateStatus(id: string, status: JobProject['status']): Promise<JobProject>;
}
