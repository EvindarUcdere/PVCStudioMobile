import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

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
  createQuoteRepository,
  createStockRepository,
} from '../../../database/repositories/createRepositories';
import { getPricingSettings } from '../../../database/repositories/PricingSettingsRepository';
import { Customer } from '../../../domain/customers/entities/Customer';
import { DesignProject } from '../../../domain/designs/entities/DesignProject';
import { JobStatus, jobStatusLabels } from '../../../domain/designs/enums/JobStatus';
import {
  calculateDesignPriceEstimate,
  PriceEstimateRates,
} from '../../../domain/designs/pricing/calculateDesignPriceEstimate';
import { calculateDesignStockNeeds } from '../../../domain/inventory/calculateDesignStockNeeds';
import { StockItem, stockUnitLabels } from '../../../domain/inventory/entities/StockItem';
import { JobProject } from '../../../domain/jobs/entities/JobProject';
import { backupDesignToCloud, backupJobToCloud } from '../../../services/firebase/fullSyncService';
import { recordActivity } from '../../../services/activityLogService';
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';
import { shareJobProductionPdf, shareProductionPdf } from '../../quotes/services/pdfService';

const workshopStatuses: JobStatus[] = ['approved', 'production', 'installation', 'done'];

type WorkshopJobGroup = {
  id: string;
  title: string;
  job: JobProject | null;
  customer: Customer | null;
  designs: DesignProject[];
};

export function WorkshopScreen() {
  const [designs, setDesigns] = useState<DesignProject[]>([]);
  const [jobs, setJobs] = useState<JobProject[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [rates, setRates] = useState<PriceEstimateRates | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const designRepository = await createDesignRepository();
      const jobRepository = await createJobRepository();
      const quoteRepository = await createQuoteRepository();
      const customerRepository = await createCustomerRepository();
      const stockRepository = await createStockRepository();
      const [loadedDesigns, loadedJobs, loadedQuotes, loadedCustomers, loadedStockItems, loadedRates] = await Promise.all([
        designRepository.list({ limit: 500 }),
        jobRepository.list({ limit: 500 }),
        quoteRepository.list({ limit: 500 }),
        customerRepository.list({ limit: 500 }),
        stockRepository.list({ includeInactive: false, limit: 500 }),
        getPricingSettings(),
      ]);
      const acceptedQuoteDesignIds = new Set(
        loadedQuotes.filter((quote) => quote.status === 'accepted').map((quote) => quote.designId),
      );
      const syncedDesigns = await Promise.all(
        loadedDesigns.map(async (design) => {
          const shouldMoveToApproval =
            acceptedQuoteDesignIds.has(design.id) &&
            !['approved', 'production', 'installation', 'done'].includes(design.jobStatus);

          if (!shouldMoveToApproval) {
            return design;
          }

          const updated = await designRepository.update({ ...design, jobStatus: 'approved' });
          void backupDesignToCloud(updated);

          if (updated.jobId) {
            const updatedJob = await jobRepository.updateStatus(updated.jobId, 'approved');
            void backupJobToCloud(updatedJob);
          }

          return updated;
        }),
      );

      setDesigns(syncedDesigns.filter((design) => workshopStatuses.includes(design.jobStatus)));
      setJobs(loadedJobs);
      setCustomers(loadedCustomers);
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
      done: designs.filter((design) => design.jobStatus === 'done'),
    }),
    [designs],
  );
  const filteredDesigns = useMemo(() => filterWorkshopDesigns(designs, jobs, customers, search), [
    customers,
    designs,
    jobs,
    search,
  ]);
  const jobGroups = useMemo(
    () => buildWorkshopJobGroups(filteredDesigns, jobs, customers),
    [customers, filteredDesigns, jobs],
  );

  async function updateDesignStatus(design: DesignProject, jobStatus: JobStatus) {
    setUpdatingId(design.id);
    setError(null);

    try {
      const repository = await createDesignRepository();
      const jobRepository = await createJobRepository();
      const updated = await repository.update({ ...design, jobStatus });
      void backupDesignToCloud(updated);
      void recordActivity({
        type: 'workshop_status_changed',
        title: `${updated.name} durumu ${jobStatusLabels[jobStatus]} yapildi`,
        description: `${updated.width} x ${updated.height} mm - ${updated.quantity} adet`,
        entityType: 'design',
        entityId: updated.id,
        customerName: updated.jobName,
      });

      if (updated.jobId) {
        const jobDesigns = await repository.list({ jobId: updated.jobId, limit: 500 });
        const nextJobStatus = getNextJobStatus(
          jobDesigns.map((item) => (item.id === updated.id ? updated : item)),
        );
        const updatedJob = await jobRepository.updateStatus(updated.jobId, nextJobStatus);
        void backupJobToCloud(updatedJob);
      }

      await load();
    } catch (statusError) {
      logger.error('Workshop status update failed', statusError);
      setError('Durum guncellenemedi.');
    } finally {
      setUpdatingId(null);
    }
  }

  async function shareProductionForm(design: DesignProject) {
    if (!rates) {
      setError('Fiyat ayarlari yuklenmeden imalat PDF olusturulamaz.');
      return;
    }

    setUpdatingId(design.id);
    setError(null);
    try {
      await shareProductionPdf({
        design,
        estimate: calculateDesignPriceEstimate(design, rates),
        customerName: '',
        customerPhone: '',
        note: design.jobName ?? '',
      });
    } catch (pdfError) {
      logger.error('Workshop production PDF share failed', pdfError);
      setError('Imalat PDF paylasilamadi.');
    } finally {
      setUpdatingId(null);
    }
  }

  async function shareJobProductionForm(group: WorkshopJobGroup) {
    if (!rates || group.designs.length === 0) {
      setError('Toplu imalat PDF icin bu ise bagli tasarim olmali.');
      return;
    }

    setUpdatingId(group.id);
    setError(null);
    try {
      await shareJobProductionPdf({
        jobName: group.title,
        customerName: group.customer?.fullName ?? '',
        customerPhone: group.customer?.phone ?? '',
        designs: group.designs,
        rates,
        stockItems,
      });
    } catch (pdfError) {
      logger.error('Workshop job production PDF share failed', pdfError);
      setError('Toplu imalat PDF paylasilamadi.');
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
      <TextInput
        accessibilityLabel="Atolye ara"
        onChangeText={setSearch}
        placeholder="Musteri, is veya tasarim ara"
        placeholderTextColor={colors.textSecondary}
        style={styles.searchInput}
        value={search}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={jobGroups}
        keyExtractor={(group) => group.id}
        contentContainerStyle={jobGroups.length === 0 ? styles.emptyList : styles.list}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.summaryGrid}>
              <SummaryBox label="Onay" value={grouped.approved.length} />
              <SummaryBox label="Uretim" value={grouped.production.length} />
              <SummaryBox label="Montaj" value={grouped.installation.length} />
              <SummaryBox label="Bitti" value={grouped.done.length} />
            </View>
            <AppButton
              label="Yeni Tasarim"
              variant="secondary"
              onPress={() => router.push(routes.newDesign)}
              style={styles.newDesignButton}
            />
          </View>
        }
        renderItem={({ item }) => (
          <WorkshopJobCard
            group={item}
            stockItems={stockItems}
            rates={rates}
            updatingId={updatingId}
            onOpenJob={() => {
              if (item.job) {
                router.push(routes.jobDetails(item.job.id));
              }
            }}
            onShareJobPdf={() => void shareJobProductionForm(item)}
            onOpenDesign={(design) => router.push(routes.designEditor(design.id))}
            onShareDesignPdf={(design) => void shareProductionForm(design)}
            onProduction={(design) => void updateDesignStatus(design, 'production')}
            onInstallation={(design) => void updateDesignStatus(design, 'installation')}
            onDone={(design) => void updateDesignStatus(design, 'done')}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="Atolyede is yok"
            description="Teklif kabul edilince veya tasarim durumu Onay/Uretim/Montaj/Bitti olunca burada gorunur."
            action={<AppButton label="Yeni Tasarim" onPress={() => router.push(routes.newDesign)} />}
          />
        }
      />
    </AppScreen>
  );
}

