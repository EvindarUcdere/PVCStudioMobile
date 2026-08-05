import { DesignProject } from '../entities/DesignProject';
import { GlassSelection } from '../entities/GlassSelection';
import { InsectScreenType } from '../entities/PanelNode';
import { OpeningType } from '../enums/OpeningType';
import { getDesignProfileColor } from '../colors/profileColorOptions';
import { collectPanels } from '../utils/findNodeById';
import { getArchHeight, isArchTopFrame } from '../utils/frameShape';
import { calculatePanelMeasurements, PanelMeasurementResult } from './calculatePanelMeasurements';
import { getProfileMeasurementSettings } from './profileMeasurementDefaults';

export type MaterialSummaryPanel = {
  panelId: string;
  openingType: OpeningType;
  insectScreen: InsectScreenType | null;
  infillType: 'glass' | 'pvc_panel';
  infillLabel: string;
  panelWidth: number;
  panelHeight: number;
  glassWidth: number;
  glassHeight: number;
  estimatedCutWidth: number;
  estimatedCutHeight: number;
  usesSash: boolean;
};

export type DesignMaterialSummary = {
  designWidth: number;
  designHeight: number;
  quantity: number;
  panelCount: number;
  glassCount: number;
  openingPanelCount: number;
  fixedPanelCount: number;
  profileName: string;
  profileColorName: string;
  profileColorHex: string;
  frameWidth: number;
  sashWidth: number;
  mullionWidth: number;
  glassRebate: number;
  archHeight: number | null;
  rollerShutterHeight: number | null;
  rollerShutterAreaSquareMeters: number;
  panels: MaterialSummaryPanel[];
};

export function calculateDesignMaterialSummary(design: DesignProject): DesignMaterialSummary {
  const panels = collectPanels(design.rootNode);
  const profile = getProfileMeasurementSettings(design.profileSystem);
  const profileColor = getDesignProfileColor(design.profileSystem);
  const panelSummaries = panels
    .map((panel) =>
      toMaterialPanel(
        panel.id,
        panel.openingType,
        panel.insectScreen ?? null,
        panel.glass ?? null,
        calculatePanelMeasurements(design, panel.id, panel.openingType),
      ),
    )
    .filter((panel): panel is MaterialSummaryPanel => panel !== null);
  const openingPanelCount = panelSummaries.filter((panel) => panel.usesSash).length;
  const glassPanelCount = panelSummaries.filter((panel) => panel.infillType === 'glass').length;
  const archHeight =
    design.rootNode.type === 'frame' && isArchTopFrame(design.rootNode)
      ? getArchHeight(design.rootNode, design.height)
      : null;
  const rollerShutterHeight =
    design.rootNode.type === 'frame' && design.rootNode.rollerShutter?.enabled
      ? design.rootNode.rollerShutter.height
      : null;

  return {
    designWidth: design.width,
    designHeight: design.height,
    quantity: design.quantity,
    panelCount: panels.length,
    glassCount: glassPanelCount,
    openingPanelCount,
    fixedPanelCount: panelSummaries.length - openingPanelCount,
    profileName: profile.profileName,
    profileColorName: profileColor.name,
    profileColorHex: profileColor.hexValue,
    frameWidth: profile.frameWidth,
    sashWidth: profile.sashWidth,
    mullionWidth: profile.mullionWidth,
    glassRebate: profile.glassRebate,
    archHeight,
    rollerShutterHeight,
    rollerShutterAreaSquareMeters: rollerShutterHeight
      ? Math.round(((design.width * rollerShutterHeight) / 1_000_000) * 100) / 100
      : 0,
    panels: panelSummaries,
  };
}

function toMaterialPanel(
  panelId: string,
  openingType: OpeningType,
  insectScreen: InsectScreenType | null,
  glass: GlassSelection | null,
  measurements: PanelMeasurementResult | null,
): MaterialSummaryPanel | null {
  if (!measurements) {
    return null;
  }

  const isPvcPanel = glass?.glassTypeId === 'pvc-panel';

  return {
    panelId,
    openingType,
    insectScreen,
    infillType: isPvcPanel ? 'pvc_panel' : 'glass',
    infillLabel: isPvcPanel ? 'PVC dolgu' : 'Cam',
    panelWidth: measurements.panelWidth,
    panelHeight: measurements.panelHeight,
    glassWidth: measurements.glassWidth,
    glassHeight: measurements.glassHeight,
    estimatedCutWidth: measurements.estimatedCutWidth,
    estimatedCutHeight: measurements.estimatedCutHeight,
    usesSash: measurements.usesSash,
  };
}
