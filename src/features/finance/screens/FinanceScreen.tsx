import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppCard } from '../../../components/ui/AppCard';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import {
  createCashTransactionRepository,
  createCustomerRepository,
  createDesignRepository,
  createPaymentRepository,
} from '../../../database/repositories/createRepositories';
import { Customer } from '../../../domain/customers/entities/Customer';
import { DesignProject } from '../../../domain/designs/entities/DesignProject';
import {
  CashTransaction,
  CashTransactionCategory,
  CashTransactionType,
  cashTransactionCategoryLabels,
} from '../../../domain/finance/entities/CashTransaction';
import { PaymentInstallment, PaymentPlan } from '../../../domain/payments/entities/PaymentPlan';
import { backupCashTransactionToCloud } from '../../../services/firebase/fullSyncService';
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';
import {
  isValidDateInput,
  maxMoneyAmount,
  sanitizeDateInput,
  sanitizeDecimalInput,
} from '../../../utils/inputValidation';

type FinanceForm = {
  type: CashTransactionType;
  category: CashTransactionCategory;
  title: string;
  amount: string;
  transactionDate: string;
  customerId: string | null;
  designId: string | null;
  notes: string;
};

type PaymentTracker = {
  plan: PaymentPlan;
  installments: PaymentInstallment[];
  paidAmount: number;
  pendingAmount: number;
  dueAmount: number;
  paidInstallmentCount: number;
  pendingInstallments: PaymentInstallment[];
  dueInstallments: PaymentInstallment[];
  nextInstallment: PaymentInstallment | null;
};

const defaultForm: FinanceForm = {
  type: 'income',
  category: 'job_payment',
  title: '',
  amount: '',
  transactionDate: getLocalDateString(),
  customerId: null,
  designId: null,
  notes: '',
};

const incomeCategoryOptions: CashTransactionCategory[] = ['job_payment', 'other'];

const expenseCategoryOptions: CashTransactionCategory[] = [
  'pvc_profile',
  'glass',
  'accessory',
  'hardware',
  'labor',
  'transport',
  'other',
];

