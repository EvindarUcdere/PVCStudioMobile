import { ProductionProfileSystem } from '../../domain/production-calculation/types';

export type SaveProductionProfileSystemInput = Omit<ProductionProfileSystem, 'createdAt' | 'updatedAt'> & {
  createdAt?: string;
  updatedAt?: string;
};

export interface ProductionProfileSystemRepository {
  save(input: SaveProductionProfileSystemInput): Promise<ProductionProfileSystem>;
  getById(id: string): Promise<ProductionProfileSystem | null>;
  list(companyId: string): Promise<ProductionProfileSystem[]>;
}
