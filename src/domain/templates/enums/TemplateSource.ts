export const templateSources = ['system', 'user'] as const;

export type TemplateSource = (typeof templateSources)[number];
