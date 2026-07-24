import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
import { JobStatus, jobStatusLabels, jobStatuses } from '../../../domain/designs/enums/JobStatus';
import { DesignTemplate } from '../../../domain/templates/entities/DesignTemplate';
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';
import { TemplatePreview } from '../../templates/components/TemplatePreview';
import { getJobStatusColor } from '../components/JobStatusSelector';

type DesignListItem = {
  project: DesignProject;
  template: DesignTemplate | null;
};

export function DesignsScreen() {
  const [items, setItems] = useState<DesignListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDesigns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const designRepository = await createDesignRepository();
      const templateRepository = await createTemplateRepository();
      const projects = await designRepository.list({
        ...(statusFilter !== 'all' ? { jobStatus: statusFilter } : null),
        ...(search.trim() ? { search: search.trim() } : null),
      });
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
      setError('Tasarimlar yuklenemedi. Lutfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter]);

  useFocusEffect(
    useCallback(() => {
      void loadDesigns();
    }, [loadDesigns]),
  );

  return (
    <AppScreen scroll={false}>
      <AppHeader title="Tasarimlar" subtitle="Kaydettiginiz PVC isleri" />
      <TextInput
        accessibilityLabel="Tasarim ara"
        onChangeText={setSearch}
        placeholder="Tasarim veya is adi ara"
        placeholderTextColor={colors.textSecondary}
        style={styles.searchInput}
        value={search}
      />
      <View style={styles.filters}>
        <StatusFilterChip
          label="Tumu"
          selected={statusFilter === 'all'}
          onPress={() => setStatusFilter('all')}
        />
        {jobStatuses.map((status) => (
          <StatusFilterChip
            key={status}
            label={jobStatusLabels[status]}
            selected={statusFilter === status}
            onPress={() => setStatusFilter(status)}
          />
        ))}
      </View>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <EmptyState
          title="Tasarimlar yuklenemedi."
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
              title="Henuz tasarim bulunmuyor."
              description="Yeni bir tasarim olusturarak baslayin."
              action={<AppButton label="Yeni Tasarim" onPress={() => router.push(routes.newDesign)} />}
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
      accessibilityLabel={`${project.name} tasarimini ac`}
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
        {project.jobName ? <Text style={styles.caption}>Is: {project.jobName}</Text> : null}
        <View style={[styles.badge, { backgroundColor: getJobStatusColor(project.jobStatus) }]}>
          <Text style={styles.badgeText}>{jobStatusLabels[project.jobStatus]}</Text>
        </View>
        <Text style={styles.meta}>
          {project.width} x {project.height} mm - {project.quantity} adet
        </Text>
        <Text style={styles.caption}>{template?.name ?? 'Ozel tasarim'}</Text>
        <Text style={styles.caption}>
          Guncellendi: {new Date(project.updatedAt).toLocaleDateString('tr-TR')}
        </Text>
      </View>
    </Pressable>
  );
}

function StatusFilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        selected ? styles.filterChipSelected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.filterChipText, selected ? styles.filterChipTextSelected : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  filterChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  filterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  filterChipTextSelected: {
    color: colors.surface,
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
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    ...typography.caption,
    color: colors.surface,
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
