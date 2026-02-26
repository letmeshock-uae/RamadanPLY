/**
 * Detect if a PLY property list represents a 3D Gaussian Splat file.
 * 3DGS PLYs contain per-point gaussian attributes beyond xyz+rgb.
 */
export interface DetectResult {
  is3dgs: boolean;
  reason: string;
}

const SCALE_PROPS = ['scale_0', 'scale_1', 'scale_2'];
const ROT_PROPS = ['rot_0', 'rot_1', 'rot_2', 'rot_3'];
const OPACITY_PROPS = ['opacity'];
const SH_PROPS = ['f_dc_0', 'f_dc_1', 'f_dc_2'];

export function detect3dgs(properties: string[]): DetectResult {
  const propSet = new Set(properties);

  const hasOpacity = OPACITY_PROPS.some((p) => propSet.has(p));
  const hasScale = SCALE_PROPS.some((p) => propSet.has(p));
  const hasRot = ROT_PROPS.some((p) => propSet.has(p));
  const hasSH = SH_PROPS.some((p) => propSet.has(p));

  if (hasOpacity && hasScale && hasRot) {
    return {
      is3dgs: true,
      reason: `3DGS attributes detected: opacity=${hasOpacity}, scale=${hasScale}, rot=${hasRot}, SH=${hasSH}`,
    };
  }

  if (hasSH) {
    return {
      is3dgs: true,
      reason: `3DGS SH coefficients detected: f_dc_* present`,
    };
  }

  return {
    is3dgs: false,
    reason: `No 3DGS attributes found (opacity=${hasOpacity}, scale=${hasScale}, rot=${hasRot})`,
  };
}
