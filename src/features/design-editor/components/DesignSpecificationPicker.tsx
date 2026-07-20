import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DesignProject } from '../../../domain/designs/entities/DesignProject';
import {
  GlassPriceOption,
  getDefaultGlassPriceOption,
  getDefaultProfileSystemPriceOption,
  PriceEstimateRates,
  ProfileSystemPriceOption,
} from '../../../domain/designs/pricing/calculateDesignPriceEstimate';
import { colors, radius, spacing, typography } from '../../../theme';

type DesignSpecificationPickerProps = {
  design: DesignProject;
  rates: PriceEstimateRates;
  onSelectProfileSystem: (option: ProfileSystemPriceOption) => void;
  onSelectGlassType: (option: GlassPriceOption) => void;
};

export function DesignSpecificationPicker({
  design,
  rates,
  onSelectProfileSystem,
  onSelectGlassType,
}: DesignSpecificationPickerProps) {
  const selectedProfileId =
    design.profileSystem?.seriesId ?? getDefaultProfileSystemPriceOption(rates).id;
  const selectedGlassId = design.defaultGlass?.glassTypeId ?? getDefaultGlassPriceOption(rates).id;

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Kalite ve cam</Text>
      <View style={styles.group}>
        <Text style={styles.caption}>Profil kalitesi</Text>
        <View style={styles.optionGrid}>
          {rates.profileSystems.map((option) => (
            <OptionButton
              key={option.id}
              title={option.name}
              subtitle={`${option.profileWidth} mm - ${formatCurrency(option.meterPrice)} / m`}
              selected={selectedProfileId === option.id}
              onPress={() => onSelectProfileSystem(option)}
            />
          ))}
        </View>
      </View>
      <View style={styles.group}>
        <Text style={styles.caption}>Cam tipi</Text>
        <View style={styles.optionGrid}>
          {rates.glassTypes.map((option) => (
            <OptionButton
              key={option.id}
              title={option.name}
              subtitle={`${option.formula ?? 'Ozel'} - ${formatCurrency(option.squareMeterPrice)} / m2`}
              selected={selectedGlassId === option.id}
              onPress={() => onSelectGlassType(option)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function OptionButton({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.option, selected ? styles.optionSelected : null]}
    >
      <Text numberOfLines={1} style={[styles.optionTitle, selected ? styles.optionTitleSelected : null]}>
        {title}
      </Text>
      <Text numberOfLines={1} style={styles.optionSubtitle}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString('tr-TR')} TL`;
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.md,
  },
  title: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  group: {
    gap: spacing.sm,
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  option: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    minHeight: 58,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    width: '47.5%',
  },
  optionSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  optionTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  optionTitleSelected: {
    color: colors.primary,
  },
  optionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
});
