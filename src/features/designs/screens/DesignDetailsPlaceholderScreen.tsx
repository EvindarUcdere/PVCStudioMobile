import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

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
import { colors, spacing, typography } from '../../../theme';
import { TemplatePreview } from '../../templates/components/TemplatePreview';

export function DesignDetailsPlaceholderScreen() {
  const { designId } = useLocalSearchParams<{ designId: string }>();
  const [project, setProject] = useState<DesignProject | null>(null);
  const [template, setTemplate] = useState<DesignTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDesign() {
      if (!designId) {
        setIsLoading(false);
        return;
      }

      try {
        const designRepository = await createDesignRepository();
        const loadedProject = await designRepository.getById(designId);
        setProject(loadedProject);

        if (loadedProject?.templateId) {
          const templateRepository = await createTemplateRepository();
          setTemplate(await templateRepository.getById(loadedProject.templateId));
        }
      } catch (loadError) {
        logger.error('Design details load failed', loadError);
        setError('Tasarim yuklenemedi. Lutfen tekrar deneyin.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadDesign();
  }, [designId]);

  if (isLoading) {
    return (
      <AppScreen centered>
        <ActivityIndicator color={colors.primary} />
      </AppScreen>
    );
  }

  if (!project) {
    return (
      <AppScreen centered>
        <EmptyState
          title="Tasarim bulunamadi"
          description={error ?? 'Secilen tasarim kaydi bulunamadi.'}
          action={<AppButton label="Tasarimlara Don" onPress={() => router.replace(routes.designs)} />}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppHeader title={project.name} subtitle="Tasarim detaylari" />
      <View style={styles.preview}>
        <TemplatePreview
          rootNode={project.rootNode}
          aspectRatio={project.width / project.height}
          designHeight={project.height}
          profileColorHex={getDesignProfileColor(project.profileSystem).hexValue}
        />
      </View>
      <View style={styles.info}>
        <Info label="Kaynak sablon" value={template?.name ?? 'Ozel tasarim'} />
        <Info label="Genislik" value={`${project.width} mm`} />
        <Info label="Yukseklik" value={`${project.height} mm`} />
        <Info label="Adet" value={String(project.quantity)} />
        <Info label="Olusturulma" value={new Date(project.createdAt).toLocaleDateString('tr-TR')} />
      </View>
      <AppButton label="Tasarimi Ac" onPress={() => router.push(routes.designEditor(project.id))} />
      <AppButton label="Tasarimlara Don" variant="ghost" onPress={() => router.replace(routes.designs)} />
    </AppScreen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
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
  info: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  infoLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  infoValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'right',
  },
});
