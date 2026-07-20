import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppCard } from '../../../components/ui/AppCard';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import { routes } from '../../../constants/routes';
import { getPricingSettings } from '../../../database/repositories/PricingSettingsRepository';
import { createDesignRepository } from '../../../database/repositories/createRepositories';
import { DesignProject } from '../../../domain/designs/entities/DesignProject';
import {
  calculateDesignPriceEstimate,
  DesignPriceEstimate,
} from '../../../domain/designs/pricing/calculateDesignPriceEstimate';
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';

export function QuotePreviewScreen() {
  const { designId } = useLocalSearchParams<{ designId: string }>();
  const [design, setDesign] = useState<DesignProject | null>(null);
  const [estimate, setEstimate] = useState<DesignPriceEstimate | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
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

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AppButton label="Teklifi Paylas" loading={isSharing} disabled={isSharing} onPress={() => void shareQuote()} />
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
});
