import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import { routes } from '../../../constants/routes';
import {
  createCustomerRepository,
  createDesignRepository,
  createTemplateRepository,
} from '../../../database/repositories/createRepositories';
import { Customer } from '../../../domain/customers/entities/Customer';
import { DesignProject } from '../../../domain/designs/entities/DesignProject';
import { getDesignProfileColor } from '../../../domain/designs/colors/profileColorOptions';
import { jobStatusLabels } from '../../../domain/designs/enums/JobStatus';
import { DesignTemplate } from '../../../domain/templates/entities/DesignTemplate';
import { backupDesignToCloud } from '../../../services/firebase/fullSyncService';
import { logger } from '../../../services/logger';
import { colors, spacing, typography } from '../../../theme';
import { DesignStockNeedsCard } from '../../design-editor/components/DesignStockNeedsCard';
import { TemplatePreview } from '../../templates/components/TemplatePreview';

export function DesignDetailsPlaceholderScreen() {
  const { designId } = useLocalSearchParams<{ designId: string }>();
  const [project, setProject] = useState<DesignProject | null>(null);
  const [template, setTemplate] = useState<DesignTemplate | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
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

        if (loadedProject?.customerId) {
          const customerRepository = await createCustomerRepository();
          setCustomer(await customerRepository.getById(loadedProject.customerId));
        } else {
          setCustomer(null);
        }
      } catch (loadError) {
        logger.error('Design details load failed', loadError);
        setError('Tasarım yüklenemedi. Lütfen tekrar deneyin.');
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
          title="Tasarım bulunamadı"
          description={error ?? 'Seçilen tasarım kaydı bulunamadı.'}
          action={<AppButton label="Tasarımlara Dön" onPress={() => router.replace(routes.designs)} />}
        />
      </AppScreen>
    );
  }

  function confirmDelete() {
    Alert.alert(
      'Tasarımı sil',
      'Bu tasarım arşive alınacak. Geri Dönüşüm ekranından tekrar geri getirebilirsiniz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            void softDeleteDesign();
          },
        },
      ],
    );
  }

  async function softDeleteDesign() {
    if (!project) {
      return;
    }

    try {
      const designRepository = await createDesignRepository();
      await designRepository.softDelete(project.id);
      const deleted = await designRepository.getByIdIncludingDeleted(project.id);
      if (deleted) {
        void backupDesignToCloud(deleted);
      }
      router.replace(routes.designs);
    } catch (deleteError) {
      logger.error('Design delete failed', deleteError);
      setError('Tasarım silinemedi. Lütfen tekrar deneyin.');
    }
  }

  return (
    <AppScreen>
      <AppHeader title={project.name} subtitle="Tasarım detayları" />
      <View style={styles.preview}>
        <TemplatePreview
          rootNode={project.rootNode}
          aspectRatio={project.width / project.height}
          designHeight={project.height}
          profileColorHex={getDesignProfileColor(project.profileSystem).hexValue}
        />
      </View>
      <View style={styles.info}>
        <Info label="Kaynak şablon" value={template?.name ?? 'Özel tasarım'} />
        <Info label="Müşteri" value={customer?.fullName ?? 'Müşterisiz'} />
        <Info label="İş adı" value={project.jobName ?? project.name} />
        <Info label="İş durumu" value={jobStatusLabels[project.jobStatus]} />
        <Info label="Genişlik" value={`${project.width} mm`} />
        <Info label="Yükseklik" value={`${project.height} mm`} />
        <Info label="Adet" value={String(project.quantity)} />
        <Info label="Oluşturulma" value={new Date(project.createdAt).toLocaleDateString('tr-TR')} />
      </View>
      <AppButton label="Tasarımı Aç" onPress={() => router.push(routes.designEditor(project.id))} />
      <View style={styles.actions}>
        <AppButton
          label="Teklif PDF"
          variant="secondary"
          onPress={() =>
            router.push(routes.designPdfPreview(project.id, 'quote', customer?.fullName ?? '', customer?.phone ?? '', ''))
          }
          style={styles.actionButton}
        />
        <AppButton
          label="Imalat PDF"
          variant="secondary"
          onPress={() =>
            router.push(
              routes.designPdfPreview(project.id, 'production', customer?.fullName ?? '', customer?.phone ?? '', ''),
            )
          }
          style={styles.actionButton}
        />
      </View>
      <AppButton label="Teklif Oluştur" variant="secondary" onPress={() => router.push(routes.designQuote(project.id))} />
      <View style={styles.stockNeeds}>
        <DesignStockNeedsCard design={project} />
      </View>
      <View style={styles.actions}>
        <AppButton label="Tasarımlara Dön" variant="ghost" onPress={() => router.replace(routes.designs)} style={styles.actionButton} />
        <AppButton label="Sil" variant="secondary" onPress={confirmDelete} style={styles.actionButton} />
      </View>
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
  stockNeeds: {
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
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
