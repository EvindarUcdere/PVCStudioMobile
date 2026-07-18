import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '../../../components/ui/AppCard';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { colors, spacing, typography } from '../../../theme';

type MoreOption = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const options: MoreOption[] = [
  { title: 'Firma Bilgileri', icon: 'business-outline' },
  { title: 'Profil Kütüphanesi', icon: 'layers-outline' },
  { title: 'Cam Kütüphanesi', icon: 'grid-outline' },
  { title: 'Uygulama Ayarları', icon: 'settings-outline' },
  { title: 'Hakkında', icon: 'information-circle-outline' },
];

export function MoreScreen() {
  return (
    <AppScreen>
      <AppHeader title="Diğer" subtitle="Uygulama ayarları ve kütüphaneler burada yer alacak." />
      <View style={styles.list}>
        {options.map((option) => (
          <AppCard key={option.title}>
            <View style={styles.optionRow}>
              <Ionicons name={option.icon} size={23} color={colors.primary} />
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionState}>Yakında</Text>
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
