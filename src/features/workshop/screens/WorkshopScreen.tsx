import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppCard } from '../../../components/ui/AppCard';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import { routes } from '../../../constants/routes';
import {
  createDesignRepository,
  createStockRepository,
} from '../../../database/repositories/createRepositories';
import { getPricingSettings } from '../../../database/repositories/PricingSettingsRepository';
import { DesignProject } from '../../../domain/designs/entities/DesignProject';
import { JobStatus, jobStatusLabels } from '../../../domain/designs/enums/JobStatus';
import { PriceEstimateRates } from '../../../domain/designs/pricing/calculateDesignPriceEstimate';
import { calculateDesignStockNeeds } from '../../../domain/inventory/calculateDesignStockNeeds';
import { StockItem, stockUnitLabels } from '../../../domain/inventory/entities/StockItem';
import { backupDesignToCloud } from '../../../services/firebase/fullSyncService';
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';

const workshopStatuses: JobStatus[] = ['approved', 'production', 'installation'];

export function WorkshopScreen() {
  const [designs, setDesigns] = useState<DesignProject[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [rates, setRates] = useState<PriceEstimateRates | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const designRepository = await createDesignRepository();
      const stockRepository = await createStockRepository();
      const [loadedDesigns, loadedStockItems, loadedRates] = await Promise.all([
        designRepository.list({ limit: 500 }),
        stockRepository.list({ includeInactive: false, limit: 500 }),
        getPricingSettings(),
      ]);

      setDesigns(loadedDesigns.filter((design) => workshopStatuses.includes(design.jobStatus)));
      setStockItems(loadedStockItems);
      setRates(loadedRates);
    } catch (loadError) {
      logger.error('Workshop screen load failed', loadError);
      setError('Atolye listesi yuklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const grouped = useMemo(
    () => ({
      approved: designs.filter((design) => design.jobStatus === 'approved'),
      production: designs.filter((design) => design.jobStatus === 'production'),
      installation: designs.filter((design) => design.jobStatus === 'installation'),
    }),
    [designs],
  );

  async function updateDesignStatus(design: DesignProject, jobStatus: JobStatus) {
    setUpdatingId(design.id);
    setError(null);

    try {
      const repository = await createDesignRepository();
      const updated = await repository.update({ ...design, jobStatus });
      void backupDesignToCloud(updated);
      await load();
    } catch (statusError) {
      logger.error('Workshop status update failed', statusError);
      setError('Durum guncellenemedi.');
    } finally {
      setUpdatingId(null);
    }
  }

  if (isLoading) {
    return (
      <AppScreen centered>
        <ActivityIndicator color={colors.primary} />
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false}>
      <AppHeader
        title="Atolye"
        subtitle="Onaylanan, uretimdeki ve montajdaki isler"
        rightAction={<AppButton label="Geri" variant="ghost" onPress={() => router.back()} />}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={designs}
        keyExtractor={(design) => design.id}
        contentContainerStyle={designs.length === 0 ? styles.emptyList : styles.list}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.summaryGrid}>
              <SummaryBox label="Onay" value={grouped.approved.length} />
              <SummaryBox label="Uretim" value={grouped.production.length} />
              <SummaryBox label="Montaj" value={grouped.installation.length} />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <WorkshopCard
            design={item}
            stockItems={stockItems}
            rates={rates}
            isUpdating={updatingId === item.id}
            onOpen={() => router.push(routes.designEditor(item.id))}
            onProduction={() => void updateDesignStatus(item, 'production')}
            onInstallation={() => void updateDesignStatus(item, 'installation')}
            onDone={() => void updateDesignStatus(item, 'done')}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="Atolyede is yok"
            description="Teklif kabul edilince veya tasarim durumu Onay/Uretim/Montaj yapilinca burada gorunur."
            action={<AppButton label="Tekliflere Git" onPress={() => router.push(routes.quotes)} />}
          />
        }
      />
    </AppScreen>
  );
}

function SummaryBox({ label, value }: { label: string; value: number }) {
  return (
    <AppCard style={styles.summaryBox}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </AppCard>
  );
}

function WorkshopCard({
  design,
  stockItems,
  rates,
  isUpdating,
  onOpen,
  onProduction,
  onInstallation,
  onDone,
}: {
  design: DesignProject;
  stockItems: StockItem[];
  rates: PriceEstimateRates | null;
  isUpdating: boolean;
  onOpen: () => void;
  onProduction: () => void;
  onInstallation: () => void;
  onDone: () => void;
}) {
  const needs = rates ? calculateDesignStockNeeds(design, stockItems, rates) : [];
  const missingNeeds = needs.filter((need) => need.status === 'missing');

  return (
    <AppCard style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.titleColumn}>
          <Text style={styles.title}>{design.name}</Text>
          <Text style={styles.caption}>
            {design.width} x {design.height} mm - {design.quantity} adet
          </Text>
        </View>
        <View style={[styles.badge, getStatusStyle(design.jobStatus)]}>
          <Text style={styles.badgeText}>{jobStatusLabels[design.jobStatus]}</Text>
        </View>
      </View>
      <Info label="Musteri/Is" value={design.jobName ?? 'Belirtilmedi'} />
      <Info
        label="Stok"
        value={missingNeeds.length > 0 ? `${missingNeeds.length} eksik kalem` : 'Yeterli gorunuyor'}
      />
      {needs.slice(0, 4).map((need) => (
        <View key={need.id} style={styles.needRow}>
          <Text style={styles.needLabel}>{need.label}</Text>
          <Text style={styles.needValue}>
            {need.requiredQuantity.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}{' '}
            {stockUnitLabels[need.unit]}
          </Text>
        </View>
      ))}
      <View style={styles.actions}>
        <AppButton label="Tasarim" variant="secondary" onPress={onOpen} style={styles.actionButton} />
        <AppButton
          label="Uretime Al"
          disabled={isUpdating || design.jobStatus === 'production'}
          loading={isUpdating}
          onPress={onProduction}
          style={styles.actionButton}
        />
      </View>
      <View style={styles.actions}>
        <AppButton
          label="Montaja Al"
          variant="secondary"
          disabled={isUpdating || design.jobStatus === 'installation'}
          onPress={onInstallation}
          style={styles.actionButton}
        />
        <AppButton
          label="Bitti"
          variant="secondary"
          disabled={isUpdating}
          onPress={onDone}
          style={styles.actionButton}
        />
      </View>
    </AppCard>
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

function getStatusStyle(status: JobStatus) {
  if (status === 'production') {
    return styles.badgeProduction;
  }

  if (status === 'installation') {
    return styles.badgeInstallation;
  }

  return styles.badgeApproved;
}

const styles = StyleSheet.create({
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  list: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  headerContent: {
    marginBottom: spacing.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryBox: {
    flex: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.heading,
    color: colors.textPrimary,
    fontSize: 22,
    lineHeight: 28,
  },
  card: {
    gap: spacing.sm,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  titleColumn: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
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
  badgeApproved: {
    backgroundColor: colors.primary,
  },
  badgeProduction: {
    backgroundColor: colors.warning,
  },
  badgeInstallation: {
    backgroundColor: colors.success,
  },
  badgeText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '700',
    textAlign: 'right',
  },
  needRow: {
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  needLabel: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '700',
  },
  needValue: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    minHeight: 42,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.sm,
  },
});
