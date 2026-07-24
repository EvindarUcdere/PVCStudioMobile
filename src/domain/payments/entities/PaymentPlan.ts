export type PaymentInstallmentStatus = 'pending' | 'paid';

export type PaymentPlan = {
  id: string;
  quoteId: string;
  designId: string;
  customerName: string | null;
  totalAmount: number;
  paidNowAmount: number;
  remainingAmount: number;
  installmentCount: number;
  firstDueDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentInstallment = {
  id: string;
  planId: string;
  quoteId: string;
  designId: string;
  sequence: number;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  status: PaymentInstallmentStatus;
  customerName: string | null;
};
