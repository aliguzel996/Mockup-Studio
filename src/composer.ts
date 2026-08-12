import type {
  BackgroundMode,
  FitMode,
  FramePreset,
  ProjectState,
  ScreenGeometry,
} from './types';
import { adjustScreenGeometry, resolveOutputDimensions, screenAspect } from './geometry';
import type { PreviewLayout } from './geometry';
export { adjustScreenGeometry, resolveOutputDimensions, screenAspect } from './geometry';
export type { OutputDimensions, PreviewLayout } from './geometry';

export interface CompositeLayers {
  composite: HTMLCanvasElement;
  background: HTMLCanvasElement;
  screen: HTMLCanvasElement;
  frame: HTMLCanvasElement;
}

const frameScreenGeometry = (frame: FramePreset, state: ProjectState): ScreenGeometry => {
  if (!frame.customVariant) return frame.screen;
  return state.customGeometries?.[frame.customVariant]
    || (frame.customVariant === 'desktop' ? state.customGeometry : frame.screen);
};

const canvas = (width: number, height: number) => {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return element;
};

const roundedRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
};

const loadImage = (url?: string): Promise<HTMLImageElement | null> => new Promise((resolve) => {
  if (!url) return resolve(null);
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => resolve(null);
  image.src = url;
});

const drawCover = (
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  x: number,
  y: number,
  width: number,
  height: number,
  contain = false,
) => {
  const scale = contain
    ? Math.min(width / sourceWidth, height / sourceHeight)
    : Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
};

const pointAt = (geometry: ScreenGeometry, u: number, width: number, height: number, top: boolean) => {
  const start = top ? geometry.topLeft : geometry.bottomLeft;
  const end = top ? geometry.topRight : geometry.bottomRight;
  return {
    x: (start.x + (end.x - start.x) * u) * width,
    y: (start.y + (end.y - start.y) * u) * height,
  };
};

const geometryBounds = (geometry: ScreenGeometry) => {
  const xs = [geometry.topLeft.x, geometry.topRight.x, geometry.bottomRight.x, geometry.bottomLeft.x];
  const ys = [geometry.topLeft.y, geometry.topRight.y, geometry.bottomRight.y, geometry.bottomLeft.y];
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
};

const isRectangularGeometry = (geometry: ScreenGeometry) => Math.abs(geometry.topLeft.y - geometry.topRight.y) < 0.00001
  && Math.abs(geometry.bottomLeft.y - geometry.bottomRight.y) < 0.00001
  && Math.abs(geometry.topLeft.x - geometry.bottomLeft.x) < 0.00001
  && Math.abs(geometry.topRight.x - geometry.bottomRight.x) < 0.00001;

