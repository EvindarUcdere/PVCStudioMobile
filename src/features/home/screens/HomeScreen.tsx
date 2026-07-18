import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppCard } from '../../../components/ui/AppCard';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import { APP_NAME } from '../../../constants/app';
import { routes } from '../../../constants/routes';
import { colors, spacing, typography } from '../../../theme';

type QuickAction = {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  soon?: boolean;
};

const quickActions: QuickAction[] = [
  {
    title: 'Tasarımlar',
    description: 'Kayıtlı çalışmaları görüntüleyin',
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
    description: 'Yakında',
    icon: 'document-text-outline',
    soon: true,
  },
  {
    title: 'Atölye',
    description: 'Yakında',
    icon: 'construct-outline',
    soon: true,
  },
];

export function HomeScreen() {
  return (
    <AppScreen>
      <AppHeader title={APP_NAME} subtitle="PVC tasarımlarınızı kolayca oluşturun" />

      <AppButton
        label="+ Yeni Tasarım"
        onPress={() => router.push(routes.newDesign)}
        style={styles.primaryAction}
      />

      <View style={styles.quickGrid}>
        {quickActions.map((item) => (
          <AppCard key={item.title} onPress={item.onPress} style={styles.quickCard}>
            <View style={styles.quickHeader}>
              <Ionicons name={item.icon} size={24} color={colors.primary} />
              {item.soon ? <Text style={styles.soonBadge}>Yakında</Text> : null}
            </View>
            <Text style={styles.quickTitle}>{item.title}</Text>
            <Text style={styles.quickDescription}>{item.description}</Text>
          </AppCard>
        ))}
      </View>

      <AppCard style={styles.emptyCard}>
        <EmptyState
          title="Henüz kayıtlı tasarım bulunmuyor."
          description="İlk PVC tasarımınızı oluşturarak başlayın."
          action={<AppButton label="Yeni Tasarım" onPress={() => router.push(routes.newDesign)} />}
        />
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  primaryAction: {
    marginBottom: spacing.lg,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  quickCard: {
    minHeight: 132,
    width: '47%',
  },
  quickHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  soonBadge: {
    ...typography.caption,
    color: colors.warning,
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
  emptyCard: {
    marginBottom: spacing.lg,
  },
});