export function FinanceScreen() {
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [paymentTrackers, setPaymentTrackers] = useState<PaymentTracker[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [designs, setDesigns] = useState<DesignProject[]>([]);
  const [form, setForm] = useState<FinanceForm>(defaultForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saveInFlightRef = useRef(false);
  const thisMonthRange = useMemo(() => getCurrentMonthRange(), []);
  const monthSummary = useMemo(
    () => summarize(transactions.filter((item) => isInRange(item.transactionDate, thisMonthRange))),
    [thisMonthRange, transactions],
  );

  const loadFinance = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const transactionRepository = await createCashTransactionRepository();
      const customerRepository = await createCustomerRepository();
      const designRepository = await createDesignRepository();
      const paymentRepository = await createPaymentRepository();
      const [loadedTransactions, loadedCustomers, loadedDesigns, loadedPaymentPlans] = await Promise.all([
        transactionRepository.list({ limit: 200 }),
        customerRepository.list({ limit: 100 }),
        designRepository.list({ limit: 100 }),
        paymentRepository.listPlans({ limit: 100 }),
      ]);
      const trackerInstallments = await Promise.all(
        loadedPaymentPlans.map(async (plan) => paymentRepository.listInstallmentsByPlan(plan.id)),
      );
      setTransactions(loadedTransactions);
      setCustomers(loadedCustomers);
      setDesigns(loadedDesigns);
      setPaymentTrackers(
        loadedPaymentPlans
          .map((plan, index) => buildPaymentTracker(plan, trackerInstallments[index] ?? []))
          .filter((tracker) => tracker.pendingAmount > 0 || tracker.paidAmount > 0),
      );
    } catch (loadError) {
      logger.error('Finance screen load failed', loadError);
      setError('Gelir gider bilgileri yuklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFinance();
    }, [loadFinance]),
  );

  function updateForm<Key extends keyof FinanceForm>(key: Key, value: FinanceForm[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'type' && value === 'income' ? { category: 'job_payment' as const } : null),
      ...(key === 'type' && value === 'expense' ? { category: 'pvc_profile' as const } : null),
    }));
    setError(null);
    setMessage(null);
  }

  async function saveTransaction() {
    if (saveInFlightRef.current || isSaving) {
      return;
    }

    const amount = parseAmount(form.amount);

    if (!form.title.trim() || !amount || !isValidDate(form.transactionDate)) {
      setError('Baslik, tutar ve tarih dogru girilmeli.');
      return;
    }

    saveInFlightRef.current = true;
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const repository = await createCashTransactionRepository();
      const saved = await repository.save({
        type: form.type,
        category: form.category,
        title: form.title,
        amount,
        transactionDate: form.transactionDate,
        customerId: form.customerId,
        designId: form.designId,
        notes: nullableTrim(form.notes),
      });
      void backupCashTransactionToCloud(saved);
      setForm({
        ...defaultForm,
        transactionDate: getLocalDateString(),
      });
      setMessage('Kayit eklendi.');
      await loadFinance();
    } catch (saveError) {
      logger.error('Cash transaction save failed', saveError);
      setError('Kayit eklenemedi.');
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
  }

  async function markInstallmentPaid(installment: PaymentInstallment) {
    await markInstallmentsPaid([installment]);
  }

  async function markInstallmentsPaid(installments: PaymentInstallment[]) {
    if (saveInFlightRef.current || isSaving) {
      return;
    }

    const payableInstallments = installments.filter((installment) => installment.status === 'pending');
    if (payableInstallments.length === 0) {
      setError('Odenecek bekleyen taksit bulunamadi.');
      return;
    }

    saveInFlightRef.current = true;
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const paymentRepository = await createPaymentRepository();
      const transactionRepository = await createCashTransactionRepository();
      for (const installment of payableInstallments) {
        await paymentRepository.markInstallmentPaid(installment.id);
        const savedTransaction = await transactionRepository.save({
          id: `installment-payment-${installment.id}`,
          type: 'income',
          category: 'job_payment',
          title: `${installment.customerName ?? 'Musteri'} taksit odemesi`,
          amount: installment.amount,
          transactionDate: getLocalDateString(),
          customerId: null,
          designId: installment.designId,
          notes: `${installment.sequence}. taksit odendi.`,
        });
        void backupCashTransactionToCloud(savedTransaction);
      }
      const totalPaid = payableInstallments.reduce((sum, installment) => sum + installment.amount, 0);
      setMessage(`${formatCurrency(totalPaid)} odeme kaydedildi.`);
      await loadFinance();
    } catch (payError) {
      logger.error('Installment paid failed', payError);
      setError('Odeme kaydedilemedi.');
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
  }

  function confirmBulkPayment(label: string, installments: PaymentInstallment[]) {
    const payableInstallments = installments.filter((installment) => installment.status === 'pending');
    if (payableInstallments.length === 0) {
      setError('Odenecek bekleyen taksit bulunamadi.');
      return;
    }

    const total = payableInstallments.reduce((sum, installment) => sum + installment.amount, 0);
    Alert.alert('Odeme kaydi', `${label}: ${formatCurrency(total)} tahsil edildi olarak kaydedilsin mi?`, [
      { text: 'Vazgec', style: 'cancel' },
      { text: 'Kaydet', onPress: () => void markInstallmentsPaid(payableInstallments) },
    ]);
  }

  async function postponeInstallment(installment: PaymentInstallment, days: number) {
    if (saveInFlightRef.current || isSaving) {
      return;
    }

    saveInFlightRef.current = true;
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const paymentRepository = await createPaymentRepository();
      const nextDate = addDays(getLocalDateString(), days);
      await paymentRepository.updateInstallmentDueDate(installment.id, nextDate);
      setMessage(`${installment.sequence}. taksit ${formatDate(nextDate)} tarihine ertelendi.`);
      await loadFinance();
    } catch (postponeError) {
      logger.error('Installment postpone failed', postponeError);
      setError('Taksit tarihi ertelenemedi.');
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
      <AppScreen scroll={false}>
        <AppHeader
          title="Gelir / Gider"
          subtitle="Kasaya giren, kasadan cikan ve net durum"
          rightAction={<AppButton label="Geri" variant="ghost" onPress={() => router.back()} />}
        />
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={transactions.length === 0 ? styles.emptyList : styles.list}
            ListHeaderComponent={
              <View style={styles.headerContent}>
                <SummaryCard summary={monthSummary} />
                <AppCard style={styles.infoCard}>
                  <Text style={styles.sectionTitle}>Kasa mantigi</Text>
                  <Text style={styles.caption}>
                    Musteriden alinan toplam satis bedeli gelir olarak tutulur. Hizmet payi teklifin icindedir,
                    gider degildir.
                  </Text>
                  <Text style={styles.caption}>
                    Gider sadece profil, cam, aksesuar, nakliye veya disariya yaptirilan ekstra is gibi gercek
                    odemeler icin eklenir.
                  </Text>
                </AppCard>
                {paymentTrackers.length > 0 ? (
                  <AppCard style={styles.formCard}>
                    <Text style={styles.sectionTitle}>Odeme takip</Text>
                    <Text style={styles.caption}>Pesinat, odenen taksitler, kalan borc ve yaklasan vadeler.</Text>
                    {paymentTrackers.map((tracker) => (
                      <PaymentTrackerCard
                        key={tracker.plan.id}
                        disabled={isSaving}
                        tracker={tracker}
                        onMarkPaid={markInstallmentPaid}
                        onPostpone={postponeInstallment}
                        onPayDue={() => confirmBulkPayment('Vadesi gelen taksitler', tracker.dueInstallments)}
                        onPayAll={() => confirmBulkPayment('Kalan tum taksitler', tracker.pendingInstallments)}
                      />
                    ))}
                  </AppCard>
                ) : null}
                <AppCard style={styles.formCard}>
                  <Text style={styles.sectionTitle}>Kasa kaydi</Text>
                  <View style={styles.row}>
                    <SegmentButton
                      label="Gelir"
                      selected={form.type === 'income'}
                      onPress={() => updateForm('type', 'income')}
                    />
                    <SegmentButton
                      label="Gider"
                      selected={form.type === 'expense'}
                      onPress={() => updateForm('type', 'expense')}
                    />
                  </View>
                  <TextInput
                    accessibilityLabel="Baslik"
                    onChangeText={(value) => updateForm('title', value)}
                    placeholder={form.type === 'income' ? 'Orn: Musteriden alinan odeme' : 'Orn: PVC profil alimi'}
                    placeholderTextColor={colors.textSecondary}
                    style={styles.input}
                    value={form.title}
                  />
                  <View style={styles.row}>
                    <TextInput
                      accessibilityLabel="Tutar"
                      keyboardType="numeric"
                      onChangeText={(value) => updateForm('amount', sanitizeDecimalInput(value))}
                      placeholder="Tutar"
                      placeholderTextColor={colors.textSecondary}
                      style={[styles.input, styles.flexInput]}
                      value={form.amount}
                    />
                    <TextInput
                      accessibilityLabel="Tarih"
                      onChangeText={(value) => updateForm('transactionDate', sanitizeDateInput(value))}
                      placeholder="YYYY-AA-GG"
                      placeholderTextColor={colors.textSecondary}
                      style={[styles.input, styles.flexInput]}
                      value={form.transactionDate}
                    />
                  </View>
                  <View style={styles.chips}>
                    {(form.type === 'income' ? incomeCategoryOptions : expenseCategoryOptions).map((category) => (
                      <Chip
                        key={category}
                        label={cashTransactionCategoryLabels[category]}
                        selected={form.category === category}
                        onPress={() => updateForm('category', category)}
                      />
                    ))}
                  </View>
                  <Selector
                    label="Musteri"
                    emptyLabel="Baglama"
                    options={customers.map((customer) => ({ id: customer.id, label: customer.fullName }))}
                    value={form.customerId}
                    onChange={(value) => updateForm('customerId', value)}
                  />
                  <Selector
                    label="Bagli is"
                    emptyLabel="Baglama"
                    options={designs.map((design) => ({
                      id: design.id,
                      label: formatDesignOption(design),
                    }))}
                    value={form.designId}
                    onChange={(value) => updateForm('designId', value)}
                  />
                  <TextInput
                    accessibilityLabel="Not"
                    multiline
                    onChangeText={(value) => updateForm('notes', value)}
                    placeholder="Not"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.input, styles.noteInput]}
                    textAlignVertical="top"
                    value={form.notes}
                  />
                  {message ? <Text style={styles.success}>{message}</Text> : null}
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  <AppButton
                    label="Kaydet"
                    loading={isSaving}
                    disabled={isSaving}
                    onPress={() => void saveTransaction()}
                  />
                </AppCard>
                <Text style={styles.sectionTitle}>Son kayitlar</Text>
              </View>
            }
            renderItem={({ item }) => <TransactionCard transaction={item} />}
            ListEmptyComponent={
              <EmptyState
                title="Kayit yok"
                description="Musteri odemesi veya PVC/cam gideri ekleyerek isi basitce takip edebilirsiniz."
              />
            }
          />
        )}
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

