export const routes = {
  home: '/',
  designs: '/designs',
  newDesign: '/new-design',
  customers: '/customers',
  more: '/more',
  quotes: '/quotes',
  finance: '/finance',
  pricingSettings: '/pricing-settings',
  companyProfile: '/company-profile',
  templateDetails: (templateId: string) => `/templates/${templateId}`,
  templateDetailsForCustomer: (templateId: string, customerId: string) =>
    `/templates/${templateId}?customerId=${customerId}`,
  createDesignFromTemplate: (templateId: string, customerId?: string | null) =>
    customerId ? `/templates/${templateId}/create?customerId=${customerId}` : `/templates/${templateId}/create`,
  designDetails: (designId: string) => `/designs/${designId}`,
  designEditor: (designId: string) => `/designs/${designId}/edit`,
  designQuote: (designId: string) => `/designs/${designId}/quote`,
  customerDetails: (customerId: string) => `/customers/${customerId}`,
  newDesignForCustomer: (customerId: string) => `/new-design?customerId=${customerId}`,
} as const;
