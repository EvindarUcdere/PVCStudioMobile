import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { AppButton } from '../../../components/ui/AppButton';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import { getPricingSettings } from '../../../database/repositories/PricingSettingsRepository';
import { createDesignRepository } from '../../../database/repositories/createRepositories';
import { calculateDesignPriceEstimate } from '../../../domain/designs/pricing/calculateDesignPriceEstimate';
import { logger } from '../../../services/logger';
import { colors, spacing, typography } from '../../../theme';
import { buildCustomerQuotePdfHtml, buildProductionPdfHtml, sharePdfHtml } from '../services/pdfService';

type PdfPreviewType = 'quote' | 'production';

export function PdfPreviewScreen() {
  const { designId, type, customerName, customerPhone, note } = useLocalSearchParams<{
    designId: string;
    type?: PdfPreviewType;
    customerName?: string;
    customerPhone?: string;
    note?: string;
  }>();
  const [html, setHtml] = useState('');
  const [title, setTitle] = useState('PDF Onizle');
  const [isLoading, setIsLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewType: PdfPreviewType = type === 'production' ? 'production' : 'quote';

  useEffect(() => {
    let isActive = true;

    async function loadPreview() {
      if (!designId) {
        setError('Tasarim kaydi bulunamadi.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const designRepository = await createDesignRepository();
        const design = await designRepository.getById(designId);
        const pricingSettings = await getPricingSettings();

        if (!design) {
          setError('Tasarim kaydi bulunamadi.');
          return;
        }

        const estimate = calculateDesignPriceEstimate(design, pricingSettings);
        const input = {
          design,
          estimate,
          customerName: customerName ?? '',
          customerPhone: customerPhone ?? '',
          note: note ?? '',
        };
        const nextHtml =
          previewType === 'production'
            ? await buildProductionPdfHtml(input)
            : await buildCustomerQuotePdfHtml(input);

        if (isActive) {
          setHtml(nextHtml);
          setTitle(previewType === 'production' ? 'Imalat PDF Onizle' : 'Teklif PDF Onizle');
        }
      } catch (previewError) {
        logger.error('PDF preview load failed', previewError);
        if (isActive) {
          setError('PDF onizleme hazirlanamadi.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      isActive = false;
    };
  }, [customerName, customerPhone, designId, note, previewType]);

  async function sharePreviewPdf() {
    if (!html || isSharing) {
      return;
    }

    setIsSharing(true);
    try {
      await sharePdfHtml(html, previewType === 'production' ? 'PVC imalat formu.pdf' : 'PVC teklif.pdf');
    } catch (shareError) {
      logger.error('PDF preview share failed', shareError);
      setError('PDF paylasilamadi.');
    } finally {
      setIsSharing(false);
    }
  }

  if (isLoading) {
    return (
      <AppScreen centered scroll={false}>
        <ActivityIndicator color={colors.primary} />
      </AppScreen>
    );
  }

  if (error || !html) {
    return (
      <AppScreen centered>
        <EmptyState
          title="PDF acilamadi"
          description={error ?? 'Onizleme olusturulamadi.'}
          action={<AppButton label="Geri Don" onPress={() => router.back()} />}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false} contentStyle={styles.screen}>
      <AppHeader
        title={title}
        subtitle="Gondermeden once kontrol edin"
        rightAction={<AppButton label="Geri" variant="ghost" onPress={() => router.back()} />}
      />
      {previewType === 'production' ? (
        <Text style={styles.warning}>
          Imalat olculeri tasarimdan hesaplanir. Uretimden once saha olcusu ve profil sistem kartlariyla son kontrol yapin.
        </Text>
      ) : null}
      <View style={styles.viewer}>
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          style={styles.webView}
        />
      </View>
      <AppButton
        label="PDF Paylas"
        loading={isSharing}
        disabled={isSharing}
        onPress={() => void sharePreviewPdf()}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.md,
  },
  warning: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  viewer: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
  },
});
