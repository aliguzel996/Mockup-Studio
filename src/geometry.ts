import type { ExportSettings, ProjectState, ScreenGeometry } from './types';

export interface OutputDimensions {
  width: number;
  height: number;
}

export interface PreviewLayout {
  viewportWidth: number;
  viewportHeight: number;
  stageX: number;
  stageY: number;
  stageWidth: number;
  stageHeight: number;
}

export const resolveOutputDimensions = (settings: ExportSettings, previewAspect = 16 / 9): OutputDimensions => {
  if (settings.longEdge === 0) {
    const width = Math.max(320, Math.round(settings.customWidth || 1920));
    const height = Math.max(180, Math.round(settings.customHeight || 1080));
    return { width, height };
  }
  const longEdge = Math.max(320, Math.round(settings.longEdge));
  const aspect = Math.max(0.1, Math.min(10, Number(previewAspect) || 16 / 9));
  if (aspect >= 1) return { width: longEdge, height: Math.max(180, Math.round(longEdge / aspect)) };
  return { width: Math.max(320, Math.round(longEdge * aspect)), height: longEdge };
};

export const screenAspect = (geometry: ScreenGeometry, stageAspect = 16 / 9) => {
  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot((b.x - a.x) * stageAspect, b.y - a.y);
  const top = distance(geometry.topLeft, geometry.topRight);
  const bottom = distance(geometry.bottomLeft, geometry.bottomRight);
  const left = distance(geometry.topLeft, geometry.bottomLeft);
  const right = distance(geometry.topRight, geometry.bottomRight);
  return ((top + bottom) / 2) / Math.max(0.0001, (left + right) / 2);
};

export const adjustScreenGeometry = (
  geometry: ScreenGeometry,
  state: Pick<ProjectState, 'screenScaleX' | 'screenScaleY' | 'screenOffsetX' | 'screenOffsetY'>,
): ScreenGeometry => {
  const xs = [geometry.topLeft.x, geometry.topRight.x, geometry.bottomRight.x, geometry.bottomLeft.x];
  const ys = [geometry.topLeft.y, geometry.topRight.y, geometry.bottomRight.y, geometry.bottomLeft.y];
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const centerX = left + (right - left) / 2;
  const centerY = top + (bottom - top) / 2;
  const scaleX = Math.max(0.1, state.screenScaleX / 100);
  const scaleY = Math.max(0.1, state.screenScaleY / 100);
  const offsetX = state.screenOffsetX / 100;
  const offsetY = state.screenOffsetY / 100;
  const transform = (point: { x: number; y: number }) => ({
    x: centerX + (point.x - centerX) * scaleX + offsetX,
    y: centerY + (point.y - centerY) * scaleY + offsetY,
  });
  return {
    ...geometry,
    topLeft: transform(geometry.topLeft),
    topRight: transform(geometry.topRight),
    bottomRight: transform(geometry.bottomRight),
    bottomLeft: transform(geometry.bottomLeft),
  };
};
