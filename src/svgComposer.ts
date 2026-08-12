import { resolveOutputDimensions } from './geometry';
import type { PreviewLayout } from './geometry';
import type { FramePreset, ProjectState, ScreenGeometry } from './types';

type Bounds = { x: number; y: number; width: number; height: number; radius: number };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const esc = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const geometryBounds = (geometry: ScreenGeometry) => {
  const xs = [geometry.topLeft.x, geometry.topRight.x, geometry.bottomRight.x, geometry.bottomLeft.x];
  const ys = [geometry.topLeft.y, geometry.topRight.y, geometry.bottomRight.y, geometry.bottomLeft.y];
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
};

const adjustGeometry = (geometry: ScreenGeometry, state: ProjectState): ScreenGeometry => {
  const bounds = geometryBounds(geometry);
  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;
  const scaleX = Math.max(0.1, state.screenScaleX / 100);
  const scaleY = Math.max(0.1, state.screenScaleY / 100);
  const transform = (point: { x: number; y: number }) => ({
    x: centerX + (point.x - centerX) * scaleX + state.screenOffsetX / 100,
    y: centerY + (point.y - centerY) * scaleY + state.screenOffsetY / 100,
  });
  return {
    ...geometry,
    topLeft: transform(geometry.topLeft),
    topRight: transform(geometry.topRight),
    bottomRight: transform(geometry.bottomRight),
    bottomLeft: transform(geometry.bottomLeft),
  };
};

const frameScreen = (frame: FramePreset, state: ProjectState) => frame.customVariant
  ? (state.customGeometries?.[frame.customVariant] || (frame.customVariant === 'desktop' ? state.customGeometry : frame.screen))
  : frame.screen;

const isRect = (geometry: ScreenGeometry) => Math.abs(geometry.topLeft.y - geometry.topRight.y) < 0.00001
  && Math.abs(geometry.bottomLeft.y - geometry.bottomRight.y) < 0.00001
  && Math.abs(geometry.topLeft.x - geometry.bottomLeft.x) < 0.00001
  && Math.abs(geometry.topRight.x - geometry.bottomRight.x) < 0.00001;

const geometryShape = (geometry: ScreenGeometry, width: number, height: number, radius: number, attributes = '') => {
  if (isRect(geometry)) {
    const bounds = geometryBounds(geometry);
    return `<rect x="${bounds.left * width}" y="${bounds.top * height}" width="${bounds.width * width}" height="${bounds.height * height}" rx="${Math.max(0, radius)}" ${attributes}/>`;
  }
  const points = [geometry.topLeft, geometry.topRight, geometry.bottomRight, geometry.bottomLeft]
    .map((point) => `${point.x * width},${point.y * height}`)
    .join(' ');
  return `<polygon points="${points}" ${attributes}/>`;
};

const geometryRect = (geometry: ScreenGeometry, width: number, height: number, radius: number): Bounds => {
  const bounds = geometryBounds(geometry);
  return { x: bounds.left * width, y: bounds.top * height, width: bounds.width * width, height: bounds.height * height, radius };
};

const deviceBounds = (frame: FramePreset, state: ProjectState, width: number, height: number): Bounds => {
  if (!frame.customVariant && frame.body) {
    const body = geometryRect(adjustGeometry(frame.body, state), width, height, 0);
    return { ...body, radius: Math.max(0, state.frameCornerRadius) * width / 1000 };
  }
  const screen = geometryRect(adjustGeometry(frameScreen(frame, state), state), width, height, 0);
  const thickness = Math.max(0, state.frameThickness) * width / 1000;
  return {
    x: screen.x - thickness,
    y: screen.y - thickness,
    width: screen.width + thickness * 2,
    height: screen.height + thickness * 2,
    radius: Math.max(0, state.frameCornerRadius) * width / 1000,
  };
};

const hexRgb = (value: string) => {
  const normalized = /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1) : '222222';
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16));
};

