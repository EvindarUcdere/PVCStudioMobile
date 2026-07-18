import { DesignProject } from '../entities/DesignProject';
import { OpeningType } from '../enums/OpeningType';
import { getPanelRealDimensions } from '../utils/getPanelDimensions';
import {
  getProfileMeasurementSettings,
  ProfileMeasurementSettings,
} from './profileMeasurementDefaults';

export type PanelMeasurementResult = {
  profile: ProfileMeasurementSettings;
  outerWidth: number;
  outerHeight: number;
  panelWidth: number;
  panelHeight: number;
  sashClearWidth: number;
  sashClearHeight: number;
  glassWidth: number;
  glassHeight: number;
  estimatedCutWidth: number;
  estimatedCutHeight: number;
  usesSash: boolean;
};

export function calculatePanelMeasurements(
  design: DesignProject,
  panelId: string,
  openingType: OpeningType,
): PanelMeasurementResult | null {
  const dimensions = getPanelRealDimensions({
    rootNode: design.rootNode,
    panelId,
    designWidth: design.width,
    designHeight: design.height,
  });

  if (!dimensions) {
    return null;
  }

  const profile = getProfileMeasurementSettings(design.profileSystem);
  const usesSash = openingType !== 'fixed';
  const frameInset = profile.frameWidth * 2;
  const sashInset = usesSash ? profile.sashWidth * 2 : 0;
  const glassInset = profile.glassRebate * 2;
  const sashClearWidth = clampMeasurement(dimensions.width - frameInset);
  const sashClearHeight = clampMeasurement(dimensions.height - frameInset);
  const glassBaseWidth = usesSash ? sashClearWidth - sashInset : sashClearWidth;
  const glassBaseHeight = usesSash ? sashClearHeight - sashInset : sashClearHeight;

  return {
    profile,
    outerWidth: design.width,
    outerHeight: design.height,
    panelWidth: dimensions.width,
    panelHeight: dimensions.height,
    sashClearWidth,
    sashClearHeight,
    glassWidth: clampMeasurement(glassBaseWidth - glassInset),
    glassHeight: clampMeasurement(glassBaseHeight - glassInset),
    estimatedCutWidth: clampMeasurement(dimensions.width + profile.cuttingAllowance * 2),
    estimatedCutHeight: clampMeasurement(dimensions.height + profile.cuttingAllowance * 2),
    usesSash,
  };
}

function clampMeasurement(value: number): number {
  return Math.max(0, Math.round(value));
}
