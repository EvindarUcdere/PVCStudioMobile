import { StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, typography } from '../../../theme';

type TemplateSearchBarProps = {
  value: string;
  onChangeText: (value: string) => void;
};

export function TemplateSearchBar({ value, onChangeText }: TemplateSearchBarProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
      <TextInput
        accessibilityLabel="Model ara"
        placeholder="Model ara"
        placeholderTextColor={colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    paddingVertical: spacing.sm,
  },
});
