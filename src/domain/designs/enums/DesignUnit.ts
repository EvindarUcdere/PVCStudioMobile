export const designUnits = ['mm'] as const;

export type DesignUnit = (typeof designUnits)[number];
