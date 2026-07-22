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
  createCustomerRepository,
  createDesignRepository,
  createQuoteRepository,
} from '../../../database/repositories/createRepositories';
import { DesignProject } from '../../../domain/designs/entities/DesignProject';
import { createId } from '../../../domain/designs/utils/id';
import {
  calculateDesignPriceEstimate,
  DesignPriceEstimate,
} from '../../../domain/designs/pricing/calculateDesignPriceEstimate';
import { Quote } from '../../../domain/quotes/entities/Quote';
import { backupDesignToCloud, backupQuoteToCloud } from '../../../services/firebase/fullSyncService';
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';
import { shareCustomerQuotePdf, shareProductionPdf } from '../services/pdfService';

export function QuotePreviewScreen() {
  const { designId } = useLocalSearchParams<{ designId: string }>();
  const [design, setDesign] = useState<DesignProject | null>(null);
  const [estimate, setEstimate] = useState<DesignPriceEstimate | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [note, setNote] = useState('');
  const [quoteId, setQuoteId] = useState<string | null>(null);
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

          if (loadedDesign?.customerId) {
            const customerRepository = await createCustomerRepository();
            const customer = await customerRepository.getById(loadedDesign.customerId);
            setCustomerName(customer?.fullName ?? '');
            setCustomerPhone(customer?.phone ?? '');
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

    const repository = await createQuoteRepository();
    const id = quoteId ?? createId();
    const message = buildQuoteMessage({
      design,
      estimate,
      customerName,
      customerPhone,
      note,
    });
    const saved = await repository.save({
      id,
      designId: design.id,
      designName: design.name,
      customerName: nullableTrim(customerName),
      customerPhone: nullableTrim(customerPhone),
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
          onChangeText={setCustomerPhone}
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
        <Info label="Renk katsayisi" value={`x${estimate.colorMultiplier}`} />
      </AppCard>

      {saveMessage ? <Text style={styles.success}>{saveMessage}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actionRow}>
        <AppButton
          label="WhatsApp Gonder"
          variant="secondary"
          disabled={isSharing}
          onPress={() => void sendWhatsAppQuote()}
          style={styles.actionButton}
        />
        <AppButton
          label="SMS Gonder"
          variant="secondary"
          disabled={isSharing}
          onPress={() => void sendSmsQuote()}
          style={styles.actionButton}
        />
      </View>
      <AppButton label="Teklifi Kaydet" loading={isSaving} disabled={isSaving} onPress={() => void saveDraftQuote()} />
      <AppButton label="Teklifi Paylas" loading={isSharing} disabled={isSharing} onPress={() => void shareQuote()} />
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
    </AppScreen>
  );
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
    `Birim fiyat: ${formatCurrency(estimate.unitTotal)}`,
    `Toplam: ${formatCurrency(estimate.total)}`,
    note.trim() ? `Not: ${note.trim()}` : null,
  ];

  return lines.filter(Boolean).join('\n');
}

function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString('tr-TR')} TL`;
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, '');
}

function normalizeTurkishWhatsAppPhone(value: string): string {
  const phone = normalizePhone(value);

  if (phone.startsWith('+')) {
    return phone.slice(1);
  }

  if (phone.startsWith('00')) {
    return phone.slice(2);
  }

  if (phone.startsWith('0') && phone.length === 11) {
    return `90${phone.slice(1)}`;
  }

  if (phone.length === 10) {
    return `90${phone}`;
  }

  return phone;
}

function nullableTrim(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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
});
