import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getPricingSettings } from '../../../database/repositories/PricingSettingsRepository';
import { DesignProject } from '../../../domain/designs/entities/DesignProject';
import {
  calculateDesignPriceEstimate,
  defaultPriceEstimateRates,
  PriceEstimateRates,
} from '../../../domain/designs/pricing/calculateDesignPriceEstimate';
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';

type DesignPriceEstimateCardProps = {
  design: DesignProject;
};

export function DesignPriceEstimateCard({ design }: DesignPriceEstimateCardProps) {
  const [rates, setRates] = useState<PriceEstimateRates>(defaultPriceEstimateRates);
  const estimate = calculateDesignPriceEstimate(design, rates);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadSettings() {
        try {
          const settings = await getPricingSettings();
          if (isActive) {
            setRates(settings);
          }
        } catch (error) {
          logger.error('Pricing settings load failed', error);
        }
      }

      void loadSettings();

      return () => {
        isActive = false;
      };
    }, []),
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Tahmini Teklif</Text>
      <View style={styles.totalBox}>
        <Text style={styles.totalLabel}>Toplam</Text>
        <Text style={styles.totalValue}>{formatCurrency(estimate.total)}</Text>
      </View>
      <Info label="Profil kalitesi" value={estimate.selectedProfileSystem.name} />
      <Info label="Cam tipi" value={estimate.selectedGlassType.name} />
      <Info label="Renk" value={estimate.selectedColor.name} />
      <Info label="Birim tutar" value={formatCurrency(estimate.unitTotal)} />
      <Info label="Adet" value={String(estimate.summary.quantity)} />
      <Info label="Profil" value={`${estimate.profileLengthMeters} m`} />
      <Info label="Cam alani" value={`${estimate.glassAreaSquareMeters} m2`} />
      <Info label="Profil tutari" value={formatCurrency(estimate.profileSubtotal)} />
      <Info label="Cam tutari" value={formatCurrency(estimate.glassSubtotal)} />
      <Info label="Aksam/kayit" value={formatCurrency(estimate.hardwareSubtotal)} />
      {estimate.archSubtotal > 0 ? <Info label="Kemer farki" value={formatCurrency(estimate.archSubtotal)} /> : null}
      <Info label="Renk katsayisi" value={`x${estimate.colorMultiplier}`} />
      <Text style={styles.description}>
        Bu tutar on tahmindir; iskonto, montaj, fire, marka ve kesin profil fiyatlari sonraki fazda netlesecek.
      </Text>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString('tr-TR')} TL`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
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
    fontSize: 22,
    lineHeight: 28,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
  },
  value: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'right',
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
