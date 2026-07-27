import { describe, expect, it } from 'vitest';

import { normalizeTurkishPhone, normalizeTurkishWhatsAppPhone, sanitizePhoneInput } from '../phone';

describe('phone utilities', () => {
  it('keeps only phone characters while typing', () => {
    expect(sanitizePhoneInput('abc 0532-123 45 67')).toBe('05321234567');
    expect(sanitizePhoneInput('+90 (532) 123 45 67')).toBe('+905321234567');
  });

  it('normalizes Turkish mobile numbers to local format', () => {
    expect(normalizeTurkishPhone('5321234567')).toBe('05321234567');
    expect(normalizeTurkishPhone('905321234567')).toBe('05321234567');
    expect(normalizeTurkishPhone('+905321234567')).toBe('05321234567');
    expect(normalizeTurkishPhone('05321234567')).toBe('05321234567');
  });

  it('rejects invalid phone values', () => {
    expect(normalizeTurkishPhone('123')).toBeNull();
    expect(normalizeTurkishPhone('02121234567')).toBeNull();
    expect(normalizeTurkishPhone('053212345678')).toBeNull();
  });

  it('normalizes WhatsApp links to international digits', () => {
    expect(normalizeTurkishWhatsAppPhone('05321234567')).toBe('905321234567');
  });
});
