import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DesignTemplate } from '../../../domain/templates/entities/DesignTemplate';
import { templateCategoryLabels } from '../../../domain/templates/enums/TemplateCategory';
import { colors, radius, spacing, typography } from '../../../theme';
import { FavoriteButton } from './FavoriteButton';
import { TemplatePreview } from './TemplatePreview';

type TemplateCardProps = {
  template: DesignTemplate;
  onPress: () => void;
  onToggleFavorite: () => void;
};

export function TemplateCard({ template, onPress, onToggleFavorite }: TemplateCardProps) {
  return (
    <Pressable
      accessibilityLabel={`${template.name} modelini aç`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.preview}>
        <TemplatePreview
          compact
          rootNode={template.rootNode}
          aspectRatio={template.previewAspectRatio}
        />
        <View style={styles.favorite}>
          <FavoriteButton
            isFavorite={template.isFavorite}
            label={template.name}
            onPress={onToggleFavorite}
          />
        </View>
      </View>
      <Text numberOfLines={2} style={styles.title}>
        {template.name}
      </Text>
      <Text style={styles.badge}>{templateCategoryLabels[template.category]}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    minHeight: 210,
    padding: spacing.sm,
  },
  pressed: {
    opacity: 0.9,
  },
  preview: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    height: 118,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  favorite: {
    position: 'absolute',
    right: 2,
    top: 2,
  },
  title: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    minHeight: 48,
  },
  badge: {
    ...typography.caption,
    color: colors.primary,
  },
});
