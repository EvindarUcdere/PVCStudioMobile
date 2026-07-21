import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import { routes } from '../../../constants/routes';
import {
  createDesignRepository,
  createTemplateRepository,
} from '../../../database/repositories/createRepositories';
import { createDesignFromTemplateInputSchema } from '../../../domain/templates/factories/createDesignFromTemplate';
import { DesignTemplate } from '../../../domain/templates/entities/DesignTemplate';
import { backupDesignToCloud } from '../../../services/firebase/fullSyncService';
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';
import { createTemplateService } from '../../templates/services/templateService';

type FormValues = {
  name: string;
  width: string;
  height: string;
  quantity: string;
};

export function CreateDesignFromTemplateScreen() {
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  const [template, setTemplate] = useState<DesignTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    setError: setFieldError,
  } = useForm<FormValues>({
    defaultValues: { name: '', width: '', height: '', quantity: '1' },
  });

  useEffect(() => {
    async function loadTemplate() {
      if (!templateId) {
        return;
      }

      try {
        const repository = await createTemplateRepository();
        const selectedTemplate = await repository.getById(templateId);
        setTemplate(selectedTemplate);
        if (selectedTemplate) {
          reset({
            name: selectedTemplate.name,
            width: String(selectedTemplate.defaultWidth),
            height: String(selectedTemplate.defaultHeight),
            quantity: '1',
          });
        }
      } catch (loadError) {
        logger.error('Create design template load failed', loadError);
        setError('Hazır model yüklenemedi. Lütfen tekrar deneyin.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadTemplate();
  }, [reset, templateId]);

  async function submit(values: FormValues) {
    if (!template || isSaving) {
      return;
    }

    const parsed = createDesignFromTemplateInputSchema.safeParse({
      name: values.name.trim(),
      width: Number(values.width),
      height: Number(values.height),
      quantity: Number(values.quantity),
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const fieldName = issue.path[0];
        if (
          fieldName === 'name' ||
          fieldName === 'width' ||
          fieldName === 'height' ||
          fieldName === 'quantity'
        ) {
          setFieldError(fieldName, { message: issue.message });
        }
      }
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const templateRepository = await createTemplateRepository();
      const designRepository = await createDesignRepository();
      const service = createTemplateService(templateRepository, designRepository);
      const project = await service.createDesign({ templateId: template.id, ...parsed.data });
      void backupDesignToCloud(project);
      router.replace(routes.designDetails(project.id));
    } catch (saveError) {
      logger.error('Create design from template failed', saveError);
      setError('Tasarım oluşturulurken bir sorun oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <AppScreen centered>
        <ActivityIndicator color={colors.primary} />
      </AppScreen>
    );
  }

  if (!template) {
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboard}
    >
      <AppScreen>
        <AppHeader title="Tasarım Oluştur" subtitle={template.name} />
        <View style={styles.form}>
          <FormField control={control} name="name" label="Tasarım Adı" keyboardType="default" />
          <FormField control={control} name="width" label="Genişlik (mm)" keyboardType="numeric" />
          <FormField
            control={control}
            name="height"
            label="Yükseklik (mm)"
            keyboardType="numeric"
          />
          <FormField control={control} name="quantity" label="Adet" keyboardType="numeric" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <AppButton
            label="Tasarımı Oluştur"
            loading={isSaving}
            disabled={isSaving}
            onPress={handleSubmit((values) => void submit(values))}
          />
        </View>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

type FormFieldProps = {
  control: ReturnType<typeof useForm<FormValues>>['control'];
  name: keyof FormValues;
  label: string;
  keyboardType: 'default' | 'numeric';
};

function FormField({ control, name, label, keyboardType }: FormFieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View style={styles.field}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            accessibilityLabel={label}
            keyboardType={keyboardType}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            style={[styles.input, fieldState.error ? styles.inputError : null]}
            value={field.value}
          />
          {fieldState.error?.message ? (
            <Text style={styles.error}>{fieldState.error.message}</Text>
          ) : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  form: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    ...typography.caption,
    color: colors.error,
  },
});