function getNextJobStatus(designs: DesignProject[]): JobStatus {
  if (designs.length === 0) {
    return 'draft';
  }

  if (designs.every((design) => design.jobStatus === 'done')) {
    return 'done';
  }

  if (designs.some((design) => design.jobStatus === 'installation')) {
    return 'installation';
  }

  if (designs.some((design) => design.jobStatus === 'production')) {
    return 'production';
  }

  if (designs.some((design) => design.jobStatus === 'approved')) {
    return 'approved';
  }

  if (designs.some((design) => design.jobStatus === 'quoted')) {
    return 'quoted';
  }

  return 'draft';
}
function SummaryBox({ label, value }: { label: string; value: number }) {
  return (
    <AppCard style={styles.summaryBox}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </AppCard>
  );
}

function WorkshopJobCard({
  group,
  stockItems,
  rates,
  updatingId,
  onOpenJob,
  onShareJobPdf,
  onOpenDesign,
  onShareDesignPdf,
  onProduction,
  onInstallation,
  onDone,
}: {
  group: WorkshopJobGroup;
  stockItems: StockItem[];
  rates: PriceEstimateRates | null;
  updatingId: string | null;
  onOpenJob: () => void;
  onShareJobPdf: () => void;
  onOpenDesign: (design: DesignProject) => void;
  onShareDesignPdf: (design: DesignProject) => void;
  onProduction: (design: DesignProject) => void;
  onInstallation: (design: DesignProject) => void;
  onDone: (design: DesignProject) => void;
}) {
  const totalQuantity = group.designs.reduce((sum, design) => sum + design.quantity, 0);
  const missingNeedCount = rates
    ? group.designs.flatMap((design) =>
        calculateDesignStockNeeds(design, stockItems, rates).filter((need) => need.status === 'missing'),
      ).length
    : 0;

  return (
    <AppCard style={styles.jobGroupCard}>
      <View style={styles.cardHeader}>
        <View style={styles.titleColumn}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          <Text style={styles.caption}>
            {group.customer?.fullName ?? 'Musterisiz'} - {group.designs.length} tasarim - {totalQuantity} adet
          </Text>
        </View>
      </View>
      <Info
        label="Toplu stok"
        value={missingNeedCount > 0 ? `${missingNeedCount} eksik kalem` : 'Yeterli gorunuyor'}
      />
      <View style={styles.actions}>
        <AppButton
          label="Is Detayi"
          variant="secondary"
          disabled={!group.job}
          onPress={onOpenJob}
          style={styles.actionButton}
        />
        <AppButton
          label="Toplu PDF"
          disabled={updatingId === group.id}
          loading={updatingId === group.id}
          onPress={onShareJobPdf}
          style={styles.actionButton}
        />
      </View>
      <View style={styles.designList}>
        {group.designs.map((design) => (
          <WorkshopDesignCard
            key={design.id}
            design={design}
            stockItems={stockItems}
            rates={rates}
            isUpdating={updatingId === design.id}
            onOpen={() => onOpenDesign(design)}
            onShareProductionPdf={() => onShareDesignPdf(design)}
            onProduction={() => onProduction(design)}
            onInstallation={() => onInstallation(design)}
            onDone={() => onDone(design)}
          />
        ))}
      </View>
    </AppCard>
  );
}