const screenPath = (
  ctx: CanvasRenderingContext2D,
  geometry: ScreenGeometry,
  width: number,
  height: number,
  cornerRadius = 0,
) => {
  if (isRectangularGeometry(geometry)) {
    const bounds = geometryBounds(geometry);
    roundedRectPath(ctx, bounds.left * width, bounds.top * height, bounds.width * width, bounds.height * height, cornerRadius);
    return;
  }
  const segments = 96;
  ctx.beginPath();
  for (let index = 0; index <= segments; index += 1) {
    const point = pointAt(geometry, index / segments, width, height, true);
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  }
  for (let index = segments; index >= 0; index -= 1) {
    const point = pointAt(geometry, index / segments, width, height, false);
    ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
};

const withCamera = (
  ctx: CanvasRenderingContext2D,
  state: ProjectState,
  width: number,
  height: number,
  render: () => void,
) => {
  const zoom = Math.max(0.25, state.cameraZoom / 100);
  const panX = (state.cameraX / 100) * width * 0.28;
  const panY = (state.cameraY / 100) * height * 0.28;
  const tiltX = (state.tiltX * Math.PI) / 180;
  const tiltY = (state.tiltY * Math.PI) / 180;
  ctx.save();
  ctx.translate(width / 2 + panX, height / 2 + panY);
  ctx.rotate((state.tilt * Math.PI) / 180);
  ctx.transform(
    Math.cos(tiltY),
    -Math.sin(tiltX) * 0.14,
    Math.sin(tiltY) * 0.14,
    Math.cos(tiltX),
    0,
    0,
  );
  ctx.scale(zoom, zoom);
  ctx.translate(-width / 2, -height / 2);
  render();
  ctx.restore();
};

const drawBackground = async (
  ctx: CanvasRenderingContext2D,
  mode: BackgroundMode,
  color: string,
  imageUrl: string | undefined,
  width: number,
  height: number,
  state: ProjectState,
) => {
  if (mode === 'transparent') return;
  if (mode === 'black' || mode === 'white' || mode === 'custom') {
    ctx.fillStyle = mode === 'black' ? '#000000' : mode === 'white' ? '#ffffff' : color;
    ctx.fillRect(0, 0, width, height);
    return;
  }
  if (mode === 'gradient') {
    let gradient: CanvasGradient;
    if (state.backgroundGradientType === 'radial') {
      gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.hypot(width, height) / 2);
    } else {
      const angle = ((state.backgroundGradientAngle - 90) * Math.PI) / 180;
      const span = Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle));
      const dx = Math.cos(angle) * span / 2;
      const dy = Math.sin(angle) * span / 2;
      gradient = ctx.createLinearGradient(width / 2 - dx, height / 2 - dy, width / 2 + dx, height / 2 + dy);
    }
    const stops = Array.isArray(state.backgroundGradientStops) && state.backgroundGradientStops.length >= 2
      ? [...state.backgroundGradientStops].sort((left, right) => left.position - right.position)
      : [
        { color: state.backgroundGradientFrom || '#050505', position: 0 },
        { color: state.backgroundGradientTo || '#f2f2ee', position: 100 },
      ];
    for (const stop of stops) {
      const color = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(stop.color) ? stop.color : '#000000';
      gradient.addColorStop(Math.max(0, Math.min(100, Number(stop.position) || 0)) / 100, color);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    return;
  }
  const background = await loadImage(imageUrl);
  if (!background) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    return;
  }
  drawCover(ctx, background, background.naturalWidth, background.naturalHeight, 0, 0, width, height);
};

const deviceRect = (frame: FramePreset, state: ProjectState, width: number, height: number) => {
  if (!frame.customVariant && frame.body) {
    const geometry = adjustScreenGeometry(frame.body, state);
    const bounds = geometryBounds(geometry);
    return {
      x: bounds.left * width,
      y: bounds.top * height,
      width: bounds.width * width,
      height: bounds.height * height,
      radius: Math.max(0, state.frameCornerRadius) * width / 1000,
    };
  }
  const geometry = adjustScreenGeometry(frameScreenGeometry(frame, state), state);
  const bounds = geometryBounds(geometry);
  const scale = width / 1000;
  const thickness = Math.max(0, state.frameThickness) * scale;
  return {
    x: bounds.left * width - thickness,
    y: bounds.top * height - thickness,
    width: bounds.width * width + thickness * 2,
    height: bounds.height * height + thickness * 2,
    radius: Math.max(0, state.frameCornerRadius) * scale,
  };
};

const deviceBodyGeometry = (frame: FramePreset, state: ProjectState, width: number, height: number): ScreenGeometry => {
  const body = deviceRect(frame, state, width, height);
  return {
    topLeft: { x: body.x / width, y: body.y / height },
    topRight: { x: (body.x + body.width) / width, y: body.y / height },
    bottomRight: { x: (body.x + body.width) / width, y: (body.y + body.height) / height },
    bottomLeft: { x: body.x / width, y: (body.y + body.height) / height },
    cornerRadius: body.radius,
  };
};

const expandGeometry = (geometry: ScreenGeometry, padX: number, padY: number): ScreenGeometry => ({
  ...geometry,
  topLeft: { x: geometry.topLeft.x - padX, y: geometry.topLeft.y - padY },
  topRight: { x: geometry.topRight.x + padX, y: geometry.topRight.y - padY },
  bottomRight: { x: geometry.bottomRight.x + padX, y: geometry.bottomRight.y + padY },
  bottomLeft: { x: geometry.bottomLeft.x - padX, y: geometry.bottomLeft.y + padY },
});

