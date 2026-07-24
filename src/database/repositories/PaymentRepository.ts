import { PaymentInstallment, PaymentPlan } from '../../domain/payments/entities/PaymentPlan';

export type SavePaymentPlanInput = {
  quoteId: string;
  designId: string;
  customerName: string | null;
  totalAmount: number;
  paidNowAmount: number;
  installmentCount: number;
  firstDueDate: string;
  notes?: string | null;
};

export interface PaymentRepository {
  savePlan(input: SavePaymentPlanInput): Promise<PaymentPlan>;
  getPlanByQuoteId(quoteId: string): Promise<PaymentPlan | null>;
  listInstallments(options?: { status?: PaymentInstallment['status']; dueTo?: string; limit?: number }): Promise<PaymentInstallment[]>;
  listInstallmentsByPlan(planId: string): Promise<PaymentInstallment[]>;
  updateInstallmentDueDate(id: string, dueDate: string): Promise<PaymentInstallment>;
  markInstallmentPaid(id: string, paidAt?: string): Promise<PaymentInstallment>;
}
