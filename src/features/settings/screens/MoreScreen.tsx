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
    state: 'Ac',
    onPress: () => router.push(routes.quotes),
  },
  {
    title: 'Fiyat Ayarlari',
    icon: 'calculator-outline',
    state: 'Ac',
    onPress: () => router.push(routes.pricingSettings),
  },
  {
    title: 'Firma Bilgileri',
    icon: 'business-outline',
    state: 'Ac',
    onPress: () => router.push(routes.companyProfile),
  },
  { title: 'Profil Kutuphanesi', icon: 'layers-outline' },
  { title: 'Cam Kutuphanesi', icon: 'grid-outline' },
  { title: 'Uygulama Ayarlari', icon: 'settings-outline' },
  { title: 'Hakkinda', icon: 'information-circle-outline' },
];

export function MoreScreen() {
  const firebaseReady = isFirebaseConfigured();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  async function backupAll() {
    if (!firebaseReady) {
      setSyncError('Firebase config girilmedi. Once .env dosyasini doldurun.');
      setSyncMessage(null);
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setSyncMessage(null);
    try {
      const result = await backupAllLocalDataToCloud();
      if (!result) {
        setSyncError('Bulut yedegi basarisiz oldu.');
        return;
      }

      setSyncMessage(
        `${result.designs} tasarim, ${result.quotes} teklif buluta yedeklendi. Firebase ID: ${result.userId}`,
      );
    } finally {
      setIsSyncing(false);
    }
  }

  async function restoreAll() {
    if (!firebaseReady) {
      setSyncError('Firebase config girilmedi. Once .env dosyasini doldurun.');
      setSyncMessage(null);
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setSyncMessage(null);
    try {
      const result = await restoreAllCloudDataToLocal();
      if (!result) {
        setSyncError('Buluttan geri yukleme basarisiz oldu.');
        return;
      }

      setSyncMessage(
        `${result.designs} tasarim, ${result.quotes} teklif cihaza alindi. Firebase ID: ${result.userId}`,
      );
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <AppScreen>
      <AppHeader title="Diger" subtitle="Uygulama ayarlari ve kutuphaneler burada yer alacak." />
      <View style={styles.statusCard}>
        <Ionicons
          name={firebaseReady ? 'cloud-done-outline' : 'cloud-offline-outline'}
          size={22}
          color={firebaseReady ? colors.success : colors.textSecondary}
        />
        <View style={styles.statusText}>
          <Text style={styles.statusTitle}>Firebase</Text>
          <Text style={styles.statusCaption}>
            {firebaseReady ? 'Bulut yedekleme hazir' : 'Config girilmedi, lokal mod aktif'}
          </Text>
        </View>
      </View>
      <View style={styles.syncActions}>
        <AppButton
          label="Tam Bulut Yedegi"
          variant="secondary"
          loading={isSyncing}
          disabled={isSyncing}
          onPress={() => void backupAll()}
          style={styles.syncButton}
        />
        <AppButton
          label="Buluttan Geri Yukle"
          variant="secondary"
          disabled={isSyncing}
          onPress={() => void restoreAll()}
          style={styles.syncButton}
        />
      </View>
      {syncMessage ? <Text style={styles.success}>{syncMessage}</Text> : null}
      {syncError ? <Text style={styles.error}>{syncError}</Text> : null}
      <View style={styles.list}>
        {options.map((option) => (
          <AppCard key={option.title} onPress={option.onPress}>
            <View style={styles.optionRow}>
              <Ionicons name={option.icon} size={23} color={colors.primary} />
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionState}>{option.state ?? 'Yakinda'}</Text>
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
  syncActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
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
