import { describe, expect, it } from 'vitest';

import { calculateDesignPriceEstimate } from '../../designs/pricing/calculateDesignPriceEstimate';
import { createEmptyDesignProject } from '../../designs/factories/createEmptyDesignProject';
import { calculateFixedGlassProduction, calculateFixedOuterFrameProduction } from '../productionFrameCalculator';
import {
  ProductionCalculationInput,
  ProductionProfileSystem,
  ProfileSystemTechnicalValues,
  TechnicalValue,
} from '../types';

const input: ProductionCalculationInput = {
  calculationMode: 'PRODUCTION',
  designId: 'design-1',
  widthMm: 1200,
  heightMm: 1500,
  profileSystemId: 'system-1',
  profileSystemVersion: '1.0.0',
};

describe('calculateFixedOuterFrameProduction', () => {
  it('returns a successful production calculation for a verified fixed outer frame system', () => {
    const result = calculateFixedOuterFrameProduction(input, createVerifiedSystem());

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success result.');
    }

    expect(result.frameCuts).toHaveLength(2);
    expect(result.frameCuts[0]).toMatchObject({
      orientation: 'HORIZONTAL',
      quantity: 2,
      cutLengthMm: 1210,
      angleStartDeg: 45,
      angleEndDeg: 45,
    });
    expect(result.frameCuts[1]).toMatchObject({
      orientation: 'VERTICAL',
      quantity: 2,
      cutLengthMm: 1512,
    });
  });

  it('blocks draft technical values in production mode', () => {
    const system = createVerifiedSystem({
      technicalValues: {
        ...createTechnicalValues(),
        sawKerfMm: tv(3, 'MM', 'DRAFT'),
      },
    });
    const result = calculateFixedOuterFrameProduction(input, system);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure result.');
    }

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'TECHNICAL_VALUE_NOT_VERIFIED',
        field: 'sawKerfMm',
      }),
    );
  });

  it('returns a controlled error for missing technical values', () => {
    const system = createVerifiedSystem({
      technicalValues: {
        ...createTechnicalValues(),
        stockLengthMm: undefined as unknown as TechnicalValue,
      },
    });
    const result = calculateFixedOuterFrameProduction(input, system);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure result.');
    }

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'TECHNICAL_VALUE_MISSING',
        field: 'stockLengthMm',
      }),
    );
  });

  it('returns a controlled error when profile system cannot be found', () => {
    const result = calculateFixedOuterFrameProduction(input, null);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure result.');
    }

    expect(result.issues[0]?.code).toBe('PROFILE_SYSTEM_NOT_FOUND');
  });

  it('returns a controlled error for version mismatch', () => {
    const result = calculateFixedOuterFrameProduction(input, createVerifiedSystem({ version: '2.0.0' }));

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure result.');
    }

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'PROFILE_SYSTEM_VERSION_MISMATCH',
      }),
    );
  });

  it('blocks zero or negative dimensions', () => {
    const result = calculateFixedOuterFrameProduction(
      {
        ...input,
        widthMm: 0,
        heightMm: -20,
      },
      createVerifiedSystem(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure result.');
    }

    expect(result.issues.map((issue) => issue.code)).toEqual(['INVALID_WIDTH', 'INVALID_HEIGHT']);
  });

  it('includes calculation trace and profile system snapshot', () => {
    const result = calculateFixedOuterFrameProduction(input, createVerifiedSystem());

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success result.');
    }

    expect(result.frameCuts[0]?.calculationTrace.length).toBeGreaterThan(0);
    expect(result.frameCuts[0]?.calculationTrace.at(-1)).toMatchObject({
      operation: 'RESULT',
      value: 1210,
    });
    expect(result.profileSystemSnapshot).toMatchObject({
      id: 'system-1',
      brand: 'TEST-BRAND',
      seriesName: 'TEST-SERIES',
      version: '1.0.0',
    });
  });

  it('does not add welding allowance when welding mode is not applicable', () => {
    const result = calculateFixedOuterFrameProduction(
      input,
      createVerifiedSystem({
        weldingAllowanceMode: 'NOT_APPLICABLE',
        technicalValues: {
          ...createTechnicalValues(),
          weldingAllowanceMmPerEnd: tv(99, 'MM'),
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success result.');
    }

    expect(result.frameCuts[0]?.cutLengthMm).toBe(1206);
    expect(result.frameCuts[1]?.cutLengthMm).toBe(1508);
  });

  it('calculates fixed glass size from verified glazing rules', () => {
    const result = calculateFixedGlassProduction(input, createVerifiedSystem());

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected success result.');
    }

    expect(result.fixedGlass).toMatchObject({
      component: 'FIXED_GLASS',
      widthMm: 1036,
      heightMm: 1336,
      areaSquareMeters: 1.384,
      quantity: 1,
    });
    expect(result.fixedGlass?.calculationTrace.at(-1)).toMatchObject({
      label: 'Cam siparis boyu',
      operation: 'RESULT',
      value: 1336,
    });
  });

  it('returns a controlled error when fixed glass rules are missing', () => {
    const result = calculateFixedGlassProduction(input, {
      ...createVerifiedSystem(),
      technicalValues: {
        ...createTechnicalValues(),
        fixedGlassDeductionLeftMm: undefined,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected failure result.');
    }

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'TECHNICAL_VALUE_MISSING',
        field: 'fixedGlassDeductionLeftMm',
      }),
    );
  });

  it('does not change the existing estimate calculation path', () => {
    const design = createEmptyDesignProject({ name: 'Estimate still works', width: 1200, height: 1500 });
    const estimate = calculateDesignPriceEstimate(design);

    expect(estimate.total).toBeGreaterThan(0);
    expect(estimate.summary.designWidth).toBe(1200);
  });
});

function createVerifiedSystem(
  overrides: Partial<ProductionProfileSystem> = {},
): ProductionProfileSystem {
  return {
    id: 'system-1',
    companyId: 'TEST-COMPANY',
    displayName: 'Test Profil Sistemi',
    brand: 'TEST-BRAND',
    seriesName: 'TEST-SERIES',
    version: '1.0.0',
    status: 'VERIFIED',
    frameProfileCode: 'FRAME-001',
    weldingAllowanceMode: 'ADD_TO_CUT_LENGTH',
    technicalValues: createTechnicalValues(),
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
    ...overrides,
  };
}

function createTechnicalValues(): ProfileSystemTechnicalValues {
  return {
    stockLengthMm: tv(3000, 'MM'),
    horizontalFrameAdjustmentMm: tv(6, 'MM'),
    verticalFrameAdjustmentMm: tv(8, 'MM'),
    horizontalCutAngleDeg: tv(45, 'DEGREE'),
    verticalCutAngleDeg: tv(45, 'DEGREE'),
    sawKerfMm: tv(3, 'MM'),
    startTrimMm: tv(0, 'MM'),
    endTrimMm: tv(0, 'MM'),
    weldingAllowanceMmPerEnd: tv(2, 'MM'),
    fixedGlassDeductionLeftMm: tv(82, 'MM'),
    fixedGlassDeductionRightMm: tv(82, 'MM'),
    fixedGlassDeductionTopMm: tv(82, 'MM'),
    fixedGlassDeductionBottomMm: tv(82, 'MM'),
  };
}

function tv(
  value: number,
  unit: TechnicalValue['unit'],
  status: TechnicalValue['status'] = 'VERIFIED',
): TechnicalValue {
  return {
    value,
    unit,
    status,
    source: 'TEST-FIXTURE',
    ...(status === 'VERIFIED' ? { verifiedAt: '2026-08-03T00:00:00.000Z' } : {}),
  };
}
