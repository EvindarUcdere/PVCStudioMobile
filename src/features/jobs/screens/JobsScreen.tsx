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
  createJobRepository,
} from '../../../database/repositories/createRepositories';
import { Customer } from '../../../domain/customers/entities/Customer';
import { jobStatusLabels } from '../../../domain/designs/enums/JobStatus';
import { createJobProject } from '../../../domain/jobs/factories/createJobProject';
import { JobProject } from '../../../domain/jobs/entities/JobProject';
import { backupJobToCloud } from '../../../services/firebase/fullSyncService';
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';

export function JobsScreen() {
  const [jobs, setJobs] = useState<JobProject[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [name, setName] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const jobRepository = await createJobRepository();
      const customerRepository = await createCustomerRepository();
      const [loadedJobs, loadedCustomers] = await Promise.all([
        jobRepository.list({ limit: 200 }),
        customerRepository.list({ limit: 200 }),
      ]);
      setJobs(loadedJobs);
      setCustomers(loadedCustomers);
    } catch (loadError) {
      logger.error('Jobs screen load failed', loadError);
      setError('Isler yuklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function saveJob() {
    if (!name.trim() || isSaving) {
      setError('Is adi girilmeli.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const repository = await createJobRepository();
      const saved = await repository.save(createJobProject({ name, customerId: selectedCustomerId }));
      void backupJobToCloud(saved);
      setName('');
      setSelectedCustomerId(null);
      await load();
      router.push(routes.jobDetails(saved.id));
    } catch (saveError) {
      logger.error('Job save failed', saveError);
      setError('Is kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppScreen scroll={false}>
      <AppHeader
        title="Isler"
        subtitle="Bir ev, oda veya santiye icin coklu tasarim"
        rightAction={<AppButton label="Geri" variant="ghost" onPress={() => router.back()} />}
      />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(job) => job.id}
          contentContainerStyle={jobs.length === 0 ? styles.emptyList : styles.list}
          ListHeaderComponent={
            <AppCard style={styles.formCard}>
              <Text style={styles.sectionTitle}>Yeni is</Text>
              <TextInput
                accessibilityLabel="Is adi"
                onChangeText={setName}
                placeholder="Orn: Ahmet Bey daire pencereleri"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                value={name}
              />
              {customers.length > 0 ? (
                <View style={styles.chips}>
                  <Chip
                    label="Musterisiz"
                    selected={selectedCustomerId === null}
                    onPress={() => setSelectedCustomerId(null)}
                  />
                  {customers.slice(0, 8).map((customer) => (
                    <Chip
                      key={customer.id}
                      label={customer.fullName}
                      selected={selectedCustomerId === customer.id}
                      onPress={() => setSelectedCustomerId(customer.id)}
                    />
                  ))}
                </View>
              ) : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <AppButton label="Is Olustur" loading={isSaving} disabled={isSaving} onPress={() => void saveJob()} />
            </AppCard>
          }
          renderItem={({ item }) => (
            <AppCard onPress={() => router.push(routes.jobDetails(item.id))} style={styles.jobCard}>
              <Text style={styles.jobTitle}>{item.name}</Text>
              <Text style={styles.caption}>
                {customerById.get(item.customerId ?? '')?.fullName ?? 'Musterisiz'} - {jobStatusLabels[item.status]}
              </Text>
            </AppCard>
          )}
          ListEmptyComponent={
            <EmptyState
              title="Is yok"
              description="Bir ev veya oda icin once is olusturun, sonra tasarimlari bu ise baglayin."
            />
          }
        />
      )}
    </AppScreen>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <AppButton
      label={label}
      variant={selected ? 'primary' : 'secondary'}
      onPress={onPress}
      style={styles.chipButton}
    />
  );
}

const styles = StyleSheet.create({
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
    gap: spacing.md,
    justifyContent: 'center',
  },
  formCard: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chipButton: {
    minHeight: 38,
    paddingHorizontal: spacing.sm,
  },
  jobCard: {
    gap: spacing.xs,
  },
  jobTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  error: {
    ...typography.caption,
    color: colors.error,
  },
});
