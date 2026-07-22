import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppCard } from '../../../components/ui/AppCard';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import { routes } from '../../../constants/routes';
import { createCustomerRepository } from '../../../database/repositories/createRepositories';
import { Customer } from '../../../domain/customers/entities/Customer';
import { backupCustomerToCloud } from '../../../services/firebase/fullSyncService';
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';

type CustomerForm = {
  fullName: string;
  phone: string;
  address: string;
  notes: string;
};

const emptyForm: CustomerForm = {
  fullName: '',
  phone: '',
  address: '',
  notes: '',
};

export function CustomersScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadCustomers = useCallback(async (query = search) => {
    setIsLoading(true);
    setError(null);
    try {
      const repository = await createCustomerRepository();
      setCustomers(await repository.list({ search: query }));
    } catch (loadError) {
      logger.error('Customer list load failed', loadError);
      setError('Musteriler yuklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useFocusEffect(
    useCallback(() => {
      void loadCustomers();
    }, [loadCustomers]),
  );

  function updateForm(key: keyof CustomerForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
    setMessage(null);
  }

  async function saveCustomer() {
    if (!form.fullName.trim()) {
      setError('Musteri adi zorunlu.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const repository = await createCustomerRepository();
      const saved = await repository.save(form);
      void backupCustomerToCloud(saved);
      setForm(emptyForm);
      setMessage('Musteri kaydedildi.');
      await loadCustomers();
    } catch (saveError) {
      logger.error('Customer save failed', saveError);
      setError('Musteri kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function runSearch(value: string) {
    setSearch(value);
    await loadCustomers(value);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
      <AppScreen scroll={false}>
        <AppHeader title="Musteriler" subtitle="Musteri kartlari ve is gecmisi" />
        <FlatList
          data={customers}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={customers.length === 0 ? styles.emptyList : styles.list}
          ListHeaderComponent={
            <View style={styles.headerContent}>
              <TextInput
                accessibilityLabel="Musteri ara"
                placeholder="Ad, telefon veya adres ara"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                value={search}
                onChangeText={(value) => void runSearch(value)}
              />
              <AppCard style={styles.formCard}>
                <Text style={styles.sectionTitle}>Yeni musteri</Text>
                <TextInput
                  accessibilityLabel="Musteri adi"
                  placeholder="Ad soyad / firma"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                  value={form.fullName}
                  onChangeText={(value) => updateForm('fullName', value)}
                />
                <TextInput
                  accessibilityLabel="Telefon"
                  keyboardType="phone-pad"
                  placeholder="Telefon"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                  value={form.phone}
                  onChangeText={(value) => updateForm('phone', value)}
                />
                <TextInput
                  accessibilityLabel="Adres"
                  placeholder="Adres"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                  value={form.address}
                  onChangeText={(value) => updateForm('address', value)}
                />
                <TextInput
                  accessibilityLabel="Not"
                  multiline
                  placeholder="Not"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, styles.noteInput]}
                  value={form.notes}
                  onChangeText={(value) => updateForm('notes', value)}
                />
                {message ? <Text style={styles.success}>{message}</Text> : null}
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <AppButton
                  label="Musteriyi Kaydet"
                  loading={isSaving}
                  disabled={isSaving}
                  onPress={() => void saveCustomer()}
                />
              </AppCard>
            </View>
          }
          renderItem={({ item }) => (
            <CustomerCard
              customer={item}
              onPress={() => router.push(routes.customerDetails(item.id))}
            />
          )}
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <EmptyState
                title="Musteri kaydi yok"
                description="Ilk musteriyi ekleyerek teklifleri daha duzenli takip edebilirsiniz."
              />
            )
          }
        />
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

function CustomerCard({ customer, onPress }: { customer: Customer; onPress: () => void }) {
  return (
    <AppCard onPress={onPress} style={styles.customerCard}>
      <View style={styles.cardHeader}>
        <View style={styles.titleColumn}>
          <Text style={styles.customerName}>{customer.fullName}</Text>
          <Text style={styles.caption}>{customer.phone ?? 'Telefon yok'}</Text>
        </View>
        <Text style={styles.openLink}>Detay</Text>
      </View>
      {customer.address ? <Text style={styles.address}>{customer.address}</Text> : null}
      <Text style={styles.date}>Guncellendi: {new Date(customer.updatedAt).toLocaleDateString('tr-TR')}</Text>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  headerContent: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  list: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  emptyList: {
    flexGrow: 1,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  center: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  formCard: {
    gap: spacing.sm,
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
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    minHeight: 46,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  noteInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  success: {
    ...typography.caption,
    color: colors.success,
  },
  error: {
    ...typography.caption,
    color: colors.error,
  },
  customerCard: {
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
  customerName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  openLink: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  address: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  date: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
