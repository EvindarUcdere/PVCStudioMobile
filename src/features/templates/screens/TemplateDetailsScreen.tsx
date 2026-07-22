import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import { routes } from '../../../constants/routes';
import { createTemplateRepository } from '../../../database/repositories/createRepositories';
import { DesignTemplate } from '../../../domain/templates/entities/DesignTemplate';
import { templateCategoryLabels } from '../../../domain/templates/enums/TemplateCategory';
import { logger } from '../../../services/logger';
import { colors, spacing, typography } from '../../../theme';
import { FavoriteButton } from '../components/FavoriteButton';
import { TemplatePreview } from '../components/TemplatePreview';

export function TemplateDetailsScreen() {
  const { templateId, customerId } = useLocalSearchParams<{ templateId: string; customerId?: string }>();
  const [template, setTemplate] = useState<DesignTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTemplate() {
      if (!templateId) {
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const repository = await createTemplateRepository();
        setTemplate(await repository.getById(templateId));
      } catch (loadError) {
        logger.error('Template details load failed', loadError);
        setError('Hazır model yüklenemedi. Lütfen tekrar deneyin.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadTemplate();
  }, [templateId]);

  async function toggleFavorite() {
    if (!template) {
      return;
    }

    const previous = template;
    const next = { ...template, isFavorite: !template.isFavorite };
    setTemplate(next);
    try {
      const repository = await createTemplateRepository();
      await repository.setFavorite(template.id, next.isFavorite);
    } catch (favoriteError) {
      logger.error('Template details favorite failed', favoriteError);
      setTemplate(previous);
      setError('Favori durumu güncellenemedi.');
    }
  }

  if (isLoading) {
    return (
      <AppScreen centered>
        <ActivityIndicator color={colors.primary} />
      </AppScreen>
    );
  }

  if (error || !template) {
    return (
      <AppScreen centered>
        <EmptyState
          title="Model bulunamadı"
          description={error ?? 'Seçilen model bulunamadı.'}
          action={<AppButton label="Geri Dön" onPress={() => router.back()} />}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppHeader
        title={template.name}
        subtitle={templateCategoryLabels[template.category]}
        rightAction={
          <FavoriteButton
            isFavorite={template.isFavorite}
            label={template.name}
            onPress={() => void toggleFavorite()}
          />
        }
      />
      <View style={styles.preview}>
        <TemplatePreview
          rootNode={template.rootNode}
          aspectRatio={template.previewAspectRatio}
          designHeight={template.defaultHeight}
        />
      </View>
      <Text style={styles.description}>{template.description}</Text>
      <Text style={styles.meta}>
        Varsayılan ölçü: {template.defaultWidth} × {template.defaultHeight} mm
      </Text>
      <AppButton
        label="Bu Modeli Kullan"
        onPress={() => router.push(routes.createDesignFromTemplate(template.id, customerId ?? null))}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  preview: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 260,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  meta: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.lg,
  },
});
