import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import { routes } from '../../../constants/routes';
import {
  createDesignRepository,
  createTemplateRepository,
} from '../../../database/repositories/createRepositories';
import { DesignProject } from '../../../domain/designs/entities/DesignProject';
import { getDesignProfileColor } from '../../../domain/designs/colors/profileColorOptions';
import { DesignTemplate } from '../../../domain/templates/entities/DesignTemplate';
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';
import { TemplatePreview } from '../../templates/components/TemplatePreview';

type DesignListItem = {
  project: DesignProject;
  template: DesignTemplate | null;
};

export function DesignsScreen() {
  const [items, setItems] = useState<DesignListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDesigns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const designRepository = await createDesignRepository();
      const templateRepository = await createTemplateRepository();
      const projects = await designRepository.list();
      const nextItems = await Promise.all(
        projects.map(async (project) => ({
          project,
          template: project.templateId
            ? await templateRepository.getById(project.templateId)
            : null,
        })),
      );
      setItems(nextItems);
    } catch (loadError) {
      logger.error('Design list load failed', loadError);
      setError('Tasarımlar yüklenemedi. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDesigns();
    }, [loadDesigns]),
  );

  return (
    <AppScreen scroll={false}>
      <AppHeader title="Tasarımlar" subtitle="Kaydettiğiniz PVC tasarımları" />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <EmptyState
          title="Tasarımlar yüklenemedi."
          description={error}
          action={<AppButton label="Tekrar Dene" onPress={() => void loadDesigns()} />}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.project.id}
          contentContainerStyle={items.length === 0 ? styles.emptyList : styles.list}
          renderItem={({ item }) => (
            <DesignCard
              item={item}
              onPress={() => router.push(routes.designDetails(item.project.id))}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              title="Henüz tasarım bulunmuyor."
              description="Yeni bir tasarım oluşturarak başlayın."
              action={
                <AppButton label="Yeni Tasarım" onPress={() => router.push(routes.newDesign)} />
              }
            />
          }
        />
      )}
    </AppScreen>
  );
}

function DesignCard({ item, onPress }: { item: DesignListItem; onPress: () => void }) {
  const { project, template } = item;
  const profileColor = getDesignProfileColor(project.profileSystem);
  return (
    <Pressable
      accessibilityLabel={`${project.name} tasarımını aç`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.preview}>
        <TemplatePreview
          rootNode={project.rootNode}
          aspectRatio={project.width / project.height}
          designHeight={project.height}
          profileColorHex={profileColor.hexValue}
          compact
        />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.title}>{project.name}</Text>
        <Text style={styles.meta}>
          {project.width} × {project.height} mm · {project.quantity} adet
        </Text>
        <Text style={styles.caption}>{template?.name ?? 'Özel tasarım'}</Text>
        <Text style={styles.caption}>
          Güncellendi: {new Date(project.updatedAt).toLocaleDateString('tr-TR')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  list: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.sm,
  },
  pressed: {
    opacity: 0.9,
  },
  preview: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    height: 96,
    overflow: 'hidden',
    width: 104,
  },
  cardBody: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  meta: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
