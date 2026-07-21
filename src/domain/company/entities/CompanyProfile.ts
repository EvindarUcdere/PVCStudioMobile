export type CompanyProfile = {
  companyName: string;
  ownerName: string;
  phone: string;
  address: string;
  taxInfo: string;
  pdfNote: string;
  quoteValidityDays: number;
};

export const defaultCompanyProfile: CompanyProfile = {
  companyName: '',
  ownerName: '',
  phone: '',
  address: '',
  taxInfo: '',
  pdfNote: 'Bu teklif on tahmindir. Kesin fiyat, yerinde olcu ve nihai malzeme seciminden sonra netlesir.',
  quoteValidityDays: 7,
};