const mixColor = (source: string, target: string, amount: number) => {
  const from = hexRgb(source);
  const to = hexRgb(target);
  const ratio = clamp(amount, 0, 1);
  return `rgb(${from.map((channel, index) => Math.round(channel + (to[index] - channel) * ratio)).join(',')})`;
};

const palette = (frame: FramePreset, state: ProjectState) => {
  const fallback = frame.finish === 'silver' ? '#b9b9b5' : frame.finish === 'titanium' ? '#68665f' : frame.finish === 'graphite' ? '#30312f' : '#111111';
  const color = state.deviceColor || fallback;
  const reflection = clamp(state.materialReflectivity / 100, 0, 1);
  const roughness = clamp(state.materialRoughness / 100, 0, 1);
  if (state.deviceMaterial === 'matte') return [mixColor(color, '#ffffff', reflection * 0.12), color, mixColor(color, '#000000', roughness * 0.18), mixColor(color, '#000000', 0.28 + roughness * 0.22)];
  if (state.deviceMaterial === 'plastic') return [mixColor(color, '#ffffff', 0.12 + reflection * 0.28), color, mixColor(color, '#000000', 0.18 + roughness * 0.2), mixColor(color, '#000000', 0.38)];
  if (state.deviceMaterial === 'glass') return [mixColor(color, '#ffffff', 0.3 + reflection * 0.35), mixColor(color, '#000000', 0.28), mixColor(color, '#ffffff', reflection * 0.32), mixColor(color, '#000000', 0.52)];
  return [mixColor(color, '#ffffff', 0.22 + reflection * 0.42), mixColor(color, '#000000', 0.24 + roughness * 0.18), mixColor(color, '#ffffff', reflection * 0.2), mixColor(color, '#000000', 0.42 + roughness * 0.2)];
};

const extractSvg = (svg: string) => {
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'svg') throw new Error('Website vector snapshot is invalid.');
  const root = parsed.documentElement;
  return {
    inner: root.innerHTML,
    viewBox: root.getAttribute('viewBox') || `0 0 ${root.getAttribute('width') || 1} ${root.getAttribute('height') || 1}`,
  };
};

const cameraTransform = (state: ProjectState, width: number, height: number) => {
  const zoom = Math.max(0.25, state.cameraZoom / 100);
  const panX = state.cameraX / 100 * width * 0.28;
  const panY = state.cameraY / 100 * height * 0.28;
  const tiltX = state.tiltX * Math.PI / 180;
  const tiltY = state.tiltY * Math.PI / 180;
  return `translate(${width / 2 + panX} ${height / 2 + panY}) rotate(${state.tilt}) matrix(${Math.cos(tiltY)} ${-Math.sin(tiltX) * 0.14} ${Math.sin(tiltY) * 0.14} ${Math.cos(tiltX)} 0 0) scale(${zoom}) translate(${-width / 2} ${-height / 2})`;
};

const backgroundMarkup = (state: ProjectState, width: number, height: number) => {
  if (state.backgroundMode === 'transparent' || state.exportSettings.format === 'transparent-png') return '';
  if (state.backgroundMode === 'image' && state.backgroundImage) return `<image href="${esc(state.backgroundImage)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>`;
  if (state.backgroundMode === 'gradient') return `<rect width="${width}" height="${height}" fill="url(#rms-background)"/>`;
  const fill = state.backgroundMode === 'white' ? '#ffffff' : state.backgroundMode === 'custom' ? state.backgroundColor : '#000000';
  return `<rect width="${width}" height="${height}" fill="${esc(fill)}"/>`;
};

