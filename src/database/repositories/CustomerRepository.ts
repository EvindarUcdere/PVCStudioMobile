import { Customer } from '../../domain/customers/entities/Customer';

export type SaveCustomerInput = {
  id?: string;
  fullName: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  deletedAt?: string | null;
  syncStatus?: Customer['syncStatus'];
  version?: number;
};

export type ListCustomersOptions = {
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
  search?: string;
};

export interface CustomerRepository {
  save(input: SaveCustomerInput): Promise<Customer>;
  getById(id: string): Promise<Customer | null>;
  list(options?: ListCustomersOptions): Promise<Customer[]>;
  softDelete(id: string): Promise<Customer>;
}
