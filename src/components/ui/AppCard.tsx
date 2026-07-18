import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { ReactNode } from 'react';

import { colors, radius, spacing } from '../../theme';

type AppCardProps = {
  children: ReactNode;
  onPress?: (() => void) | undefined;
  style?: ViewStyle;
};

export function AppCard({ children, onPress, style }: AppCardProps) {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed ? styles.pressed : null, style]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.88,
  },
});
