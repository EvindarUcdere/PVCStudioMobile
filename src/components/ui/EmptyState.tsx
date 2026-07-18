import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme';

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconPlaceholder} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  iconPlaceholder: {
    backgroundColor: colors.border,
    borderRadius: 20,
    height: 40,
    width: 40,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  action: {
    marginTop: spacing.md,
    width: '100%',
  },
});
