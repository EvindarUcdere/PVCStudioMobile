import { createDesignDomainSql } from '../schema/designSchema';
import { DatabaseMigration } from './types';

export const designDomainMigration: DatabaseMigration = {
  id: '002_design_domain',
  async up(database) {
    await database.execAsync(createDesignDomainSql);
  },
};
