import { describe, expect, it } from 'vitest';

import { DomainValidationError } from '../../../domain/designs/errors';
import { createEmptyDesignProject } from '../../../domain/designs/factories/createEmptyDesignProject';
import { designDomainMigration } from '../../migrations/002_design_domain';
import { MigrationDatabase } from '../../migrations/types';
import { DesignProjectRow } from '../../mappers/designMapper';
import { seedReferenceData } from '../../seeds/seedReferenceData';
import { SqliteDatabaseLike, SqliteDesignRepository } from '../SqliteDesignRepository';

type ReferenceTableName =
  'profile_brands' | 'profile_series' | 'profile_colors' | 'glass_types' | 'accessory_types';

class InMemoryDatabase implements SqliteDatabaseLike, MigrationDatabase {
  readonly designProjects = new Map<string, DesignProjectRow>();
  readonly referenceTables: Record<ReferenceTableName, Map<string, unknown[]>> = {
    profile_brands: new Map(),
    profile_series: new Map(),
    profile_colors: new Map(),
    glass_types: new Map(),
    accessory_types: new Map(),
  };

  async execAsync(_sql: string): Promise<void> {}

  async runAsync(sql: string, params: unknown[] = []): Promise<unknown> {
    const normalized = sql.trim().toLowerCase();

    if (normalized.startsWith('insert into design_projects')) {
      const row: DesignProjectRow = {
        id: String(params[0]),
        name: String(params[1]),
        customer_id: params[2] === null ? null : String(params[2]),
        template_id: params[3] === null ? null : String(params[3]),
        width: Number(params[4]),
        height: Number(params[5]),
        quantity: Number(params[6]),
        job_status: String(params[7]),
        job_name: params[8] === null ? null : String(params[8]),
        unit: String(params[9]),
        root_node_json: String(params[10]),
        profile_system_json: params[11] === null ? null : String(params[11]),
        default_glass_json: params[12] === null ? null : String(params[12]),
        accessories_json: String(params[13]),
        notes: params[14] === null ? null : String(params[14]),
        created_at: String(params[15]),
        updated_at: String(params[16]),
        deleted_at: params[17] === null ? null : String(params[17]),
        sync_status: String(params[18]),
        version: Number(params[19]),
      };

      if (this.designProjects.has(row.id)) {
        throw new Error('UNIQUE constraint failed: design_projects.id');
      }

      this.designProjects.set(row.id, row);
      return {};
    }

    if (
      normalized.startsWith('update design_projects set') &&
      normalized.includes('root_node_json')
    ) {
      const id = String(params[17]);
      const existing = this.designProjects.get(id);
      if (!existing || existing.deleted_at !== null) {
        return {};
      }

      this.designProjects.set(id, {
        ...existing,
        name: String(params[0]),
        customer_id: params[1] === null ? null : String(params[1]),
        template_id: params[2] === null ? null : String(params[2]),
        width: Number(params[3]),
        height: Number(params[4]),
        quantity: Number(params[5]),
        job_status: String(params[6]),
        job_name: params[7] === null ? null : String(params[7]),
        unit: String(params[8]),
        root_node_json: String(params[9]),
        profile_system_json: params[10] === null ? null : String(params[10]),
        default_glass_json: params[11] === null ? null : String(params[11]),
        accessories_json: String(params[12]),
        notes: params[13] === null ? null : String(params[13]),
        updated_at: String(params[14]),
        sync_status: String(params[15]),
        version: Number(params[16]),
      });
      return {};
    }

    if (normalized.startsWith('update design_projects') && normalized.includes('deleted_at')) {
      const id = String(params[3]);
      const existing = this.designProjects.get(id);
      if (!existing) {
        return {};
      }

      this.designProjects.set(id, {
        ...existing,
        deleted_at: params[0] === null ? null : String(params[0]),
        updated_at: String(params[1]),
        version: Number(params[2]),
      });
      return {};
    }

    const referenceTable = this.getReferenceTableName(normalized);
    if (referenceTable) {
      const id = String(params[0]);
      if (!this.referenceTables[referenceTable].has(id)) {
        this.referenceTables[referenceTable].set(id, [...params]);
      }
      return {};
    }

    return {};
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const normalized = sql.trim().toLowerCase();

    if (normalized.includes('from design_projects')) {
      const id = String(params[0]);
      const row = this.designProjects.get(id);

      if (!row) {
        return null;
      }

      if (normalized.includes('deleted_at is null') && row.deleted_at !== null) {
        return null;
      }

      if (normalized.startsWith('select id, version')) {
        return { id: row.id, version: row.version } as T;
      }

      return row as T;
    }

    return null;
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const normalized = sql.toLowerCase();
    let rows = Array.from(this.designProjects.values());
    let paramIndex = 0;

    if (normalized.includes('deleted_at is null')) {
      rows = rows.filter((row) => row.deleted_at === null);
    }

    if (normalized.includes('customer_id = ?')) {
      const customerId = String(params[paramIndex]);
      paramIndex += 1;
      rows = rows.filter((row) => row.customer_id === customerId);
    }

    if (normalized.includes('job_status = ?')) {
      const jobStatus = String(params[paramIndex]);
      paramIndex += 1;
      rows = rows.filter((row) => row.job_status === jobStatus);
    }

    if (normalized.includes('name like ?')) {
      const search = String(params[paramIndex]).replaceAll('%', '').toLocaleLowerCase('tr-TR');
      paramIndex += 1;
      rows = rows.filter((row) => row.name.toLocaleLowerCase('tr-TR').includes(search));
    }

    rows.sort((left, right) => right.updated_at.localeCompare(left.updated_at));

    const limit = Number(params[paramIndex] ?? 100);
    const offset = Number(params[paramIndex + 1] ?? 0);
    return rows.slice(offset, offset + limit) as T[];
  }

