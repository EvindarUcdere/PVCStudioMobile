import { describe, expect, it } from 'vitest';

import { ProductionProfileSystem } from '../../../domain/production-calculation/types';
import { SqliteDatabaseLike } from '../SqliteDesignRepository';
import { SqliteProductionProfileSystemRepository } from '../SqliteProductionProfileSystemRepository';

type ProductionProfileSystemRow = {
  id: string;
  company_id: string;
  display_name: string;
  brand: string;
  series_name: string;
  version: string;
  status: ProductionProfileSystem['status'];
  frame_profile_code: string;
  welding_allowance_mode: ProductionProfileSystem['weldingAllowanceMode'];
  technical_values_json: string;
  created_at: string;
  updated_at: string;
};

class InMemoryProductionProfileSystemDatabase implements SqliteDatabaseLike {
  readonly rows = new Map<string, ProductionProfileSystemRow>();

  async execAsync(_sql: string): Promise<void> {}

  async runAsync(sql: string, params: unknown[] = []): Promise<unknown> {
    if (sql.toLowerCase().includes('insert or replace into production_profile_systems')) {
      const row: ProductionProfileSystemRow = {
        id: String(params[0]),
        company_id: String(params[1]),
        display_name: String(params[2]),
        brand: String(params[3]),
        series_name: String(params[4]),
        version: String(params[5]),
        status: params[6] as ProductionProfileSystem['status'],
        frame_profile_code: String(params[7]),
        welding_allowance_mode: params[8] as ProductionProfileSystem['weldingAllowanceMode'],
        technical_values_json: String(params[9]),
        created_at: String(params[10]),
        updated_at: String(params[11]),
      };

      this.rows.set(row.id, row);
    }

    return {};
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    if (sql.toLowerCase().includes('from production_profile_systems')) {
      return (this.rows.get(String(params[0])) as T | undefined) ?? null;
    }

    return null;
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (!sql.toLowerCase().includes('from production_profile_systems')) {
      return [];
    }

    const companyId = String(params[0]);
    return Array.from(this.rows.values())
      .filter((row) => row.company_id === companyId)
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at)) as T[];
  }
}

describe('SqliteProductionProfileSystemRepository', () => {
  it('creates and lists production profile systems by company', async () => {
    const database = new InMemoryProductionProfileSystemDatabase();
    const repository = new SqliteProductionProfileSystemRepository(database);

    await repository.save(createProfileSystem({ id: 'system-1', companyId: 'company-a' }));
    await repository.save(createProfileSystem({ id: 'system-2', companyId: 'company-b' }));

    const companyProfiles = await repository.list('company-a');

    expect(companyProfiles).toHaveLength(1);
    expect(companyProfiles[0]?.id).toBe('system-1');
    expect(companyProfiles[0]?.displayName).toBe('Test Profil Sistemi');
  });

  it('updates an existing profile system while preserving createdAt', async () => {
    const database = new InMemoryProductionProfileSystemDatabase();
    const repository = new SqliteProductionProfileSystemRepository(database);

    const first = await repository.save(
      createProfileSystem({
        id: 'system-1',
        displayName: 'Eski Ad',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      }),
    );
    const second = await repository.save({
      ...first,
      displayName: 'Yeni Ad',
      updatedAt: '2026-08-03T00:00:00.000Z',
    });

    expect(second.displayName).toBe('Yeni Ad');
    expect(second.createdAt).toBe('2026-08-01T00:00:00.000Z');
    expect(database.rows.size).toBe(1);
  });

  it('archives a profile system without deleting its row', async () => {
    const database = new InMemoryProductionProfileSystemDatabase();
    const repository = new SqliteProductionProfileSystemRepository(database);

    const saved = await repository.save(createProfileSystem({ id: 'system-1', status: 'VERIFIED' }));
    const archived = await repository.save({ ...saved, status: 'ARCHIVED' });

    expect(archived.status).toBe('ARCHIVED');
    expect(await repository.getById('system-1')).not.toBeNull();
    expect(database.rows.size).toBe(1);
  });
});

function createProfileSystem(overrides: Partial<ProductionProfileSystem> = {}): ProductionProfileSystem {
  return {
    id: overrides.id ?? 'system-1',
    companyId: overrides.companyId ?? 'company-a',
    displayName: overrides.displayName ?? 'Test Profil Sistemi',
    brand: overrides.brand ?? 'TEST-BRAND',
    seriesName: overrides.seriesName ?? 'TEST-SERIES',
    version: overrides.version ?? '1.0.0',
    status: overrides.status ?? 'DRAFT',
    frameProfileCode: overrides.frameProfileCode ?? 'FRAME-001',
    weldingAllowanceMode: overrides.weldingAllowanceMode ?? 'INCLUDED_BY_MACHINE',
    technicalValues: overrides.technicalValues ?? {
      stockLengthMm: tv(3000, 'MM'),
      horizontalFrameAdjustmentMm: tv(0, 'MM'),
      verticalFrameAdjustmentMm: tv(0, 'MM'),
      horizontalCutAngleDeg: tv(45, 'DEGREE'),
      verticalCutAngleDeg: tv(45, 'DEGREE'),
      sawKerfMm: tv(3, 'MM'),
      startTrimMm: tv(0, 'MM'),
      endTrimMm: tv(0, 'MM'),
      weldingAllowanceMmPerEnd: tv(0, 'MM'),
    },
    createdAt: overrides.createdAt ?? '2026-08-03T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-08-03T00:00:00.000Z',
  };
}

function tv(value: number, unit: 'MM' | 'DEGREE') {
  return {
    value,
    unit,
    status: 'DRAFT' as const,
  };
}