const hexRgb = (value: string) => {
  const normalized = /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1) : '222222';
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16));
};

const mixColor = (source: string, target: string, amount: number) => {
  const from = hexRgb(source);
  const to = hexRgb(target);
  const ratio = Math.max(0, Math.min(1, amount));
  return `rgb(${from.map((channel, index) => Math.round(channel + (to[index] - channel) * ratio)).join(',')})`;
};

const partSurface = (
  ctx: CanvasRenderingContext2D,
  state: ProjectState,
  color: string,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  if (!state.partGradientEnabled) return color;
  const angle = (state.partGradientAngle * Math.PI) / 180;
  const span = Math.max(width, height, Math.hypot(width, height) * Math.max(1, state.partGradientSize / 100));
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const dx = Math.cos(angle) * span / 2;
  const dy = Math.sin(angle) * span / 2;
  const contrast = 1 - Math.max(0, Math.min(100, state.partGradientSoftness)) * 0.0082;
  const reflection = Math.max(0, Math.min(1, state.materialReflectivity / 100)) * contrast;
  const roughness = Math.max(0, Math.min(1, state.materialRoughness / 100)) * contrast;
  const gradient = ctx.createLinearGradient(centerX - dx, centerY - dy, centerX + dx, centerY + dy);
  gradient.addColorStop(0, mixColor(color, '#000000', 0.34 * contrast + roughness * 0.08));
  gradient.addColorStop(0.38, color);
  gradient.addColorStop(0.5, mixColor(color, '#ffffff', 0.34 * reflection));
  gradient.addColorStop(0.62, color);
  gradient.addColorStop(1, mixColor(color, '#000000', 0.38 * contrast + roughness * 0.08));
  return gradient;
};

const framePalette = (frame: FramePreset, state: ProjectState) => {
  const fallback = frame.finish === 'silver' ? '#b9b9b5' : frame.finish === 'titanium' ? '#68665f' : frame.finish === 'graphite' ? '#30312f' : '#111111';
  const color = state.deviceColor || fallback;
  const reflection = Math.max(0, Math.min(1, state.materialReflectivity / 100));
  const roughness = Math.max(0, Math.min(1, state.materialRoughness / 100));
  if (state.deviceMaterial === 'matte') return { start: mixColor(color, '#ffffff', reflection * 0.12), mid: color, end: mixColor(color, '#000000', roughness * 0.18), dark: mixColor(color, '#000000', 0.28 + roughness * 0.22) };
  if (state.deviceMaterial === 'plastic') return { start: mixColor(color, '#ffffff', 0.12 + reflection * 0.28), mid: color, end: mixColor(color, '#000000', 0.18 + roughness * 0.2), dark: mixColor(color, '#000000', 0.38) };
  if (state.deviceMaterial === 'glass') return { start: mixColor(color, '#ffffff', 0.3 + reflection * 0.35), mid: mixColor(color, '#000000', 0.28), end: mixColor(color, '#ffffff', reflection * 0.32), dark: mixColor(color, '#000000', 0.52) };
  return { start: mixColor(color, '#ffffff', 0.22 + reflection * 0.42), mid: mixColor(color, '#000000', 0.24 + roughness * 0.18), end: mixColor(color, '#ffffff', reflection * 0.2), dark: mixColor(color, '#000000', 0.42 + roughness * 0.2) };
};

