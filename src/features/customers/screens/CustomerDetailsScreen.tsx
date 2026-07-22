import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppCard } from '../../../components/ui/AppCard';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import { routes } from '../../../constants/routes';
import {
  createCustomerRepository,
  createDesignRepository,
} from '../../../database/repositories/createRepositories';
import { Customer } from '../../../domain/customers/entities/Customer';
import { DesignProject } from '../../../domain/designs/entities/DesignProject';
import { jobStatusLabels } from '../../../domain/designs/enums/JobStatus';
import { backupCustomerToCloud } from '../../../services/firebase/fullSyncService';
import { logger } from '../../../services/logger';
import { colors, spacing, typography } from '../../../theme';

export function CustomerDetailsScreen() {
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [designs, setDesigns] = useState<DesignProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const groupedDesigns = groupDesignsByJobName(designs);

  const loadCustomer = useCallback(async () => {
    if (!customerId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const customerRepository = await createCustomerRepository();
      const designRepository = await createDesignRepository();
      const loadedCustomer = await customerRepository.getById(customerId);
      setCustomer(loadedCustomer);
      setDesigns(await designRepository.list({ customerId }));
    } catch (loadError) {
      logger.error('Customer details load failed', loadError);
      setError('Musteri yuklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, [customerId]);

  useFocusEffect(
    useCallback(() => {
      void loadCustomer();
    }, [loadCustomer]),
  );

  async function deleteCustomer() {
    if (!customer) {
      return;
    }

    Alert.alert('Musteriyi sil', 'Bu musteri karti arsivlenecek.', [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          void softDeleteCustomer(customer);
        },
      },
    ]);
  }

  async function softDeleteCustomer(target: Customer) {
    try {
      const repository = await createCustomerRepository();
      const deleted = await repository.softDelete(target.id);
      void backupCustomerToCloud(deleted);
      router.replace(routes.customers);
    } catch (deleteError) {
      logger.error('Customer delete failed', deleteError);
      setError('Musteri silinemedi.');
    }
  }

  if (isLoading) {
    return (
      <AppScreen centered>
        <ActivityIndicator color={colors.primary} />
      </AppScreen>
    );
  }

  if (!customer) {
    return (
      <AppScreen centered>
        <EmptyState
          title="Musteri bulunamadi"
          description={error ?? 'Secilen musteri kaydi bulunamadi.'}
          action={<AppButton label="Musterilere Don" onPress={() => router.replace(routes.customers)} />}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false}>
      <AppHeader
        title={customer.fullName}
        subtitle="Musteri detaylari"
        rightAction={<AppButton label="Geri" variant="ghost" onPress={() => router.back()} />}
      />
      <FlatList
        data={groupedDesigns}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <AppCard style={styles.infoCard}>
              <Info label="Telefon" value={customer.phone ?? 'Yok'} />
              <Info label="Adres" value={customer.address ?? 'Yok'} />
              <Info label="Not" value={customer.notes ?? 'Yok'} />
              <Info label="Guncelleme" value={new Date(customer.updatedAt).toLocaleDateString('tr-TR')} />
            </AppCard>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.actions}>
              <AppButton
                label="Yeni Tasarim"
                onPress={() => router.push(routes.newDesignForCustomer(customer.id))}
                style={styles.actionButton}
              />
              <AppButton
                label="Sil"
                variant="secondary"
                onPress={() => void deleteCustomer()}
                style={styles.actionButton}
              />
            </View>
            <Text style={styles.sectionTitle}>Bagli tasarimlar</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.jobGroup}>
            <Text style={styles.jobGroupTitle}>{item.title}</Text>
            {item.designs.map((design) => (
              <AppCard
                key={design.id}
                onPress={() => router.push(routes.designDetails(design.id))}
                style={styles.designCard}
              >
                <Text style={styles.designTitle}>{design.name}</Text>
                <Text style={styles.caption}>
                  {`${design.width} x ${design.height} mm - ${design.quantity} adet`}
                </Text>
                <Text style={styles.caption}>Durum: {jobStatusLabels[design.jobStatus]}</Text>
                <Text style={styles.caption}>
                  Guncellendi: {new Date(design.updatedAt).toLocaleDateString('tr-TR')}
                </Text>
              </AppCard>
            ))}
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            title="Bagli tasarim yok"
            description="Sonraki adimda tasarim kaydederken musteri secimini buraya baglayacagiz."
          />
        }
      />
    </AppScreen>
  );
}

type DesignJobGroup = {
  key: string;
  title: string;
  designs: DesignProject[];
};

function groupDesignsByJobName(designs: DesignProject[]): DesignJobGroup[] {
  const groups = new Map<string, DesignJobGroup>();

  designs.forEach((design) => {
    const title = design.jobName ?? 'Tekil isler';
    const key = title.toLocaleLowerCase('tr-TR');
    const current = groups.get(key);

    if (current) {
      current.designs.push(design);
      return;
    }

    groups.set(key, { key, title, designs: [design] });
  });

  return Array.from(groups.values());
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  headerContent: {
    gap: spacing.md,
  },
  infoCard: {
    gap: spacing.sm,
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
    flex: 1.4,
    fontWeight: '700',
    textAlign: 'right',
  },
  actions: {
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
  designCard: {
    gap: spacing.xs,
  },
  jobGroup: {
    gap: spacing.sm,
  },
  jobGroupTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
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
  error: {
    ...typography.caption,
    color: colors.error,
  },
});
