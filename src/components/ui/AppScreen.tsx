import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '../../theme';

type AppScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  centered?: boolean;
  contentStyle?: ViewStyle;
};

export function AppScreen({
  children,
  scroll = true,
  centered = false,
  contentStyle,
}: AppScreenProps) {
  const content = (
    <View style={[styles.content, centered ? styles.centered : null, contentStyle]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
