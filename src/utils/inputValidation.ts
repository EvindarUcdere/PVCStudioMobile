export const maxDesignMeasurementMm = 10000;
export const minDesignMeasurementMm = 200;
export const maxDesignQuantity = 999;
export const maxMoneyAmount = 100_000_000;
export const maxStockQuantity = 1_000_000;

export function sanitizeDecimalInput(value: string): string {
  const normalized = value.replace(',', '.');
  const cleaned = normalized.replace(/[^0-9.]/g, '');
  const [integerPart = '', ...decimalParts] = cleaned.split('.');
  const decimalPart = decimalParts.join('');
  return decimalParts.length > 0 ? `${integerPart}.${decimalPart}` : integerPart;
}

export function sanitizeIntegerInput(value: string): string {
  return value.replace(/\D/g, '');
}

export function sanitizeDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);

  return [year, month, day].filter(Boolean).join('-');
}

export function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [yearValue, monthValue, dayValue] = value.split('-').map(Number);
  if (!yearValue || !monthValue || !dayValue) {
    return false;
  }

  const date = new Date(yearValue, monthValue - 1, dayValue);
  return (
    date.getFullYear() === yearValue &&
    date.getMonth() === monthValue - 1 &&
    date.getDate() === dayValue
  );
}

export function parseBoundedNumber(
  value: string,
  options: { min: number; max: number; integer?: boolean },
): number | null {
  const parsed = Number(value.replace(',', '.').trim());
  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (options.integer && !Number.isInteger(parsed)) {
    return null;
  }

  return parsed >= options.min && parsed <= options.max ? parsed : null;
}
