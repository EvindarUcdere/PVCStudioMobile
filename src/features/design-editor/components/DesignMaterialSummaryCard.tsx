import { StyleSheet, Text, View } from 'react-native';

import { DesignProject } from '../../../domain/designs/entities/DesignProject';
import { calculateDesignMaterialSummary } from '../../../domain/designs/measurement/calculateDesignMaterialSummary';
import { colors, radius, spacing, typography } from '../../../theme';

type DesignMaterialSummaryCardProps = {
  design: DesignProject;
};

export function DesignMaterialSummaryCard({ design }: DesignMaterialSummaryCardProps) {
  const summary = calculateDesignMaterialSummary(design);
  const firstPanels = summary.panels.slice(0, 4);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Genel Tasarim Ozeti</Text>
      <View style={styles.summaryGrid}>
        <SummaryBox label="Panel" value={String(summary.panelCount)} />
        <SummaryBox label="Cam" value={String(summary.glassCount)} />
        <SummaryBox label="Acilir" value={String(summary.openingPanelCount)} />
        <SummaryBox label="Sabit" value={String(summary.fixedPanelCount)} />
      </View>
      <Info label="Dis olcu" value={`${summary.designWidth} x ${summary.designHeight} mm`} />
      <Info label="Adet" value={String(summary.quantity)} />
      <Info label="Profil" value={summary.profileName} />
      <View style={styles.colorRow}>
        <Text style={styles.label}>Renk</Text>
        <View style={styles.colorValue}>
          <View style={[styles.colorDot, { backgroundColor: summary.profileColorHex }]} />
          <Text style={styles.value}>{summary.profileColorName}</Text>
        </View>
      </View>
      {summary.archHeight ? <Info label="Kemer yuksekligi" value={`${summary.archHeight} mm`} /> : null}
      <Info
        label="Kasa/kanat"
        value={`Kasa ${summary.frameWidth} mm, kanat ${summary.sashWidth} mm`}
      />
      <Info
        label="Kayit/cam payi"
        value={`Kayit ${summary.mullionWidth} mm, cam ${summary.glassRebate} mm`}
      />
      <View style={styles.panelList}>
        <Text style={styles.sectionLabel}>Ilk cam olculeri</Text>
        {firstPanels.map((panel, index) => (
          <Info
            key={panel.panelId}
            label={`Cam ${index + 1}`}
            value={`${panel.glassWidth} x ${panel.glassHeight} mm`}
          />
        ))}
      </View>
      <Text style={styles.description}>
        Bu ozet teklif ve uretim listesi icin on hazirliktir; kesin kesim hesabi profil teknik kartlariyla netlesecek.
      </Text>
    </View>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryBox}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  summaryBox: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    padding: spacing.sm,
  },
  summaryValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
  },
  value: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'right',
  },
  colorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  colorValue: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  colorDot: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 16,
    width: 16,
  },
  panelList: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