export const composeMockupSvg = (
  websiteSvg: string | undefined,
  state: ProjectState,
  frame: FramePreset,
  previewLayout?: PreviewLayout,
) => {
  const previewAspect = previewLayout ? previewLayout.viewportWidth / Math.max(1, previewLayout.viewportHeight) : 16 / 9;
  const { width, height } = resolveOutputDimensions(state.exportSettings, previewAspect);
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
  const geometry = adjustGeometry(frameScreen(frame, state), state);
  const screen = geometryRect(geometry, stage.width, stage.height, Math.max(0, state.screenCornerRadius) * stage.width / 1000);
  const body = deviceBounds(frame, state, stage.width, stage.height);
  const colors = palette(frame, state);
  const scale = stage.width / 1000;
  const line = Math.max(1, state.wireframeThickness * scale);
  const bodyFill = state.wireframeEnabled ? 'none' : 'url(#rms-device-material)';
  const outline = state.wireframeEnabled ? state.wireframeColor : 'rgba(255,255,255,.24)';
  const site = websiteSvg && state.exportSettings.outputKind !== 'empty' ? extractSvg(websiteSvg) : null;
  const stops = [...state.backgroundGradientStops].sort((a, b) => a.position - b.position);
  const gradientStops = stops.map((stop) => `<stop offset="${clamp(stop.position, 0, 100)}%" stop-color="${esc(stop.color)}"/>`).join('');
  const backgroundGradient = state.backgroundGradientType === 'radial'
    ? `<radialGradient id="rms-background">${gradientStops}</radialGradient>`
    : `<linearGradient id="rms-background" gradientTransform="rotate(${state.backgroundGradientAngle} .5 .5)" x1="0" y1="0" x2="1" y2="0">${gradientStops}</linearGradient>`;
  const materialStops = `<stop offset="0" stop-color="${colors[0]}"/><stop offset="34%" stop-color="${colors[1]}"/><stop offset="76%" stop-color="${colors[2]}"/><stop offset="100%" stop-color="${colors[3]}"/>`;
  const screenShape = geometryShape(geometry, stage.width, stage.height, screen.radius);
  const bodyGeometry: ScreenGeometry = {
    topLeft: { x: body.x / stage.width, y: body.y / stage.height },
    topRight: { x: (body.x + body.width) / stage.width, y: body.y / stage.height },
    bottomRight: { x: (body.x + body.width) / stage.width, y: (body.y + body.height) / stage.height },
    bottomLeft: { x: body.x / stage.width, y: (body.y + body.height) / stage.height },
    cornerRadius: body.radius,
  };
  const bodyShape = geometryShape(bodyGeometry, stage.width, stage.height, body.radius);

  const parts: string[] = [];
  if (frame.kind === 'monitor' || frame.kind === 'custom') {
    const stemWidth = stage.width * state.stemWidth / 100;
    const stemX = stage.width / 2 - stemWidth / 2;
    const stemY = body.y + body.height - stage.height * 0.002;
    const stemHeight = stage.height * state.stemHeight / 100;
    const baseY = stemY + stemHeight - stage.height * 0.005;
    if (state.stemVisible) parts.push(`<rect x="${stemX}" y="${stemY}" width="${stemWidth}" height="${stemHeight}" fill="${state.wireframeEnabled ? 'none' : 'url(#rms-stem)'}" stroke="${state.wireframeEnabled ? esc(state.wireframeColor) : 'none'}" stroke-width="${line}"/>`);
    if (state.baseVisible) {
      const baseWidth = stage.width * state.baseWidth / 100;
      const baseHeight = stage.height * state.baseHeight / 100;
      parts.push(`<rect x="${stage.width / 2 - baseWidth / 2}" y="${baseY}" width="${baseWidth}" height="${baseHeight}" rx="${state.baseRadius * scale}" fill="${state.wireframeEnabled ? 'none' : 'url(#rms-base)'}" stroke="${state.wireframeEnabled ? esc(state.wireframeColor) : 'none'}" stroke-width="${line}"/>`);
    }
  }
  if (frame.kind === 'laptop' && state.deckVisible) {
    const deckY = body.y + body.height - stage.height * 0.005;
    const top = stage.width * state.deckWidth / 200;
    const bottom = Math.min(stage.width * 0.49, top + stage.width * 0.008);
    const deckHeight = stage.height * state.deckHeight / 100;
    const path = `M ${stage.width / 2 - top} ${deckY} L ${stage.width / 2 + top} ${deckY} L ${stage.width / 2 + bottom} ${deckY + deckHeight * 0.62} Q ${stage.width / 2 + bottom * 0.9} ${deckY + deckHeight} ${stage.width / 2 + top * 0.88} ${deckY + deckHeight} L ${stage.width / 2 - top * 0.88} ${deckY + deckHeight} Q ${stage.width / 2 - bottom * 0.9} ${deckY + deckHeight} ${stage.width / 2 - bottom} ${deckY + deckHeight * 0.62} Z`;
    parts.push(`<path d="${path}" fill="${state.wireframeEnabled ? 'none' : 'url(#rms-deck)'}" stroke="${state.wireframeEnabled ? esc(state.wireframeColor) : 'none'}" stroke-width="${line}"/>`);
  }

  const siteMarkup = site ? `<g clip-path="url(#rms-screen-clip)"><svg x="${screen.x}" y="${screen.y}" width="${screen.width}" height="${screen.height}" viewBox="${esc(site.viewBox)}" preserveAspectRatio="${state.fitMode === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'}">${site.inner}</svg><rect x="${screen.x}" y="${screen.y}" width="${screen.width}" height="${screen.height}" fill="url(#rms-screen-edge)" pointer-events="none"/></g>` : '';
  const phoneButtons: string[] = [];
  if (frame.kind === 'phone') {
    const buttonWidth = Math.max(2, stage.width * 0.0028);
    const button = (x: number, y: number, buttonHeight: number) => `<rect x="${x}" y="${y}" width="${buttonWidth}" height="${buttonHeight}" fill="${state.wireframeEnabled ? 'none' : esc(state.deviceColor)}" stroke="${state.wireframeEnabled ? esc(state.wireframeColor) : 'rgba(255,255,255,.2)'}" stroke-width="${state.wireframeEnabled ? line : 1}"/>`;
    if (state.phoneLeftControlsVisible) {
      phoneButtons.push(button(body.x - buttonWidth, body.y + body.height * 0.22, body.height * 0.08));
      phoneButtons.push(button(body.x - buttonWidth, body.y + body.height * 0.33, body.height * 0.06));
    }
    if (state.phoneRightButtonVisible) phoneButtons.push(button(body.x + body.width, body.y + body.height * 0.29, body.height * 0.13));
  }
  let detail = '';
  if (state.detailVisible) {
    const detailScale = state.detailScale / 100;
    if (frame.detail === 'dynamic-island') detail = `<rect x="${screen.x + screen.width / 2 - stage.width * 0.0275 * detailScale}" y="${screen.y + stage.height * 0.012}" width="${stage.width * 0.055 * detailScale}" height="${stage.height * 0.021 * detailScale}" rx="${stage.height * 0.011 * detailScale}" fill="${esc(state.detailColor)}"/>`;
    else if (frame.detail === 'notch') detail = `<rect x="${screen.x + screen.width / 2 - stage.width * 0.04 * detailScale}" y="${screen.y}" width="${stage.width * 0.08 * detailScale}" height="${stage.height * 0.022 * detailScale}" rx="${stage.height * 0.007 * detailScale}" fill="${esc(state.detailColor)}"/>`;
    else if (frame.detail === 'tablet-camera' || frame.detail === 'display-camera') detail = `<circle cx="${body.x + body.width / 2}" cy="${body.y + Math.max(2, state.frameThickness * scale * 0.5)}" r="${Math.max(1.5, stage.height * 0.0027) * detailScale}" fill="${esc(state.detailColor)}"/>`;
  }
  const customOverlay = frame.customVariant && state.customFrameImage && !state.wireframeEnabled
    ? `<image href="${esc(state.customFrameImage)}" x="${body.x}" y="${body.y}" width="${body.width}" height="${body.height}" preserveAspectRatio="xMidYMid meet"/>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" data-rms-vector="true" data-rms-text-outlined="true">
  <metadata>Responsive Mockup Studio vector export. Website text is stored as font-independent vector outlines; source bitmap assets remain embedded bitmap assets.</metadata>
  <defs>
    ${backgroundGradient}
    <linearGradient id="rms-device-material" x1="0" y1="0" x2="1" y2="1">${materialStops}</linearGradient>
    <linearGradient id="rms-stem" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${mixColor(state.stemColor, '#000000', .28)}"/><stop offset="48%" stop-color="${mixColor(state.stemColor, '#ffffff', .24)}"/><stop offset="100%" stop-color="${mixColor(state.stemColor, '#000000', .32)}"/></linearGradient>
    <linearGradient id="rms-base" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${mixColor(state.baseColor, '#000000', .22)}"/><stop offset="50%" stop-color="${mixColor(state.baseColor, '#ffffff', .18)}"/><stop offset="100%" stop-color="${mixColor(state.baseColor, '#000000', .28)}"/></linearGradient>
    <linearGradient id="rms-deck" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${mixColor(state.deckColor, '#ffffff', .2)}"/><stop offset="100%" stop-color="${mixColor(state.deckColor, '#000000', .28)}"/></linearGradient>
    <radialGradient id="rms-screen-edge"><stop offset="70%" stop-color="#fff" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="${state.matte ? .085 : .04}"/></radialGradient>
    <clipPath id="rms-screen-clip">${screenShape}</clipPath>
    <mask id="rms-body-cut"><rect x="${body.x}" y="${body.y}" width="${body.width}" height="${body.height}" rx="${body.radius}" fill="#fff"/>${geometryShape(geometry, stage.width, stage.height, screen.radius, 'fill="#000"')}</mask>
    <filter id="rms-shadow" x="-50%" y="-50%" width="200%" height="200%"><feMorphology operator="dilate" radius="${Math.max(0, state.shadowSpread * scale)}"/><feGaussianBlur stdDeviation="${Math.max(0, state.shadowBlur * scale / 2)}"/><feOffset dx="${state.shadowOffsetX * scale}" dy="${state.shadowOffsetY * scale}"/></filter>
  </defs>
  ${backgroundMarkup(state, width, height)}
  <g transform="translate(${stage.x} ${stage.y})"><g transform="${cameraTransform(state, stage.width, stage.height)}">
    ${state.shadowEnabled && !state.wireframeEnabled ? `<g opacity="${clamp(state.shadowOpacity / 100, 0, 1)}" filter="url(#rms-shadow)">${bodyShape.replace('/>', ' fill="#000"/>')}</g>` : ''}
    ${parts.join('')}
    ${state.wireframeEnabled ? '' : `<rect x="${body.x}" y="${body.y}" width="${body.width}" height="${body.height}" rx="${body.radius}" fill="${bodyFill}" mask="url(#rms-body-cut)"/>`}
    ${siteMarkup}
    ${geometryShape(bodyGeometry, stage.width, stage.height, body.radius, `fill="none" stroke="${esc(outline)}" stroke-width="${state.wireframeEnabled ? line : Math.max(1, stage.height * .0012)}"`)}
    ${geometryShape(geometry, stage.width, stage.height, screen.radius, `fill="none" stroke="${state.wireframeEnabled ? esc(state.wireframeColor) : 'rgba(255,255,255,.16)'}" stroke-width="${state.wireframeEnabled ? line : Math.max(1, stage.height * .0012)}"`)}
    ${phoneButtons.join('')}${detail}${customOverlay}
  </g></g>
</svg>`;
};
