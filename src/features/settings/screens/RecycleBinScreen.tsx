import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppCard } from '../../../components/ui/AppCard';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import {
  createCustomerRepository,
  createDesignRepository,
} from '../../../database/repositories/createRepositories';
import { Customer } from '../../../domain/customers/entities/Customer';
import { DesignProject } from '../../../domain/designs/entities/DesignProject';
import {
  backupCustomerToCloud,
  backupDesignToCloud,
} from '../../../services/firebase/fullSyncService';
import { logger } from '../../../services/logger';
import { colors, spacing, typography } from '../../../theme';

export function RecycleBinScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [designs, setDesigns] = useState<DesignProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const customerRepository = await createCustomerRepository();
      const designRepository = await createDesignRepository();
      const [allCustomers, allDesigns] = await Promise.all([
        customerRepository.list({ includeDeleted: true, limit: 200 }),
        designRepository.list({ includeDeleted: true, limit: 200 }),
      ]);
      setCustomers(allCustomers.filter((customer) => customer.deletedAt));
      setDesigns(allDesigns.filter((design) => design.deletedAt));
    } catch (loadError) {
      logger.error('Recycle bin load failed', loadError);
      setError('Silinen kayıtlar yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function restoreCustomer(customer: Customer) {
    setRestoringId(customer.id);
    setError(null);
    setMessage(null);
    try {
      const repository = await createCustomerRepository();
      const restored = await repository.restore(customer.id);
      void backupCustomerToCloud(restored);
      setMessage(`${restored.fullName} geri yüklendi.`);
      await load();
    } catch (restoreError) {
      logger.error('Customer restore failed', restoreError);
      setError('Müşteri geri yüklenemedi.');
    } finally {
      setRestoringId(null);
    }
  }

  async function restoreDesign(design: DesignProject) {
    setRestoringId(design.id);
    setError(null);
    setMessage(null);
    try {
      const repository = await createDesignRepository();
      await repository.restore(design.id);
      const restored = await repository.getById(design.id);
      if (restored) {
        void backupDesignToCloud(restored);
      }
      setMessage(`${design.name} geri yüklendi.`);
      await load();
    } catch (restoreError) {
      logger.error('Design restore failed', restoreError);
      setError('Tasarım geri yüklenemedi.');
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <AppScreen>
      <AppHeader title="Geri Dönüşüm" subtitle="Yanlışlıkla silinen kayıtları geri alın." rightAction={<AppButton label="Geri" variant="ghost" onPress={() => router.back()} />} />
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Silinen müşteriler</Text>
        {customers.length === 0 ? <Text style={styles.caption}>Silinen müşteri yok.</Text> : null}
        {customers.map((customer) => (
          <AppCard key={customer.id}>
            <View style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.title}>{customer.fullName}</Text>
                <Text style={styles.caption}>{customer.deletedAt}</Text>
              </View>
              <AppButton
                label="Geri Al"
                variant="secondary"
                loading={restoringId === customer.id}
                disabled={Boolean(restoringId)}
                onPress={() => void restoreCustomer(customer)}
              />
            </View>
          </AppCard>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Silinen tasarımlar</Text>
        {designs.length === 0 ? <Text style={styles.caption}>Silinen tasarım yok.</Text> : null}
        {designs.map((design) => (
          <AppCard key={design.id}>
            <View style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.title}>{design.name}</Text>
                <Text style={styles.caption}>
                  {design.width} x {design.height} mm | {design.deletedAt}
                </Text>
              </View>
              <AppButton
                label="Geri Al"
                variant="secondary"
                loading={restoringId === design.id}
                disabled={Boolean(restoringId)}
                onPress={() => void restoreDesign(design)}
              />
            </View>
          </AppCard>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  info: {
    flex: 1,
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
  success: {
    ...typography.caption,
    color: colors.success,
  },
  error: {
    ...typography.caption,
    color: colors.error,
  },
});