const drawDeviceBack = (
  ctx: CanvasRenderingContext2D,
  frame: FramePreset,
  state: ProjectState,
  width: number,
  height: number,
) => {
  const body = deviceRect(frame, state, width, height);
  const bodyGeometry = deviceBodyGeometry(frame, state, width, height);
  const scale = width / 1000;
  const palette = framePalette(frame, state);
  ctx.save();

  if (frame.kind === 'monitor' || frame.kind === 'custom') {
    const stemWidth = width * state.stemWidth / 100;
    const stemX = width / 2 - stemWidth / 2;
    const bodyBottom = pointAt(bodyGeometry, 0.5, width, height, false);
    const stemY = bodyBottom.y - height * 0.002;
    const stemHeight = height * state.stemHeight / 100;
    const baseY = stemY + stemHeight - height * 0.005;
    if (state.stemVisible) {
      if (state.wireframeEnabled && state.baseVisible) {
        const lineWidth = Math.max(1, state.wireframeThickness * scale);
        ctx.beginPath();
        ctx.moveTo(stemX - lineWidth / 2, stemY);
        ctx.lineTo(stemX - lineWidth / 2, baseY);
        ctx.moveTo(stemX + stemWidth + lineWidth / 2, stemY);
        ctx.lineTo(stemX + stemWidth + lineWidth / 2, baseY);
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = state.wireframeColor;
        ctx.stroke();
      } else {
        roundedRectPath(ctx, stemX, stemY, stemWidth, stemHeight, 0);
        if (state.wireframeEnabled) {
          const lineWidth = Math.max(1, state.wireframeThickness * scale);
          roundedRectPath(ctx, stemX - lineWidth / 2, stemY - lineWidth / 2, stemWidth + lineWidth, stemHeight + lineWidth, 0);
          ctx.lineWidth = lineWidth;
          ctx.strokeStyle = state.wireframeColor;
          ctx.stroke();
        } else {
          ctx.fillStyle = partSurface(ctx, state, state.stemColor, stemX, stemY, stemWidth, stemHeight);
          ctx.fill();
        }
      }
    }
    const baseWidth = width * state.baseWidth / 100;
    const baseHeight = height * state.baseHeight / 100;
    if (state.baseVisible) {
      if (state.wireframeEnabled) {
        const lineWidth = Math.max(1, state.wireframeThickness * scale);
        roundedRectPath(ctx, width / 2 - baseWidth / 2 - lineWidth / 2, baseY - lineWidth / 2, baseWidth + lineWidth, baseHeight + lineWidth, state.baseRadius * scale + lineWidth / 2);
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = state.wireframeColor;
        ctx.stroke();
      } else {
        roundedRectPath(ctx, width / 2 - baseWidth / 2, baseY, baseWidth, baseHeight, state.baseRadius * scale);
        ctx.fillStyle = partSurface(ctx, state, state.baseColor, width / 2 - baseWidth / 2, baseY, baseWidth, baseHeight);
        ctx.fill();
      }
    }
  }

  if (frame.kind === 'laptop' && state.deckVisible) {
    const deckY = body.y + body.height - height * 0.005;
    const deckHalfTop = width * state.deckWidth / 200;
    const deckHalfBottom = Math.min(width * 0.49, deckHalfTop + width * 0.008);
    const deckHeight = height * state.deckHeight / 100;
    ctx.beginPath();
    ctx.moveTo(width / 2 - deckHalfTop, deckY);
    ctx.lineTo(width / 2 + deckHalfTop, deckY);
    ctx.lineTo(width / 2 + deckHalfBottom, deckY + deckHeight * 0.62);
    ctx.quadraticCurveTo(width / 2 + deckHalfBottom * 0.9, deckY + deckHeight, width / 2 + deckHalfTop * 0.88, deckY + deckHeight);
    ctx.lineTo(width / 2 - deckHalfTop * 0.88, deckY + deckHeight);
    ctx.quadraticCurveTo(width / 2 - deckHalfBottom * 0.9, deckY + deckHeight, width / 2 - deckHalfBottom, deckY + deckHeight * 0.62);
    ctx.closePath();
    if (state.wireframeEnabled) {
      ctx.lineWidth = Math.max(1, state.wireframeThickness * scale);
      ctx.strokeStyle = state.wireframeColor;
      ctx.stroke();
    } else {
      ctx.fillStyle = partSurface(ctx, state, state.deckColor, width / 2 - deckHalfBottom, deckY, deckHalfBottom * 2, deckHeight);
      ctx.fill();
    }
  }

  if (!state.wireframeEnabled && state.shadowEnabled && state.shadowOpacity > 0) {
    const spread = state.shadowSpread * scale;
    const shadowWidth = body.width + spread * 2;
    const shadowHeight = body.height + spread * 2;
    if (shadowWidth > 0 && shadowHeight > 0) {
      ctx.save();
      ctx.shadowColor = `rgba(0,0,0,${state.shadowOpacity / 100})`;
      ctx.shadowBlur = Math.max(0, state.shadowBlur * scale);
      ctx.shadowOffsetX = state.shadowOffsetX * scale;
      ctx.shadowOffsetY = state.shadowOffsetY * scale;
      ctx.fillStyle = '#000';
      const shadowGeometry = expandGeometry(bodyGeometry, spread / width, spread / height);
      screenPath(ctx, shadowGeometry, width, height, Math.max(0, body.radius + spread));
      ctx.fill();
      ctx.restore();
    }
  }

  if (state.wireframeEnabled) {
    // The outside-only body outline is drawn once in drawDeviceOverlay.
  } else {
    screenPath(ctx, bodyGeometry, width, height, body.radius);
    const bezel = ctx.createLinearGradient(body.x, body.y, body.x + body.width, body.y + body.height);
    bezel.addColorStop(0, palette.start);
    bezel.addColorStop(0.34, palette.mid);
    bezel.addColorStop(0.76, palette.end);
    bezel.addColorStop(1, palette.dark);
    ctx.fillStyle = bezel;
    ctx.fill();
  }
  ctx.restore();
};