function SummaryCard({ summary }: { summary: { income: number; expense: number; net: number } }) {
  return (
    <AppCard style={styles.summaryCard}>
      <Text style={styles.sectionTitle}>Bu ay</Text>
      <View style={styles.summaryGrid}>
        <SummaryItem label="Gelir" value={summary.income} tone="income" />
        <SummaryItem label="Gider" value={summary.expense} tone="expense" />
        <SummaryItem label="Net" value={summary.net} tone={summary.net >= 0 ? 'income' : 'expense'} />
      </View>
    </AppCard>
  );
}

function SummaryItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'income' | 'expense';
}) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, tone === 'income' ? styles.incomeText : styles.expenseText]}>
        {formatCurrency(value)}
      </Text>
    </View>
  );
}

function PaymentTrackerCard({
  tracker,
  disabled,
  onMarkPaid,
  onPostpone,
  onPayDue,
  onPayAll,
}: {
  tracker: PaymentTracker;
  disabled: boolean;
  onMarkPaid: (installment: PaymentInstallment) => Promise<void>;
  onPostpone: (installment: PaymentInstallment, days: number) => Promise<void>;
  onPayDue: () => void;
  onPayAll: () => void;
}) {
  const visibleInstallments = [
    ...tracker.installments.filter((installment) => installment.status === 'paid').slice(-2),
    ...tracker.pendingInstallments.slice(0, 4),
  ];

  return (
    <View style={styles.paymentPlanCard}>
      <View style={styles.paymentHeader}>
        <View style={styles.transactionTitleColumn}>
          <Text style={styles.transactionTitle}>{tracker.plan.customerName ?? 'Musteri'}</Text>
          <Text style={styles.caption}>{tracker.plan.installmentCount} taksitli odeme plani</Text>
        </View>
        <View style={styles.paymentStatusPill}>
          <Text style={styles.paymentStatusText}>
            {tracker.dueAmount > 0 ? `${formatCurrency(tracker.dueAmount)} vadesi geldi` : 'Guncel'}
          </Text>
        </View>
      </View>
      <View style={styles.paymentTotals}>
        <PaymentTotalItem label="Toplam" value={tracker.plan.totalAmount} />
        <PaymentTotalItem label="Odenen" value={tracker.paidAmount} tone="income" />
        <PaymentTotalItem label="Kalan" value={tracker.pendingAmount} tone={tracker.pendingAmount > 0 ? 'expense' : 'income'} />
      </View>
      {tracker.nextInstallment ? (
        <Text style={styles.caption}>
          Siradaki: {tracker.nextInstallment.sequence}. taksit - {formatCurrency(tracker.nextInstallment.amount)} -{' '}
          {formatDate(tracker.nextInstallment.dueDate)}
        </Text>
      ) : (
        <Text style={styles.success}>Bu odeme plani tamamen kapanmis.</Text>
      )}
      {visibleInstallments.map((installment) => (
        <View key={installment.id} style={styles.installmentTrackRow}>
          <View style={styles.installmentTrackInfo}>
            <Text style={styles.transactionTitle}>
              {installment.sequence}. taksit - {formatCurrency(installment.amount)}
            </Text>
            <Text style={styles.caption}>
              {formatDate(installment.dueDate)} | {installment.status === 'paid' ? `Odendi ${installment.paidAt ? formatDate(installment.paidAt.slice(0, 10)) : ''}` : dueLabel(installment.dueDate)}
            </Text>
          </View>
          {installment.status === 'pending' ? (
            <View style={styles.installmentActions}>
              <AppButton
                label="Ode"
                variant="secondary"
                disabled={disabled}
                onPress={() => void onMarkPaid(installment)}
                style={styles.paidButton}
              />
              <View style={styles.postponeActions}>
                <AppButton
                  label="+3"
                  variant="ghost"
                  disabled={disabled}
                  onPress={() => void onPostpone(installment, 3)}
                  style={styles.postponeButton}
                />
                <AppButton
                  label="+7"
                  variant="ghost"
                  disabled={disabled}
                  onPress={() => void onPostpone(installment, 7)}
                  style={styles.postponeButton}
                />
              </View>
            </View>
          ) : (
            <Text style={styles.success}>Odendi</Text>
          )}
        </View>
      ))}
      {tracker.pendingInstallments.length > 0 ? (
        <View style={styles.bulkPaymentActions}>
          <AppButton
            label="Vadesi gelenleri ode"
            variant="secondary"
            disabled={disabled || tracker.dueInstallments.length === 0}
            onPress={onPayDue}
            style={styles.bulkButton}
          />
          <AppButton
            label="Tum kalani ode"
            variant="ghost"
            disabled={disabled}
            onPress={onPayAll}
            style={styles.bulkButton}
          />
        </View>
      ) : null}
    </View>
  );
}

function PaymentTotalItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'income' | 'expense';
}) {
  return (
    <View style={styles.paymentTotalItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, tone === 'income' ? styles.incomeText : null, tone === 'expense' ? styles.expenseText : null]}>
        {formatCurrency(value)}
      </Text>
    </View>
  );
}

function TransactionCard({ transaction }: { transaction: CashTransaction }) {
  const isIncome = transaction.type === 'income';
  return (
    <AppCard style={styles.transactionCard}>
      <View style={styles.transactionHeader}>
        <View style={styles.transactionTitleColumn}>
          <Text style={styles.transactionTitle}>{transaction.title}</Text>
          <Text style={styles.caption}>
            {cashTransactionCategoryLabels[transaction.category]} - {formatDate(transaction.transactionDate)}
          </Text>
        </View>
        <Text style={[styles.transactionAmount, isIncome ? styles.incomeText : styles.expenseText]}>
          {isIncome ? '+' : '-'} {formatCurrency(transaction.amount)}
        </Text>
      </View>
      {transaction.notes ? <Text style={styles.caption}>{transaction.notes}</Text> : null}
    </AppCard>
  );
}

function SegmentButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.segment,
        selected ? styles.segmentSelected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : null]}>{label}</Text>
    </Pressable>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{label}</Text>
    </Pressable>
  );
}

