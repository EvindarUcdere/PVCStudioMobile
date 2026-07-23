import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppCard } from '../../../components/ui/AppCard';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import { routes } from '../../../constants/routes';
import {
  createCustomerRepository,
  createDesignRepository,
  createJobRepository,
  createStockRepository,
} from '../../../database/repositories/createRepositories';
import { getPricingSettings } from '../../../database/repositories/PricingSettingsRepository';
import { Customer } from '../../../domain/customers/entities/Customer';
import { DesignProject } from '../../../domain/designs/entities/DesignProject';
import { jobStatusLabels } from '../../../domain/designs/enums/JobStatus';
import { calculateDesignPriceEstimate, PriceEstimateRates } from '../../../domain/designs/pricing/calculateDesignPriceEstimate';
import { calculateDesignStockNeeds } from '../../../domain/inventory/calculateDesignStockNeeds';
import { StockItem, stockUnitLabels } from '../../../domain/inventory/entities/StockItem';
import { JobProject } from '../../../domain/jobs/entities/JobProject';
import { logger } from '../../../services/logger';
import { colors, spacing, typography } from '../../../theme';

type MaterialTotal = {
  key: string;
  label: string;
  requiredQuantity: number;
  availableQuantity: number;
  unit: StockItem['unit'];
};

export function JobDetailsScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const [job, setJob] = useState<JobProject | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [designs, setDesigns] = useState<DesignProject[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [rates, setRates] = useState<PriceEstimateRates | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function load() {
        if (!jobId) {
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setError(null);
        try {
          const jobRepository = await createJobRepository();
          const designRepository = await createDesignRepository();
          const stockRepository = await createStockRepository();
          const customerRepository = await createCustomerRepository();
          const loadedJob = await jobRepository.getById(jobId);

          if (!loadedJob) {
            if (isActive) {
              setJob(null);
              setIsLoading(false);
            }
            return;
          }

          const [loadedDesigns, loadedStockItems, loadedRates, loadedCustomer] = await Promise.all([
            designRepository.list({ jobId, limit: 500 }),
            stockRepository.list({ includeInactive: false, limit: 500 }),
            getPricingSettings(),
            loadedJob.customerId ? customerRepository.getById(loadedJob.customerId) : Promise.resolve(null),
          ]);

          if (isActive) {
            setJob(loadedJob);
            setDesigns(loadedDesigns);
            setStockItems(loadedStockItems);
            setRates(loadedRates);
            setCustomer(loadedCustomer);
          }
        } catch (loadError) {
          logger.error('Job details load failed', loadError);
          if (isActive) {
            setError('Is detaylari yuklenemedi.');
          }
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
    }, [jobId]),
  );

  const total = useMemo(
    () => designs.reduce((sum, design) => sum + (rates ? calculateDesignPriceEstimate(design, rates).total : 0), 0),
    [designs, rates],
  );
  const materialTotals = useMemo(
    () => (rates ? calculateJobMaterialTotals(designs, stockItems, rates) : []),
    [designs, rates, stockItems],
  );

  if (isLoading) {
    return (
      <AppScreen centered>
        <ActivityIndicator color={colors.primary} />
      </AppScreen>
    );
  }

  if (!job) {
    return (
      <AppScreen centered>
        <EmptyState
          title="Is bulunamadi"
          description={error ?? 'Secilen is kaydi bulunamadi.'}
          action={<AppButton label="Islere Don" onPress={() => router.replace(routes.jobs)} />}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppHeader title={job.name} subtitle="Coklu tasarim isi" rightAction={<AppButton label="Geri" variant="ghost" onPress={() => router.back()} />} />
      <AppCard style={styles.summaryCard}>
        <Info label="Musteri" value={customer?.fullName ?? 'Musterisiz'} />
        <Info label="Durum" value={jobStatusLabels[job.status]} />
        <Info label="Tasarim sayisi" value={String(designs.length)} />
        <Info label="Toplam tahmini teklif" value={formatCurrency(total)} />
      </AppCard>

      <AppCard style={styles.summaryCard}>
        <Text style={styles.sectionTitle}>Toplu malzeme ihtiyaci</Text>
        {materialTotals.length === 0 ? (
          <Text style={styles.caption}>Bu ise bagli tasarim yok.</Text>
        ) : (
          materialTotals.map((item) => (
            <View key={item.key} style={styles.materialRow}>
              <View style={styles.materialInfo}>
                <Text style={styles.materialTitle}>{item.label}</Text>
                <Text style={styles.caption}>Stok: {formatQuantity(item.availableQuantity, item.unit)}</Text>
              </View>
              <Text style={styles.materialQuantity}>{formatQuantity(item.requiredQuantity, item.unit)}</Text>
            </View>
          ))
        )}
      </AppCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Bagli tasarimlar</Text>
        <AppButton label="Yeni Tasarim" variant="secondary" onPress={() => router.push(routes.newDesign)} style={styles.smallButton} />
      </View>
      {designs.length === 0 ? (
        <EmptyState
          title="Tasarim bagli degil"
          description="Bir tasarimi editor ekranindan bu ise baglayabilirsiniz."
        />
      ) : (
        designs.map((design) => (
          <AppCard key={design.id} onPress={() => router.push(routes.designDetails(design.id))} style={styles.designCard}>
            <Text style={styles.designTitle}>{design.name}</Text>
            <Text style={styles.caption}>
              {design.width} x {design.height} mm - {design.quantity} adet
            </Text>
            <Text style={styles.caption}>{formatCurrency(rates ? calculateDesignPriceEstimate(design, rates).total : 0)}</Text>
          </AppCard>
        ))
      )}
    </AppScreen>
  );
}

function calculateJobMaterialTotals(
  designs: DesignProject[],
  stockItems: StockItem[],
  rates: PriceEstimateRates,
): MaterialTotal[] {
  const totals = new Map<string, MaterialTotal>();

  designs.forEach((design) => {
    calculateDesignStockNeeds(design, stockItems, rates).forEach((need) => {
      const key = `${need.type}:${need.unit}`;
      const existing = totals.get(key);

      if (existing) {
        existing.requiredQuantity += need.requiredQuantity;
        return;
      }

      totals.set(key, {
        key,
        label: need.type === 'pvc_profile' ? 'PVC profil' : need.label,
        requiredQuantity: need.requiredQuantity,
        availableQuantity: need.availableQuantity,
        unit: need.unit,
      });
    });
  });

  return Array.from(totals.values()).map((item) => ({
    ...item,
    requiredQuantity: roundQuantity(item.requiredQuantity),
  }));
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.caption}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString('tr-TR')} TL`;
}

function formatQuantity(value: number, unit: StockItem['unit']): string {
  return `${value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ${stockUnitLabels[unit]}`;
}

function roundQuantity(value: number): number {
  return Math.round(value * 100) / 100;
}

const styles = StyleSheet.create({
  summaryCard: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
  },
  smallButton: {
    minHeight: 38,
    paddingHorizontal: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  infoValue: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'right',
  },
  materialRow: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  materialInfo: {
    flex: 1,
  },
  materialTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  materialQuantity: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'right',
  },
  designCard: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  designTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