const drawDeviceOverlay = (
  ctx: CanvasRenderingContext2D,
  frame: FramePreset,
  state: ProjectState,
  width: number,
  height: number,
  customFrame: HTMLImageElement | null,
) => {
  const body = deviceRect(frame, state, width, height);
  const bodyGeometry = deviceBodyGeometry(frame, state, width, height);
  const geometry = adjustScreenGeometry(frameScreenGeometry(frame, state), state);
  const scale = width / 1000;
  const screenRadius = Math.max(0, state.screenCornerRadius) * scale;
  const detailScale = state.detailScale / 100;

  ctx.save();
  const bodyLineWidth = state.wireframeEnabled ? Math.max(1, state.wireframeThickness * scale) : Math.max(1, height * 0.0012);
  ctx.lineWidth = bodyLineWidth;
  ctx.strokeStyle = state.wireframeEnabled ? state.wireframeColor : 'rgba(255,255,255,.24)';
  const bodyOutlineGeometry = state.wireframeEnabled
    ? expandGeometry(bodyGeometry, bodyLineWidth / width / 2, bodyLineWidth / height / 2)
    : bodyGeometry;
  screenPath(ctx, bodyOutlineGeometry, width, height, body.radius + (state.wireframeEnabled ? bodyLineWidth / 2 : 0));
  ctx.stroke();
  const screenLineWidth = state.wireframeEnabled ? Math.max(1, state.wireframeThickness * scale) : Math.max(1, height * 0.0012);
  const screenOutlineGeometry = state.wireframeEnabled
    ? expandGeometry(geometry, screenLineWidth / width / 2, screenLineWidth / height / 2)
    : geometry;
  screenPath(ctx, screenOutlineGeometry, width, height, screenRadius + (state.wireframeEnabled ? screenLineWidth / 2 : 0));
  ctx.lineWidth = screenLineWidth;
  ctx.strokeStyle = state.wireframeEnabled ? state.wireframeColor : 'rgba(255,255,255,.16)';
  ctx.stroke();

  if (frame.kind === 'phone') {
    const buttonWidth = Math.max(2, width * 0.0028);
    const drawPhoneButton = (x: number, y: number, buttonHeight: number) => {
      roundedRectPath(ctx, x, y, buttonWidth, buttonHeight, 0);
      if (state.wireframeEnabled) {
        ctx.lineWidth = Math.max(1, state.wireframeThickness * scale);
        ctx.strokeStyle = state.wireframeColor;
        ctx.stroke();
      } else {
        ctx.fillStyle = state.deviceColor;
        ctx.fill();
        ctx.lineWidth = Math.max(1, height * 0.001);
        ctx.strokeStyle = 'rgba(255,255,255,.2)';
        ctx.stroke();
      }
    };
    if (state.phoneLeftControlsVisible) {
      drawPhoneButton(body.x - buttonWidth, body.y + body.height * 0.22, body.height * 0.08);
      drawPhoneButton(body.x - buttonWidth, body.y + body.height * 0.33, body.height * 0.06);
    }
    if (state.phoneRightButtonVisible) drawPhoneButton(body.x + body.width, body.y + body.height * 0.29, body.height * 0.13);
  }

  if (state.detailVisible && frame.detail === 'dynamic-island') {
    const top = pointAt(geometry, 0.5, width, height, true);
    roundedRectPath(ctx, top.x - width * 0.0275 * detailScale, top.y + height * 0.012, width * 0.055 * detailScale, height * 0.021 * detailScale, height * 0.011 * detailScale);
    if (state.wireframeEnabled) ctx.stroke(); else { ctx.fillStyle = state.detailColor; ctx.fill(); }
  } else if (state.detailVisible && frame.detail === 'notch') {
    const top = pointAt(geometry, 0.5, width, height, true);
    roundedRectPath(ctx, top.x - width * 0.04 * detailScale, top.y, width * 0.08 * detailScale, height * 0.022 * detailScale, height * 0.007 * detailScale);
    if (state.wireframeEnabled) ctx.stroke(); else { ctx.fillStyle = state.detailColor; ctx.fill(); }
  } else if (state.detailVisible && (frame.detail === 'tablet-camera' || frame.detail === 'display-camera')) {
    const bodyTop = pointAt(bodyGeometry, 0.5, width, height, true);
    ctx.beginPath();
    ctx.arc(bodyTop.x, bodyTop.y + Math.max(2, state.frameThickness * scale * 0.5), Math.max(1.5, height * 0.0027) * detailScale, 0, Math.PI * 2);
    if (state.wireframeEnabled) ctx.stroke(); else { ctx.fillStyle = state.detailColor; ctx.fill(); }
  }

  if (customFrame && !state.wireframeEnabled) {
    drawCover(ctx, customFrame, customFrame.naturalWidth, customFrame.naturalHeight, body.x, body.y, body.width, body.height, true);
  }
  ctx.restore();
};

