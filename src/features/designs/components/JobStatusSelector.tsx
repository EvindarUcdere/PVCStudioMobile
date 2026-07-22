import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { JobStatus, jobStatusLabels, jobStatuses } from '../../../domain/designs/enums/JobStatus';
import { colors, radius, spacing, typography } from '../../../theme';

type JobStatusSelectorProps = {
  value: JobStatus;
  onChange: (status: JobStatus) => void;
};

export function JobStatusSelector({ value, onChange }: JobStatusSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Is durumu</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>
        {jobStatuses.map((status) => (
          <Pressable
            accessibilityRole="button"
            key={status}
            onPress={() => onChange(status)}
            style={({ pressed }) => [
              styles.option,
              value === status ? styles.optionSelected : null,
              pressed ? styles.optionPressed : null,
            ]}
          >
            <Text style={[styles.optionLabel, value === status ? styles.optionLabelSelected : null]}>
              {jobStatusLabels[status]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export function getJobStatusColor(status: JobStatus): string {
  if (status === 'approved' || status === 'done') {
    return colors.success;
  }

  if (status === 'production' || status === 'installation') {
    return colors.warning;
  }

  if (status === 'canceled') {
    return colors.error;
  }

  return colors.primary;
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  options: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  option: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionPressed: {
    opacity: 0.86,
  },
  optionLabel: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  optionLabelSelected: {
    color: colors.surface,
  },
});