function Selector({
  label,
  emptyLabel,
  options,
  value,
  onChange,
}: {
  label: string;
  emptyLabel: string;
  options: { id: string; label: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <View style={styles.selector}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        <Chip label={emptyLabel} selected={value === null} onPress={() => onChange(null)} />
        {options.slice(0, 8).map((option) => (
          <Chip
            key={option.id}
            label={option.label}
            selected={value === option.id}
            onPress={() => onChange(option.id)}
          />
        ))}
      </View>
    </View>
  );
}

function buildPaymentTracker(plan: PaymentPlan, installments: PaymentInstallment[]): PaymentTracker {
  const today = getLocalDateString();
  const sortedInstallments = [...installments].sort((left, right) => left.sequence - right.sequence);
  const paidInstallments = sortedInstallments.filter((installment) => installment.status === 'paid');
  const pendingInstallments = sortedInstallments.filter((installment) => installment.status === 'pending');
  const dueInstallments = pendingInstallments.filter((installment) => installment.dueDate <= today);
  const paidInstallmentAmount = paidInstallments.reduce((sum, installment) => sum + installment.amount, 0);
  const pendingAmount = pendingInstallments.reduce((sum, installment) => sum + installment.amount, 0);

  return {
    plan,
    installments: sortedInstallments,
    paidAmount: Math.min(plan.totalAmount, plan.paidNowAmount + paidInstallmentAmount),
    pendingAmount,
    dueAmount: dueInstallments.reduce((sum, installment) => sum + installment.amount, 0),
    paidInstallmentCount: paidInstallments.length,
    pendingInstallments,
    dueInstallments,
    nextInstallment: pendingInstallments[0] ?? null,
  };
}

function summarize(transactions: CashTransaction[]): { income: number; expense: number; net: number } {
  const income = transactions
    .filter((item) => item.type === 'income')
    .reduce((total, item) => total + item.amount, 0);
  const expense = transactions
    .filter((item) => item.type === 'expense')
    .reduce((total, item) => total + item.amount, 0);
  return { income, expense, net: income - expense };
}

function formatDesignOption(design: DesignProject): string {
  const baseName = design.jobName ?? design.name;
  return `${baseName} (${design.width}x${design.height})`;
}

function getLocalDateString(): string {
  return toDateInputValue(new Date());
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function getCurrentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  return { from, to };
}

function isInRange(value: string, range: { from: string; to: string }): boolean {
  return value >= range.from && value <= range.to;
}

function parseAmount(value: string): number | null {
  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) && parsed > 0 && parsed <= maxMoneyAmount ? parsed : null;
}

