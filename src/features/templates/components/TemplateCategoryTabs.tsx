import { ScrollView, StyleSheet, Text, Pressable } from 'react-native';

import { templateCategoryLabels } from '../../../domain/templates/enums/TemplateCategory';
import { colors, radius, spacing, typography } from '../../../theme';
import { TemplateFilter } from '../hooks/useTemplates';

const filters: { id: TemplateFilter; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'window', label: templateCategoryLabels.window },
  { id: 'door', label: templateCategoryLabels.door },
  { id: 'balcony', label: templateCategoryLabels.balcony },
  { id: 'sliding', label: templateCategoryLabels.sliding },
  { id: 'tilt', label: templateCategoryLabels.tilt },
  { id: 'special', label: templateCategoryLabels.special },
  { id: 'favorites', label: 'Favoriler' },
];

type TemplateCategoryTabsProps = {
  selected: TemplateFilter;
  onSelect: (filter: TemplateFilter) => void;
};

export function TemplateCategoryTabs({ selected, onSelect }: TemplateCategoryTabsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {filters.map((filter) => {
        const isSelected = selected === filter.id;
        return (
          <Pressable
            accessibilityLabel={`${filter.label} kategori filtresi`}
            accessibilityRole="button"
            key={filter.id}
            onPress={() => onSelect(filter.id)}
            style={[styles.tab, isSelected ? styles.selectedTab : null]}
          >
            <Text style={[styles.label, isSelected ? styles.selectedLabel : null]}>
              {filter.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  tab: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  selectedTab: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  selectedLabel: {
    color: colors.surface,
  },
});
