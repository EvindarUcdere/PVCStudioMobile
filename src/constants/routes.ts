export const routes = {
  home: '/',
  designs: '/designs',
  newDesign: '/new-design',
  customers: '/customers',
  more: '/more',
  templateDetails: (templateId: string) => `/templates/${templateId}`,
  createDesignFromTemplate: (templateId: string) => `/templates/${templateId}/create`,
  designDetails: (designId: string) => `/designs/${designId}`,
  designEditor: (designId: string) => `/designs/${designId}/edit`,
} as const;