  private getReferenceTableName(sql: string): ReferenceTableName | null {
    for (const table of Object.keys(this.referenceTables) as ReferenceTableName[]) {
      if (sql.startsWith(`insert or ignore into ${table}`)) {
        return table;
      }
    }

    return null;
  }
}

describe('SqliteDesignRepository', () => {
  it('creates and reads a design project', async () => {
    const repository = new SqliteDesignRepository(new InMemoryDatabase());
    const project = createEmptyDesignProject({
      name: 'Salon Penceresi',
      width: 1700,
      height: 1400,
    });

    const saved = await repository.create(project);
    const found = await repository.getById(saved.id);

    expect(found?.id).toBe(saved.id);
    expect(found?.name).toBe('Salon Penceresi');
  });

  it('lists, searches, updates, soft deletes and restores projects', async () => {
    const database = new InMemoryDatabase();
    const repository = new SqliteDesignRepository(database);
    const first = await repository.create(createEmptyDesignProject({ name: 'Salon Penceresi' }));
    await repository.create(createEmptyDesignProject({ name: 'Mutfak Kapısı' }));

    expect(await repository.list()).toHaveLength(2);
    expect(await repository.list({ search: 'Salon' })).toHaveLength(1);

    const updated = await repository.update({ ...first, name: 'Salon Ana Pencere' });
    expect(updated.name).toBe('Salon Ana Pencere');
    expect(updated.version).toBe(first.version + 1);

    await repository.softDelete(updated.id);
    expect(await repository.getById(updated.id)).toBeNull();
    expect(await repository.list()).toHaveLength(1);
    expect(await repository.list({ includeDeleted: true })).toHaveLength(2);

    await repository.restore(updated.id);
    expect(await repository.getById(updated.id)).not.toBeNull();
  });

  it('duplicates a design without mutating the original', async () => {
    const repository = new SqliteDesignRepository(new InMemoryDatabase());
    const original = await repository.create(createEmptyDesignProject({ name: 'Yatak Odası' }));

    const copy = await repository.duplicate(original.id, 'Yatak Odası Kopya');

    expect(copy.id).not.toBe(original.id);
    expect(copy.name).toBe('Yatak Odası Kopya');
    expect((await repository.getById(original.id))?.name).toBe('Yatak Odası');
  });

  it('rejects invalid data', async () => {
    const repository = new SqliteDesignRepository(new InMemoryDatabase());
    const project = createEmptyDesignProject({ name: 'Bozuk' });

    await expect(repository.create({ ...project, width: -1 })).rejects.toBeInstanceOf(
      DomainValidationError,
    );
  });

  it('runs design migration and seed without duplicates', async () => {
    const database = new InMemoryDatabase();

    await designDomainMigration.up(database);
    await seedReferenceData(database);
    await seedReferenceData(database);

    expect(database.referenceTables.profile_brands.size).toBe(2);
    expect(database.referenceTables.profile_series.size).toBe(2);
    expect(database.referenceTables.profile_colors.size).toBe(9);
    expect(database.referenceTables.glass_types.size).toBe(11);
    expect(database.referenceTables.accessory_types.size).toBe(11);
  });
});