const prepareSource = (
  source: HTMLImageElement,
  geometry: ScreenGeometry,
  width: number,
  height: number,
  fitMode: FitMode,
) => {
  const targetAspect = screenAspect(geometry, width / height);
  const targetWidth = Math.max(32, Math.round(width * 0.82));
  const targetHeight = Math.max(32, Math.round(targetWidth / targetAspect));
  const prepared = canvas(targetWidth, targetHeight);
  const ctx = prepared.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#090b09';
  if (fitMode === 'contain') ctx.fillRect(0, 0, targetWidth, targetHeight);
  drawCover(
    ctx,
    source,
    source.naturalWidth,
    source.naturalHeight,
    0,
    0,
    targetWidth,
    targetHeight,
    fitMode === 'contain',
  );
  return prepared;
};

const drawScreenToGeometry = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  geometry: ScreenGeometry,
  width: number,
  height: number,
  cornerRadius: number,
) => {
  ctx.save();
  screenPath(ctx, geometry, width, height, cornerRadius);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // Full-height sub-pixel columns preserve perspective for calibrated quads.
  const steps = Math.max(320, Math.min(3200, source.width, Math.round(width * 0.92)));
  for (let index = 0; index < steps; index += 1) {
    const u0 = index / steps;
    const u1 = (index + 1) / steps;
    const top0 = pointAt(geometry, u0, width, height, true);
    const top1 = pointAt(geometry, u1, width, height, true);
    const bottom0 = pointAt(geometry, u0, width, height, false);
    const sourceX = u0 * source.width;
    const sourceWidth = Math.max(0.01, (u1 - u0) * source.width);
    const drawX = Math.max(0, sourceX - 0.85);
    const drawEnd = Math.min(source.width, sourceX + sourceWidth + 0.85);
    const drawWidth = drawEnd - drawX;
    const a = (top1.x - top0.x) / sourceWidth;
    const b = (top1.y - top0.y) / sourceWidth;
    const c = (bottom0.x - top0.x) / source.height;
    const d = (bottom0.y - top0.y) / source.height;
    ctx.save();
    ctx.transform(a, b, c, d, top0.x - a * sourceX, top0.y - b * sourceX);
    ctx.drawImage(source, drawX, 0, drawWidth, source.height, drawX, 0, drawWidth, source.height);
    ctx.restore();
  }
  ctx.restore();
};

