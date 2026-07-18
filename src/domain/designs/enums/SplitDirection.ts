export const splitDirections = ['horizontal', 'vertical'] as const;

export type SplitDirection = (typeof splitDirections)[number];