function isValidDate(value: string): boolean {
  return isValidDateInput(value);
}

function nullableTrim(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString('tr-TR')} TL`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('tr-TR');
}

function dueLabel(dueDate: string): string {
  const today = getLocalDateString();

  if (dueDate < today) {
    return 'Gecikti';
  }

  if (dueDate === today) {
    return 'Bugun';
  }

  return 'Bekliyor';
}

function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  list: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  headerContent: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  summaryCard: {
    gap: spacing.sm,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryItem: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    padding: spacing.sm,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.body,
    fontWeight: '800',
  },
  formCard: {
    gap: spacing.sm,
  },
  infoCard: {
    gap: spacing.xs,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.textPrimary,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  flexInput: {
    flex: 1,
  },
  noteInput: {
    minHeight: 72,
    paddingTop: spacing.sm,
  },
  segment: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
  },
  segmentSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentText: {
    ...typography.button,
    color: colors.primary,
  },
  segmentTextSelected: {
    color: colors.surface,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: colors.surface,
  },
  pressed: {
    opacity: 0.86,
  },
  selector: {
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  transactionCard: {
    gap: spacing.sm,
  },
  transactionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  transactionTitleColumn: {
    flex: 1,
    gap: 2,
  },
  transactionTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  transactionAmount: {
    ...typography.body,
    fontWeight: '800',
    textAlign: 'right',
  },
  paymentPlanCard: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  paymentHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  paymentStatusPill: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    maxWidth: 130,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  paymentStatusText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '800',
    textAlign: 'center',
  },
  paymentTotals: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  paymentTotalItem: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    padding: spacing.xs,
  },
  installmentTrackRow: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  installmentTrackInfo: {
    flex: 1,
    gap: 2,
  },
  installmentActions: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  bulkPaymentActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bulkButton: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: spacing.xs,
  },
  dueRow: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  dueInfo: {
    flex: 1,
  },
  dueAction: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  paidButton: {
    minHeight: 34,
    paddingHorizontal: spacing.sm,
  },
  postponeActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  postponeButton: {
    minHeight: 30,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  incomeText: {
    color: colors.success,
  },
  expenseText: {
    color: colors.error,
  },
  success: {
    ...typography.caption,
    color: colors.success,
  },
  error: {
    ...typography.caption,
    color: colors.error,
  },
});
