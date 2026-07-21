import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Share, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../components/ui/AppButton';
import { AppCard } from '../../../components/ui/AppCard';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppScreen } from '../../../components/ui/AppScreen';
import { EmptyState } from '../../../components/ui/EmptyState';
import { routes } from '../../../constants/routes';
import { createQuoteRepository } from '../../../database/repositories/createRepositories';
import { Quote, QuoteStatus } from '../../../domain/quotes/entities/Quote';
import { backupQuoteToCloud } from '../../../services/firebase/fullSyncService';
import { logger } from '../../../services/logger';
import { colors, radius, spacing, typography } from '../../../theme';
import { shareCustomerQuotePdf } from '../services/pdfService';

const statusLabels: Record<QuoteStatus, string> = {
  draft: 'Taslak',
  sent: 'Gonderildi',
  accepted: 'Kabul edildi',
  rejected: 'Reddedildi',
};

export function QuotesScreen() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQuotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const repository = await createQuoteRepository();
      setQuotes(await repository.list());
    } catch (loadError) {
      logger.error('Quote list load failed', loadError);
      setError('Teklifler yuklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadQuotes();
    }, [loadQuotes]),
  );

  async function updateStatus(quote: Quote, status: QuoteStatus) {
    try {
      const repository = await createQuoteRepository();
      const updated = await repository.updateStatus(quote.id, status);
      void backupQuoteToCloud(updated);
      setQuotes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (statusError) {
      logger.error('Quote status update failed', statusError);
      setError('Teklif durumu guncellenemedi.');
    }
  }

  async function shareQuote(quote: Quote) {
    try {
      await Share.share({ message: quote.message });
      await updateStatus(quote, 'sent');
    } catch (shareError) {
      logger.error('Saved quote share failed', shareError);
      setError('Teklif paylasilamadi.');
    }
  }

  async function shareQuotePdf(quote: Quote) {
    try {
      await shareCustomerQuotePdf({ quote });
      await updateStatus(quote, 'sent');
    } catch (shareError) {
      logger.error('Saved quote PDF share failed', shareError);
      setError('Teklif PDF paylasilamadi.');
    }
  }

  return (
    <AppScreen scroll={false}>
      <AppHeader
        title="Teklifler"
        subtitle="Kaydedilen ve gonderilen teklifler"
        rightAction={<AppButton label="Geri" variant="ghost" onPress={() => router.back()} />}
      />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <EmptyState
          title="Teklifler yuklenemedi"
          description={error}
          action={<AppButton label="Tekrar Dene" onPress={() => void loadQuotes()} />}
        />
      ) : (
        <FlatList
          data={quotes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={quotes.length === 0 ? styles.emptyList : styles.list}
          renderItem={({ item }) => (
            <QuoteCard
              quote={item}
              onOpenDesign={() => router.push(routes.designDetails(item.designId))}
              onShare={() => void shareQuote(item)}
              onSharePdf={() => void shareQuotePdf(item)}
              onAccept={() => void updateStatus(item, 'accepted')}
              onReject={() => void updateStatus(item, 'rejected')}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              title="Henuz teklif yok"
              description="Bir tasarimdan teklif olusturup kaydederek baslayin."
              action={<AppButton label="Tasarimlara Git" onPress={() => router.push(routes.designs)} />}
            />
          }
        />
      )}
    </AppScreen>
  );
}

function QuoteCard({
  quote,
  onOpenDesign,
  onShare,
  onSharePdf,
  onAccept,
  onReject,
}: {
  quote: Quote;
  onOpenDesign: () => void;
  onShare: () => void;
  onSharePdf: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.titleColumn}>
          <Text style={styles.title}>{quote.customerName ?? quote.designName}</Text>
          <Text style={styles.caption}>{quote.customerPhone ?? quote.designName}</Text>
        </View>
        <View style={[styles.badge, getStatusStyle(quote.status)]}>
          <Text style={styles.badgeText}>{statusLabels[quote.status]}</Text>
        </View>
      </View>
      <Info label="Olcu" value={`${quote.width} x ${quote.height} mm`} />
      <Info label="Adet" value={String(quote.quantity)} />
      <Info label="Profil" value={quote.profileSystemName} />
      <Info label="Cam" value={quote.glassTypeName} />
      <Info label="Toplam" value={formatCurrency(quote.total)} />
      <Text style={styles.date}>Guncellendi: {new Date(quote.updatedAt).toLocaleDateString('tr-TR')}</Text>
      <View style={styles.actions}>
        <AppButton label="Paylas" onPress={onShare} style={styles.actionButton} />
        <AppButton label="PDF" variant="secondary" onPress={onSharePdf} style={styles.actionButton} />
      </View>
      <View style={styles.actions}>
        <AppButton label="Tasarim" variant="secondary" onPress={onOpenDesign} style={styles.actionButton} />
        <AppButton
          label="Kabul"
          variant="secondary"
          disabled={quote.status === 'accepted'}
          onPress={onAccept}
          style={styles.actionButton}
        />
      </View>
      <View style={styles.actions}>
        <AppButton
          label="Red"
          variant="secondary"
          disabled={quote.status === 'rejected'}
          onPress={onReject}
          style={styles.actionButton}
        />
      </View>
    </AppCard>
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

function getStatusStyle(status: QuoteStatus) {
  if (status === 'accepted') {
    return styles.badgeAccepted;
  }

  if (status === 'rejected') {
    return styles.badgeRejected;
  }

  if (status === 'sent') {
    return styles.badgeSent;
  }

  return styles.badgeDraft;
}

function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString('tr-TR')} TL`;
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  list: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    gap: spacing.sm,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  titleColumn: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '700',
  },
  badgeDraft: {
    backgroundColor: colors.textSecondary,
  },
  badgeSent: {
    backgroundColor: colors.primary,
  },
  badgeAccepted: {
    backgroundColor: colors.success,
  },
  badgeRejected: {
    backgroundColor: colors.error,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '700',
    textAlign: 'right',
  },
  date: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    minHeight: 42,
  },
});
