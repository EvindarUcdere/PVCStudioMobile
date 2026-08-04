import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
  createCustomerRepository,
  createDesignRepository,
  createTemplateRepository,
} from '../../../database/repositories/createRepositories';
import { getCompanyProfile } from '../../../database/repositories/CompanyProfileRepository';
import { Customer } from '../../../domain/customers/entities/Customer';
import { defaultProfileColorId } from '../../../domain/designs/colors/profileColorOptions';
import { ProfileSystemSelection } from '../../../domain/designs/entities/ProfileSystemSelection';
import { getDefaultProfileSystemPriceOption } from '../../../domain/designs/pricing/calculateDesignPriceEstimate';
import { ProductionProfileSystem } from '../../../domain/production-calculation/types';
import { createDesignFromTemplateInputSchema } from '../../../domain/templates/factories/createDesignFromTemplate';
import { DesignTemplate } from '../../../domain/templates/entities/DesignTemplate';
import { backupDesignToCloud } from '../../../services/firebase/fullSyncService';
import { listProductionProfileSystemsFromCloud } from '../../../services/firebase/productionProfileSystemCloudService';
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';
import { sanitizeIntegerInput } from '../../../utils/inputValidation';
import { CustomerSelector } from '../../customers/components/CustomerSelector';
import { createTemplateService } from '../../templates/services/templateService';

type FormValues = {
  name: string;
  jobName: string;
  width: string;
  height: string;
  quantity: string;
};

