import { StyleSheet, Text, View } from 'react-native';

import { DesignProject } from '../../../domain/designs/entities/DesignProject';
import { OpeningType } from '../../../domain/designs/enums/OpeningType';
import { calculatePanelMeasurements } from '../../../domain/designs/measurement/calculatePanelMeasurements';
import { findNodeById } from '../../../domain/designs/utils/findNodeById';
import { getArchHeight, isArchTopFrame } from '../../../domain/designs/utils/frameShape';
import { colors, radius, spacing, typography } from '../../../theme';

type SelectedPanelSheetProps = {
  design: DesignProject;
  selectedNodeId: string | null;
};

const openingLabels: Record<OpeningType, string> = {
  fixed: 'Sabit',
  'open-left': 'Sola acilir',
  'open-right': 'Saga acilir',
  tilt: 'Vasistas',
  'tilt-top': 'Vasistas alttan acilir',
  'tilt-bottom': 'Vasistas ustten acilir',
  'tilt-turn-left': 'Sol cift acilim',
  'tilt-turn-right': 'Sag cift acilim',
  'double-sash': 'Cift kanat',
  'sliding-left': 'Surme sol',
  'sliding-right': 'Surme sag',
  'door-left': 'Sol kapi',
  'door-right': 'Sag kapi',
};

export function SelectedPanelSheet({ design, selectedNodeId }: SelectedPanelSheetProps) {
  if (!selectedNodeId) {
    return (
      <View style={styles.sheet}>
        <Text style={styles.title}>Panel secilmedi</Text>
        <Text style={styles.description}>Bilgilerini gormek icin cizimde bir panele dokun.</Text>
      </View>
    );
  }

  const node = findNodeById(design.rootNode, selectedNodeId);
  if (node?.type !== 'panel') {
    return (
      <View style={styles.sheet}>
        <Text style={styles.title}>Panel bulunamadi</Text>
        <Text style={styles.description}>Secim gecersiz. Baska bir panele dokun.</Text>
      </View>
    );
  }

  const measurements = calculatePanelMeasurements(design, node.id, node.openingType);
  const archHeight =
    design.rootNode.type === 'frame' && isArchTopFrame(design.rootNode)
      ? getArchHeight(design.rootNode, design.height)
      : null;

  return (
    <View style={styles.sheet}>
      <Text style={styles.title}>Secili Panel Detayi</Text>
      {measurements ? (
        <View style={styles.measureSummary}>
          <View style={styles.measureBox}>
            <Text style={styles.measureLabel}>Panel</Text>
            <Text style={styles.measureValue}>
              {measurements.panelWidth} x {measurements.panelHeight}
            </Text>
            <Text style={styles.measureUnit}>mm</Text>
          </View>
          <View style={styles.measureBox}>
            <Text style={styles.measureLabel}>Cam</Text>
            <Text style={styles.measureValue}>
              {measurements.glassWidth} x {measurements.glassHeight}
            </Text>
            <Text style={styles.measureUnit}>mm</Text>
          </View>
        </View>
      ) : null}
      <Info label="Tur" value="Panel" />
      <Info label="Acilim" value={openingLabels[node.openingType] ?? 'Bilinmeyen acilim'} />
      <Info label="Dis kasa" value={`${design.width} x ${design.height} mm`} />
      {archHeight ? <Info label="Kemer yuksekligi" value={`${archHeight} mm`} /> : null}
      <Info label="Profil" value={measurements ? measurements.profile.profileName : '-'} />
      <Info
        label="Kasa/kanat"
        value={
          measurements
            ? `Kasa ${measurements.profile.frameWidth} mm, kanat ${measurements.profile.sashWidth} mm`
            : '-'
        }
      />
      <Info
        label="Kayit/cam payi"
        value={
          measurements
            ? `Kayit ${measurements.profile.mullionWidth} mm, cam ${measurements.profile.glassRebate} mm`
            : '-'
        }
      />
      <Info
        label="Panel net"
        value={measurements ? `${measurements.panelWidth} x ${measurements.panelHeight} mm` : '-'}
      />
      <Info
        label="Kanat boslugu"
        value={
          measurements ? `${measurements.sashClearWidth} x ${measurements.sashClearHeight} mm` : '-'
        }
      />
      <Info
        label="Tahmini cam"
        value={measurements ? `${measurements.glassWidth} x ${measurements.glassHeight} mm` : '-'}
      />
      <Info
        label="Kesim payi"
        value={
          measurements
            ? `${measurements.profile.cuttingAllowance} mm, kaynak ${measurements.profile.weldingAllowance} mm`
            : '-'
        }
      />
      <Info
        label="Tahmini kesim"
        value={
          measurements ? `${measurements.estimatedCutWidth} x ${measurements.estimatedCutHeight} mm` : '-'
        }
      />
      <Info label="Cam" value={node.glass?.glassTypeId ?? design.defaultGlass?.glassTypeId ?? '-'} />
      {node.notes ? <Info label="Not" value={node.notes} /> : null}
      <Text style={styles.description}>
        Cam olcusu profil kalinligina gore tahmini hesaplanir; kesin uretim hesabi sonraki fazda
        profil teknik kartlariyla netlesecek.
      </Text>
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
  sheet: {
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
  description: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
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
  measureSummary: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  measureBox: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    padding: spacing.sm,
  },
  measureLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  measureValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  measureUnit: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
