import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '../../../components/ui/AppCard';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { routes } from '../../../constants/routes';
import { colors, spacing, typography } from '../../../theme';

type MoreOption = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  state?: string;
  onPress?: () => void;
};

const options: MoreOption[] = [
  {
    title: 'Fiyat Ayarlari',
    icon: 'calculator-outline',
    state: 'Ac',
    onPress: () => router.push(routes.pricingSettings),
  },
  { title: 'Firma Bilgileri', icon: 'business-outline' },
  { title: 'Profil Kutuphanesi', icon: 'layers-outline' },
  { title: 'Cam Kutuphanesi', icon: 'grid-outline' },
  { title: 'Uygulama Ayarlari', icon: 'settings-outline' },
  { title: 'Hakkinda', icon: 'information-circle-outline' },
];

export function MoreScreen() {
  return (
    <AppScreen>
      <AppHeader title="Diger" subtitle="Uygulama ayarlari ve kutuphaneler burada yer alacak." />
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