function WorkshopDesignCard({
  design,
  stockItems,
  rates,
  isUpdating,
  onOpen,
  onShareProductionPdf,
  onProduction,
  onInstallation,
  onDone,
}: {
  design: DesignProject;
  stockItems: StockItem[];
  rates: PriceEstimateRates | null;
  isUpdating: boolean;
  onOpen: () => void;
  onShareProductionPdf: () => void;
  onProduction: () => void;
  onInstallation: () => void;
  onDone: () => void;
}) {
  const needs = rates ? calculateDesignStockNeeds(design, stockItems, rates) : [];
  const missingNeeds = needs.filter((need) => need.status === 'missing');

  return (
    <View style={styles.designSubCard}>
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
          label="Imalat PDF"
          variant="secondary"
          disabled={isUpdating}
          onPress={onShareProductionPdf}
          style={styles.actionButton}
        />
      </View>
      <View style={styles.actions}>
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
    </View>
  );
}

function buildWorkshopJobGroups(
  designs: DesignProject[],
  jobs: JobProject[],
  customers: Customer[],
): WorkshopJobGroup[] {
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const groups = new Map<string, WorkshopJobGroup>();

  designs.forEach((design) => {
    const job = design.jobId ? jobById.get(design.jobId) ?? null : null;
    const customer = job?.customerId ? customerById.get(job.customerId) ?? null : null;
    const groupId = job?.id ?? `single:${design.id}`;
    const existing = groups.get(groupId);

    if (existing) {
      existing.designs.push(design);
      return;
    }

    groups.set(groupId, {
      id: groupId,
      title: job?.name ?? design.jobName ?? design.name,
      job,
      customer,
      designs: [design],
    });
  });

  return Array.from(groups.values()).sort(
    (first, second) => second.designs.length - first.designs.length,
  );
}

function filterWorkshopDesigns(
  designs: DesignProject[],
  jobs: JobProject[],
  customers: Customer[],
  search: string,
): DesignProject[] {
  const query = search.trim().toLocaleLowerCase('tr-TR');
  if (!query) {
    return designs;
  }

  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));

  return designs.filter((design) => {
    const job = design.jobId ? jobById.get(design.jobId) : null;
    const customer = job?.customerId ? customerById.get(job.customerId) : null;
    const haystack = [
      design.name,
      design.jobName,
      job?.name,
      customer?.fullName,
      customer?.phone,
      jobStatusLabels[design.jobStatus],
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('tr-TR');

    return haystack.includes(query);
  });
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

  if (status === 'done') {
    return styles.badgeDone;
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
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  searchInput: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryBox: {
    gap: spacing.xs,
    padding: spacing.sm,
    width: '48%',
  },
  newDesignButton: {
    minHeight: 42,
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
  jobGroupCard: {
    gap: spacing.md,
  },
  designList: {
    gap: spacing.sm,
  },
  designSubCard: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
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
  groupTitle: {
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
  badgeApproved: {
    backgroundColor: colors.primary,
  },
  badgeProduction: {
    backgroundColor: colors.warning,
  },
  badgeInstallation: {
    backgroundColor: colors.success,
  },
  badgeDone: {
    backgroundColor: colors.textSecondary,
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
