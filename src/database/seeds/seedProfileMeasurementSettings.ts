import { MigrationDatabase } from '../migrations/types';

const updatedAt = '2026-01-01T00:00:00.000Z';

const profileMeasurementSettings = [
  {
    seriesId: 'standard-70',
    frameWidth: 70,
    sashWidth: 62,
    mullionWidth: 76,
    glassRebate: 18,
    cuttingAllowance: 3,
    weldingAllowance: 2,
  },
  {
    seriesId: 'premium-80',
    frameWidth: 80,
    sashWidth: 70,
    mullionWidth: 86,
    glassRebate: 20,
    cuttingAllowance: 3,
    weldingAllowance: 2,
  },
];

export async function seedProfileMeasurementSettings(database: MigrationDatabase): Promise<void> {
  for (const settings of profileMeasurementSettings) {
    await database.runAsync(
      `
        INSERT INTO profile_measurement_settings
        (series_id, frame_width, sash_width, mullion_width, glass_rebate,
         cutting_allowance, welding_allowance, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(series_id) DO UPDATE SET
          frame_width = excluded.frame_width,
          sash_width = excluded.sash_width,
          mullion_width = excluded.mullion_width,
          glass_rebate = excluded.glass_rebate,
          cutting_allowance = excluded.cutting_allowance,
          welding_allowance = excluded.welding_allowance,
          updated_at = excluded.updated_at;
      `,
      [
        settings.seriesId,
        settings.frameWidth,
        settings.sashWidth,
        settings.mullionWidth,
        settings.glassRebate,
        settings.cuttingAllowance,
        settings.weldingAllowance,
        updatedAt,
      ],
    );
  }
}
