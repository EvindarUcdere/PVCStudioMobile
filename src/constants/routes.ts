export const routes = {
  home: '/',
  designs: '/designs',
  newDesign: '/new-design',
  customers: '/customers',
  more: '/more',
  quotes: '/quotes',
  workshop: '/workshop',
  finance: '/finance',
  stock: '/stock',
  jobs: '/jobs',
  pricingSettings: '/pricing-settings',
  companyProfile: '/company-profile',
  templateDetails: (templateId: string) => `/templates/${templateId}`,
  templateDetailsForCustomer: (templateId: string, customerId: string) =>
    `/templates/${templateId}?customerId=${customerId}`,
  templateDetailsForJob: (templateId: string, jobId: string, customerId?: string | null) =>
    `/templates/${templateId}?jobId=${jobId}${customerId ? `&customerId=${customerId}` : ''}`,
  createDesignFromTemplate: (templateId: string, customerId?: string | null, jobId?: string | null) => {
    const params = new URLSearchParams();
    if (customerId) {
      params.set('customerId', customerId);
    }
    if (jobId) {
      params.set('jobId', jobId);
    }
    const query = params.toString();
    return query ? `/templates/${templateId}/create?${query}` : `/templates/${templateId}/create`;
  },
  designDetails: (designId: string) => `/designs/${designId}`,
  designEditor: (designId: string) => `/designs/${designId}/edit`,
  designQuote: (designId: string) => `/designs/${designId}/quote`,
  jobDetails: (jobId: string) => `/jobs/${jobId}`,
  customerDetails: (customerId: string) => `/customers/${customerId}`,
  newDesignForCustomer: (customerId: string) => `/new-design?customerId=${customerId}`,
  newDesignForJob: (jobId: string, customerId?: string | null) =>
    `/new-design?jobId=${jobId}${customerId ? `&customerId=${customerId}` : ''}`,
} as const;
