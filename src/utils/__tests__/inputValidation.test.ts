import { describe, expect, it } from 'vitest';

import {
  isValidDateInput,
  parseBoundedNumber,
  sanitizeDateInput,
  sanitizeDecimalInput,
  sanitizeIntegerInput,
} from '../inputValidation';

describe('inputValidation', () => {
  it('keeps numeric inputs numeric', () => {
    expect(sanitizeIntegerInput('12a-3')).toBe('123');
    expect(sanitizeDecimalInput('1a2,5 TL')).toBe('12.5');
  });

  it('formats and validates strict date input', () => {
    expect(sanitizeDateInput('20260729')).toBe('2026-07-29');
    expect(isValidDateInput('2026-07-29')).toBe(true);
    expect(isValidDateInput('2026-02-31')).toBe(false);
  });

  it('rejects values outside bounds', () => {
    expect(parseBoundedNumber('5', { min: 1, max: 10, integer: true })).toBe(5);
    expect(parseBoundedNumber('-1', { min: 1, max: 10 })).toBeNull();
    expect(parseBoundedNumber('11', { min: 1, max: 10 })).toBeNull();
  });
});
