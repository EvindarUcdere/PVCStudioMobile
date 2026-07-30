import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppCard } from '../../../components/ui/AppCard';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { routes } from '../../../constants/routes';
import { isFirebaseConfigured } from '../../../services/firebase/firebaseConfig';
import {
  backupAllLocalDataToCloud,
  restoreAllCloudDataToLocal,
} from '../../../services/firebase/fullSyncService';
import { colors, spacing, typography } from '../../../theme';

type MoreOption = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  state?: string;
  onPress?: () => void;
};

const options: MoreOption[] = [
  {
    title: 'Teklifler',
    icon: 'document-text-outline',
    state: 'Aç',
    onPress: () => router.push(routes.quotes),
  },
  {
    title: 'Atölye',
    icon: 'construct-outline',
    state: 'Aç',
    onPress: () => router.push(routes.workshop),
  },
  {
    title: 'Gelir / Gider',
    icon: 'cash-outline',
    state: 'Aç',
    onPress: () => router.push(routes.finance),
  },
  {
    title: 'İşler',
    icon: 'briefcase-outline',
    state: 'Aç',
    onPress: () => router.push(routes.jobs),
  },
  {
    title: 'Stok',
    icon: 'cube-outline',
    state: 'Aç',
    onPress: () => router.push(routes.stock),
  },
  {
    title: 'Hareketler',
    icon: 'time-outline',
    state: 'Aç',
    onPress: () => router.push(routes.activity),
  },
  {
    title: 'Geri Dönüşüm',
    icon: 'refresh-circle-outline',
    state: 'Geri al',
    onPress: () => router.push(routes.recycleBin),
  },
  {
    title: 'Fiyat Ayarları',
    icon: 'calculator-outline',
    state: 'Aç',
    onPress: () => router.push(routes.pricingSettings),
  },
  {
    title: 'Firma Bilgileri',
    icon: 'business-outline',
    state: 'Aç',
    onPress: () => router.push(routes.companyProfile),
  },
  {
    title: 'Profil Kütüphanesi',
    icon: 'layers-outline',
    state: 'Düzenle',
    onPress: () => router.push(routes.pricingSettings),
  },
  {
    title: 'Cam Kütüphanesi',
    icon: 'grid-outline',
    state: 'Düzenle',
    onPress: () => router.push(routes.pricingSettings),
  },
  {
    title: 'Uygulama Ayarları',
    icon: 'settings-outline',
    state: 'Açık',
    onPress: () => router.push(routes.appSettings),
  },
  {
    title: 'Hakkında',
    icon: 'information-circle-outline',
    state: 'PVC Studio',
    onPress: () => router.push(routes.about),
  },
];

export function MoreScreen() {
  const firebaseReady = isFirebaseConfigured();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  async function backupAll() {
    if (!firebaseReady) {
      setSyncError('Firebase config girilmedi. Önce .env dosyasını doldurun.');
      setSyncMessage(null);
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setSyncMessage(null);
    try {
      const result = await backupAllLocalDataToCloud();
      if (!result) {
        setSyncError('Bulut yedeği başarısız oldu.');
        return;
      }

      setSyncMessage(
        `${result.customers} müşteri, ${result.jobs} iş, ${result.designs} tasarım, ${result.quotes} teklif, ${result.cashTransactions} kasa kaydı, ${result.stockItems} stok ürünü buluta yedeklendi. Firma kodu: ${result.companyId}`,
      );
    } finally {
      setIsSyncing(false);
    }
  }

  async function restoreAll() {
    if (!firebaseReady) {
      setSyncError('Firebase config girilmedi. Önce .env dosyasını doldurun.');
      setSyncMessage(null);
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setSyncMessage(null);
    try {
      const result = await restoreAllCloudDataToLocal();
      if (!result) {
        setSyncError('Buluttan geri yükleme başarısız oldu.');
        return;
      }

      setSyncMessage(
        `${result.customers} müşteri, ${result.jobs} iş, ${result.designs} tasarım, ${result.quotes} teklif, ${result.cashTransactions} kasa kaydı, ${result.stockItems} stok ürünü bu telefona alındı. Firma kodu: ${result.companyId}`,
      );
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <AppScreen>
      <AppHeader title="Diğer" subtitle="Fiyat, kütüphane, yedekleme ve firma ayarları." />
      <View style={styles.statusCard}>
        <Ionicons
          name={firebaseReady ? 'cloud-done-outline' : 'cloud-offline-outline'}
          size={22}
          color={firebaseReady ? colors.success : colors.textSecondary}
        />
        <View style={styles.statusText}>
          <Text style={styles.statusTitle}>Firebase</Text>
          <Text style={styles.statusCaption}>
            {firebaseReady ? 'Bulut yedekleme hazır' : 'Config girilmedi, lokal mod aktif'}
          </Text>
        </View>
      </View>
      <AppCard style={styles.backupCard}>
        <Text style={styles.backupTitle}>Yedekleme / Kurtarma</Text>
        <Text style={styles.backupCaption}>
          Normal kullanımda veriler internet varken otomatik senkronlanır. Bu butonları telefon
          değişimi, sorun sonrası kurtarma veya elle güvenlik yedeği almak için kullanın.
        </Text>
        <View style={styles.syncActions}>
          <AppButton
            label="Tüm Verileri Buluta Yedekle"
            variant="secondary"
            loading={isSyncing}
            disabled={isSyncing}
            onPress={() => void backupAll()}
            style={styles.syncButton}
          />
          <AppButton
            label="Buluttaki Verileri Bu Telefona Al"
            variant="secondary"
            disabled={isSyncing}
            onPress={() => void restoreAll()}
            style={styles.syncButton}
          />
        </View>
      </AppCard>
      {syncMessage ? <Text style={styles.success}>{syncMessage}</Text> : null}
      {syncError ? <Text style={styles.error}>{syncError}</Text> : null}
      <View style={styles.list}>
        {options.map((option) => (
          <AppCard key={option.title} onPress={option.onPress}>
            <View style={styles.optionRow}>
              <Ionicons name={option.icon} size={23} color={colors.primary} />
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionState}>{option.state ?? 'Aç'}</Text>
            </View>
          </AppCard>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  statusCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  statusText: {
    flex: 1,
  },
  statusTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  statusCaption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  backupCard: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  backupTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  backupCaption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  syncActions: {
    gap: spacing.sm,
  },
  syncButton: {
    flex: 1,
  },
  success: {
    ...typography.caption,
    color: colors.success,
    marginBottom: spacing.sm,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  optionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  optionTitle: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '600',
  },
  optionState: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
