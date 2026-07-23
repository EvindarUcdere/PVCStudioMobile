import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '../../../components/ui/AppCard';
import { createStockRepository } from '../../../database/repositories/createRepositories';
import { getPricingSettings } from '../../../database/repositories/PricingSettingsRepository';
import { DesignProject } from '../../../domain/designs/entities/DesignProject';
import {
  defaultPriceEstimateRates,
  PriceEstimateRates,
} from '../../../domain/designs/pricing/calculateDesignPriceEstimate';
import { calculateDesignStockNeeds, DesignStockNeed } from '../../../domain/inventory/calculateDesignStockNeeds';
import { StockItem, stockUnitLabels } from '../../../domain/inventory/entities/StockItem';
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';

export function DesignStockNeedsCard({ design, rates }: { design: DesignProject; rates?: PriceEstimateRates }) {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [localRates, setLocalRates] = useState<PriceEstimateRates>(rates ?? defaultPriceEstimateRates);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function load() {
        setIsLoading(true);
        try {
          const repository = await createStockRepository();
          const [items, settings] = await Promise.all([
            repository.list({ includeInactive: false, limit: 500 }),
            rates ? Promise.resolve(rates) : getPricingSettings(),
          ]);

          if (isActive) {
            setStockItems(items);
            setLocalRates(settings);
          }
        } catch (error) {
          logger.error('Design stock needs load failed', error);
        } finally {
          if (isActive) {
            setIsLoading(false);
          }
        }
      }

      void load();

      return () => {
        isActive = false;
      };
    }, [rates]),
  );

  const needs = useMemo(
    () => calculateDesignStockNeeds(design, stockItems, rates ?? localRates),
    [design, localRates, rates, stockItems],
  );
  const missingCount = needs.filter((need) => need.status === 'missing').length;

  return (
    <AppCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleColumn}>
          <Text style={styles.title}>Malzeme ihtiyaci</Text>
          <Text style={styles.caption}>Stoktan otomatik dusmez, uretim oncesi kontrol icindir.</Text>
        </View>
        <View style={[styles.badge, missingCount > 0 ? styles.missingBadge : styles.okBadge]}>
          <Text style={styles.badgeText}>{missingCount > 0 ? `${missingCount} eksik` : 'Yeterli'}</Text>
        </View>
      </View>
      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <View style={styles.rows}>
          {needs.map((need) => (
            <NeedRow key={need.id} need={need} />
          ))}
        </View>
      )}
    </AppCard>
  );
}

function NeedRow({ need }: { need: DesignStockNeed }) {
  return (
    <View style={styles.needRow}>
      <View style={styles.needInfo}>
        <Text style={styles.needTitle}>{need.label}</Text>
        <Text style={styles.caption}>{need.detail}</Text>
      </View>
      <View style={styles.quantityColumn}>
        <Text style={styles.quantity}>Gerekli: {formatQuantity(need.requiredQuantity, need.unit)}</Text>
        <Text style={styles.caption}>Stok: {formatQuantity(need.availableQuantity, need.unit)}</Text>
        {need.missingQuantity > 0 ? (
          <Text style={styles.missing}>Eksik: {formatQuantity(need.missingQuantity, need.unit)}</Text>
        ) : null}
      </View>
    </View>
  );
}

function formatQuantity(value: number, unit: DesignStockNeed['unit']): string {
  return `${value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ${stockUnitLabels[unit]}`;
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  titleColumn: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  okBadge: {
    backgroundColor: colors.success,
  },
  missingBadge: {
    backgroundColor: colors.warning,
  },
  badgeText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '700',
  },
  rows: {
    gap: spacing.sm,
  },
  needRow: {
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  needInfo: {
    flex: 1,
    gap: 2,
  },
  needTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  quantityColumn: {
    alignItems: 'flex-end',
    gap: 2,
    maxWidth: '44%',
  },
  quantity: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'right',
  },
  missing: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '700',
    textAlign: 'right',
  },
});
