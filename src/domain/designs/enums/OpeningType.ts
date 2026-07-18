export const openingTypes = [
  'fixed',
  'open-left',
  'open-right',
  'tilt',
  'tilt-top',
  'tilt-bottom',
  'tilt-turn-left',
  'tilt-turn-right',
  'double-sash',
  'sliding-left',
  'sliding-right',
  'door-left',
  'door-right',
] as const;

export type OpeningType = (typeof openingTypes)[number];
