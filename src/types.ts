export type Language = 'tr' | 'en';
export type Theme = 'dark' | 'light';
export type FitMode = 'responsive' | 'cover' | 'contain' | 'custom';
export type BackgroundMode = 'black' | 'white' | 'transparent' | 'custom' | 'gradient' | 'image';
export type BackgroundGradientType = 'linear' | 'radial';
export type ExportFormat = 'png' | 'transparent-png' | 'jpeg' | 'webp' | 'svg';
export type DeviceKind = 'monitor' | 'laptop' | 'tablet' | 'phone' | 'custom';
export type CustomFrameVariant = 'desktop' | 'tablet' | 'phone';
export type DeviceFinish = 'silver' | 'graphite' | 'black' | 'titanium';
export type DeviceStand = 'studio' | 'dell' | 'gaming' | 'xdr' | 'laptop' | 'none';
export type DeviceDetail = 'display-camera' | 'notch' | 'tablet-camera' | 'dynamic-island' | 'none';
export type DeviceMaterial = 'metal' | 'matte' | 'plastic' | 'glass';
export type CompositionFrameRatio = 'none' | '1:1' | '4:5' | '16:9';
export type CompositionFrameOrientation = 'landscape' | 'portrait';

export interface Point {
  x: number;
  y: number;
}

export interface ScreenGeometry {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
  cornerRadius: number;
}

export interface GradientColorStop {
  id: string;
  color: string;
  position: number;
}

export interface FramePreset {
  id: string;
  name: { tr: string; en: string };
  group: { tr: string; en: string };
  kind: DeviceKind;
  customVariant?: CustomFrameVariant;
  aspectLabel: string;
  viewport: { width: number; height: number };
  nativeResolution: string;
  screen: ScreenGeometry;
  body?: ScreenGeometry;
  finish: DeviceFinish;
  stand: DeviceStand;
  detail: DeviceDetail;
  appearance: {
    frameThickness: number;
    frameCornerRadius: number;
    screenCornerRadius: number;
  };
  parts?: {
    stemWidth?: number;
    stemHeight?: number;
    baseWidth?: number;
    baseHeight?: number;
    baseRadius?: number;
    deckWidth?: number;
    deckHeight?: number;
  };
  accent: string;
  thumbnail: string;
}

export interface CaptureOptions {
  webContentsId: number;
  viewportWidth: number;
  viewportHeight: number;
  pixelRatio: number;
  fullPage: boolean;
  scrollY: number;
  delayMs: number;
  freezeAnimations: boolean;
  hideScrollbar: boolean;
  hideCursor: boolean;
  hidePageBackground: boolean;
  customCss: string;
  hiddenSelectors: string;
}

export interface CaptureResult {
  ok: boolean;
  dataUrl?: string;
  width?: number;
  height?: number;
  cssWidth?: number;
  cssHeight?: number;
  title?: string;
  url?: string;
  error?: string;
}

export interface VectorCaptureResult {
  ok: boolean;
  svg?: string;
  width?: number;
  height?: number;
  title?: string;
  url?: string;
  error?: string;
}

export interface ExportSettings {
  format: ExportFormat;
  longEdge: number;
  customWidth: number;
  customHeight: number;
  dpi: number;
  quality: number;
  pngOptimization: boolean;
  outputKind: 'mockup' | 'empty';
  namingTemplate: string;
}

export interface ProjectState {
  schemaVersion: 1;
  name: string;
  url: string;
  frameId: string;
  viewportWidth: number;
  viewportHeight: number;
  viewportAuto: boolean;
  fitMode: FitMode;
  compositionFrameRatio: CompositionFrameRatio;
  compositionFrameOrientation: CompositionFrameOrientation;
  cameraZoom: number;
  cameraX: number;
  cameraY: number;
  tilt: number;
  tiltX: number;
  tiltY: number;
  frameThickness: number;
  frameCornerRadius: number;
  screenCornerRadius: number;
  screenScaleX: number;
  screenScaleY: number;
  screenOffsetX: number;
  screenOffsetY: number;
  deviceColor: string;
  deviceMaterial: DeviceMaterial;
  materialRoughness: number;
  materialReflectivity: number;
  wireframeEnabled: boolean;
  wireframeColor: string;
  wireframeThickness: number;
  stemWidth: number;
  stemHeight: number;
  stemColor: string;
  stemVisible: boolean;
  baseWidth: number;
  baseHeight: number;
  baseRadius: number;
  baseColor: string;
  baseVisible: boolean;
  deckWidth: number;
  deckHeight: number;
  deckColor: string;
  deckVisible: boolean;
  phoneLeftControlsVisible: boolean;
  phoneRightButtonVisible: boolean;
  detailScale: number;
  detailColor: string;
  detailVisible: boolean;
  partGradientEnabled: boolean;
  partGradientAngle: number;
  partGradientSize: number;
  partGradientSoftness: number;
  shadowEnabled: boolean;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlur: number;
  shadowSpread: number;
  shadowOpacity: number;
  matte: boolean;
  glare: number;
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  backgroundGradientType: BackgroundGradientType;
  backgroundGradientStops: GradientColorStop[];
  backgroundGradientAngle: number;
  backgroundGradientFrom?: string;
  backgroundGradientTo?: string;
  backgroundGradientBalance?: number;
  backgroundImage?: string;
  customFrameImage?: string;
  customMaskImage?: string;
  customGeometry: ScreenGeometry;
  customGeometries: Record<CustomFrameVariant, ScreenGeometry>;
  freezeAnimations: boolean;
  hideScrollbar: boolean;
  hideCursor: boolean;
  hidePageBackground: boolean;
  customCss: string;
  hiddenSelectors: string;
  exportSettings: ExportSettings;
}

export interface SaveImageRequest {
  dataUrl: string;
  format: ExportFormat | 'png';
  dpi: number;
  quality: number;
  suggestedName: string;
  path?: string;
}

export interface SaveResult {
  ok: boolean;
  path?: string;
  size?: number;
  sha256?: string;
  width?: number;
  height?: number;
  density?: number;
  hasAlpha?: boolean;
  error?: string;
}

export interface SaveVectorRequest {
  svg: string;
  suggestedName: string;
  path?: string;
}

export interface RuntimeInfo {
  desktop: boolean;
  platform: string;
  version: string;
  userData?: string;
}

export interface RMSDesktopAPI {
  getRuntimeInfo(): Promise<RuntimeInfo>;
  capturePage(options: CaptureOptions): Promise<CaptureResult>;
  capturePageSvg(options: Omit<CaptureOptions, 'pixelRatio'>): Promise<VectorCaptureResult>;
  saveImage(request: SaveImageRequest): Promise<SaveResult>;
  saveSvg(request: SaveVectorRequest): Promise<SaveResult>;
  showItemInFolder(path: string): Promise<void>;
  readImageFile(kind: 'frame' | 'mask' | 'background'): Promise<{ ok: boolean; dataUrl?: string; path?: string; error?: string }>;
}

declare global {
  interface Window {
    rms?: RMSDesktopAPI;
  }
}
