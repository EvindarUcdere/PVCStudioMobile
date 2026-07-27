import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppCard } from '../../../components/ui/AppCard';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { routes } from '../../../constants/routes';
import { isFirebaseConfigured } from '../../../services/firebase/firebaseConfig';
import { colors, radius, spacing, typography } from '../../../theme';

type SettingsShortcut = {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

const shortcuts: SettingsShortcut[] = [
  {
    title: 'Firma ve ortak kullanim',
    description: 'Firma kodu, patron-cirak kullanimi, e-posta girisi ve bulut senkron ayarlari.',
    icon: 'business-outline',
    onPress: () => router.push(routes.companyProfile),
  },
  {
    title: 'Fiyat ve kutuphaneler',
    description: 'Profil kalitesi, cam tipleri, renk katsayilari ve iscilik/hizmet bedeli.',
    icon: 'calculator-outline',
    onPress: () => router.push(routes.pricingSettings),
  },
  {
    title: 'Hareket kayitlari',
    description: 'Is, teklif, odeme ve atolye hareketlerinin sistem kaydi.',
    icon: 'time-outline',
    onPress: () => router.push(routes.activity),
  },
];

export function AppSettingsScreen() {
  const firebaseReady = isFirebaseConfigured();

  return (
    <AppScreen>
      <AppHeader
        title="Uygulama Ayarlari"
        subtitle="Firma, senkron ve temel uygulama tercihleri."
        rightAction={<AppButton label="Geri" variant="ghost" onPress={() => router.back()} />}
      />
      <View style={styles.statusCard}>
        <Ionicons
          name={firebaseReady ? 'cloud-done-outline' : 'cloud-offline-outline'}
          size={24}
          color={firebaseReady ? colors.success : colors.textSecondary}
        />
        <View style={styles.statusText}>
          <Text style={styles.statusTitle}>Bulut durumu</Text>
          <Text style={styles.statusCaption}>
            {firebaseReady
              ? 'Firebase config hazir. Ortak kullanim ve yedekleme kullanilabilir.'
              : 'Firebase config eksik. Uygulama bu cihazda lokal modda calisir.'}
          </Text>
        </View>
      </View>
      <View style={styles.list}>
        {shortcuts.map((shortcut) => (
          <AppCard key={shortcut.title} onPress={shortcut.onPress}>
            <View style={styles.row}>
              <Ionicons name={shortcut.icon} size={24} color={colors.primary} />
              <View style={styles.textColumn}>
                <Text style={styles.title}>{shortcut.title}</Text>
                <Text style={styles.description}>{shortcut.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </View>
          </AppCard>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  statusText: {
    flex: 1,
    gap: spacing.xs,
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
  list: {
    gap: spacing.sm,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  textColumn: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
