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
  activity: '/activity',
  recycleBin: '/recycle-bin',
  jobs: '/jobs',
  pricingSettings: '/pricing-settings',
  companyProfile: '/company-profile',
  appSettings: '/app-settings',
  about: '/about',
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
  designPdfPreview: (
    designId: string,
    type: 'quote' | 'production',
    customerName = '',
    customerPhone = '',
    note = '',
  ) => {
    const params = new URLSearchParams({ type });
    if (customerName) {
      params.set('customerName', customerName);
    }
    if (customerPhone) {
      params.set('customerPhone', customerPhone);
    }
    if (note) {
      params.set('note', note);
    }
    return `/designs/${designId}/pdf-preview?${params.toString()}`;
  },
  jobDetails: (jobId: string) => `/jobs/${jobId}`,
  customerDetails: (customerId: string) => `/customers/${customerId}`,
  newDesignForCustomer: (customerId: string) => `/new-design?customerId=${customerId}`,
  newDesignForJob: (jobId: string, customerId?: string | null) =>
    `/new-design?jobId=${jobId}${customerId ? `&customerId=${customerId}` : ''}`,
} as const;
