import { DesignProject } from '../../domain/designs/entities/DesignProject';

export type ListDesignsOptions = {
  includeDeleted?: boolean;
  customerId?: string;
  jobStatus?: string | undefined;
  limit?: number;
  offset?: number;
  search?: string;
};

export interface DesignRepository {
  create(project: DesignProject): Promise<DesignProject>;
  getById(id: string): Promise<DesignProject | null>;
  list(options?: ListDesignsOptions): Promise<DesignProject[]>;
  update(project: DesignProject): Promise<DesignProject>;
  softDelete(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  duplicate(id: string, newName?: string): Promise<DesignProject>;
}
