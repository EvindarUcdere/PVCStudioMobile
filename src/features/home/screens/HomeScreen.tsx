import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppCard } from '../../../components/ui/AppCard';
import { AppScreen } from '../../../components/ui/AppScreen';
import { APP_NAME } from '../../../constants/app';
import { routes } from '../../../constants/routes';
import {
  createDesignRepository,
  createJobRepository,
  createPaymentRepository,
  createQuoteRepository,
  createStockRepository,
} from '../../../database/repositories/createRepositories';
import { colors, spacing, typography } from '../../../theme';
import { logger } from '../../../services/logger';

type QuickAction = {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

type HomeStats = {
  openJobs: number;
  pendingQuotes: number;
  duePayments: number;
  workshopDesigns: number;
  lowStockItems: number;
};

const quickActions: QuickAction[] = [
  {
    title: 'İşler',
    description: 'Müşteri bazlı pencere ve kapıları yönetin',
    icon: 'briefcase-outline',
    onPress: () => router.push(routes.jobs),
  },
  {
    title: 'Tasarımlar',
    description: 'Kayıtlı çalışmalarınızı görüntüleyin',
    icon: 'albums-outline',
    onPress: () => router.push(routes.designs),
  },
  {
    title: 'Müşteriler',
    description: 'Müşteri listenizi yönetin',
    icon: 'people-outline',
    onPress: () => router.push(routes.customers),
  },
  {
    title: 'Teklifler',
    description: 'Kayıtlı teklifleri takip edin',
    icon: 'document-text-outline',
    onPress: () => router.push(routes.quotes),
  },
  {
    title: 'Atölye',
    description: 'Üretim ve montaj işlerini görün',
    icon: 'construct-outline',
    onPress: () => router.push(routes.workshop),
  },
];

const initialStats: HomeStats = {
  openJobs: 0,
  pendingQuotes: 0,
  duePayments: 0,
  workshopDesigns: 0,
  lowStockItems: 0,
};

export function HomeScreen() {
  const [stats, setStats] = useState<HomeStats>(initialStats);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setIsLoadingStats(true);
    setStatsError(null);

    try {
      const jobRepository = await createJobRepository();
      const quoteRepository = await createQuoteRepository();
      const stockRepository = await createStockRepository();
      const paymentRepository = await createPaymentRepository();
      const designRepository = await createDesignRepository();
      const [jobs, quotes, lowStockItems, dueInstallments, designs] = await Promise.all([
        jobRepository.list({ limit: 500 }),
        quoteRepository.list({ limit: 500 }),
        stockRepository.list({ includeInactive: false, lowStockOnly: true, limit: 500 }),
        paymentRepository.listInstallments({ status: 'pending', dueTo: getLocalDateString(), limit: 500 }),
        designRepository.list({ limit: 500 }),
      ]);

      const designById = new Map(designs.map((design) => [design.id, design]));
      const workshopStatuses = ['approved', 'production', 'installation'];

      setStats({
        openJobs: jobs.filter((job) => job.status !== 'done' && job.status !== 'canceled').length,
        pendingQuotes: quotes.filter((quote) => {
          const design = designById.get(quote.designId);
          const isStillBeforeWorkshop = !design || design.jobStatus === 'draft' || design.jobStatus === 'quoted';
          return (quote.status === 'draft' || quote.status === 'sent') && isStillBeforeWorkshop;
        }).length,
        duePayments: dueInstallments.length,
        workshopDesigns: designs.filter((design) => workshopStatuses.includes(design.jobStatus)).length,
        lowStockItems: lowStockItems.length,
      });
    } catch (error) {
      logger.error('Home stats load failed', error);
      setStatsError('Özet bilgileri yüklenemedi.');
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadStats();
    }, [loadStats]),
  );

  return (
    <AppScreen>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="cube-outline" size={24} color={colors.primary} />
        </View>
        <Text style={styles.title}>{APP_NAME}</Text>
        <Text style={styles.subtitle}>İş, tasarım, teklif ve üretimi tek yerden takip edin.</Text>

        <View style={styles.heroActions}>
          <AppButton label="+ Yeni İş" onPress={() => router.push(routes.jobs)} style={styles.heroButton} />
          <AppButton
            label="+ Yeni Tasarım"
            onPress={() => router.push(routes.newDesign)}
            variant="secondary"
            style={styles.heroButton}
          />
        </View>
      </View>

      <AppCard style={styles.summaryCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Bugünkü durum</Text>
          {isLoadingStats ? <ActivityIndicator color={colors.primary} size="small" /> : null}
        </View>
        {statsError ? <Text style={styles.errorText}>{statsError}</Text> : null}
        <View style={styles.summaryGrid}>
          <SummaryItem
            label="Açık iş"
            value={stats.openJobs}
            icon="briefcase-outline"
            onPress={() => router.push(routes.jobs)}
          />
          <SummaryItem
            label="Teklif bekliyor"
            value={stats.pendingQuotes}
            icon="document-text-outline"
            onPress={() => router.push(routes.quotes)}
          />
          <SummaryItem
            label="Ödeme bekliyor"
            value={stats.duePayments}
            icon="cash-outline"
            warning
            onPress={() => router.push(routes.finance)}
          />
          <SummaryItem
            label="Atölyede"
            value={stats.workshopDesigns}
            icon="construct-outline"
            onPress={() => router.push(routes.workshop)}
          />
          <SummaryItem
            label="Düşük stok"
            value={stats.lowStockItems}
            icon="alert-circle-outline"
            warning
            onPress={() => router.push(routes.stock)}
          />
        </View>
      </AppCard>

      <View style={styles.quickGrid}>
        {quickActions.map((item) => (
          <AppCard key={item.title} onPress={item.onPress} style={styles.quickCard}>
            <View style={styles.quickHeader}>
              <Ionicons name={item.icon} size={24} color={colors.primary} />
            </View>
            <Text style={styles.quickTitle}>{item.title}</Text>
            <Text style={styles.quickDescription}>{item.description}</Text>
          </AppCard>
        ))}
      </View>

      <AppCard style={styles.flowCard}>
        <Text style={styles.sectionTitle}>Hızlı akış</Text>
        <View style={styles.flowRow}>
          <View style={styles.flowStep}>
            <Ionicons name="person-add-outline" size={20} color={colors.primary} />
            <Text style={styles.flowText}>Müşteri ve iş aç</Text>
          </View>
          <View style={styles.flowLine} />
          <View style={styles.flowStep}>
            <Ionicons name="grid-outline" size={20} color={colors.primary} />
            <Text style={styles.flowText}>Tasarımları ekle</Text>
          </View>
          <View style={styles.flowLine} />
          <View style={styles.flowStep}>
            <Ionicons name="checkmark-done-outline" size={20} color={colors.primary} />
            <Text style={styles.flowText}>Teklif ve atölye</Text>
          </View>
        </View>
      </AppCard>
    </AppScreen>
  );
}

function getLocalDateString(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function SummaryItem({
  label,
  value,
  icon,
  onPress,
  warning = false,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  warning?: boolean;
}) {
  return (
    <AppCard onPress={onPress} style={styles.summaryItem}>
      <View style={[styles.summaryIcon, warning && value > 0 ? styles.summaryIconWarning : null]}>
        <Ionicons name={icon} size={18} color={warning && value > 0 ? colors.warning : colors.primary} />
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#E7F1EE',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginBottom: spacing.md,
    width: 36,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  heroActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  heroButton: {
    flex: 1,
  },
  summaryCard: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryItem: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 94,
    padding: spacing.sm,
    width: '48%',
  },
  summaryIcon: {
    alignItems: 'center',
    backgroundColor: '#E7F1EE',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    width: 28,
  },
  summaryIconWarning: {
    backgroundColor: '#FFF4E1',
  },
  summaryValue: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  quickCard: {
    minHeight: 124,
    width: '47%',
  },
  quickHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  quickTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  quickDescription: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  flowCard: {
    marginBottom: spacing.lg,
  },
  flowRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  flowStep: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  flowLine: {
    backgroundColor: colors.border,
    height: 1,
    marginTop: 10,
    width: spacing.lg,
  },
  flowText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
