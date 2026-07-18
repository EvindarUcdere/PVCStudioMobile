import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme';

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  rightAction?: ReactNode;
};

export function AppHeader({ title, subtitle, rightAction }: AppHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.textGroup}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightAction ? <View>{rightAction}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  textGroup: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
