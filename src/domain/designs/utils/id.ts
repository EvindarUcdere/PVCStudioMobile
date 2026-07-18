function createFallbackUuid(): string {
  const randomValues = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  const versionValue = randomValues[6];
  const variantValue = randomValues[8];

  if (versionValue === undefined || variantValue === undefined) {
    throw new Error('UUID random value generation failed.');
  }

  randomValues[6] = (versionValue & 0x0f) | 0x40;
  randomValues[8] = (variantValue & 0x3f) | 0x80;

  const hex = randomValues.map((value) => value.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
    .slice(6, 8)
    .join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

export function createId(): string {
  const randomUuid = globalThis.crypto?.randomUUID;

  if (randomUuid) {
    return randomUuid.call(globalThis.crypto);
  }

  return createFallbackUuid();
}
