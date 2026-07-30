import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppCard } from '../../../components/ui/AppCard';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { colors, spacing, typography } from '../../../theme';

const appVersion = '0.1.0';

export function AboutScreen() {
  return (
    <AppScreen>
      <AppHeader
        title="Hakkında"
        subtitle="PVC Studio Mobile"
        rightAction={<AppButton label="Geri" variant="ghost" onPress={() => router.back()} />}
      />
      <AppCard style={styles.heroCard}>
        <View style={styles.logoCircle}>
          <Ionicons name="grid-outline" size={30} color={colors.surface} />
        </View>
        <Text style={styles.appName}>PVC Studio</Text>
        <Text style={styles.caption}>PVC işleri için tasarım, teklif, atölye, stok ve ödeme takibi.</Text>
      </AppCard>
      <View style={styles.list}>
        <Info label="Sürüm" value={appVersion} />
        <Info label="Platform" value="React Native + Expo" />
        <Info label="Yerel veri" value="Expo SQLite" />
        <Info label="Bulut senkron" value="Firebase" />
        <Info label="PDF" value="Expo Print / Sharing" />
      </View>
      <Text style={styles.note}>
        Bu uygulama PVC ustalarının müşteri, tasarım, teklif, üretim ve stok akışlarını tek yerden takip etmesi
        için hazırlanıyor.
      </Text>
    </AppScreen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <AppCard>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  logoCircle: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  appName: {
    ...typography.heading,
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 30,
  },
  caption: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  list: {
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  infoLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  infoValue: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '700',
    textAlign: 'right',
  },
  note: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});
