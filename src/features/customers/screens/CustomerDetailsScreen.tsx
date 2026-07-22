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
import { backupCustomerToCloud } from '../../../services/firebase/fullSyncService';
import { logger } from '../../../services/logger';
import { colors, spacing, typography } from '../../../theme';

export function CustomerDetailsScreen() {
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [designs, setDesigns] = useState<DesignProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        data={designs}
        keyExtractor={(item) => item.id}
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
                onPress={() => router.push(routes.newDesign)}
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
          <AppCard onPress={() => router.push(routes.designDetails(item.id))} style={styles.designCard}>
            <Text style={styles.designTitle}>{item.name}</Text>
            <Text style={styles.caption}>{`${item.width} x ${item.height} mm - ${item.quantity} adet`}</Text>
            <Text style={styles.caption}>Guncellendi: {new Date(item.updatedAt).toLocaleDateString('tr-TR')}</Text>
          </AppCard>
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
