import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
} from '../../../database/repositories/createRepositories';
import { Customer } from '../../../domain/customers/entities/Customer';
import { DesignProject } from '../../../domain/designs/entities/DesignProject';
import {
  CashTransaction,
  CashTransactionCategory,
  CashTransactionType,
  cashTransactionCategoryLabels,
} from '../../../domain/finance/entities/CashTransaction';
import { backupCashTransactionToCloud } from '../../../services/firebase/fullSyncService';
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';

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

const defaultForm: FinanceForm = {
  type: 'income',
  category: 'job_payment',
  title: '',
  amount: '',
  transactionDate: new Date().toISOString().slice(0, 10),
  customerId: null,
  designId: null,
  notes: '',
};

const categoryOptions: CashTransactionCategory[] = [
  'job_payment',
  'material',
  'labor',
  'transport',
  'rent',
  'utilities',
  'other',
];

export function FinanceScreen() {
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [designs, setDesigns] = useState<DesignProject[]>([]);
  const [form, setForm] = useState<FinanceForm>(defaultForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      const [loadedTransactions, loadedCustomers, loadedDesigns] = await Promise.all([
        transactionRepository.list({ limit: 200 }),
        customerRepository.list({ limit: 100 }),
        designRepository.list({ limit: 100 }),
      ]);
      setTransactions(loadedTransactions);
      setCustomers(loadedCustomers);
      setDesigns(loadedDesigns);
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
    }));
    setError(null);
    setMessage(null);
  }

  async function saveTransaction() {
    const amount = parseAmount(form.amount);

    if (!form.title.trim() || !amount || !isValidDate(form.transactionDate)) {
      setError('Baslik, tutar ve tarih dogru girilmeli.');
      return;
    }

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
        transactionDate: new Date().toISOString().slice(0, 10),
      });
      setMessage('Kayit eklendi.');
      await loadFinance();
    } catch (saveError) {
      logger.error('Cash transaction save failed', saveError);
      setError('Kayit eklenemedi.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
      <AppScreen scroll={false}>
        <AppHeader
          title="Gelir / Gider"
          subtitle="Kasa, masraf ve is odemeleri"
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
                <AppCard style={styles.formCard}>
                  <Text style={styles.sectionTitle}>Hizli kayit</Text>
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
                    placeholder={form.type === 'income' ? 'Orn: Ahmet is odemesi' : 'Orn: Profil alimi'}
                    placeholderTextColor={colors.textSecondary}
                    style={styles.input}
                    value={form.title}
                  />
                  <View style={styles.row}>
                    <TextInput
                      accessibilityLabel="Tutar"
                      keyboardType="numeric"
                      onChangeText={(value) => updateForm('amount', value)}
                      placeholder="Tutar"
                      placeholderTextColor={colors.textSecondary}
                      style={[styles.input, styles.flexInput]}
                      value={form.amount}
                    />
                    <TextInput
                      accessibilityLabel="Tarih"
                      onChangeText={(value) => updateForm('transactionDate', value)}
                      placeholder="YYYY-AA-GG"
                      placeholderTextColor={colors.textSecondary}
                      style={[styles.input, styles.flexInput]}
                      value={form.transactionDate}
                    />
                  </View>
                  <View style={styles.chips}>
                    {categoryOptions.map((category) => (
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
                    label="Is / Tasarim"
                    emptyLabel="Baglama"
                    options={designs.map((design) => ({
                      id: design.id,
                      label: design.jobName ? `${design.jobName} - ${design.name}` : design.name,
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
                description="Gelir veya gider ekleyerek kasayi basitce takip edebilirsiniz."
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

function summarize(transactions: CashTransaction[]): { income: number; expense: number; net: number } {
  const income = transactions
    .filter((item) => item.type === 'income')
    .reduce((total, item) => total + item.amount, 0);
  const expense = transactions
    .filter((item) => item.type === 'expense')
    .reduce((total, item) => total + item.amount, 0);
  return { income, expense, net: income - expense };
}

function getCurrentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

function isInRange(value: string, range: { from: string; to: string }): boolean {
  return value >= range.from && value <= range.to;
}

function parseAmount(value: string): number | null {
  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
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
