import { EntityNotFoundError, RepositoryError } from '../../domain/designs/errors';
import { createIsoTimestamp } from '../../domain/designs/utils/date';
import { createId } from '../../domain/designs/utils/id';
import { PaymentInstallment, PaymentPlan } from '../../domain/payments/entities/PaymentPlan';
import { PaymentRepository, SavePaymentPlanInput } from './PaymentRepository';
import { SqliteDatabaseLike } from './SqliteDesignRepository';

type PaymentPlanRow = {
  id: string;
  quote_id: string;
  design_id: string;
  customer_name: string | null;
  total_amount: number;
  paid_now_amount: number;
  remaining_amount: number;
  installment_count: number;
  first_due_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type PaymentInstallmentRow = {
  id: string;
  plan_id: string;
  quote_id: string;
  design_id: string;
  sequence: number;
  amount: number;
  due_date: string;
  paid_at: string | null;
  status: PaymentInstallment['status'];
  customer_name: string | null;
};

export class SqlitePaymentRepository implements PaymentRepository {
  constructor(private readonly database: SqliteDatabaseLike) {}

  async savePlan(input: SavePaymentPlanInput): Promise<PaymentPlan> {
    if (input.totalAmount <= 0 || input.paidNowAmount < 0 || input.installmentCount < 1) {
      throw new RepositoryError('Payment plan values are invalid.');
    }

    const existing = await this.getPlanByQuoteId(input.quoteId);
    const id = existing?.id ?? createId();
    const now = createIsoTimestamp();
    const createdAt = existing?.createdAt ?? now;
    const remainingAmount = Math.max(0, input.totalAmount - input.paidNowAmount);

    await this.database.execAsync('BEGIN TRANSACTION;');
    try {
      await this.database.runAsync(
        `
          INSERT OR REPLACE INTO payment_plans
          (id, quote_id, design_id, customer_name, total_amount, paid_now_amount, remaining_amount,
           installment_count, first_due_date, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
        [
          id,
          input.quoteId,
          input.designId,
          input.customerName,
          input.totalAmount,
          input.paidNowAmount,
          remainingAmount,
          input.installmentCount,
          input.firstDueDate,
          normalizeOptionalText(input.notes),
          createdAt,
          now,
        ],
      );
      await this.database.runAsync('DELETE FROM payment_installments WHERE plan_id = ?;', [id]);

      const installments = buildInstallments({
        planId: id,
        quoteId: input.quoteId,
        designId: input.designId,
        customerName: input.customerName,
        remainingAmount,
        installmentCount: input.installmentCount,
        firstDueDate: input.firstDueDate,
      });

      for (const installment of installments) {
        await this.database.runAsync(
          `
            INSERT INTO payment_installments
            (id, plan_id, quote_id, design_id, sequence, amount, due_date, paid_at, status, customer_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
          `,
          [
            installment.id,
            installment.planId,
            installment.quoteId,
            installment.designId,
            installment.sequence,
            installment.amount,
            installment.dueDate,
            installment.paidAt,
            installment.status,
            installment.customerName,
          ],
        );
      }
      await this.database.execAsync('COMMIT;');
    } catch (error) {
      await this.database.execAsync('ROLLBACK;');
      throw error;
    }

    const saved = await this.getPlanByQuoteId(input.quoteId);
    if (!saved) {
      throw new RepositoryError('Saved payment plan could not be read.');
    }
    return saved;
  }

  async getPlanByQuoteId(quoteId: string): Promise<PaymentPlan | null> {
    const row = await this.database.getFirstAsync<PaymentPlanRow>(
      'SELECT * FROM payment_plans WHERE quote_id = ? LIMIT 1;',
      [quoteId],
    );
    return row ? toPlan(row) : null;
  }

  async listInstallments(options: { status?: PaymentInstallment['status']; dueTo?: string; limit?: number } = {}): Promise<PaymentInstallment[]> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (options.status) {
      where.push('status = ?');
      params.push(options.status);
    }
    if (options.dueTo) {
      where.push('due_date <= ?');
      params.push(options.dueTo);
    }
    params.push(options.limit ?? 100);

    const rows = await this.database.getAllAsync<PaymentInstallmentRow>(
      `
        SELECT * FROM payment_installments
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY due_date ASC
        LIMIT ?;
      `,
      params,
    );
    return rows.map(toInstallment);
  }

  async listInstallmentsByPlan(planId: string): Promise<PaymentInstallment[]> {
    const rows = await this.database.getAllAsync<PaymentInstallmentRow>(
      'SELECT * FROM payment_installments WHERE plan_id = ? ORDER BY sequence ASC;',
      [planId],
    );
    return rows.map(toInstallment);
  }

  async markInstallmentPaid(id: string, paidAt = new Date().toISOString()): Promise<PaymentInstallment> {
    await this.database.runAsync(
      'UPDATE payment_installments SET status = ?, paid_at = ? WHERE id = ?;',
      ['paid', paidAt, id],
    );
    const row = await this.database.getFirstAsync<PaymentInstallmentRow>(
      'SELECT * FROM payment_installments WHERE id = ? LIMIT 1;',
      [id],
    );
    if (!row) {
      throw new EntityNotFoundError('PaymentInstallment', id);
    }
    return toInstallment(row);
  }
}

function buildInstallments({
  planId,
  quoteId,
  designId,
  customerName,
  remainingAmount,
  installmentCount,
  firstDueDate,
}: {
  planId: string;
  quoteId: string;
  designId: string;
  customerName: string | null;
  remainingAmount: number;
  installmentCount: number;
  firstDueDate: string;
}): PaymentInstallment[] {
  const baseAmount = Math.floor((remainingAmount / installmentCount) * 100) / 100;
  let allocated = 0;

  return Array.from({ length: installmentCount }, (_, index) => {
    const isLast = index === installmentCount - 1;
    const amount = isLast ? Math.round((remainingAmount - allocated) * 100) / 100 : baseAmount;
    allocated += amount;
    return {
      id: createId(),
      planId,
      quoteId,
      designId,
      sequence: index + 1,
      amount,
      dueDate: addMonths(firstDueDate, index),
      paidAt: null,
      status: 'pending',
      customerName,
    };
  });
}

function addMonths(dateString: string, months: number): string {
  const parts = dateString.split('-').map(Number);
  const year = parts[0] ?? new Date().getFullYear();
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const date = new Date(year, month - 1 + months, day);
  return date.toISOString().slice(0, 10);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function toPlan(row: PaymentPlanRow): PaymentPlan {
  return {
    id: row.id,
    quoteId: row.quote_id,
    designId: row.design_id,
    customerName: row.customer_name,
    totalAmount: row.total_amount,
    paidNowAmount: row.paid_now_amount,
    remainingAmount: row.remaining_amount,
    installmentCount: row.installment_count,
    firstDueDate: row.first_due_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toInstallment(row: PaymentInstallmentRow): PaymentInstallment {
  return {
    id: row.id,
    planId: row.plan_id,
    quoteId: row.quote_id,
    designId: row.design_id,
    sequence: row.sequence,
    amount: row.amount,
    dueDate: row.due_date,
    paidAt: row.paid_at,
    status: row.status,
    customerName: row.customer_name,
  };
}
