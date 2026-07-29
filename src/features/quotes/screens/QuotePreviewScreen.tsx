import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppCard } from '../../../components/ui/AppCard';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import { routes } from '../../../constants/routes';
import { getPricingSettings } from '../../../database/repositories/PricingSettingsRepository';
import {
  createCashTransactionRepository,
  createCustomerRepository,
  createDesignRepository,
  createPaymentRepository,
  createJobRepository,
  createQuoteRepository,
} from '../../../database/repositories/createRepositories';
import { DesignProject } from '../../../domain/designs/entities/DesignProject';
import { createId } from '../../../domain/designs/utils/id';
import {
  calculateDesignPriceEstimate,
  DesignPriceEstimate,
} from '../../../domain/designs/pricing/calculateDesignPriceEstimate';
import { Quote } from '../../../domain/quotes/entities/Quote';
import { PaymentInstallment, PaymentPlan } from '../../../domain/payments/entities/PaymentPlan';
import {
  backupCashTransactionToCloud,
  backupDesignToCloud,
  backupJobToCloud,
  backupQuoteToCloud,
} from '../../../services/firebase/fullSyncService';
import { recordActivity } from '../../../services/activityLogService';
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';
import {
  normalizePhone,
  normalizeTurkishPhone,
  normalizeTurkishWhatsAppPhone,
  sanitizePhoneInput,
} from '../../../utils/phone';
import { shareCustomerQuotePdf, shareProductionPdf } from '../services/pdfService';