const applyMatte = (
  ctx: CanvasRenderingContext2D,
  geometry: ScreenGeometry,
  width: number,
  height: number,
  matte: boolean,
  glare: number,
  cornerRadius: number,
) => {
  ctx.save();
  screenPath(ctx, geometry, width, height, cornerRadius);
  ctx.clip();
  const left = Math.min(geometry.topLeft.x, geometry.bottomLeft.x) * width;
  const right = Math.max(geometry.topRight.x, geometry.bottomRight.x) * width;
  const top = Math.min(geometry.topLeft.y, geometry.topRight.y) * height;
  const bottom = Math.max(geometry.bottomLeft.y, geometry.bottomRight.y) * height;
  const edge = ctx.createRadialGradient((left + right) / 2, (top + bottom) / 2, 0, (left + right) / 2, (top + bottom) / 2, Math.max(right - left, bottom - top) * 0.64);
  edge.addColorStop(0, 'rgba(255,255,255,0)');
  edge.addColorStop(0.74, matte ? 'rgba(0,0,0,.012)' : 'rgba(0,0,0,.005)');
  edge.addColorStop(1, matte ? 'rgba(0,0,0,.085)' : 'rgba(0,0,0,.04)');
  ctx.fillStyle = edge;
  ctx.fillRect(left, top, right - left, bottom - top);

  if (glare > 0) {
    const reflection = ctx.createLinearGradient(left, top, right, bottom);
    reflection.addColorStop(0, `rgba(255,255,255,${0.0018 * glare})`);
    reflection.addColorStop(0.42, `rgba(255,255,255,${0.0005 * glare})`);
    reflection.addColorStop(0.68, 'rgba(255,255,255,0)');
    ctx.fillStyle = reflection;
    ctx.fillRect(left, top, right - left, bottom - top);
  }
  ctx.restore();
};

const applyCustomMask = (
  ctx: CanvasRenderingContext2D,
  frame: FramePreset,
  state: ProjectState,
  width: number,
  height: number,
  mask: HTMLImageElement | null,
) => {
  if (!mask) return;
  const body = deviceRect(frame, state, width, height);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  drawCover(ctx, mask, mask.naturalWidth, mask.naturalHeight, body.x, body.y, body.width, body.height, true);
  ctx.restore();
};

const cutScreenAperture = (
  ctx: CanvasRenderingContext2D,
  geometry: ScreenGeometry,
  width: number,
  height: number,
  cornerRadius: number,
) => {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  screenPath(ctx, geometry, width, height, cornerRadius);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();
};

