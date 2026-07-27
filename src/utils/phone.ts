export function sanitizePhoneInput(value: string): string {
  const trimmed = value.trim();
  const hasLeadingPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  const maxLength = hasLeadingPlus || digits.startsWith('90') ? 12 : 11;

  return hasLeadingPlus ? `+${digits.slice(0, maxLength)}` : digits.slice(0, maxLength);
}

export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const hasLeadingPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  return hasLeadingPlus ? `+${digits}` : digits;
}

export function normalizeTurkishPhone(value: string): string | null {
  const phone = normalizePhone(value);

  if (!phone) {
    return null;
  }

  if (/^05\d{9}$/.test(phone)) {
    return phone;
  }

  if (/^\+905\d{9}$/.test(phone)) {
    return `0${phone.slice(3)}`;
  }

  if (/^5\d{9}$/.test(phone)) {
    return `0${phone}`;
  }

  if (/^905\d{9}$/.test(phone)) {
    return `0${phone.slice(2)}`;
  }

  return null;
}

export function normalizeTurkishWhatsAppPhone(value: string): string | null {
  const phone = normalizeTurkishPhone(value);
  return phone ? `90${phone.slice(1)}` : null;
}