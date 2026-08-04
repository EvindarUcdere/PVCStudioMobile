import { describe, expect, it } from 'vitest';

import { ProductionProfileSystem } from '../../../../domain/production-calculation/types';
import {
  canVerifyProfileSystem,
  emptyProductionProfileFormValues,
  fromSignedAdjustment,
  parseDecimal,
  shouldDowngradeVerifiedEdit,
  shouldShowWeldingAllowance,
  toProductionProfileFormValues,
  toProductionProfileSystem,
  toSignedAdjustment,
} from '../productionProfileForm';

describe('productionProfileForm', () => {
  it('shows welding allowance only when mode is add to cut length', () => {
    expect(shouldShowWeldingAllowance('ADD_TO_CUT_LENGTH')).toBe(true);
    expect(shouldShowWeldingAllowance('INCLUDED_BY_MACHINE')).toBe(false);
    expect(shouldShowWeldingAllowance('NOT_APPLICABLE')).toBe(false);
  });

  it('does not use welding allowance when mode is not applicable', () => {
    const profileSystem = toProductionProfileSystem(
      {
        ...completeValues(),
        weldingAllowanceMode: 'NOT_APPLICABLE',
        weldingAllowanceMmPerEnd: '99',
      },
      'company-1',
      'system-1',
      null,
      '2026-08-03T00:00:00.000Z',
    );

    expect(profileSystem?.technicalValues.weldingAllowanceMmPerEnd.value).toBe(0);
  });

  it('blocks verification when required fields are missing', () => {
    const verification = canVerifyProfileSystem({
      ...emptyProductionProfileFormValues,
      markVerified: true,
    });

    expect(verification.canVerify).toBe(false);
    expect(verification.missingLabels).toContain('Profil sistemi adı eksik');
  });

  it('allows verification when all required fields are complete', () => {
    expect(canVerifyProfileSystem(completeValues()).canVerify).toBe(true);
  });

  it('downgrades a verified profile edit to draft when verification is not re-confirmed', () => {
    expect(shouldDowngradeVerifiedEdit(verifiedSystem(), { ...completeValues(), markVerified: false })).toBe(true);
  });

  it('stores add, subtract and none adjustments as signed values without accepting negatives directly', () => {
    expect(toSignedAdjustment({ operation: 'ADD', valueMm: '12' })).toBe(12);
    expect(toSignedAdjustment({ operation: 'SUBTRACT', valueMm: '12' })).toBe(-12);
    expect(toSignedAdjustment({ operation: 'NONE', valueMm: '' })).toBe(0);
    expect(toSignedAdjustment({ operation: 'ADD', valueMm: '-12' })).toBe(null);
  });

  it('parses decimal comma values', () => {
    expect(parseDecimal('12,5')).toBe(12.5);
    expect(parseDecimal('12.5')).toBe(12.5);
  });

  it('converts existing signed adjustment values after migration without losing records', () => {
    expect(fromSignedAdjustment(10)).toEqual({ operation: 'ADD', valueMm: '10' });
    expect(fromSignedAdjustment(-10)).toEqual({ operation: 'SUBTRACT', valueMm: '10' });
    expect(fromSignedAdjustment(0)).toEqual({ operation: 'NONE', valueMm: '' });

    const formValues = toProductionProfileFormValues(verifiedSystem());
    expect(formValues.displayName).toBe('Test Profil Sistemi');
    expect(formValues.horizontalFrameAdjustment).toEqual({ operation: 'ADD', valueMm: '6' });
  });
});

function completeValues() {
  return {
    ...emptyProductionProfileFormValues,
    displayName: 'Test Profil Sistemi',
    brand: 'TEST-BRAND',
    seriesName: 'TEST-SERIES',
    version: '1.0.0',
    frameProfileCode: 'FRAME-001',
    stockLengthMm: '3000',
    horizontalFrameAdjustment: { operation: 'ADD' as const, valueMm: '6' },
    verticalFrameAdjustment: { operation: 'SUBTRACT' as const, valueMm: '4' },
    horizontalCutAngleDeg: '45',
    verticalCutAngleDeg: '45',
    sawKerfMm: '3',
    startTrimMm: '0',
    endTrimMm: '0',
    weldingAllowanceMode: 'ADD_TO_CUT_LENGTH' as const,
    weldingAllowanceMmPerEnd: '2',
    fixedGlassDeductionLeftMm: '82',
    fixedGlassDeductionRightMm: '82',
    fixedGlassDeductionTopMm: '82',
    fixedGlassDeductionBottomMm: '82',
    source: 'TEST-FICHE',
    markVerified: true,
  };
}

function verifiedSystem(): ProductionProfileSystem {
  return {
    id: 'system-1',
    companyId: 'company-1',
    displayName: 'Test Profil Sistemi',
    brand: 'TEST-BRAND',
    seriesName: 'TEST-SERIES',
    version: '1.0.0',
    status: 'VERIFIED',
    frameProfileCode: 'FRAME-001',
    weldingAllowanceMode: 'ADD_TO_CUT_LENGTH',
    technicalValues: {
      stockLengthMm: tv(3000, 'MM'),
      horizontalFrameAdjustmentMm: tv(6, 'MM'),
      verticalFrameAdjustmentMm: tv(-4, 'MM'),
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
    },
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
  };
}

function tv(value: number, unit: 'MM' | 'DEGREE') {
  return {
    value,
    unit,
    status: 'VERIFIED' as const,
    source: 'TEST-FICHE',
    verifiedAt: '2026-08-03T00:00:00.000Z',
  };
}