export const composeMockup = async (
  captureDataUrl: string | undefined,
  sourceState: ProjectState,
  frame: FramePreset,
  previewLayout?: PreviewLayout,
): Promise<CompositeLayers> => {
  const state = sourceState;
  const previewAspect = previewLayout
    ? previewLayout.viewportWidth / Math.max(1, previewLayout.viewportHeight)
    : 16 / 9;
  const { width, height } = resolveOutputDimensions(state.exportSettings, previewAspect);
  const background = canvas(width, height);
  const screen = canvas(width, height);
  const frameLayer = canvas(width, height);
  const composite = canvas(width, height);
  const bgCtx = background.getContext('2d')!;
  const screenCtx = screen.getContext('2d')!;
  const frameCtx = frameLayer.getContext('2d')!;
  const compositeCtx = composite.getContext('2d')!;
  const transparent = state.backgroundMode === 'transparent' || state.exportSettings.format === 'transparent-png';
  const backgroundMode = transparent ? 'transparent' : state.backgroundMode;
  await drawBackground(bgCtx, backgroundMode, state.backgroundColor, state.backgroundImage, width, height, state);

  const previewWidth = Math.max(1, previewLayout?.viewportWidth || width);
  const previewHeight = Math.max(1, previewLayout?.viewportHeight || height);
  const previewScale = Math.min(width / previewWidth, height / previewHeight);
  const previewOffsetX = (width - previewWidth * previewScale) / 2;
  const previewOffsetY = (height - previewHeight * previewScale) / 2;
  const stage = previewLayout ? {
    x: previewOffsetX + previewLayout.stageX * previewScale,
    y: previewOffsetY + previewLayout.stageY * previewScale,
    width: Math.max(1, previewLayout.stageWidth * previewScale),
    height: Math.max(1, previewLayout.stageHeight * previewScale),
  } : { x: 0, y: 0, width, height };
  const onStage = (ctx: CanvasRenderingContext2D, render: () => void) => {
    ctx.save();
    ctx.translate(stage.x, stage.y);
    render();
    ctx.restore();
  };

  const geometry = adjustScreenGeometry(frameScreenGeometry(frame, state), state);
  const screenRadius = Math.max(0, state.screenCornerRadius) * (stage.width / 1000);
  const source = await loadImage(captureDataUrl);
  const customFrame = frame.customVariant ? await loadImage(state.customFrameImage) : null;
  const customMask = frame.customVariant ? await loadImage(state.customMaskImage) : null;

  onStage(frameCtx, () => withCamera(frameCtx, state, stage.width, stage.height, () => {
    drawDeviceBack(frameCtx, frame, state, stage.width, stage.height);
    cutScreenAperture(frameCtx, geometry, stage.width, stage.height, screenRadius);
    drawDeviceOverlay(frameCtx, frame, state, stage.width, stage.height, customFrame);
  }));
  if (source && state.exportSettings.outputKind !== 'empty') {
    const prepared = prepareSource(source, geometry, stage.width, stage.height, state.fitMode);
    onStage(screenCtx, () => withCamera(screenCtx, state, stage.width, stage.height, () => {
      drawScreenToGeometry(screenCtx, prepared, geometry, stage.width, stage.height, screenRadius);
      applyMatte(screenCtx, geometry, stage.width, stage.height, state.matte, state.glare, screenRadius);
    }));
    onStage(screenCtx, () => withCamera(screenCtx, state, stage.width, stage.height, () => applyCustomMask(screenCtx, frame, state, stage.width, stage.height, customMask)));
  }

  if (transparent) {
    for (const ctx of [screenCtx, frameCtx]) {
      ctx.clearRect(0, 0, width, 1);
      ctx.clearRect(0, height - 1, width, 1);
      ctx.clearRect(0, 0, 1, height);
      ctx.clearRect(width - 1, 0, 1, height);
    }
  }

  compositeCtx.drawImage(background, 0, 0);
  compositeCtx.drawImage(screen, 0, 0);
  compositeCtx.drawImage(frameLayer, 0, 0);
  if (transparent) {
    compositeCtx.clearRect(0, 0, width, 1);
    compositeCtx.clearRect(0, height - 1, width, 1);
    compositeCtx.clearRect(0, 0, 1, height);
    compositeCtx.clearRect(width - 1, 0, 1, height);
  }
  return { composite, background, screen, frame: frameLayer };
};

export const canvasToDataUrl = (target: HTMLCanvasElement, format: string, quality = 0.92) => {
  const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  return new Promise<string>((resolve, reject) => {
    target.toBlob((blob) => {
      if (!blob) {
        reject(new Error(`Canvas encoding failed for ${mime}`));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error || new Error(`Canvas encoding failed for ${mime}`));
      reader.readAsDataURL(blob);
    }, mime, quality);
  });
};
