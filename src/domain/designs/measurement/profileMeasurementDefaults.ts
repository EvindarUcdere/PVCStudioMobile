import { ProfileSystemSelection } from '../entities/ProfileSystemSelection';

export type ProfileMeasurementSettings = {
  seriesId: string;
  profileName: string;
  frameWidth: number;
  sashWidth: number;
  mullionWidth: number;
  glassRebate: number;
  cuttingAllowance: number;
  weldingAllowance: number;
};

export const defaultProfileMeasurementSettings: ProfileMeasurementSettings = {
  seriesId: 'standard-70',
  profileName: 'Standart 70 mm',
  frameWidth: 70,
  sashWidth: 62,
  mullionWidth: 76,
  glassRebate: 18,
  cuttingAllowance: 3,
  weldingAllowance: 2,
};

export function getProfileMeasurementSettings(
  profileSystem: ProfileSystemSelection | null,
): ProfileMeasurementSettings {
  if (!profileSystem) {
    return defaultProfileMeasurementSettings;
  }

  return {
    seriesId: profileSystem.seriesId,
    profileName: `${profileSystem.seriesId} (${profileSystem.profileWidth} mm)`,
    frameWidth: profileSystem.profileWidth,
    sashWidth: Math.max(48, Math.round(profileSystem.profileWidth * 0.88)),
    mullionWidth: Math.max(58, Math.round(profileSystem.profileWidth * 1.08)),
    glassRebate: 18,
    cuttingAllowance: 3,
    weldingAllowance: 2,
  };
}
