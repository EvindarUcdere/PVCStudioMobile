export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected';

export type Quote = {
  id: string;
  designId: string;
  designName: string;
  customerName: string | null;
  customerPhone: string | null;
  note: string | null;
  status: QuoteStatus;
  width: number;
  height: number;
  quantity: number;
  profileSystemName: string;
  colorName: string;
  glassTypeName: string;
  unitTotal: number;
  total: number;
  message: string;
  createdAt: string;
  updatedAt: string;
};
