import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '../../theme';

type LoadingScreenProps = {
  message?: string;
};

export function LoadingScreen({ message = 'Yükleniyor...' }: LoadingScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.message}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
