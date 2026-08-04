import { z } from 'zod';

import { RepositoryError } from '../../domain/designs/errors';
import { createIsoTimestamp } from '../../domain/designs/utils/date';
import {
  ProductionProfileSystem,
  ProfileSystemTechnicalValues,
  WeldingAllowanceMode,
} from '../../domain/production-calculation/types';
import {
  ProductionProfileSystemRepository,
  SaveProductionProfileSystemInput,
} from './ProductionProfileSystemRepository';
import { SqliteDatabaseLike } from './SqliteDesignRepository';

type ProductionProfileSystemRow = {
  id: string;
  company_id: string;
  display_name: string;
  brand: string;
  series_name: string;
  version: string;
  status: ProductionProfileSystem['status'];
  frame_profile_code: string;
  welding_allowance_mode: WeldingAllowanceMode;
  technical_values_json: string;
  created_at: string;
  updated_at: string;
};

const technicalValueSchema = z.object({
  value: z.number(),
  unit: z.enum(['MM', 'DEGREE']),
  status: z.enum(['DRAFT', 'VERIFIED']),
  source: z.string().optional(),
  note: z.string().optional(),
  verifiedAt: z.string().optional(),
});

const technicalValuesSchema: z.ZodType<ProfileSystemTechnicalValues> = z.object({
  stockLengthMm: technicalValueSchema,
  horizontalFrameAdjustmentMm: technicalValueSchema,
  verticalFrameAdjustmentMm: technicalValueSchema,
  horizontalCutAngleDeg: technicalValueSchema,
  verticalCutAngleDeg: technicalValueSchema,
  sawKerfMm: technicalValueSchema,
  startTrimMm: technicalValueSchema,
  endTrimMm: technicalValueSchema,
  weldingAllowanceMmPerEnd: technicalValueSchema,
  fixedGlassDeductionLeftMm: technicalValueSchema.optional(),
  fixedGlassDeductionRightMm: technicalValueSchema.optional(),
  fixedGlassDeductionTopMm: technicalValueSchema.optional(),
  fixedGlassDeductionBottomMm: technicalValueSchema.optional(),
});

export class SqliteProductionProfileSystemRepository implements ProductionProfileSystemRepository {
  constructor(private readonly database: SqliteDatabaseLike) {}

  async save(input: SaveProductionProfileSystemInput): Promise<ProductionProfileSystem> {
    const now = createIsoTimestamp();
    const createdAt = input.createdAt ?? (await this.getById(input.id))?.createdAt ?? now;
    const technicalValues = technicalValuesSchema.parse(input.technicalValues);

    if (
      !input.id.trim() ||
      !input.companyId.trim() ||
      !input.displayName.trim() ||
      !input.brand.trim() ||
      !input.seriesName.trim()
    ) {
      throw new RepositoryError('Production profile system identity fields are required.');
    }

    await this.database.runAsync(
      `
        INSERT OR REPLACE INTO production_profile_systems
        (id, company_id, display_name, brand, series_name, version, status, frame_profile_code,
         welding_allowance_mode, technical_values_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `,
      [
        input.id,
        input.companyId,
        input.displayName.trim(),
        input.brand.trim(),
        input.seriesName.trim(),
        input.version.trim(),
        input.status,
        input.frameProfileCode.trim(),
        input.weldingAllowanceMode,
        JSON.stringify(technicalValues),
        createdAt,
        input.updatedAt ?? now,
      ],
    );

    const saved = await this.getById(input.id);
    if (!saved) {
      throw new RepositoryError('Saved production profile system could not be read.');
    }

    return saved;
  }

  async getById(id: string): Promise<ProductionProfileSystem | null> {
    const row = await this.database.getFirstAsync<ProductionProfileSystemRow>(
      'SELECT * FROM production_profile_systems WHERE id = ? LIMIT 1;',
      [id],
    );

    return row ? toDomain(row) : null;
  }

  async list(companyId: string): Promise<ProductionProfileSystem[]> {
    const rows = await this.database.getAllAsync<ProductionProfileSystemRow>(
      `
        SELECT * FROM production_profile_systems
        WHERE company_id = ?
        ORDER BY updated_at DESC;
      `,
      [companyId],
    );

    return rows.map(toDomain);
  }
}

function toDomain(row: ProductionProfileSystemRow): ProductionProfileSystem {
  return {
    id: row.id,
    companyId: row.company_id,
    displayName: row.display_name,
    brand: row.brand,
    seriesName: row.series_name,
    version: row.version,
    status: row.status,
    frameProfileCode: row.frame_profile_code,
    weldingAllowanceMode: row.welding_allowance_mode,
    technicalValues: technicalValuesSchema.parse(JSON.parse(row.technical_values_json)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