export function QuotePreviewScreen() {
  const { designId } = useLocalSearchParams<{ designId: string }>();
  const [design, setDesign] = useState<DesignProject | null>(null);
  const [estimate, setEstimate] = useState<DesignPriceEstimate | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [note, setNote] = useState('');
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan | null>(null);
  const [paymentInstallments, setPaymentInstallments] = useState<PaymentInstallment[]>([]);
  const [paidNowAmount, setPaidNowAmount] = useState('');
  const [installmentCount, setInstallmentCount] = useState('3');
  const [firstDueDate, setFirstDueDate] = useState(getLocalDateString());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isPdfSharing, setIsPdfSharing] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadQuote() {
        if (!designId) {
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setError(null);
        try {
          const repository = await createDesignRepository();
          const loadedDesign = await repository.getById(designId);
          const pricingSettings = await getPricingSettings();

          if (!isActive) {
            return;
          }

          setDesign(loadedDesign);
          setEstimate(loadedDesign ? calculateDesignPriceEstimate(loadedDesign, pricingSettings) : null);

          const quoteCustomerId = loadedDesign?.customerId ?? (await getDesignJobCustomerId(loadedDesign));
          if (quoteCustomerId) {
            const customerRepository = await createCustomerRepository();
            const customer = await customerRepository.getById(quoteCustomerId);
            setCustomerName(customer?.fullName ?? '');
            setCustomerPhone(customer?.phone ?? '');
          }

          const quoteRepository = await createQuoteRepository();
          const paymentRepository = await createPaymentRepository();
          const existingQuotes = await quoteRepository.list({ designId, limit: 1 });
          const existingQuote = existingQuotes[0];
          if (existingQuote) {
            setQuoteId(existingQuote.id);
            const plan = await paymentRepository.getPlanByQuoteId(existingQuote.id);
            setPaymentPlan(plan);
            if (plan) {
              setPaidNowAmount(String(plan.paidNowAmount));
              setInstallmentCount(String(plan.installmentCount));
              setFirstDueDate(plan.firstDueDate);
              setPaymentInstallments(await paymentRepository.listInstallmentsByPlan(plan.id));
            }
          }
        } catch (loadError) {
          logger.error('Quote preview load failed', loadError);
          if (isActive) {
            setError('Teklif bilgileri yuklenemedi.');
          }
        } finally {
          if (isActive) {
            setIsLoading(false);
          }
        }
      }

      void loadQuote();

      return () => {
        isActive = false;
      };
    }, [designId]),
  );

  async function shareQuote() {
    if (!design || !estimate || isSharing) {
      return;
    }

    setIsSharing(true);
    try {
      await saveCurrentQuote('sent');
      await Share.share({
        message: buildQuoteMessage({
          design,
          estimate,
          customerName,
          customerPhone,
          note,
        }),
      });
    } catch (shareError) {
      logger.error('Quote share failed', shareError);
      setError('Teklif paylasilamadi.');
    } finally {
      setIsSharing(false);
    }
  }

  async function sendSmsQuote() {
    if (!design || !estimate) {
      return;
    }

    const phone = normalizePhone(customerPhone);
    if (!phone) {
      setError('SMS icin musteri telefonu girilmeli.');
      return;
    }

    const body = encodeURIComponent(
      buildQuoteMessage({
        design,
        estimate,
        customerName,
        customerPhone,
        note,
      }),
    );
    const separator = Platform.OS === 'ios' ? '&' : '?';

    try {
      await saveCurrentQuote('sent');
      await Linking.openURL(`sms:${phone}${separator}body=${body}`);
    } catch (smsError) {
      logger.error('Quote SMS failed', smsError);
      setError('SMS uygulamasi acilamadi.');
    }
  }

  async function sendWhatsAppQuote() {
    if (!design || !estimate) {
      return;
    }

    const phone = normalizeTurkishWhatsAppPhone(customerPhone);
    if (!phone) {
      setError('WhatsApp icin musteri telefonu girilmeli.');
      return;
    }

    const text = encodeURIComponent(
      buildQuoteMessage({
        design,
        estimate,
        customerName,
        customerPhone,
        note,
      }),
    );

    try {
      await saveCurrentQuote('sent');
      await Linking.openURL(`https://wa.me/${phone}?text=${text}`);
    } catch (whatsAppError) {
      logger.error('Quote WhatsApp failed', whatsAppError);
      setError('WhatsApp acilamadi.');
    }
  }

  async function saveDraftQuote() {
    if (customerPhone.trim() && !normalizeTurkishPhone(customerPhone)) {
      setError('Telefon 05xxxxxxxxx formatinda olmali.');
      return;
    }

    setIsSaving(true);
    try {
      await saveCurrentQuote('draft');
      setSaveMessage('Teklif kaydedildi.');
      setError(null);
    } catch (saveError) {
      logger.error('Quote draft save failed', saveError);
      setError('Teklif kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function savePaymentPlan() {
    if (!design || !estimate) {
      return;
    }

    const paidNow = parsePositiveAmount(paidNowAmount) ?? 0;
    const count = Number(installmentCount.trim());
    const displayedTotal = Math.round(estimate.total);

    if (
      paidNow < 0 ||
      paidNow > displayedTotal ||
      !Number.isInteger(count) ||
      count < 0 ||
      (count > 0 && !isValidDate(firstDueDate))
    ) {
      setError('Odeme plani icin pesinat, taksit sayisi ve tarih dogru girilmeli.');
      return;
    }

    if (count === 0 && paidNow < displayedTotal) {
      setError('Taksit yoksa alinan odeme toplam tutara esit olmali.');
      return;
    }

    setIsSaving(true);
    try {
      const quote = await saveCurrentQuote('draft');
      if (!quote) {
        return;
      }

      if (count === 0) {
        const transactionRepository = await createCashTransactionRepository();
        const savedTransaction = await transactionRepository.save({
          type: 'income',
          category: 'job_payment',
          title: `${customerName || 'Musteri'} pesin odeme`,
          amount: paidNow,
          transactionDate: getLocalDateString(),
          customerId: design.customerId,
          designId: design.id,
          notes: nullableTrim(note) ?? 'Teklif pesin odendi.',
        });
        void backupCashTransactionToCloud(savedTransaction);
        void recordActivity({
          type: 'payment_saved',
          title: `${customerName || 'Musteri'} pesin odeme kaydedildi`,
          description: `${Math.round(paidNow).toLocaleString('tr-TR')} TL kasa gelirine eklendi.`,
          entityType: 'design',
          entityId: design.id,
          customerName: nullableTrim(customerName),
        });
        await approvePaidQuote(quote);
        setPaymentPlan(null);
        setPaymentInstallments([]);
        setSaveMessage('Pesin odeme kaydedildi ve is Atolye onay adimina alindi.');
        setError(null);
        return;
      }

      const paymentRepository = await createPaymentRepository();
      const savedPlan = await paymentRepository.savePlan({
        quoteId: quote.id,
        designId: design.id,
        customerName: nullableTrim(customerName),
        totalAmount: estimate.total,
        paidNowAmount: paidNow,
        installmentCount: count,
        firstDueDate,
        notes: nullableTrim(note),
      });
      void recordActivity({
        type: 'payment_saved',
        title: `${customerName || 'Musteri'} odeme plani kaydedildi`,
        description: `${Math.round(paidNow).toLocaleString('tr-TR')} TL pesinat, ${count} taksit.`,
        entityType: 'design',
        entityId: design.id,
        customerName: nullableTrim(customerName),
      });
      await approvePaidQuote(quote);
      setPaymentPlan(savedPlan);
      setPaymentInstallments(await paymentRepository.listInstallmentsByPlan(savedPlan.id));
      setSaveMessage('Odeme plani kaydedildi ve is Atolye onay adimina alindi.');
      setError(null);
    } catch (planError) {
      logger.error('Payment plan save failed', planError);
      setError('Odeme plani kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function saveInstallmentDates() {
    if (!paymentPlan) {
      return;
    }

    if (paymentInstallments.some((installment) => !isValidDate(installment.dueDate))) {
      setError('Taksit tarihlerinin formati YYYY-AA-GG olmali.');
      return;
    }

    setIsSaving(true);
    try {
      const paymentRepository = await createPaymentRepository();
      const updatedInstallments: PaymentInstallment[] = [];
      for (const installment of paymentInstallments) {
        updatedInstallments.push(
          await paymentRepository.updateInstallmentDueDate(installment.id, installment.dueDate),
        );
      }
      setPaymentInstallments(updatedInstallments);
      setSaveMessage('Taksit tarihleri kaydedildi.');
      setError(null);
    } catch (dateError) {
      logger.error('Payment installment dates save failed', dateError);
      setError('Taksit tarihleri kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  }

  function updateInstallmentDate(id: string, dueDate: string) {
    setPaymentInstallments((current) =>
      current.map((installment) =>
        installment.id === id ? { ...installment, dueDate } : installment,
      ),
    );
    setError(null);
    setSaveMessage(null);
  }

  async function shareCustomerPdf() {
    if (!design || !estimate || isPdfSharing) {
      return;
    }

    setIsPdfSharing(true);
    try {
      await saveCurrentQuote('sent');
      await shareCustomerQuotePdf({ design, estimate, customerName, customerPhone, note });
    } catch (pdfError) {
      logger.error('Customer quote PDF share failed', pdfError);
      setError('Teklif PDF paylasilamadi.');
    } finally {
      setIsPdfSharing(false);
    }
  }

  async function shareProductionForm() {
    if (!design || !estimate || isPdfSharing) {
      return;
    }

    setIsPdfSharing(true);
    try {
      await shareProductionPdf({ design, estimate, customerName, customerPhone, note });
    } catch (pdfError) {
      logger.error('Production PDF share failed', pdfError);
      setError('Imalat PDF paylasilamadi.');
    } finally {
      setIsPdfSharing(false);
    }
  }

  async function saveCurrentQuote(status: Quote['status']): Promise<Quote | null> {
    if (!design || !estimate) {
      return null;
    }

    const normalizedCustomerPhone = customerPhone.trim() ? normalizeTurkishPhone(customerPhone) : null;
    if (customerPhone.trim() && !normalizedCustomerPhone) {
      setError('Telefon 05xxxxxxxxx formatinda olmali.');
      return null;
    }

    const repository = await createQuoteRepository();
    const id = quoteId ?? createId();
    const message = buildQuoteMessage({
      design,
      estimate,
      customerName,
      customerPhone: normalizedCustomerPhone ?? '',
      note,
    });
    const saved = await repository.save({
      id,
      designId: design.id,
      designName: design.name,
      customerName: nullableTrim(customerName),
      customerPhone: normalizedCustomerPhone,
      note: nullableTrim(note),
      status,
      width: design.width,
      height: design.height,
      quantity: design.quantity,
      profileSystemName: estimate.selectedProfileSystem.name,
      colorName: estimate.selectedColor.name,
      glassTypeName: estimate.selectedGlassType.name,
      unitTotal: estimate.unitTotal,
      total: estimate.total,
      message,
    });

    setQuoteId(saved.id);
    setSaveMessage(status === 'sent' ? 'Teklif gonderildi olarak kaydedildi.' : 'Teklif kaydedildi.');
    void backupQuoteToCloud(saved);

    if (status === 'sent' && design.jobStatus === 'draft') {
      const designRepository = await createDesignRepository();
      const updatedDesign = await designRepository.update({ ...design, jobStatus: 'quoted' });
      setDesign(updatedDesign);
      void backupDesignToCloud(updatedDesign);
    }

    return saved;
  }

  if (isLoading) {
    return (
      <AppScreen centered>
        <ActivityIndicator color={colors.primary} />
      </AppScreen>
    );
  }

  if (!design || !estimate) {
    return (
      <AppScreen centered>
        <EmptyState
          title="Teklif olusturulamadi"
          description={error ?? 'Tasarim kaydi bulunamadi.'}
          action={<AppButton label="Tasarimlara Don" onPress={() => router.replace(routes.designs)} />}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppHeader
        title="Teklif"
        subtitle={design.name}
        rightAction={<AppButton label="Geri" variant="ghost" onPress={() => router.back()} />}
      />

      <AppCard style={styles.formCard}>
        <Text style={styles.sectionTitle}>Musteri bilgisi</Text>
        <TextInput
          accessibilityLabel="Musteri adi"
          onChangeText={setCustomerName}
          placeholder="Musteri adi"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          value={customerName}
        />
        <TextInput
          accessibilityLabel="Telefon"
          keyboardType="phone-pad"
          onChangeText={(value) => setCustomerPhone(sanitizePhoneInput(value))}
          placeholder="Telefon"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          value={customerPhone}
        />
        <TextInput
          accessibilityLabel="Teklif notu"
          multiline
          onChangeText={setNote}
          placeholder="Not"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, styles.noteInput]}
          textAlignVertical="top"
          value={note}
        />
      </AppCard>

      <AppCard style={styles.summaryCard}>
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Tahmini toplam</Text>
          <Text style={styles.totalValue}>{formatCurrency(estimate.total)}</Text>
        </View>
        <Info label="Tasarim" value={design.name} />
        <Info label="Olcu" value={`${design.width} x ${design.height} mm`} />
        <Info label="Adet" value={String(design.quantity)} />
        <Info label="Profil kalitesi" value={estimate.selectedProfileSystem.name} />
        <Info label="Renk" value={estimate.selectedColor.name} />
        <Info label="Cam tipi" value={estimate.selectedGlassType.name} />
        <Info label="Profil" value={`${estimate.profileLengthMeters} m`} />
        <Info label="Cam alani" value={`${estimate.glassAreaSquareMeters} m2`} />
        <Info label="Birim fiyat" value={formatCurrency(estimate.unitTotal)} />
      </AppCard>

      <AppCard style={styles.breakdownCard}>
        <Text style={styles.sectionTitle}>Fiyat dokumu</Text>
        <Info label="Profil tutari" value={formatCurrency(estimate.profileSubtotal)} />
        <Info label="Cam tutari" value={formatCurrency(estimate.glassSubtotal)} />
        <Info label="Aksam/kayit" value={formatCurrency(estimate.hardwareSubtotal)} />
        {estimate.archSubtotal > 0 ? <Info label="Kemer farki" value={formatCurrency(estimate.archSubtotal)} /> : null}
        <Info label="Malzeme karsiligi" value={formatCurrency(estimate.materialSubtotal)} />
        <Info label="Iscilik / hizmet" value={formatCurrency(estimate.serviceLaborSubtotal)} />
        <Info label="Renk katsayisi" value={`x${estimate.colorMultiplier}`} />
      </AppCard>

      <AppCard style={styles.breakdownCard}>
        <Text style={styles.sectionTitle}>Odeme plani</Text>
        <Info label="Toplam ucret" value={formatCurrency(estimate.total)} />
        <View style={styles.actionRow}>
          <TextInput
            accessibilityLabel="Pesinat"
            keyboardType="numeric"
            onChangeText={setPaidNowAmount}
            placeholder="Simdi alinacak"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, styles.actionButton]}
            value={paidNowAmount}
          />
          <TextInput
            accessibilityLabel="Taksit sayisi"
            keyboardType="numeric"
            onChangeText={setInstallmentCount}
            placeholder="Taksit (0 pesin)"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, styles.actionButton]}
            value={installmentCount}
          />
        </View>
        <Text style={styles.helperText}>
          Tamami pesin alindiyse simdi alinacak tutari toplam ucret yapip taksit sayisini 0 girin.
        </Text>
        <TextInput
          accessibilityLabel="Ilk odeme tarihi"
          onChangeText={setFirstDueDate}
          placeholder="YYYY-AA-GG"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          value={firstDueDate}
        />
        <AppButton label="Odemeyi Kaydet" loading={isSaving} disabled={isSaving} onPress={() => void savePaymentPlan()} />
        {paymentPlan ? (
          <View style={styles.installments}>
            {paymentInstallments.map((installment) => (
              <View key={installment.id} style={styles.installmentRow}>
                <View style={styles.installmentInfo}>
                  <Text style={styles.infoLabel}>{installment.sequence}. taksit</Text>
                  <Text style={styles.infoValue}>{formatCurrency(installment.amount)}</Text>
                </View>
                <TextInput
                  accessibilityLabel={`${installment.sequence}. taksit tarihi`}
                  onChangeText={(value) => updateInstallmentDate(installment.id, value)}
                  placeholder="YYYY-AA-GG"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                  value={installment.dueDate}
                />
              </View>
            ))}
            <AppButton
              label="Taksit Tarihlerini Kaydet"
              variant="secondary"
              loading={isSaving}
              disabled={isSaving}
              onPress={() => void saveInstallmentDates()}
            />
          </View>
        ) : null}
      </AppCard>

      {saveMessage ? <Text style={styles.success}>{saveMessage}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AppCard style={styles.actionsCard}>
        <Text style={styles.sectionTitle}>Teklif islemleri</Text>
        <Text style={styles.helperText}>
          Teklifi Kaydet, bu fiyat ve musteri bilgileriyle teklif kaydi olusturur. Tasarim cizimi
          icin editor ekranindaki Kaydet kullanilir.
        </Text>
        <AppButton label="Teklifi Kaydet" loading={isSaving} disabled={isSaving} onPress={() => void saveDraftQuote()} />
        <AppButton
          label="Teklifi Paylas"
          variant="secondary"
          loading={isSharing}
          disabled={isSharing}
          onPress={() => void shareQuote()}
        />
      </AppCard>

      <AppCard style={styles.actionsCard}>
        <Text style={styles.sectionTitle}>Musteriye gonder</Text>
        <View style={styles.actionRow}>
          <AppButton
            label="WhatsApp"
            variant="secondary"
            disabled={isSharing}
            onPress={() => void sendWhatsAppQuote()}
            style={styles.actionButton}
          />
          <AppButton
            label="SMS"
            variant="secondary"
            disabled={isSharing}
            onPress={() => void sendSmsQuote()}
            style={styles.actionButton}
          />
        </View>
      </AppCard>

      <AppCard style={styles.actionsCard}>
        <Text style={styles.sectionTitle}>PDF ve tasarim</Text>
        <View style={styles.actionRow}>
          <AppButton
            label="Teklif PDF"
            variant="secondary"
            loading={isPdfSharing}
            disabled={isPdfSharing}
            onPress={() => void shareCustomerPdf()}
            style={styles.actionButton}
          />
          <AppButton
            label="Imalat PDF"
            variant="secondary"
            loading={isPdfSharing}
            disabled={isPdfSharing}
            onPress={() => void shareProductionForm()}
            style={styles.actionButton}
          />
        </View>
        <AppButton label="Tasarimi Duzenle" variant="secondary" onPress={() => router.push(routes.designEditor(design.id))} />
      </AppCard>
    </AppScreen>
  );
}

async function getDesignJobCustomerId(design: DesignProject | null): Promise<string | null> {
  if (!design?.jobId) {
    return null;
  }

  const jobRepository = await createJobRepository();
  const job = await jobRepository.getById(design.jobId);
  return job?.customerId ?? null;
}

async function approvePaidQuote(quote: Quote): Promise<void> {
  const quoteRepository = await createQuoteRepository();
  const designRepository = await createDesignRepository();
  const jobRepository = await createJobRepository();

  const acceptedQuote = await quoteRepository.updateStatus(quote.id, 'accepted');
  void backupQuoteToCloud(acceptedQuote);
  void recordActivity({
    type: 'quote_accepted',
    title: `${quote.customerName ?? quote.designName} teklifi onaylandi`,
    description: 'Teklif kabul edildi ve is Atolye onay adimina alindi.',
    entityType: 'quote',
    entityId: acceptedQuote.id,
    customerName: quote.customerName,
  });

  const currentDesign = await designRepository.getById(quote.designId);
  if (!currentDesign) {
    return;
  }

  if (!['production', 'installation', 'done'].includes(currentDesign.jobStatus)) {
    const updatedDesign = await designRepository.update({ ...currentDesign, jobStatus: 'approved' });
    void backupDesignToCloud(updatedDesign);
  }

  if (currentDesign.jobId) {
    const updatedJob = await jobRepository.updateStatus(currentDesign.jobId, 'approved');
    void backupJobToCloud(updatedJob);
  }
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function buildQuoteMessage({
  design,
  estimate,
  customerName,
  customerPhone,
  note,
}: {
  design: DesignProject;
  estimate: DesignPriceEstimate;
  customerName: string;
  customerPhone: string;
  note: string;
}): string {
  const lines = [
    'PVC Teklif',
    customerName.trim() ? `Musteri: ${customerName.trim()}` : null,
    customerPhone.trim() ? `Telefon: ${customerPhone.trim()}` : null,
    `Tasarim: ${design.name}`,
    `Olcu: ${design.width} x ${design.height} mm`,
    `Adet: ${design.quantity}`,
    `Profil: ${estimate.selectedProfileSystem.name}`,
    `Renk: ${estimate.selectedColor.name}`,
    `Cam: ${estimate.selectedGlassType.name}`,
    `Malzeme karsiligi: ${formatCurrency(estimate.materialSubtotal)}`,
    `Iscilik / hizmet: ${formatCurrency(estimate.serviceLaborSubtotal)}`,
    `Birim fiyat: ${formatCurrency(estimate.unitTotal)}`,
    `Toplam: ${formatCurrency(estimate.total)}`,
    note.trim() ? `Not: ${note.trim()}` : null,
  ];

  return lines.filter(Boolean).join('\n');
}

function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString('tr-TR')} TL`;
}

function nullableTrim(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getLocalDateString(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parsePositiveAmount(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

const styles = StyleSheet.create({
  formCard: {
    gap: spacing.sm,
  },
  summaryCard: {
    gap: spacing.sm,
  },
  breakdownCard: {
    gap: spacing.sm,
  },
  actionsCard: {
    gap: spacing.sm,
  },
  installments: {
    gap: spacing.xs,
  },
  installmentRow: {
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  installmentInfo: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.textPrimary,
    minHeight: 46,
    paddingHorizontal: spacing.sm,
  },
  noteInput: {
    minHeight: 86,
    paddingTop: spacing.sm,
  },
  totalBox: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
    padding: spacing.md,
  },
  totalLabel: {
    ...typography.caption,
    color: colors.surface,
  },
  totalValue: {
    ...typography.heading,
    color: colors.surface,
    fontSize: 24,
    lineHeight: 30,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  infoLabel: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '700',
    textAlign: 'right',
  },
  error: {
    ...typography.caption,
    color: colors.error,
  },
  success: {
    ...typography.caption,
    color: colors.success,
  },
  helperText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
