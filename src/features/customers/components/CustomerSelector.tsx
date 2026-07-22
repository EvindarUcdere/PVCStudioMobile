import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Customer } from '../../../domain/customers/entities/Customer';
import { colors, radius, spacing, typography } from '../../../theme';

type CustomerSelectorProps = {
  customers: Customer[];
  selectedCustomerId: string | null;
  onSelectCustomer: (customerId: string | null) => void;
};

export function CustomerSelector({
  customers,
  selectedCustomerId,
  onSelectCustomer,
}: CustomerSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Musteri</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}>
        <CustomerOption
          label="Musterisiz"
          selected={selectedCustomerId === null}
          onPress={() => onSelectCustomer(null)}
        />
        {customers.map((customer) => (
          <CustomerOption
            key={customer.id}
            label={customer.fullName}
            detail={customer.phone ?? undefined}
            selected={selectedCustomerId === customer.id}
            onPress={() => onSelectCustomer(customer.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function CustomerOption({
  label,
  detail,
  selected,
  onPress,
}: {
  label: string;
  detail?: string | undefined;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected ? styles.optionSelected : null,
        pressed ? styles.optionPressed : null,
      ]}
    >
      <Text numberOfLines={1} style={[styles.optionLabel, selected ? styles.optionLabelSelected : null]}>
        {label}
      </Text>
      {detail ? (
        <Text numberOfLines={1} style={[styles.optionDetail, selected ? styles.optionDetailSelected : null]}>
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
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
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 2,
    minHeight: 48,
    minWidth: 118,
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
  optionDetail: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  optionDetailSelected: {
    color: colors.surface,
  },
});