export function CreateDesignFromTemplateScreen() {
  const { templateId, customerId, jobId } = useLocalSearchParams<{
    templateId: string;
    customerId?: string;
    jobId?: string;
  }>();
  const [template, setTemplate] = useState<DesignTemplate | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [profileSystems, setProfileSystems] = useState<ProductionProfileSystem[]>([]);
  const [selectedProfileSystemId, setSelectedProfileSystemId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveInFlightRef = useRef(false);
  const {
    control,
    handleSubmit,
    reset,
    setError: setFieldError,
  } = useForm<FormValues>({
    defaultValues: { name: '', jobName: '', width: '', height: '', quantity: '1' },
  });
  const watchedValues = useWatch({ control });
  const hasUnsavedInput =
    Boolean(watchedValues.name?.trim()) ||
    Boolean(watchedValues.jobName?.trim()) ||
    Boolean(watchedValues.width?.trim()) ||
    Boolean(watchedValues.height?.trim()) ||
    watchedValues.quantity !== '1' ||
    selectedCustomerId !== null;

  useEffect(() => {
    async function loadTemplate() {
      if (!templateId) {
        return;
      }

      try {
        const repository = await createTemplateRepository();
        const customerRepository = await createCustomerRepository();
        const companyProfile = await getCompanyProfile();
        const selectedTemplate = await repository.getById(templateId);
        const savedProfileSystems = companyProfile.companyId.trim()
          ? await listProductionProfileSystemsFromCloud(companyProfile.companyId.trim())
          : [];
        const activeProfileSystems = savedProfileSystems.filter((profileSystem) => profileSystem.status !== 'ARCHIVED');
        setCustomers(await customerRepository.list({ limit: 100 }));
        setProfileSystems(activeProfileSystems);
        setSelectedProfileSystemId(activeProfileSystems[0]?.id ?? null);
        setSelectedCustomerId(customerId ?? null);
        setTemplate(selectedTemplate);
        if (selectedTemplate) {
          reset({
            name: selectedTemplate.name,
            jobName: '',
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
  }, [customerId, reset, templateId]);

  async function submit(values: FormValues) {
    if (!template || saveInFlightRef.current || isSaving) {
      return;
    }

    const parsed = createDesignFromTemplateInputSchema.safeParse({
      name: values.name.trim(),
      jobName: nullableTrim(values.jobName),
      width: Number(values.width),
      height: Number(values.height),
      quantity: Number(values.quantity),
      customerId: selectedCustomerId,
      jobId: jobId ?? null,
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

    saveInFlightRef.current = true;
    setIsSaving(true);
    setError(null);
    try {
      const templateRepository = await createTemplateRepository();
      const designRepository = await createDesignRepository();
      const service = createTemplateService(templateRepository, designRepository);
      const selectedProfileSystem =
        profileSystems.find((profileSystem) => profileSystem.id === selectedProfileSystemId) ?? null;
      const project = await service.createDesign({
        templateId: template.id,
        ...parsed.data,
        profileSystem: toDesignProfileSystemSelection(selectedProfileSystem),
      });
      void backupDesignToCloud(project);
      router.replace(routes.designEditor(project.id));
    } catch (saveError) {
      logger.error('Create design from template failed', saveError);
      setError('Tasarım oluşturulurken bir sorun oluştu. Lütfen tekrar deneyin.');
    } finally {
      saveInFlightRef.current = false;
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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboard}
    >
      <AppScreen>
        <AppHeader
          title="Tasarım Oluştur"
          subtitle={template.name}
          rightAction={<AppButton label="Geri" variant="ghost" onPress={() => confirmBack(hasUnsavedInput)} />}
        />
        <View style={styles.form}>
          <FormField control={control} name="name" label="Tasarım Adı" keyboardType="default" />
          <FormField control={control} name="jobName" label="Is adi" keyboardType="default" />
          <FormField
            control={control}
            name="width"
            label="Genişlik (mm)"
            keyboardType="numeric"
            sanitize={sanitizeIntegerInput}
          />
          <FormField
            control={control}
            name="height"
            label="Yükseklik (mm)"
            keyboardType="numeric"
            sanitize={sanitizeIntegerInput}
          />
          <FormField
            control={control}
            name="quantity"
            label="Adet"
            keyboardType="numeric"
            sanitize={sanitizeIntegerInput}
          />
          <CustomerSelector
            customers={customers}
            selectedCustomerId={selectedCustomerId}
            onSelectCustomer={setSelectedCustomerId}
          />
          <ProfileSystemSelector
            profileSystems={profileSystems}
            selectedProfileSystemId={selectedProfileSystemId}
            onSelectProfileSystem={setSelectedProfileSystemId}
          />
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
  sanitize?: (value: string) => string;
};

function FormField({ control, name, label, keyboardType, sanitize }: FormFieldProps) {
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
            onChangeText={(value) => field.onChange(sanitize ? sanitize(value) : value)}
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

function ProfileSystemSelector({
  profileSystems,
  selectedProfileSystemId,
  onSelectProfileSystem,
}: {
  profileSystems: ProductionProfileSystem[];
  selectedProfileSystemId: string | null;
  onSelectProfileSystem: (profileSystemId: string | null) => void;
}) {
  if (profileSystems.length === 0) {
    return (
      <View style={styles.selectorPanel}>
        <Text style={styles.selectorTitle}>Profil sistemi</Text>
        <Text style={styles.selectorCaption}>
          Firma icin kayitli aktif profil sistemi yok. Tasarim teknik profil sistemi secilmeden olusturulur.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.selectorPanel}>
      <View style={styles.selectorHeader}>
        <Text style={styles.selectorTitle}>Profil sistemi</Text>
        <Pressable accessibilityRole="button" onPress={() => onSelectProfileSystem(null)}>
          <Text style={styles.clearSelection}>Secme</Text>
        </Pressable>
      </View>
      <View style={styles.optionGrid}>
        {profileSystems.map((profileSystem) => {
          const selected = selectedProfileSystemId === profileSystem.id;
          return (
            <Pressable
              key={profileSystem.id}
              accessibilityRole="button"
              onPress={() => onSelectProfileSystem(profileSystem.id)}
              style={[styles.profileOption, selected ? styles.profileOptionSelected : null]}
            >
              <Text numberOfLines={1} style={[styles.profileOptionTitle, selected ? styles.profileOptionTitleSelected : null]}>
                {profileSystem.displayName}
              </Text>
              <Text numberOfLines={1} style={styles.selectorCaption}>
                {profileSystem.brand} / {profileSystem.seriesName} - v{profileSystem.version}
              </Text>
              <Text style={profileSystem.status === 'VERIFIED' ? styles.verifiedText : styles.draftText}>
                {profileSystem.status === 'VERIFIED' ? 'VERIFIED' : 'DRAFT'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function toDesignProfileSystemSelection(
  profileSystem: ProductionProfileSystem | null,
): ProfileSystemSelection | null {
  if (!profileSystem) {
    return null;
  }

  const estimateDefault = getDefaultProfileSystemPriceOption();

  return {
    brandId: estimateDefault.id,
    seriesId: estimateDefault.id,
    profileWidth: estimateDefault.profileWidth,
    chamberCount: estimateDefault.chamberCount,
    wallClass: estimateDefault.wallClass,
    gasketCount: null,
    gasketColor: null,
    steelThickness: null,
    interiorColorId: defaultProfileColorId,
    exteriorColorId: defaultProfileColorId,
    productionProfileSystemId: profileSystem.id,
    productionProfileSystemName: profileSystem.displayName,
    productionProfileSystemVersion: profileSystem.version,
    productionProfileSystemStatus: profileSystem.status,
    productionFrameProfileCode: profileSystem.frameProfileCode,
    productionSashProfileCode: profileSystem.sashProfileCode,
    productionMullionProfileCode: profileSystem.mullionProfileCode,
    productionTransomProfileCode: profileSystem.transomProfileCode,
    productionGlazingBeadProfileCode: profileSystem.glazingBeadProfileCode,
    productionGasketCode: profileSystem.gasketCode,
    productionHardwareSetCode: profileSystem.hardwareSetCode,
  };
}

function confirmBack(hasUnsavedInput: boolean) {
  if (!hasUnsavedInput) {
    router.back();
    return;
  }

  Alert.alert('Değişiklikler kaybolacak', 'Bu tasarım henüz oluşturulmadı. Çıkmak istiyor musunuz?', [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Çık', style: 'destructive', onPress: () => router.back() },
  ]);
}

function nullableTrim(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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
  selectorPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  selectorHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  selectorTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  selectorCaption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  clearSelection: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '800',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  profileOption: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 2,
    minHeight: 82,
    padding: spacing.sm,
    width: '47.5%',
  },
  profileOptionSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  profileOptionTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  profileOptionTitleSelected: {
    color: colors.primary,
  },
  verifiedText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '800',
  },
  draftText: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '800',
  },
});
