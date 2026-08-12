import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  BookmarkCheck,
  BookmarkPlus,
  Camera,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Crosshair,
  Eye,
  EyeOff,
  FileOutput,
  Globe2,
  Grid2X2,
  Heart,
  ImagePlus,
  Languages,
  LoaderCircle,
  LockKeyhole,
  Maximize2,
  Monitor,
  MousePointer2,
  Move,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  RectangleHorizontal,
  RectangleVertical,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adjustScreenGeometry, resolveOutputDimensions, screenAspect } from './geometry';
import type { PreviewLayout } from './geometry';
import { DEFAULT_CUSTOM_GEOMETRIES, DEFAULT_CUSTOM_GEOMETRY, FRAME_PRESETS, getFrame, groupFrames } from './presets';
import type {
  BackgroundMode,
  CaptureResult,
  CompositionFrameOrientation,
  CompositionFrameRatio,
  ExportFormat,
  FitMode,
  FramePreset,
  GradientColorStop,
  Language,
  ProjectState,
  RuntimeInfo,
  ScreenGeometry,
  Theme,
} from './types';

const STORAGE_KEY = 'rms.project.v1';
const RECENT_KEY = 'rms.recent.v1';
const BOOKMARKS_KEY = 'rms.bookmarks.v1';
const THEME_KEY = 'rms.theme.v1';
const FRAMES_PANEL_KEY = 'rms.frames-panel.v1';
const SAVED_MONITORS_KEY = 'rms.saved-monitors.v1';
const FAVORITE_FRAMES_KEY = 'rms.favorite-frames.v1';

export const createDefaultProject = (): ProjectState => ({
  schemaVersion: 1,
  name: 'Untitled mockup',
  url: 'https://example.com/',
  frameId: 'custom',
  viewportWidth: 1440,
  viewportHeight: 900,
  viewportAuto: true,
  fitMode: 'responsive',
  compositionFrameRatio: 'none',
  compositionFrameOrientation: 'landscape',
  cameraZoom: 100,
  cameraX: 0,
  cameraY: 0,
  tilt: 0,
  tiltX: 0,
  tiltY: 0,
  frameThickness: 14,
  frameCornerRadius: 24,
  screenCornerRadius: 16,
  screenScaleX: 100,
  screenScaleY: 100,
  screenOffsetX: 0,
  screenOffsetY: 0,
  deviceColor: '#111111',
  deviceMaterial: 'matte',
  materialRoughness: 64,
  materialReflectivity: 28,
  wireframeEnabled: false,
  wireframeColor: '#f2f2ee',
  wireframeThickness: 2,
  stemWidth: 2.4,
  stemHeight: 13,
  stemColor: '#202120',
  stemVisible: true,
  baseWidth: 24,
  baseHeight: 3.2,
  baseRadius: 8,
  baseColor: '#202120',
  baseVisible: true,
  deckWidth: 76,
  deckHeight: 11,
  deckColor: '#4d4e4b',
  deckVisible: true,
  phoneLeftControlsVisible: true,
  phoneRightButtonVisible: true,
  detailScale: 100,
  detailColor: '#030303',
  detailVisible: false,
  partGradientEnabled: true,
  partGradientAngle: 105,
  partGradientSize: 240,
  partGradientSoftness: 76,
  shadowEnabled: true,
  shadowOffsetX: 0,
  shadowOffsetY: 28,
  shadowBlur: 54,
  shadowSpread: 0,
  shadowOpacity: 34,
  matte: true,
  glare: 3,
  backgroundMode: 'black',
  backgroundColor: '#171a17',
  backgroundGradientType: 'linear',
  backgroundGradientStops: [
    { id: 'gradient-start', color: '#050505', position: 0 },
    { id: 'gradient-end', color: '#f2f2ee', position: 100 },
  ],
  backgroundGradientAngle: 135,
  customGeometry: DEFAULT_CUSTOM_GEOMETRY,
  customGeometries: {
    desktop: DEFAULT_CUSTOM_GEOMETRIES.desktop,
    tablet: DEFAULT_CUSTOM_GEOMETRIES.tablet,
    phone: DEFAULT_CUSTOM_GEOMETRIES.phone,
  },
  freezeAnimations: false,
  hideScrollbar: false,
  hideCursor: false,
  hidePageBackground: false,
  customCss: '',
  hiddenSelectors: '',
  exportSettings: {
    format: 'png',
    longEdge: 2560,
    customWidth: 1920,
    customHeight: 1080,
    dpi: 150,
    quality: 92,
    pngOptimization: true,
    outputKind: 'mockup',
    namingTemplate: '{site}-{frame}-{width}px-{date}',
  },
});

const tr = {
  frames: 'Çerçeveler',
  export: 'Dışa aktar', theme: 'Tema',
  desktop: 'Masaüstü', tablet: 'Tablet', phone: 'Telefon', custom: 'Özel',
  camera: 'Kamera', background: 'Arka plan', output: 'Çıktı', advanced: 'Gelişmiş',
  viewport: 'Viewport', fit: 'Yerleştirme', responsive: 'Responsive uydur', cover: 'Ortadan kırp',
  contain: 'Tamamını göster', customFit: 'Özel viewport', zoom: 'Kamera zoomu', panX: 'Kamera X',
  panY: 'Kamera Y', tilt: 'Hafif eğim', tiltX: 'Vertical tilt', tiltY: 'Horizontal tilt', matte: 'Mat ekran', glare: 'Cam yansıması',
  frame: 'Çerçeve', frameThickness: 'Çerçeve kalınlığı', frameCornerRadius: 'Dış köşe radius', screenCornerRadius: 'Ekran köşe radius',
  shadow: 'Drop shadow', shadowX: 'Yön X', shadowY: 'Yön Y', shadowBlur: 'Yumuşaklık', shadowSpread: 'Boyut', shadowOpacity: 'Şiddet', resetModel: 'Model varsayılanı',
  black: 'Siyah', white: 'Beyaz', transparent: 'Şeffaf', customColor: 'Özel renk', gradient: 'Gradient', image: 'Görsel',
  gradientType: 'Gradient tipi', linear: 'Linear', radial: 'Radial', addGradientColor: 'Renk ekle', removeGradientColor: 'Rengi kaldır', gradientPosition: 'Renk konumu', hexColor: 'HEX renk kodu',
  format: 'Format', size: 'Uzun kenar', dpi: 'DPI', quality: 'Kalite', freeze: 'Animasyonları dondur',
  hideScrollbar: 'Scrollbar gizle', hideCursor: 'İmleci gizle', hideBackground: 'Sayfa zeminini gizle',
  customCss: 'Özel CSS',
  pageElements: 'Sayfa elemanları', refreshElements: 'Elemanları yenile', noPageElements: 'Gizlenebilir eleman bulunamadı', technicalLocked: 'Üretici teknik ölçüleri kilitli',
  webNotice: 'Uzak site capture’ı tarayıcı güvenliği nedeniyle Windows sürümünde çalışır.',
  uploadCapture: 'Ekran görüntüsü yükle', noCapture: 'Önce bir site capture alın veya ekran görüntüsü yükleyin.',
  captureFailed: 'Capture başarısız', exportDone: 'Çıktı hazır',
  bookmarks: 'Bookmarklar', bookmarkCurrent: 'Bu siteyi bookmarkla', removeBookmark: 'Bookmarkı sil', noBookmarks: 'Henüz bookmark yok',
  invalidUrl: 'Geçersiz web adresi', bookmarkAdded: 'Bookmark eklendi', bookmarkRemoved: 'Bookmark silindi', resetControl: 'Varsayılana döndür',
  deviceSettings: 'Cihaz ayarları', screenSurface: 'Ekran yüzeyi', material: 'Renk / materyal', structure: 'Parçalar',
  screenWidth: 'Ekran eni', screenHeight: 'Ekran boyu',
  viewportAuto: 'Çerçeveye otomatik uy', viewportCustom: 'Custom viewport',
  deviceColor: 'Cihaz rengi', materialType: 'Materyal', metal: 'Metal', materialMatte: 'Mat', plastic: 'Plastik', glass: 'Cam',
  roughness: 'Pürüzlülük', reflectivity: 'Yansıma', wireframe: 'Wireframe', wireframeColor: 'Kontür rengi', wireframeThickness: 'Kontür kalınlığı',
  stand: 'Ayak borusu', stemWidth: 'Boru kalınlığı', stemHeight: 'Boru boyu', stemColor: 'Boru rengi',
  base: 'Taban', baseWidth: 'Taban eni', baseHeight: 'Taban boyu', baseRadius: 'Taban radius', baseColor: 'Taban rengi',
  deck: 'Alt dudak', deckWidth: 'Dudak eni', deckHeight: 'Dudak kalınlığı', deckColor: 'Dudak rengi', detail: 'Cihaz detayı', detailScale: 'Detay boyutu', detailColor: 'Detay rengi',
  partGradient: 'Parça gradienti', gradientAngle: 'Gradient açısı', gradientSize: 'Gradient boyutu', gradientSoftness: 'Gradient yumuşaklığı',
  hideFrames: 'Çerçeveleri gizle', showFrames: 'Çerçeveleri göster', uploadBackground: 'Arka plan yükle',
};

const en: typeof tr = {
  frames: 'Frames',
  export: 'Export', theme: 'Theme',
  desktop: 'Desktop', tablet: 'Tablet', phone: 'Phone', custom: 'Custom',
  camera: 'Camera', background: 'Background', output: 'Output', advanced: 'Advanced',
  viewport: 'Viewport', fit: 'Fit', responsive: 'Fit responsive viewport', cover: 'Center crop',
  contain: 'Show all', customFit: 'Custom viewport', zoom: 'Camera zoom', panX: 'Camera X',
  panY: 'Camera Y', tilt: 'Subtle tilt', tiltX: 'Vertical tilt', tiltY: 'Horizontal tilt', matte: 'Matte display', glare: 'Glass reflection',
  frame: 'Frame', frameThickness: 'Frame thickness', frameCornerRadius: 'Outer corner radius', screenCornerRadius: 'Screen corner radius',
  shadow: 'Drop shadow', shadowX: 'Direction X', shadowY: 'Direction Y', shadowBlur: 'Softness', shadowSpread: 'Size', shadowOpacity: 'Intensity', resetModel: 'Model defaults',
  black: 'Black', white: 'White', transparent: 'Transparent', customColor: 'Custom color', gradient: 'Gradient', image: 'Image',
  gradientType: 'Gradient type', linear: 'Linear', radial: 'Radial', addGradientColor: 'Add color', removeGradientColor: 'Remove color', gradientPosition: 'Color position', hexColor: 'HEX color code',
  format: 'Format', size: 'Long edge', dpi: 'DPI', quality: 'Quality', freeze: 'Freeze animations',
  hideScrollbar: 'Hide scrollbar', hideCursor: 'Hide cursor', hideBackground: 'Hide page background',
  customCss: 'Custom CSS',
  pageElements: 'Page elements', refreshElements: 'Refresh elements', noPageElements: 'No hideable elements found', technicalLocked: 'Manufacturer geometry locked',
  webNotice: 'Remote-site capture works in Windows because browsers enforce cross-origin security.',
  uploadCapture: 'Upload screenshot', noCapture: 'Capture a site or upload a screenshot first.',
  captureFailed: 'Capture failed', exportDone: 'Export ready',
  bookmarks: 'Bookmarks', bookmarkCurrent: 'Bookmark this site', removeBookmark: 'Remove bookmark', noBookmarks: 'No bookmarks yet',
  invalidUrl: 'Invalid web address', bookmarkAdded: 'Bookmark added', bookmarkRemoved: 'Bookmark removed', resetControl: 'Reset to default',
  deviceSettings: 'Device settings', screenSurface: 'Screen surface', material: 'Color / material', structure: 'Parts',
  screenWidth: 'Screen width', screenHeight: 'Screen height',
  viewportAuto: 'Auto-fit to frame', viewportCustom: 'Custom viewport',
  deviceColor: 'Device color', materialType: 'Material', metal: 'Metal', materialMatte: 'Matte', plastic: 'Plastic', glass: 'Glass',
  roughness: 'Roughness', reflectivity: 'Reflectivity', wireframe: 'Wireframe', wireframeColor: 'Outline color', wireframeThickness: 'Outline thickness',
  stand: 'Stand stem', stemWidth: 'Stem thickness', stemHeight: 'Stem height', stemColor: 'Stem color',
  base: 'Base', baseWidth: 'Base width', baseHeight: 'Base height', baseRadius: 'Base radius', baseColor: 'Base color',
  deck: 'Front lip', deckWidth: 'Lip width', deckHeight: 'Lip thickness', deckColor: 'Lip color', detail: 'Device detail', detailScale: 'Detail size', detailColor: 'Detail color',
  partGradient: 'Part gradient', gradientAngle: 'Gradient angle', gradientSize: 'Gradient size', gradientSoftness: 'Gradient softness',
  hideFrames: 'Hide frames', showFrames: 'Show frames', uploadBackground: 'Upload background',
};

const safeJson = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    if (!value) return fallback;
    const parsed = JSON.parse(value);
    if (Array.isArray(fallback)) return (Array.isArray(parsed) ? parsed : fallback) as T;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
};

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const canonicalHexColor = (value: unknown, fallback = '#000000') => {
  if (typeof value !== 'string' || !HEX_COLOR.test(value.trim())) return fallback;
  const hex = value.trim().toUpperCase();
  if (hex.length === 4) return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  return hex;
};

const normalizeGradientStops = (value: unknown, fallback: GradientColorStop[]): GradientColorStop[] => {
  if (!Array.isArray(value) || value.length < 2) return fallback.map((stop) => ({ ...stop }));
  return value
    .map((stop, index) => ({
      id: typeof stop?.id === 'string' && stop.id ? stop.id : `gradient-stop-${index}`,
      color: canonicalHexColor(stop?.color, fallback[index % fallback.length]?.color || '#000000'),
      position: clamp(Number(stop?.position) || 0, 0, 100),
    }))
    .sort((left, right) => left.position - right.position);
};

const hydrateProject = (value: Partial<ProjectState>): ProjectState => {
  const fallback = createDefaultProject();
  const legacyStops = value.backgroundGradientFrom || value.backgroundGradientTo
    ? [
      { id: 'gradient-start', color: canonicalHexColor(value.backgroundGradientFrom, fallback.backgroundGradientStops[0].color), position: 0 },
      { id: 'gradient-end', color: canonicalHexColor(value.backgroundGradientTo, fallback.backgroundGradientStops.at(-1)?.color), position: 100 },
    ]
    : fallback.backgroundGradientStops;
  const legacyDesktopGeometry = value.customGeometry || fallback.customGeometries.desktop;
  const savedCustomGeometries = value.customGeometries || { ...fallback.customGeometries, desktop: legacyDesktopGeometry };
  return {
    ...fallback,
    ...value,
    backgroundGradientStops: normalizeGradientStops(value.backgroundGradientStops, legacyStops),
    customGeometry: savedCustomGeometries.desktop || legacyDesktopGeometry,
    customGeometries: {
      desktop: savedCustomGeometries.desktop || legacyDesktopGeometry,
      tablet: savedCustomGeometries.tablet || fallback.customGeometries.tablet,
      phone: savedCustomGeometries.phone || fallback.customGeometries.phone,
    },
    exportSettings: { ...fallback.exportSettings, ...(value.exportSettings || {}), outputKind: 'mockup' },
  };
};

const frameScreenGeometry = (selected: FramePreset, state: ProjectState): ScreenGeometry => (
  selected.customVariant ? state.customGeometries[selected.customVariant] : selected.screen
);

const createDeviceThumbnail = (selected: FramePreset, state: ProjectState) => {
  const target = document.createElement('canvas');
  target.width = 192;
  target.height = 112;
  const context = target.getContext('2d');
  if (!context) return '';
  const geometry = frameScreenGeometry(selected, state);
  const xs = [geometry.topLeft.x, geometry.topRight.x, geometry.bottomRight.x, geometry.bottomLeft.x];
  const ys = [geometry.topLeft.y, geometry.topRight.y, geometry.bottomRight.y, geometry.bottomLeft.y];
  const left = Math.min(...xs) * target.width;
  const top = Math.min(...ys) * target.height;
  const right = Math.max(...xs) * target.width;
  const bottom = Math.max(...ys) * target.height;
  const bezel = Math.max(2, state.frameThickness * target.width / 1000);
  context.clearRect(0, 0, target.width, target.height);
  context.fillStyle = state.deviceColor;
  context.fillRect(left - bezel, top - bezel, right - left + bezel * 2, bottom - top + bezel * 2);
  context.fillStyle = state.backgroundMode === 'white' ? '#f5f5f2' : '#d7d8d4';
  context.fillRect(left, top, right - left, bottom - top);
  context.strokeStyle = state.wireframeEnabled ? state.wireframeColor : '#777';
  context.lineWidth = Math.max(1, state.wireframeThickness * 0.65);
  context.strokeRect(left - bezel, top - bezel, right - left + bezel * 2, bottom - top + bezel * 2);
  if (selected.customVariant === 'desktop') {
    const stemWidth = Math.max(2, target.width * state.stemWidth / 100);
    const stemHeight = target.height * state.stemHeight / 100;
    const stemX = target.width / 2 - stemWidth / 2;
    context.fillStyle = state.stemColor;
    if (state.stemVisible) context.fillRect(stemX, bottom + bezel, stemWidth, stemHeight);
    if (state.baseVisible) context.fillRect(target.width / 2 - target.width * state.baseWidth / 200, bottom + bezel + stemHeight, target.width * state.baseWidth / 100, Math.max(2, target.height * state.baseHeight / 100));
  }
  if (selected.kind === 'phone') {
    context.fillStyle = state.deviceColor;
    if (state.phoneLeftControlsVisible) {
      context.fillRect(left - bezel - 2, top + (bottom - top) * 0.22, 2, (bottom - top) * 0.08);
      context.fillRect(left - bezel - 2, top + (bottom - top) * 0.33, 2, (bottom - top) * 0.06);
    }
    if (state.phoneRightButtonVisible) context.fillRect(right + bezel, top + (bottom - top) * 0.29, 2, (bottom - top) * 0.13);
  }
  return target.toDataURL('image/png');
};

const normalizeUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 'https://example.com/';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const hostnameFromUrl = (value: string) => {
  try {
    return new URL(value).hostname || value;
  } catch {
    return value;
  }
};

const slug = (value: string) => value
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/[^a-z0-9çğıöşü]+/gi, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 72) || 'mockup';

const dataUrlFromFile = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type PageElementCandidate = {
  selector: string;
  label: string;
  tag: string;
  count: number;
};

type SavedMonitor = {
  id: string;
  name: string;
  frameId: string;
  thumbnail: string;
  project: ProjectState;
  createdAt: number;
};

const dangerousPageSelector = (selector: string) => /^(?:html|body|:root|#(?:root|app|__next)|\.(?:root|app))$/i.test(selector.trim());

const selectorList = (value: string) => value
  .split(/[\n,]+/)
  .map((selector) => selector.trim())
  .filter((selector) => Boolean(selector) && !dangerousPageSelector(selector));

const guestPresentationCss = (state: ProjectState) => {
  const rules: string[] = [];
  if (state.freezeAnimations) rules.push('*,*::before,*::after{animation-play-state:paused!important;transition:none!important}');
  if (state.hideScrollbar) rules.push('html{scrollbar-width:none!important}::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}');
  if (state.hideCursor) rules.push('html,body,body *{cursor:none!important}');
  if (state.hidePageBackground) rules.push('html,body{background:transparent!important;background-image:none!important}');
  const hidden = selectorList(state.hiddenSelectors);
  if (hidden.length) rules.push(`${hidden.join(',')}{visibility:hidden!important}`);
  if (state.customCss.trim()) rules.push(state.customCss);
  return rules.join('\n');
};

const materialSurface = (
  color: string,
  material: ProjectState['deviceMaterial'],
  roughness: number,
  reflectivity: number,
  options?: { enabled: boolean; angle: number; softness: number },
) => {
  if (options?.enabled === false) return color;
  const contrast = options ? 1 - clamp(options.softness, 0, 100) * 0.0082 : 1;
  const shine = clamp(Math.round(reflectivity * 0.55 * contrast), 0, 55);
  const shade = clamp(Math.round((18 + roughness * 0.34) * contrast), 4, 52);
  const angle = options?.angle ?? (material === 'matte' ? 145 : material === 'plastic' ? 155 : 135);
  if (material === 'matte') return `linear-gradient(${angle}deg, color-mix(in srgb, ${color} ${100 - Math.round(6 * contrast)}%, white), ${color} 58%, color-mix(in srgb, ${color} ${100 - Math.round(shade * 0.45)}%, black))`;
  if (material === 'plastic') return `linear-gradient(${angle}deg, color-mix(in srgb, ${color} ${100 - shine}%, white) 0%, ${color} 45%, color-mix(in srgb, ${color} ${100 - shade}%, black) 100%)`;
  if (material === 'glass') return `linear-gradient(${angle}deg, color-mix(in srgb, ${color} ${100 - Math.round(22 * contrast)}%, transparent), ${color} 46%, color-mix(in srgb, ${color} ${100 - Math.round(18 * contrast)}%, white) 68%, color-mix(in srgb, ${color} ${100 - Math.round(25 * contrast)}%, transparent))`;
  return `linear-gradient(${angle}deg, color-mix(in srgb, ${color} ${100 - shine}%, white), color-mix(in srgb, ${color} ${100 - shade}%, black) 38%, ${color} 72%, color-mix(in srgb, ${color} ${100 - Math.round(42 * contrast)}%, black))`;
};

const finishColor = (finish: FramePreset['finish']) => ({
  silver: '#b9b9b5', graphite: '#30312f', black: '#111111', titanium: '#68665f',
}[finish]);

const frameGeometryDefaults = (selected: FramePreset): Partial<ProjectState> => ({
  frameThickness: selected.appearance.frameThickness,
  frameCornerRadius: selected.appearance.frameCornerRadius,
  screenCornerRadius: selected.appearance.screenCornerRadius,
  screenScaleX: 100,
  screenScaleY: 100,
  screenOffsetX: 0,
  screenOffsetY: 0,
  stemWidth: selected.parts?.stemWidth ?? (selected.stand === 'xdr' ? 4.2 : selected.stand === 'dell' ? 3 : selected.stand === 'gaming' ? 2.8 : 2.4),
  stemHeight: selected.parts?.stemHeight ?? 13,
  baseWidth: selected.parts?.baseWidth ?? (selected.stand === 'gaming' ? 32 : selected.stand === 'xdr' ? 20 : 24),
  baseHeight: selected.parts?.baseHeight ?? (selected.stand === 'xdr' ? 3.8 : selected.stand === 'gaming' ? 2.3 : selected.stand === 'dell' ? 2.6 : 3.2),
  baseRadius: selected.parts?.baseRadius ?? (selected.stand === 'gaming' ? 3 : selected.stand === 'dell' || selected.stand === 'xdr' ? 3 : 8),
  deckWidth: selected.parts?.deckWidth ?? 76,
  deckHeight: selected.parts?.deckHeight ?? 11,
  detailScale: 100,
});

const frameAppearance = (selected: FramePreset): Partial<ProjectState> => {
  const darkStand = selected.stand === 'gaming' || selected.stand === 'dell';
  return {
    ...frameGeometryDefaults(selected),
    deviceColor: finishColor(selected.finish),
    deviceMaterial: selected.finish === 'black' ? 'matte' : 'metal',
    materialRoughness: selected.finish === 'black' ? 64 : 32,
    materialReflectivity: selected.finish === 'black' ? 28 : 68,
    wireframeEnabled: false,
    wireframeColor: '#f2f2ee',
    wireframeThickness: 2,
    stemColor: darkStand ? '#202120' : '#a4a4a0',
    stemVisible: true,
    baseColor: darkStand ? '#202120' : '#aaa9a5',
    baseVisible: true,
    deckColor: selected.finish === 'silver' ? '#8f908d' : '#4d4e4b',
    deckVisible: true,
    phoneLeftControlsVisible: true,
    phoneRightButtonVisible: true,
    detailColor: '#030303',
    detailVisible: false,
    partGradientEnabled: true,
    partGradientAngle: 105,
    partGradientSize: 240,
    partGradientSoftness: 76,
  };
};

const responsiveViewportSize = (selected: FramePreset, state: ProjectState) => {
  if (!state.viewportAuto) return {
    width: clamp(Math.round(state.viewportWidth), 1, 7680),
    height: clamp(Math.round(state.viewportHeight), 1, 7680),
  };
  const sourceGeometry = frameScreenGeometry(selected, state);
  const adjusted = adjustScreenGeometry(sourceGeometry, state);
  const width = clamp(Math.round(state.viewportWidth * state.screenScaleX / 100), 1, 7680);
  const height = clamp(Math.round(width / Math.max(0.05, screenAspect(adjusted))), 1, 7680);
  return { width, height };
};

const loadStoredProject = (): ProjectState => {
  const fallback = createDefaultProject();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ProjectState>;
    const hydrated = hydrateProject(parsed);
    const selected = getFrame(hydrated.frameId);
    hydrated.detailVisible = false;
    if (!selected.customVariant) {
      Object.assign(hydrated, frameGeometryDefaults(selected));
    } else if (typeof parsed.frameThickness !== 'number' || typeof parsed.frameCornerRadius !== 'number' || typeof parsed.screenCornerRadius !== 'number' || typeof parsed.screenScaleX !== 'number') {
      Object.assign(hydrated, frameAppearance(selected));
    }
    return hydrated;
  } catch {
    return fallback;
  }
};

function App() {
  const [language, setLanguage] = useState<Language>('tr');
  const [theme, setTheme] = useState<Theme>(() => localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark');
  const copy = language === 'tr' ? tr : en;
  const [project, setProject] = useState<ProjectState>(loadStoredProject);
  const [runtime, setRuntime] = useState<RuntimeInfo>({ desktop: Boolean(window.rms), platform: 'web', version: '1.0.0' });
  const [address, setAddress] = useState(project.url);
  const [activeUrl, setActiveUrl] = useState(project.url);
  const [webviewNode, setWebviewNode] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ tone: 'good' | 'bad' | 'info'; text: string } | null>(null);
  const [lastRaw, setLastRaw] = useState<string>();
  const [isPanning, setIsPanning] = useState(false);
  const [activePanel, setActivePanel] = useState<'camera' | 'background' | 'output' | 'advanced'>('camera');
  const [pageElements, setPageElements] = useState<PageElementCandidate[]>([]);
  const [pageElementsLoading, setPageElementsLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => safeJson(RECENT_KEY, []));
  const [bookmarks, setBookmarks] = useState<string[]>(() => safeJson(BOOKMARKS_KEY, []));
  const [savedMonitors, setSavedMonitors] = useState<SavedMonitor[]>(() => safeJson(SAVED_MONITORS_KEY, []));
  const [favoriteFrames, setFavoriteFrames] = useState<string[]>(() => safeJson(FAVORITE_FRAMES_KEY, []));
  const [activeSavedMonitorId, setActiveSavedMonitorId] = useState<string | null>(null);
  const [bookmarkMenuOpen, setBookmarkMenuOpen] = useState(false);
  const [deviceSettingsOpen, setDeviceSettingsOpen] = useState(false);
  const [framesPanelOpen, setFramesPanelOpen] = useState(() => localStorage.getItem(FRAMES_PANEL_KEY) === 'open');
  const [deviceDockPosition, setDeviceDockPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDeviceDockDragging, setIsDeviceDockDragging] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 1000, height: 562.5 });
  const [previewSize, setPreviewSize] = useState({ width: 1000, height: 700 });
  const stageRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLElement>(null);
  const compositionFrameRef = useRef<HTMLDivElement>(null);
  const deviceSettingsDockRef = useRef<HTMLDivElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileKindRef = useRef<'frame' | 'mask' | 'background'>('frame');
  const bookmarkMenuRef = useRef<HTMLDivElement>(null);
  const activeUrlRef = useRef(project.url);
  const addressEditingRef = useRef(false);
  const pendingNavigationRef = useRef<{ target: string; previous: string } | null>(null);
  const panDragRef = useRef<{ pointerId: number; x: number; y: number; cameraX: number; cameraY: number } | null>(null);
  const deviceDockDragRef = useRef<{ pointerId: number; x: number; y: number; originX: number; originY: number; maxX: number; maxY: number } | null>(null);
  const deviceDockDidDragRef = useRef(false);
  const projectRef = useRef(project);
  projectRef.current = project;
  const frame = useMemo(() => getFrame(project.frameId), [project.frameId]);
  const geometryEditable = Boolean(frame.customVariant);
  const defaultProject = useMemo(createDefaultProject, []);
  const modelDefaults = useMemo(() => ({ ...defaultProject, ...frameAppearance(frame) }), [defaultProject, frame]);
  const geometry = useMemo(
    () => adjustScreenGeometry(frameScreenGeometry(frame, project), project),
    [frame, project.customGeometries, project.screenScaleX, project.screenScaleY, project.screenOffsetX, project.screenOffsetY],
  );
  const effectiveViewport = useMemo(
    () => responsiveViewportSize(frame, project),
    [frame, project.customGeometries, project.viewportAuto, project.viewportWidth, project.viewportHeight, project.screenScaleX, project.screenScaleY],
  );
  const customFrames = useMemo(() => FRAME_PRESETS.filter((item) => Boolean(item.customVariant)), []);
  const readyFrameGroups = useMemo(() => groupFrames(language)
    .map(([group, items]) => [group, items.filter((item) => !item.customVariant)] as const)
    .filter(([, items]) => items.length > 0), [language]);
  const favoriteReadyFrames = useMemo(() => FRAME_PRESETS.filter((item) => !item.customVariant && favoriteFrames.includes(item.id)), [favoriteFrames]);

  const updateProject = useCallback((patch: Partial<ProjectState>) => {
    setActiveSavedMonitorId(null);
    setProject((current) => Object.entries(patch).every(([key, value]) => current[key as keyof ProjectState] === value)
      ? current
      : { ...current, ...patch });
  }, []);

  const applyPagePresentation = useCallback(async () => {
    if (!runtime.desktop || !webviewNode?.executeJavaScript) return;
    const css = guestPresentationCss(project);
    const script = `(() => {
      let style = document.getElementById('__rms_page_presentation');
      if (!style) {
        style = document.createElement('style');
        style.id = '__rms_page_presentation';
        (document.head || document.documentElement).appendChild(style);
      }
      style.textContent = ${JSON.stringify(css)};
      return true;
    })()`;
    await webviewNode.executeJavaScript(script, true).catch(() => undefined);
  }, [runtime.desktop, webviewNode, project.freezeAnimations, project.hideScrollbar, project.hideCursor, project.hidePageBackground, project.hiddenSelectors, project.customCss]);

  const refreshPageElements = useCallback(async () => {
    if (!runtime.desktop || !webviewNode?.executeJavaScript) {
      setPageElements([]);
      return;
    }
    setPageElementsLoading(true);
    const script = `(() => {
      const hiddenSelectors = ${JSON.stringify(selectorList(project.hiddenSelectors))};
      const escapeCss = (value) => window.CSS?.escape ? CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
      const stableClass = (value) => value && value.length < 42 && !/^(css|jsx|sc|chakra|mantine|Mui)-/i.test(value) && !/[0-9a-f]{8,}/i.test(value);
      const selectorFor = (element) => {
        if (element.id) {
          const selector = '#' + escapeCss(element.id);
          try { if (document.querySelectorAll(selector).length === 1) return selector; } catch {}
        }
        const tag = element.tagName.toLowerCase();
        const classes = Array.from(element.classList || []).filter(stableClass).slice(0, 2);
        if (classes.length) {
          const selector = tag + classes.map((name) => '.' + escapeCss(name)).join('');
          try { if (document.querySelectorAll(selector).length <= 4) return selector; } catch {}
        }
        const path = [];
        let node = element;
        while (node && node !== document.body && path.length < 4) {
          const nodeTag = node.tagName.toLowerCase();
          const siblings = node.parentElement ? Array.from(node.parentElement.children).filter((item) => item.tagName === node.tagName) : [];
          path.unshift(nodeTag + (siblings.length > 1 ? ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')' : ''));
          const selector = 'body > ' + path.join(' > ');
          try { if (document.querySelectorAll(selector).length === 1) return selector; } catch {}
          node = node.parentElement;
        }
        return 'body > ' + path.join(' > ');
      };
      const candidates = Array.from(document.querySelectorAll('header,nav,footer,aside,dialog,[role="dialog"],[role="banner"],[role="navigation"],[role="contentinfo"],[id],[class]'))
        .filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          const tag = element.tagName.toLowerCase();
          const semantic = ['header','nav','footer','aside','dialog'].includes(tag) || Boolean(element.getAttribute('role'));
          const directlyHidden = hiddenSelectors.some((selector) => { try { return element.matches(selector); } catch { return false; } });
          const pageRoot = !semantic && rect.width >= innerWidth * .92 && rect.height >= innerHeight * .88;
          return element.id !== '__rms_page_presentation'
            && tag !== 'html'
            && tag !== 'body'
            && !pageRoot
            && style.display !== 'none'
            && (style.visibility !== 'hidden' || directlyHidden)
            && rect.width > 24
            && rect.height > 14;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const tag = element.tagName.toLowerCase();
          const semantic = ['header','nav','footer','aside','dialog'].includes(tag) || Boolean(element.getAttribute('role'));
          const fixed = style.position === 'fixed' || style.position === 'sticky';
          const area = Math.min(innerWidth * innerHeight, rect.width * rect.height);
          const score = (semantic ? 1000000 : 0) + (fixed ? 750000 : 0) + area;
          const text = (element.getAttribute('aria-label') || element.getAttribute('role') || element.id || Array.from(element.classList || []).filter(stableClass).slice(0, 2).join('.') || element.textContent || tag).replace(/\\s+/g, ' ').trim().slice(0, 54);
          const selector = selectorFor(element);
          let count = 1;
          try { count = document.querySelectorAll(selector).length; } catch {}
          return { selector, label: text || tag, tag, count, score };
        })
        .sort((left, right) => right.score - left.score);
      const seen = new Set();
      return candidates.filter((item) => item.selector && !seen.has(item.selector) && seen.add(item.selector)).slice(0, 32).map(({ score, ...item }) => item);
    })()`;
    const result = await webviewNode.executeJavaScript(script, true).catch(() => []);
    setPageElements(Array.isArray(result) ? result : []);
    setPageElementsLoading(false);
  }, [runtime.desktop, webviewNode, project.hiddenSelectors]);

  const toggleHiddenSelector = useCallback((selector: string) => {
    if (dangerousPageSelector(selector)) return;
    setProject((current) => {
      const selectors = selectorList(current.hiddenSelectors);
      const next = selectors.includes(selector) ? selectors.filter((item) => item !== selector) : [...selectors, selector];
      return { ...current, hiddenSelectors: next.join(',\n') };
    });
  }, []);

  const updateGradientStop = useCallback((id: string, patch: Partial<GradientColorStop>) => {
    setProject((current) => ({
      ...current,
      backgroundGradientStops: current.backgroundGradientStops.map((stop) => stop.id === id
        ? { ...stop, ...patch, position: patch.position === undefined ? stop.position : clamp(patch.position, 0, 100) }
        : stop),
    }));
  }, []);

  const addGradientStop = useCallback(() => {
    setProject((current) => {
      const sorted = [...current.backgroundGradientStops].sort((left, right) => left.position - right.position);
      let insertAt = 50;
      let widestGap = -1;
      for (let index = 1; index < sorted.length; index += 1) {
        const gap = sorted[index].position - sorted[index - 1].position;
        if (gap > widestGap) {
          widestGap = gap;
          insertAt = Math.round((sorted[index - 1].position + sorted[index].position) / 2);
        }
      }
      return {
        ...current,
        backgroundGradientStops: [...current.backgroundGradientStops, {
          id: `gradient-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          color: '#808080',
          position: insertAt,
        }],
      };
    });
  }, []);

  const removeGradientStop = useCallback((id: string) => {
    setProject((current) => current.backgroundGradientStops.length <= 2 ? current : {
      ...current,
      backgroundGradientStops: current.backgroundGradientStops.filter((stop) => stop.id !== id),
    });
  }, []);

  const updateViewportSize = useCallback((patch: { width?: number; height?: number }) => {
    setProject((current) => ({
      ...current,
      viewportWidth: patch.width === undefined ? current.viewportWidth : clamp(Math.round(Number(patch.width) || 1), 1, 7680),
      viewportHeight: patch.height === undefined ? current.viewportHeight : clamp(Math.round(Number(patch.height) || 1), 1, 7680),
      viewportAuto: false,
      fitMode: 'responsive',
    }));
  }, []);

  const toggleViewportAuto = useCallback(() => {
    setProject((current) => {
      if (current.viewportAuto) {
        const currentSize = responsiveViewportSize(getFrame(current.frameId), current);
        return { ...current, ...currentSize, viewportAuto: false, fitMode: 'responsive' };
      }
      return {
        ...current,
        viewportWidth: clamp(Math.round(current.viewportWidth / Math.max(0.1, current.screenScaleX / 100)), 1, 7680),
        viewportAuto: true,
        fitMode: 'responsive',
      };
    });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = language;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme, language]);

  useEffect(() => {
    const timer = window.setTimeout(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(project)), 140);
    return () => window.clearTimeout(timer);
  }, [project]);

  useEffect(() => {
    const persistLatestProject = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(projectRef.current));
    window.addEventListener('pagehide', persistLatestProject);
    return () => window.removeEventListener('pagehide', persistLatestProject);
  }, []);

  useEffect(() => {
    if (geometryEditable) return;
    const locked = frameGeometryDefaults(frame);
    setProject((current) => {
      const entries = Object.entries(locked) as Array<[keyof ProjectState, ProjectState[keyof ProjectState]]>;
      if (entries.every(([key, value]) => current[key] === value)) return current;
      return { ...current, ...locked };
    });
  }, [frame.id, geometryEditable]);

  useEffect(() => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 12)));
  }, [recent]);

  useEffect(() => {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem(SAVED_MONITORS_KEY, JSON.stringify(savedMonitors));
  }, [savedMonitors]);

  useEffect(() => {
    localStorage.setItem(FAVORITE_FRAMES_KEY, JSON.stringify(favoriteFrames));
  }, [favoriteFrames]);

  useEffect(() => {
    localStorage.setItem(FRAMES_PANEL_KEY, framesPanelOpen ? 'open' : 'closed');
  }, [framesPanelOpen]);

  useEffect(() => {
    if (!bookmarkMenuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!bookmarkMenuRef.current?.contains(event.target as Node)) setBookmarkMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setBookmarkMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [bookmarkMenuOpen]);

  useEffect(() => {
    window.rms?.getRuntimeInfo().then(setRuntime).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!stageRef.current) return;
    const observer = new ResizeObserver(([entry]) => setStageSize((current) => {
      const next = { width: entry.contentRect.width, height: entry.contentRect.height };
      return current.width === next.width && current.height === next.height ? current : next;
    }));
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!previewCanvasRef.current) return;
    const observer = new ResizeObserver(([entry]) => setPreviewSize((current) => {
      const next = { width: entry.contentRect.width, height: entry.contentRect.height };
      return current.width === next.width && current.height === next.height ? current : next;
    }));
    observer.observe(previewCanvasRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!webviewNode) return;
    const start = () => setLoading(true);
    const stop = () => {
      setLoading(false);
      void applyPagePresentation();
      void refreshPageElements();
    };
    const navigated = (event: any) => {
      if (!event?.url) return;
      const pending = pendingNavigationRef.current;
      if (pending && event.url === pending.previous && event.url !== pending.target) return;
      pendingNavigationRef.current = null;
      activeUrlRef.current = event.url;
      if (!addressEditingRef.current) setAddress(event.url);
      setActiveUrl(event.url);
      setProject((current) => ({ ...current, url: event.url }));
    };
    const failed = (event: any) => {
      setLoading(false);
      setToast({ tone: 'bad', text: `${event.errorCode ?? ''} ${event.errorDescription ?? 'Load failed'}`.trim() });
    };
    webviewNode.addEventListener('did-start-loading', start);
    webviewNode.addEventListener('did-stop-loading', stop);
    webviewNode.addEventListener('did-navigate', navigated);
    webviewNode.addEventListener('did-navigate-in-page', navigated);
    webviewNode.addEventListener('did-fail-load', failed);
    return () => {
      webviewNode.removeEventListener('did-start-loading', start);
      webviewNode.removeEventListener('did-stop-loading', stop);
      webviewNode.removeEventListener('did-navigate', navigated);
      webviewNode.removeEventListener('did-navigate-in-page', navigated);
      webviewNode.removeEventListener('did-fail-load', failed);
    };
  }, [webviewNode, applyPagePresentation, refreshPageElements]);

  useEffect(() => {
    void applyPagePresentation();
  }, [applyPagePresentation]);

  useEffect(() => {
    if (activePanel === 'advanced') void refreshPageElements();
  }, [activePanel, activeUrl, refreshPageElements]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (text: string, tone: 'good' | 'bad' | 'info' = 'info') => setToast({ text, tone });

  const navigate = (value = address) => {
    const url = normalizeUrl(value);
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Unsupported protocol');
    } catch {
      showToast(`${copy.invalidUrl}: ${value}`, 'bad');
      return;
    }
    updateProject({ url });
    setAddress(url);
    pendingNavigationRef.current = { target: url, previous: activeUrlRef.current };
    activeUrlRef.current = url;
    setActiveUrl(url);
    setRecent((items) => [url, ...items.filter((item) => item !== url)].slice(0, 12));
    setBookmarkMenuOpen(false);
    if (runtime.desktop && activeUrl === url) webviewNode?.reload?.();
  };

  const toggleBookmark = (value: string) => {
    const url = normalizeUrl(value);
    const exists = bookmarks.includes(url);
    setBookmarks((items) => exists ? items.filter((item) => item !== url) : [url, ...items.filter((item) => item !== url)]);
    showToast(exists ? copy.bookmarkRemoved : copy.bookmarkAdded, 'good');
  };

  const toggleCurrentBookmark = () => toggleBookmark(activeUrl || project.url || address);

  const removeBookmark = (url: string) => {
    setBookmarks((items) => items.filter((item) => item !== url));
    showToast(copy.bookmarkRemoved, 'good');
  };

  const selectFrame = (selected: FramePreset) => {
    updateProject({
      frameId: selected.id,
      viewportWidth: selected.viewport.width,
      viewportHeight: selected.viewport.height,
      viewportAuto: true,
      fitMode: 'responsive',
      ...frameAppearance(selected),
    });
  };

  const toggleFavoriteFrame = (frameId: string) => {
    setFavoriteFrames((items) => items.includes(frameId) ? items.filter((id) => id !== frameId) : [frameId, ...items]);
  };

  const setBreakpoint = (width: number, height: number, frameId?: string) => {
    const selected = frameId ? getFrame(frameId) : undefined;
    updateProject({
      viewportWidth: width,
      viewportHeight: height,
      viewportAuto: true,
      fitMode: 'responsive',
      ...(selected ? { frameId: selected.id, ...frameAppearance(selected) } : {}),
    });
  };

  const resetViewportAndFrame = () => {
    const selected = frame;
    const variant = selected.customVariant;
    const defaultGeometry = variant ? DEFAULT_CUSTOM_GEOMETRIES[variant] : undefined;
    updateProject({
      viewportWidth: selected.viewport.width,
      viewportHeight: selected.viewport.height,
      viewportAuto: true,
      fitMode: 'responsive',
      cameraZoom: defaultProject.cameraZoom,
      cameraX: defaultProject.cameraX,
      cameraY: defaultProject.cameraY,
      tilt: defaultProject.tilt,
      tiltX: defaultProject.tiltX,
      tiltY: defaultProject.tiltY,
      phoneLeftControlsVisible: true,
      phoneRightButtonVisible: true,
      ...frameGeometryDefaults(selected),
      ...(variant && defaultGeometry ? {
        customGeometry: variant === 'desktop' ? defaultGeometry : project.customGeometry,
        customGeometries: { ...project.customGeometries, [variant]: defaultGeometry },
      } : {}),
    });
    showToast(language === 'tr' ? 'Viewport ve çerçeve sıfırlandı.' : 'Viewport and frame reset.', 'good');
  };

  const resetFrameAppearance = () => updateProject(frameAppearance(frame));

  const removeDeviceComponent = (component: 'stem' | 'base' | 'deck' | 'detail' | 'phoneLeftControls' | 'phoneRightButton', label: string) => {
    const question = language === 'tr' ? `${label} kaldırılsın mı?` : `Remove ${label}?`;
    if (!window.confirm(question)) return;
    updateProject({ [`${component}Visible`]: false } as Partial<ProjectState>);
  };

  const beginViewportPan = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 1) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panDragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, cameraX: project.cameraX, cameraY: project.cameraY };
    setIsPanning(true);
  };

  const moveViewportPan = (event: React.PointerEvent<HTMLElement>) => {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const cameraX = clamp(drag.cameraX + ((event.clientX - drag.x) / Math.max(1, stageSize.width)) * (100 / 0.28), -100, 100);
    const cameraY = clamp(drag.cameraY + ((event.clientY - drag.y) / Math.max(1, stageSize.height)) * (100 / 0.28), -100, 100);
    updateProject({ cameraX: Math.round(cameraX * 10) / 10, cameraY: Math.round(cameraY * 10) / 10 });
  };

  const endViewportPan = (event: React.PointerEvent<HTMLElement>) => {
    if (panDragRef.current?.pointerId !== event.pointerId) return;
    panDragRef.current = null;
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const zoomViewport = (event: React.WheelEvent<HTMLElement>) => {
    event.preventDefault();
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    updateProject({ cameraZoom: Math.round(clamp(project.cameraZoom - delta * 0.08, 45, 220) * 10) / 10 });
  };

  const beginDeviceSettingsDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    const collapsedHandle = target.closest('[data-dock-drag-handle="true"]');
    if (!deviceSettingsOpen && !collapsedHandle) return;
    if (!collapsedHandle && target.closest('button,input,select,textarea,a,label,[contenteditable="true"]')) return;
    const scrollColumn = target.closest('.device-settings-group');
    if (scrollColumn) {
      const columnRect = scrollColumn.getBoundingClientRect();
      if (event.clientX >= columnRect.right - 8) return;
    }
    const canvas = previewCanvasRef.current;
    const dock = deviceSettingsDockRef.current;
    if (!canvas || !dock) return;
    const canvasRect = canvas.getBoundingClientRect();
    const dockRect = dock.getBoundingClientRect();
    event.preventDefault();
    event.stopPropagation();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Synthetic QA pointers cannot be captured. */ }
    deviceDockDidDragRef.current = false;
    deviceDockDragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: dockRect.left - canvasRect.left,
      originY: dockRect.top - canvasRect.top,
      maxX: Math.max(0, canvasRect.width - dockRect.width),
      maxY: Math.max(0, canvasRect.height - dockRect.height),
    };
    setIsDeviceDockDragging(true);
  };

  const moveDeviceSettingsDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = deviceDockDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 3) deviceDockDidDragRef.current = true;
    setDeviceDockPosition({
      x: clamp(drag.originX + event.clientX - drag.x, 0, drag.maxX),
      y: clamp(drag.originY + event.clientY - drag.y, 0, drag.maxY),
    });
  };

  const endDeviceSettingsDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (deviceDockDragRef.current?.pointerId !== event.pointerId) return;
    deviceDockDragRef.current = null;
    setIsDeviceDockDragging(false);
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    } catch { /* Synthetic QA pointers cannot be captured. */ }
  };

  useEffect(() => {
    if (!deviceDockPosition) return;
    const animationFrame = window.requestAnimationFrame(() => {
      const canvasRect = previewCanvasRef.current?.getBoundingClientRect();
      const dockRect = deviceSettingsDockRef.current?.getBoundingClientRect();
      if (!canvasRect || !dockRect) return;
      setDeviceDockPosition((current) => current ? {
        x: clamp(current.x, 0, Math.max(0, canvasRect.width - dockRect.width)),
        y: clamp(current.y, 0, Math.max(0, canvasRect.height - dockRect.height)),
      } : current);
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [deviceSettingsOpen]);

  const screenBounds = useMemo(() => {
    const xs = [geometry.topLeft.x, geometry.topRight.x, geometry.bottomRight.x, geometry.bottomLeft.x];
    const ys = [geometry.topLeft.y, geometry.topRight.y, geometry.bottomRight.y, geometry.bottomLeft.y];
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const right = Math.max(...xs);
    const bottom = Math.max(...ys);
    return { left, top, width: right - left, height: bottom - top };
  }, [geometry]);

  const screenPixelSize = useMemo(() => ({
    width: Math.max(1, stageSize.width * screenBounds.width),
    height: Math.max(1, stageSize.height * screenBounds.height),
  }), [stageSize, screenBounds]);

  const liveScale = useMemo(() => {
    const scaleX = screenPixelSize.width / Math.max(1, effectiveViewport.width);
    const scaleY = screenPixelSize.height / Math.max(1, effectiveViewport.height);
    return project.fitMode === 'cover' ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
  }, [screenPixelSize, effectiveViewport.width, effectiveViewport.height, project.fitMode]);

  useEffect(() => {
    if (!runtime.desktop || !webviewNode?.setZoomFactor) return;
    const resetGuestZoom = () => {
      try {
        webviewNode.setZoomFactor(1);
      } catch {
        // The guest may still be attaching; dom-ready retries at native scale.
      }
    };
    resetGuestZoom();
    webviewNode.addEventListener('dom-ready', resetGuestZoom);
    return () => webviewNode.removeEventListener('dom-ready', resetGuestZoom);
  }, [runtime.desktop, webviewNode]);

  useEffect(() => {
    if (!runtime.desktop || !webviewNode) return;
    webviewNode.style.width = `${effectiveViewport.width}px`;
    webviewNode.style.height = `${effectiveViewport.height}px`;
    const animationFrame = window.requestAnimationFrame(() => {
      webviewNode.executeJavaScript?.('window.dispatchEvent(new Event("resize"))', true)?.catch?.(() => undefined);
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [runtime.desktop, webviewNode, effectiveViewport.width, effectiveViewport.height]);

  const readPreviewLayout = (): PreviewLayout | undefined => {
    const viewport = previewCanvasRef.current;
    const stage = stageRef.current?.parentElement;
    if (!viewport || !stage || viewport.clientWidth < 1 || viewport.clientHeight < 1) return undefined;
    const frameGuide = project.compositionFrameRatio === 'none' ? null : compositionFrameRef.current;
    if (frameGuide) {
      const viewportRect = viewport.getBoundingClientRect();
      const frameRect = frameGuide.getBoundingClientRect();
      return {
        viewportWidth: frameRect.width,
        viewportHeight: frameRect.height,
        stageX: stage.offsetLeft - (frameRect.left - viewportRect.left),
        stageY: stage.offsetTop - (frameRect.top - viewportRect.top),
        stageWidth: stage.offsetWidth,
        stageHeight: stage.offsetHeight,
      };
    }
    return {
      viewportWidth: viewport.clientWidth,
      viewportHeight: viewport.clientHeight,
      stageX: stage.offsetLeft,
      stageY: stage.offsetTop,
      stageWidth: stage.offsetWidth,
      stageHeight: stage.offsetHeight,
    };
  };

  const captureCurrent = async (captureFrame = frame, captureProject = project, previewLayout = readPreviewLayout()): Promise<CaptureResult> => {
    if (!runtime.desktop || !window.rms || !webviewNode?.getWebContentsId) {
      return lastRaw ? { ok: true, dataUrl: lastRaw } : { ok: false, error: copy.noCapture };
    }
    const dimensions = resolveOutputDimensions(
      captureProject.exportSettings,
      previewLayout ? previewLayout.viewportWidth / Math.max(1, previewLayout.viewportHeight) : 16 / 9,
    );
    const captureViewport = responsiveViewportSize(captureFrame, captureProject);
    const captureGeometry = frameScreenGeometry(captureFrame, captureProject);
    const previewScale = previewLayout
      ? Math.min(dimensions.width / previewLayout.viewportWidth, dimensions.height / previewLayout.viewportHeight)
      : 1;
    const stageWidth = previewLayout ? previewLayout.stageWidth * previewScale : dimensions.width;
    const stageHeight = previewLayout ? previewLayout.stageHeight * previewScale : dimensions.height;
    const apertureWidth = Math.abs(captureGeometry.topRight.x - captureGeometry.topLeft.x) * stageWidth * (captureProject.cameraZoom / 100);
    const apertureHeight = Math.abs(captureGeometry.bottomLeft.y - captureGeometry.topLeft.y) * stageHeight * (captureProject.cameraZoom / 100);
    const requiredDensity = Math.max(apertureWidth / captureViewport.width, apertureHeight / captureViewport.height);
    const pixelRatio = Math.max(1.5, Math.min(4, requiredDensity * 1.4));
    setLoading(true);
    try {
      const result = await window.rms.capturePage({
        webContentsId: webviewNode.getWebContentsId(),
        viewportWidth: captureViewport.width,
        viewportHeight: captureViewport.height,
        pixelRatio,
        fullPage: false,
        scrollY: 0,
        delayMs: 0,
        freezeAnimations: captureProject.freezeAnimations,
        hideScrollbar: captureProject.hideScrollbar,
        hideCursor: captureProject.hideCursor,
        hidePageBackground: captureProject.hidePageBackground,
        customCss: captureProject.customCss,
        hiddenSelectors: captureProject.hiddenSelectors,
      });
      if (result.ok && result.dataUrl) setLastRaw(result.dataUrl);
      else showToast(`${copy.captureFailed}: ${result.error || ''}`, 'bad');
      return result;
    } catch (error) {
      const result = { ok: false, error: error instanceof Error ? error.message : String(error) };
      showToast(`${copy.captureFailed}: ${result.error}`, 'bad');
      return result;
    } finally {
      setLoading(false);
    }
  };

  const captureCurrentSvg = async (captureFrame = frame, captureProject = project) => {
    if (!runtime.desktop || !window.rms || !webviewNode?.getWebContentsId) {
      return { ok: false, error: language === 'tr' ? 'Vektör website yakalama masaüstü sürümünde kullanılabilir.' : 'Vector website capture is available in the desktop build.' };
    }
    const captureViewport = responsiveViewportSize(captureFrame, captureProject);
    setLoading(true);
    try {
      const result = await window.rms.capturePageSvg({
        webContentsId: webviewNode.getWebContentsId(),
        viewportWidth: captureViewport.width,
        viewportHeight: captureViewport.height,
        fullPage: false,
        scrollY: 0,
        delayMs: 0,
        freezeAnimations: captureProject.freezeAnimations,
        hideScrollbar: captureProject.hideScrollbar,
        hideCursor: captureProject.hideCursor,
        hidePageBackground: captureProject.hidePageBackground,
        customCss: captureProject.customCss,
        hiddenSelectors: captureProject.hiddenSelectors,
      });
      if (!result.ok) showToast(`${copy.captureFailed}: ${result.error || ''}`, 'bad');
      return result;
    } catch (error) {
      const result = { ok: false, error: error instanceof Error ? error.message : String(error) };
      showToast(`${copy.captureFailed}: ${result.error}`, 'bad');
      return result;
    } finally {
      setLoading(false);
    }
  };

  const renderName = (selectedFrame: FramePreset, selectedProject: ProjectState) => {
    const date = new Date().toISOString().slice(0, 10);
    const site = slug(new URL(normalizeUrl(selectedProject.url)).hostname);
    const width = resolveOutputDimensions(selectedProject.exportSettings).width;
    return selectedProject.exportSettings.namingTemplate
      .replaceAll('{site}', site)
      .replaceAll('{frame}', slug(selectedFrame.name.en))
      .replaceAll('{width}', String(width))
      .replaceAll('{date}', date);
  };

  const browserDownload = (dataUrl: string, name: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const browserDownloadSvg = (svg: string, name: string) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const saveSvgDocument = async (svg: string, selectedFrame: FramePreset, selectedProject: ProjectState, suffix = '', outputPath?: string) => {
    const baseName = `${renderName(selectedFrame, selectedProject)}${suffix}`;
    if (!runtime.desktop || !window.rms) {
      browserDownloadSvg(svg, `${baseName}.svg`);
      return null;
    }
    const result = await window.rms.saveSvg({
      svg,
      suggestedName: baseName,
      path: outputPath ? `${outputPath}\\${baseName}.svg` : undefined,
    });
    if (result.ok && result.path && result.sha256) return result;
    if (result.error !== 'cancelled') showToast(result.error || 'SVG export failed', 'bad');
    return null;
  };

  const saveCanvas = async (
    target: HTMLCanvasElement,
    selectedFrame: FramePreset,
    selectedProject: ProjectState,
    suffix = '',
    outputPath?: string,
  ) => {
    const format = selectedProject.exportSettings.format;
    const { canvasToDataUrl } = await import('./composer');
    const dataUrl = await canvasToDataUrl(target, format, selectedProject.exportSettings.quality / 100);
    const baseName = `${renderName(selectedFrame, selectedProject)}${suffix}`;
    const extension = format === 'jpeg' ? 'jpg' : format === 'transparent-png' ? 'png' : format;
    if (!runtime.desktop || !window.rms) {
      browserDownload(dataUrl, `${baseName}.${extension}`);
      return null;
    }
    const result = await window.rms.saveImage({
      dataUrl,
      format,
      dpi: selectedProject.exportSettings.dpi,
      quality: selectedProject.exportSettings.quality,
      suggestedName: baseName,
      path: outputPath ? `${outputPath}\\${baseName}.${extension}` : undefined,
    });
    if (result.ok && result.path && result.sha256) return result;
    if (result.error !== 'cancelled') showToast(result.error || 'Export failed', 'bad');
    return null;
  };

  const exportOne = async (selectedFrame = frame, selectedProject = project, outputPath?: string) => {
    const previewLayout = readPreviewLayout();
    const needsCapture = selectedProject.exportSettings.outputKind !== 'empty';
    if (selectedProject.exportSettings.format === 'svg') {
      const vectorCapture = needsCapture ? await captureCurrentSvg(selectedFrame, selectedProject) : { ok: true, svg: undefined };
      if (!vectorCapture.ok) return;
      const { composeMockupSvg } = await import('./svgComposer');
      const svg = composeMockupSvg(vectorCapture.svg, selectedProject, selectedFrame, previewLayout);
      const saved = await saveSvgDocument(svg, selectedFrame, selectedProject, selectedProject.exportSettings.outputKind === 'empty' ? '-empty' : '', outputPath);
      if (saved || !runtime.desktop) {
        showToast(copy.exportDone, 'good');
      }
      return;
    }
    const captured = needsCapture ? await captureCurrent(selectedFrame, selectedProject, previewLayout) : { ok: true };
    if (!captured.ok) return;
    const { composeMockup } = await import('./composer');
    const { composite } = await composeMockup(captured.dataUrl, selectedProject, selectedFrame, previewLayout);
    await saveCanvas(composite, selectedFrame, selectedProject, selectedProject.exportSettings.outputKind === 'empty' ? '-empty' : '', outputPath);
    showToast(copy.exportDone, 'good');
  };

  const toggleSaveCurrentMonitor = () => {
    if (!frame.customVariant) {
      showToast(language === 'tr' ? 'Önce özel bir çerçeve seç.' : 'Select a custom frame first.', 'info');
      return;
    }
    if (activeSavedMonitorId) {
      setSavedMonitors((items) => items.filter((item) => item.id !== activeSavedMonitorId));
      setActiveSavedMonitorId(null);
      showToast(language === 'tr' ? 'Kayıt kaldırıldı.' : 'Saved device removed.', 'info');
      return;
    }
    const id = globalThis.crypto?.randomUUID?.() || `saved-${Date.now()}`;
    const typeName = frame.customVariant === 'desktop'
      ? (language === 'tr' ? 'Bilgisayar' : 'Desktop')
      : frame.customVariant === 'tablet' ? 'Tablet' : (language === 'tr' ? 'Telefon' : 'Phone');
    const number = savedMonitors.filter((item) => getFrame(item.frameId).customVariant === frame.customVariant).length + 1;
    const saved: SavedMonitor = {
      id,
      name: `${typeName} ${number}`,
      frameId: frame.id,
      thumbnail: createDeviceThumbnail(frame, project),
      project: JSON.parse(JSON.stringify(project)) as ProjectState,
      createdAt: Date.now(),
    };
    setSavedMonitors((items) => [saved, ...items]);
    setActiveSavedMonitorId(id);
    showToast(language === 'tr' ? 'Monitör kaydedildi.' : 'Device saved.', 'good');
  };

  const loadSavedMonitor = (saved: SavedMonitor) => {
    const savedProject = hydrateProject(saved.project);
    setProject((current) => ({
      ...savedProject,
      url: current.url,
      backgroundMode: current.backgroundMode,
      backgroundColor: current.backgroundColor,
      backgroundGradientType: current.backgroundGradientType,
      backgroundGradientStops: current.backgroundGradientStops,
      backgroundGradientAngle: current.backgroundGradientAngle,
      backgroundImage: current.backgroundImage,
      cameraZoom: current.cameraZoom,
      cameraX: current.cameraX,
      cameraY: current.cameraY,
      tilt: current.tilt,
      tiltX: current.tiltX,
      tiltY: current.tiltY,
      exportSettings: current.exportSettings,
      freezeAnimations: current.freezeAnimations,
      hideScrollbar: current.hideScrollbar,
      hideCursor: current.hideCursor,
      hidePageBackground: current.hidePageBackground,
      customCss: current.customCss,
      hiddenSelectors: current.hiddenSelectors,
    }));
    setActiveSavedMonitorId(saved.id);
  };

  const exportSavedMonitor = async (saved: SavedMonitor) => {
    const savedProject = hydrateProject(saved.project);
    await exportOne(getFrame(saved.frameId), {
      ...savedProject,
      url: project.url,
      backgroundMode: 'transparent',
      exportSettings: { ...project.exportSettings, format: 'transparent-png', outputKind: 'empty' },
    });
  };

  const removeSavedMonitor = (id: string) => {
    setSavedMonitors((items) => items.filter((item) => item.id !== id));
    if (activeSavedMonitorId === id) setActiveSavedMonitorId(null);
  };

  const importImage = async (kind: 'frame' | 'mask' | 'background') => {
    if (runtime.desktop && window.rms) {
      const result = await window.rms.readImageFile(kind);
      if (!result.ok || !result.dataUrl) return;
      const customFrameId = geometryEditable ? frame.id : 'custom';
      updateProject(kind === 'frame' ? { customFrameImage: result.dataUrl, frameId: customFrameId }
        : kind === 'mask' ? { customMaskImage: result.dataUrl, frameId: customFrameId }
          : { backgroundImage: result.dataUrl, backgroundMode: 'image' });
      return;
    }
    fileKindRef.current = kind;
    fileInputRef.current?.click();
  };

  const handleGenericFile = async (file?: File) => {
    if (!file) return;
    const dataUrl = await dataUrlFromFile(file);
    const kind = fileKindRef.current;
    const customFrameId = geometryEditable ? frame.id : 'custom';
    updateProject(kind === 'frame' ? { customFrameImage: dataUrl, frameId: customFrameId }
      : kind === 'mask' ? { customMaskImage: dataUrl, frameId: customFrameId }
        : { backgroundImage: dataUrl, backgroundMode: 'image' });
  };

  const stageScale = stageSize.width / 1000;
  const frameX = project.frameThickness / 1000;
  const frameY = project.frameThickness / (1000 * 9 / 16);
  const presetBodyGeometry = !geometryEditable && frame.body ? adjustScreenGeometry(frame.body, project) : null;
  const presetBodyXs = presetBodyGeometry ? [presetBodyGeometry.topLeft.x, presetBodyGeometry.topRight.x, presetBodyGeometry.bottomRight.x, presetBodyGeometry.bottomLeft.x] : [];
  const presetBodyYs = presetBodyGeometry ? [presetBodyGeometry.topLeft.y, presetBodyGeometry.topRight.y, presetBodyGeometry.bottomRight.y, presetBodyGeometry.bottomLeft.y] : [];
  const bodyBounds = presetBodyGeometry ? {
    x: Math.min(...presetBodyXs),
    y: Math.min(...presetBodyYs),
    width: Math.max(...presetBodyXs) - Math.min(...presetBodyXs),
    height: Math.max(...presetBodyYs) - Math.min(...presetBodyYs),
  } : {
    x: screenBounds.left - frameX,
    y: screenBounds.top - frameY,
    width: screenBounds.width + frameX * 2,
    height: screenBounds.height + frameY * 2,
  };
  const screenRenderBounds = screenBounds;
  const bodyRenderBounds = { left: bodyBounds.x, top: bodyBounds.y, width: bodyBounds.width, height: bodyBounds.height };
  const bodyStyle: React.CSSProperties = {
    left: `${bodyRenderBounds.left * 100}%`,
    top: `${bodyRenderBounds.top * 100}%`,
    width: `${bodyRenderBounds.width * 100}%`,
    height: `${bodyRenderBounds.height * 100}%`,
    borderRadius: `${project.frameCornerRadius * stageScale}px`,
  };
  const customClip = geometryEditable
    ? `polygon(${[geometry.topLeft, geometry.topRight, geometry.bottomRight, geometry.bottomLeft].map((point) => `${((point.x - screenBounds.left) / screenBounds.width) * 100}% ${((point.y - screenBounds.top) / screenBounds.height) * 100}%`).join(',')})`
    : undefined;
  const liveSurfaceStyle: React.CSSProperties = {
    left: `${screenRenderBounds.left * 100}%`,
    top: `${screenRenderBounds.top * 100}%`,
    width: `${screenRenderBounds.width * 100}%`,
    height: `${screenRenderBounds.height * 100}%`,
    borderRadius: `${project.screenCornerRadius * stageScale}px`,
    clipPath: customClip,
  };
  const deviceBodyStyle: React.CSSProperties = {
    ...bodyStyle,
    background: materialSurface(project.deviceColor, project.deviceMaterial, project.materialRoughness, project.materialReflectivity),
    boxShadow: project.shadowEnabled
      ? `${project.shadowOffsetX * stageScale}px ${project.shadowOffsetY * stageScale}px ${project.shadowBlur * stageScale}px ${project.shadowSpread * stageScale}px rgba(0,0,0,${project.shadowOpacity / 100})`
      : 'none',
  };
  const partSurfaceOptions = {
    enabled: project.partGradientEnabled,
    angle: project.partGradientAngle,
    softness: project.partGradientSoftness,
  };
  const partGradientSizing: React.CSSProperties = project.partGradientEnabled ? {
    backgroundSize: `${project.partGradientSize}% ${project.partGradientSize}%`,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  } : {};
  const partSurfaceStyle = (color: string): React.CSSProperties => {
    const surface = materialSurface(color, project.deviceMaterial, project.materialRoughness, project.materialReflectivity, partSurfaceOptions);
    return project.partGradientEnabled
      ? { backgroundColor: color, backgroundImage: surface, ...partGradientSizing }
      : { background: surface };
  };
  const standTop = bodyBounds.y + bodyBounds.height - 0.002;
  const stemJoinsWireframeBase = project.wireframeEnabled && project.baseVisible;
  const stemStyle: React.CSSProperties = {
    left: `${50 - project.stemWidth / 2}%`,
    top: `${standTop * 100}%`,
    width: `${project.stemWidth}%`,
    height: `${Math.max(0.1, project.stemHeight - (stemJoinsWireframeBase ? 0.5 : 0))}%`,
    ...partSurfaceStyle(project.stemColor),
  };
  const baseStyle: React.CSSProperties = {
    left: `${50 - project.baseWidth / 2}%`,
    top: `${standTop * 100 + project.stemHeight - 0.5}%`,
    width: `${project.baseWidth}%`,
    height: `${project.baseHeight}%`,
    borderRadius: `${project.baseRadius * stageScale}px`,
    ...partSurfaceStyle(project.baseColor),
  };
  const deckStyle: React.CSSProperties = {
    left: `${50 - project.deckWidth / 2}%`,
    top: `${(bodyBounds.y + bodyBounds.height - 0.0015) * 100}%`,
    width: `${project.deckWidth}%`,
    height: `${project.deckHeight}%`,
    ...partSurfaceStyle(project.deckColor),
    '--deck-color': project.deckColor,
  } as React.CSSProperties;
  const detailScale = project.detailScale / 100;
  const detailStyle = (width: number, height: number): React.CSSProperties => ({
    left: `${50 - width * detailScale / 2}%`,
    width: `${width * detailScale}%`,
    height: `${height * detailScale}%`,
    background: project.detailColor,
  });
  const phoneLeftControlsStyle = {
    left: `${(bodyBounds.x - 0.006) * 100}%`,
    top: `${(bodyBounds.y + bodyBounds.height * 0.22) * 100}%`,
    width: '1.2%',
    height: `${bodyBounds.height * 0.18 * 100}%`,
    '--phone-button-color': project.deviceColor,
  } as React.CSSProperties;
  const phoneRightButtonStyle = {
    left: `${(bodyBounds.x + bodyBounds.width - 0.006) * 100}%`,
    top: `${(bodyBounds.y + bodyBounds.height * 0.29) * 100}%`,
    width: '1.2%',
    height: `${bodyBounds.height * 0.13 * 100}%`,
    '--phone-button-color': project.deviceColor,
  } as React.CSSProperties;
  const screenTopCenter = screenBounds.top;
  const displayCameraTop = bodyBounds.y + Math.max(0.003, (screenTopCenter - bodyBounds.y) * 0.5) - 0.0028 * detailScale;
  const deviceStageStyle = {
    '--wire-color': project.wireframeColor,
    '--wire-size': `${project.wireframeThickness * stageScale}px`,
  } as React.CSSProperties;
  const browserStyle: React.CSSProperties = {
    width: `${effectiveViewport.width}px`,
    height: `${effectiveViewport.height}px`,
    transform: `translate(-50%, -50%) scale(${liveScale})`,
  };
  const liveScreenContentStyle: React.CSSProperties = {
    filter: 'none',
    transform: 'translateZ(0)',
  };
  const deviceSettingsDockStyle: React.CSSProperties | undefined = deviceDockPosition ? {
    left: `${deviceDockPosition.x}px`,
    top: `${deviceDockPosition.y}px`,
    bottom: 'auto',
    transform: 'none',
  } : undefined;
  const compositionFrameAspect = (() => {
    const base = project.compositionFrameRatio === '1:1' ? 1 : project.compositionFrameRatio === '4:5' ? 4 / 5 : 16 / 9;
    return project.compositionFrameOrientation === 'portrait' ? Math.min(base, 1 / base) : Math.max(base, 1 / base);
  })();
  const compositionFrameInset = 28;
  const compositionFrameAvailableWidth = Math.max(1, previewSize.width - compositionFrameInset * 2);
  const compositionFrameAvailableHeight = Math.max(1, previewSize.height - compositionFrameInset * 2);
  const compositionFrameWidth = Math.min(compositionFrameAvailableWidth, compositionFrameAvailableHeight * compositionFrameAspect);
  const compositionFrameHeight = compositionFrameWidth / compositionFrameAspect;
  const compositionFrameStyle: React.CSSProperties | undefined = project.compositionFrameRatio === 'none' ? undefined : {
    width: `${compositionFrameWidth}px`,
    height: `${compositionFrameHeight}px`,
  };
  const currentBookmarkUrl = normalizeUrl(activeUrl || project.url);
  const currentBookmarked = bookmarks.includes(currentBookmarkUrl);
  const backgroundGradientStops = normalizeGradientStops(project.backgroundGradientStops, defaultProject.backgroundGradientStops);
  const backgroundGradientStopCss = backgroundGradientStops
    .map((stop) => `${canonicalHexColor(stop.color)} ${clamp(stop.position, 0, 100)}%`)
    .join(', ');
  const backgroundGradientCss = project.backgroundGradientType === 'radial'
    ? `radial-gradient(circle at center, ${backgroundGradientStopCss})`
    : `linear-gradient(${project.backgroundGradientAngle}deg, ${backgroundGradientStopCss})`;
  const centerDeviceInPreview = () => updateProject({
    cameraX: defaultProject.cameraX,
    cameraY: defaultProject.cameraY,
  });

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="language-button" onClick={() => setLanguage(language === 'tr' ? 'en' : 'tr')}><Languages size={15} /> {language.toUpperCase()}</button>
        <button
          className="theme-toggle"
          type="button"
          role="switch"
          aria-checked={theme === 'light'}
          title={copy.theme}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <span>DARK</span><i aria-hidden="true" /><span>LIGHT</span>
        </button>
      </header>

      <div className={`workspace-grid ${framesPanelOpen ? '' : 'frames-collapsed'}`}>
        {!framesPanelOpen && <button className="frames-reveal" type="button" aria-label={copy.showFrames} title={copy.showFrames} onClick={() => setFramesPanelOpen(true)}><PanelLeftOpen size={15} /><span>{copy.frames}</span></button>}
        <aside className={`left-panel panel ${framesPanelOpen ? '' : 'collapsed'}`} aria-hidden={!framesPanelOpen}>
          <div className="panel-heading">
            <span>{copy.frames}</span>
            <span className="panel-heading-actions">
              <span className="count-pill">{FRAME_PRESETS.length + savedMonitors.length}</span>
              <button className="frames-collapse" type="button" aria-label={copy.hideFrames} title={copy.hideFrames} onClick={() => setFramesPanelOpen(false)}><PanelLeftClose size={14} /></button>
            </span>
          </div>
          <div className="frame-scroll">
            <section className="frame-group custom-frame-group">
              <div className="group-label">{language === 'tr' ? 'Özel çerçeve' : 'Custom frame'}</div>
              <div className="frame-grid compact-frame-grid">
                {customFrames.map((item) => (
                  <button key={item.id} data-frame-id={item.id} className={`frame-card compact-frame-card ${item.id === frame.id ? 'selected' : ''}`} onClick={() => selectFrame(item)}>
                    <span className={`frame-glyph kind-${item.kind}`} style={{ '--accent': item.accent } as React.CSSProperties}>{item.thumbnail}</span>
                    <span className="frame-card-copy"><strong>{item.customVariant === 'desktop' ? (language === 'tr' ? 'Bilgisayar' : 'Desktop') : item.customVariant === 'tablet' ? 'Tablet' : (language === 'tr' ? 'Telefon' : 'Phone')}</strong><small>{item.viewport.width} × {item.viewport.height}</small></span>
                  </button>
                ))}
              </div>
            </section>

            {favoriteReadyFrames.length > 0 && <section className="frame-group favorite-frame-group">
              <div className="group-label">{language === 'tr' ? 'Favoriler' : 'Favorites'}</div>
              <div className="frame-grid compact-frame-grid">
                {favoriteReadyFrames.map((item) => <div className="ready-frame-row" key={`favorite-${item.id}`}>
                  <button data-frame-id={item.id} className={`frame-card compact-frame-card ${item.id === frame.id ? 'selected' : ''}`} onClick={() => selectFrame(item)}>
                    <span className={`frame-glyph kind-${item.kind}`} style={{ '--accent': item.accent } as React.CSSProperties}>{item.thumbnail}</span>
                    <span className="frame-card-copy"><strong>{item.name[language]}</strong><small>{item.aspectLabel}</small></span>
                  </button>
                  <button className="frame-favorite active" type="button" aria-label={language === 'tr' ? 'Favorilerden çıkar' : 'Remove from favorites'} title={language === 'tr' ? 'Favorilerden çıkar' : 'Remove from favorites'} onClick={() => toggleFavoriteFrame(item.id)}><Heart size={12} fill="currentColor" /></button>
                </div>)}
              </div>
            </section>}

            <details className="ready-frame-details">
              <summary><span>{language === 'tr' ? 'Hazır çerçeveler' : 'Preset frames'}</span><ChevronDown size={13} /></summary>
              <div className="ready-frame-content">
                {readyFrameGroups.map(([group, items]) => (
                  <section className="frame-group" key={group}>
                    <div className="group-label">{group}</div>
                    <div className="frame-grid compact-frame-grid">
                      {items.map((item) => <div className="ready-frame-row" key={item.id}>
                        <button data-frame-id={item.id} className={`frame-card compact-frame-card ${item.id === frame.id ? 'selected' : ''}`} onClick={() => selectFrame(item)}>
                          <span className={`frame-glyph kind-${item.kind}`} style={{ '--accent': item.accent } as React.CSSProperties}>{item.thumbnail}</span>
                          <span className="frame-card-copy"><strong>{item.name[language]}</strong><small>{item.aspectLabel}</small></span>
                        </button>
                        <button className={`frame-favorite ${favoriteFrames.includes(item.id) ? 'active' : ''}`} type="button" aria-pressed={favoriteFrames.includes(item.id)} aria-label={favoriteFrames.includes(item.id) ? (language === 'tr' ? 'Favorilerden çıkar' : 'Remove from favorites') : (language === 'tr' ? 'Favorilere ekle' : 'Add to favorites')} title={favoriteFrames.includes(item.id) ? (language === 'tr' ? 'Favorilerden çıkar' : 'Remove from favorites') : (language === 'tr' ? 'Favorilere ekle' : 'Add to favorites')} onClick={() => toggleFavoriteFrame(item.id)}><Heart size={12} fill={favoriteFrames.includes(item.id) ? 'currentColor' : 'none'} /></button>
                      </div>)}
                    </div>
                  </section>
                ))}
              </div>
            </details>

            <section className="saved-monitor-section">
              <div className="group-label">{language === 'tr' ? 'Kaydedilen cihazlar' : 'Saved devices'}</div>
              <div className="saved-monitor-list">
                {savedMonitors.map((saved) => (
                  <div className={`saved-monitor-row ${activeSavedMonitorId === saved.id ? 'active' : ''}`} key={saved.id} data-saved-monitor-id={saved.id}>
                    <button className="saved-monitor-load" type="button" onClick={() => loadSavedMonitor(saved)}>
                      <img src={saved.thumbnail} alt="" />
                      <span><strong>{saved.name}</strong><small>{getFrame(saved.frameId).customVariant?.toUpperCase()}</small></span>
                    </button>
                    <button className="saved-monitor-export" type="button" title={language === 'tr' ? 'Boş ekranlı şeffaf cihaz PNG' : 'Transparent device PNG with empty screen'} aria-label={`${saved.name}: ${language === 'tr' ? 'boş ekranlı PNG' : 'empty-screen PNG'}`} onClick={() => void exportSavedMonitor(saved)}><FileOutput size={12} /></button>
                    <button className="saved-monitor-delete" type="button" title={language === 'tr' ? 'Sil' : 'Delete'} aria-label={`${saved.name}: ${language === 'tr' ? 'sil' : 'delete'}`} onClick={() => removeSavedMonitor(saved.id)}><Trash2 size={12} /></button>
                  </div>
                ))}
                {savedMonitors.length === 0 && <p className="saved-monitor-empty">{language === 'tr' ? 'Yıldızla kaydet.' : 'Save with the star.'}</p>}
              </div>
            </section>
          </div>
        </aside>

        <main className="main-column">
          <div className="browser-bar panel">
            <button className="browser-icon" onClick={() => webviewNode?.canGoBack?.() && webviewNode.goBack()}><ArrowLeft size={16} /></button>
            <button className="browser-icon" onClick={() => webviewNode?.canGoForward?.() && webviewNode.goForward()}><ArrowRight size={16} /></button>
            <button className="browser-icon" onClick={() => runtime.desktop ? webviewNode?.reload?.() : navigate()}><RefreshCw size={15} /></button>
            <form className="address-field" onSubmit={(event) => { event.preventDefault(); navigate(address); }}>
              <Globe2 size={14} />
              <input
                aria-label="URL"
                value={address}
                onChange={(event) => setAddress(event.currentTarget.value)}
                onPointerDown={(event) => { event.stopPropagation(); addressEditingRef.current = true; }}
                onFocus={() => { addressEditingRef.current = true; }}
                onBlur={() => { addressEditingRef.current = false; }}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  navigate(event.currentTarget.value);
                }}
              />
              {loading && <LoaderCircle className="spin" size={14} />}
            </form>
            <div className="bookmark-menu-wrap" ref={bookmarkMenuRef}>
              <button
                className={`browser-icon ${bookmarkMenuOpen || currentBookmarked ? 'active' : ''}`}
                type="button"
                title={copy.bookmarks}
                aria-label={copy.bookmarks}
                aria-haspopup="menu"
                aria-expanded={bookmarkMenuOpen}
                onClick={() => setBookmarkMenuOpen((open) => !open)}
              ><Heart size={15} fill={currentBookmarked ? 'currentColor' : 'none'} /></button>
              {bookmarkMenuOpen && (
                <div className="bookmark-menu" role="menu">
                  <div className="bookmark-menu-heading"><span>{copy.bookmarks}</span><b>{bookmarks.length}</b></div>
                  <button className="bookmark-current" type="button" role="menuitem" onClick={toggleCurrentBookmark}>
                    {currentBookmarked ? <BookmarkCheck size={14} /> : <BookmarkPlus size={14} />}
                    <span>{currentBookmarked ? copy.removeBookmark : copy.bookmarkCurrent}</span>
                  </button>
                  <div className="bookmark-list">
                    {bookmarks.length === 0 && <p>{copy.noBookmarks}</p>}
                    {bookmarks.map((url) => (
                      <div className="bookmark-item" key={url}>
                        <button className="bookmark-link" type="button" role="menuitem" onClick={() => navigate(url)}>
                          <strong>{hostnameFromUrl(url)}</strong><small>{url}</small>
                        </button>
                        <button className="bookmark-delete" type="button" aria-label={`${copy.removeBookmark}: ${hostnameFromUrl(url)}`} onClick={() => removeBookmark(url)}><Trash2 size={13} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="preview-toolbar panel">
            <div className="breakpoints">
              <button onClick={() => setBreakpoint(1920, 1080, 'custom')}><Monitor size={14} /> {copy.desktop}</button>
              <button onClick={() => setBreakpoint(834, 1210, 'custom-tablet')}><Grid2X2 size={14} /> {copy.tablet}</button>
              <button onClick={() => setBreakpoint(402, 874, 'custom-phone')}><Smartphone size={14} /> {copy.phone}</button>
              <button className={`viewport-mode-toggle ${project.viewportAuto ? 'active' : ''}`} type="button" role="switch" aria-checked={project.viewportAuto} title={project.viewportAuto ? copy.viewportAuto : copy.viewportCustom} onClick={toggleViewportAuto}>{project.viewportAuto ? 'AUTO' : 'CUSTOM'}</button>
              <span className={`viewport-fields ${project.viewportAuto ? 'auto' : ''}`}><input type="number" value={effectiveViewport.width} disabled={project.viewportAuto} aria-label="Viewport width" onInput={(event) => updateViewportSize({ width: Number(event.currentTarget.value) })} /><b>×</b><input type="number" value={effectiveViewport.height} disabled={project.viewportAuto} aria-label="Viewport height" onInput={(event) => updateViewportSize({ height: Number(event.currentTarget.value) })} /></span>
              <button
                className="viewport-swap"
                type="button"
                title={language === 'tr' ? 'En ve boyu değiştir' : 'Swap width and height'}
                aria-label={language === 'tr' ? 'En ve boyu değiştir' : 'Swap width and height'}
                onClick={() => updateProject({ viewportWidth: effectiveViewport.height, viewportHeight: effectiveViewport.width, viewportAuto: false, fitMode: 'responsive' })}
              ><ArrowLeftRight size={14} /></button>
              <button
                className="viewport-reset"
                type="button"
                title={language === 'tr' ? 'Viewport ve özel çerçeveyi sıfırla' : 'Reset viewport and custom frame'}
                aria-label={language === 'tr' ? 'Viewport ve özel çerçeveyi sıfırla' : 'Reset viewport and custom frame'}
                onClick={resetViewportAndFrame}
              ><RotateCcw size={13} /></button>
            </div>
            <button
              type="button"
              className="center-device-button"
              title={language === 'tr' ? 'Cihazı önizlemede ortala' : 'Center device in preview'}
              aria-label={language === 'tr' ? 'Cihazı önizlemede ortala' : 'Center device in preview'}
              onClick={centerDeviceInPreview}
            ><Crosshair size={14} /></button>
            <div className="preview-actions">
              <div className="hidden-component-restores" aria-label={language === 'tr' ? 'Kaldırılan parçalar' : 'Removed parts'}>
                {(frame.kind === 'monitor' || frame.kind === 'custom') && !project.stemVisible && <button className="restore-component-button" type="button" title={language === 'tr' ? 'Ayak borusunu geri getir' : 'Restore stand stem'} aria-label={language === 'tr' ? 'Ayak borusunu geri getir' : 'Restore stand stem'} onClick={() => updateProject({ stemVisible: true })}><RotateCcw size={13} /><span>{copy.stand}</span></button>}
                {(frame.kind === 'monitor' || frame.kind === 'custom') && !project.baseVisible && <button className="restore-component-button" type="button" title={language === 'tr' ? 'Tabanı geri getir' : 'Restore base'} aria-label={language === 'tr' ? 'Tabanı geri getir' : 'Restore base'} onClick={() => updateProject({ baseVisible: true })}><RotateCcw size={13} /><span>{copy.base}</span></button>}
                {frame.kind === 'laptop' && !project.deckVisible && <button className="restore-component-button" type="button" title={language === 'tr' ? 'Laptop deck’i geri getir' : 'Restore laptop deck'} aria-label={language === 'tr' ? 'Laptop deck’i geri getir' : 'Restore laptop deck'} onClick={() => updateProject({ deckVisible: true })}><RotateCcw size={13} /><span>{copy.deck}</span></button>}
                {frame.detail !== 'none' && !project.detailVisible && <button className="restore-component-button" type="button" title={language === 'tr' ? 'Cihaz detayını geri getir' : 'Restore device detail'} aria-label={language === 'tr' ? 'Cihaz detayını geri getir' : 'Restore device detail'} onClick={() => updateProject({ detailVisible: true })}><RotateCcw size={13} /><span>{copy.detail}</span></button>}
                {frame.kind === 'phone' && !project.phoneLeftControlsVisible && <button className="restore-component-button" type="button" title={language === 'tr' ? 'Sol yan tuşları geri getir' : 'Restore left side buttons'} aria-label={language === 'tr' ? 'Sol yan tuşları geri getir' : 'Restore left side buttons'} onClick={() => updateProject({ phoneLeftControlsVisible: true })}><RotateCcw size={13} /><span>{language === 'tr' ? 'Sol tuşlar' : 'Left buttons'}</span></button>}
                {frame.kind === 'phone' && !project.phoneRightButtonVisible && <button className="restore-component-button" type="button" title={language === 'tr' ? 'Sağ yan tuşu geri getir' : 'Restore right side button'} aria-label={language === 'tr' ? 'Sağ yan tuşu geri getir' : 'Restore right side button'} onClick={() => updateProject({ phoneRightButtonVisible: true })}><RotateCcw size={13} /><span>{language === 'tr' ? 'Sağ tuş' : 'Right button'}</span></button>}
              </div>
              {!runtime.desktop && <button onClick={() => screenshotInputRef.current?.click()}><ImagePlus size={14} /> {copy.uploadCapture}</button>}
            </div>
            <div className="composition-frame-controls" aria-label={language === 'tr' ? 'Çıktı kadrajı' : 'Output frame'}>
              {(['1:1', '4:5', '16:9'] as CompositionFrameRatio[]).map((ratio) => <button
                key={ratio}
                type="button"
                className={project.compositionFrameRatio === ratio ? 'active' : ''}
                aria-pressed={project.compositionFrameRatio === ratio}
                title={project.compositionFrameRatio === ratio ? (language === 'tr' ? 'Kadrajı kapat' : 'Disable frame') : `${ratio} ${language === 'tr' ? 'kadraj' : 'frame'}`}
                onClick={() => updateProject({ compositionFrameRatio: project.compositionFrameRatio === ratio ? 'none' : ratio })}
              >{ratio}</button>)}
              <i aria-hidden="true" />
              <button type="button" className={project.compositionFrameRatio !== 'none' && project.compositionFrameOrientation === 'landscape' ? 'active' : ''} aria-pressed={project.compositionFrameRatio !== 'none' && project.compositionFrameOrientation === 'landscape'} title={language === 'tr' ? 'Yatay kadraj' : 'Landscape frame'} onClick={() => updateProject({ compositionFrameOrientation: 'landscape' as CompositionFrameOrientation })}><RectangleHorizontal size={14} /></button>
              <button type="button" className={project.compositionFrameRatio !== 'none' && project.compositionFrameOrientation === 'portrait' ? 'active' : ''} aria-pressed={project.compositionFrameRatio !== 'none' && project.compositionFrameOrientation === 'portrait'} title={language === 'tr' ? 'Dikey kadraj' : 'Portrait frame'} onClick={() => updateProject({ compositionFrameOrientation: 'portrait' as CompositionFrameOrientation })}><RectangleVertical size={14} /></button>
            </div>
          </div>

          <section
            ref={previewCanvasRef}
            className={`preview-canvas ${project.backgroundMode} ${isPanning ? 'is-panning' : ''}`}
            style={{ '--custom-bg': project.backgroundColor, '--gradient-bg': backgroundGradientCss } as React.CSSProperties}
            onPointerDown={beginViewportPan}
            onPointerMove={moveViewportPan}
            onPointerUp={endViewportPan}
            onPointerCancel={endViewportPan}
            onAuxClick={(event) => { if (event.button === 1) event.preventDefault(); }}
            onWheel={zoomViewport}
          >
            {project.backgroundMode === 'image' && project.backgroundImage && <img className="preview-background-image" src={project.backgroundImage} alt="" />}
            {project.compositionFrameRatio !== 'none' && <div ref={compositionFrameRef} className="composition-frame-guide" data-ratio={project.compositionFrameRatio} data-orientation={project.compositionFrameOrientation} style={compositionFrameStyle} aria-hidden="true" />}
            <button
              className={`preview-save-monitor ${activeSavedMonitorId ? 'active' : ''}`}
              type="button"
              aria-pressed={Boolean(activeSavedMonitorId)}
              aria-label={language === 'tr' ? 'Özel cihazı kaydet' : 'Save custom device'}
              title={frame.customVariant ? (language === 'tr' ? 'Özel cihazı kaydet' : 'Save custom device') : (language === 'tr' ? 'Özel çerçeve seç' : 'Select a custom frame')}
              disabled={!frame.customVariant}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={toggleSaveCurrentMonitor}
            ><Star size={15} fill={activeSavedMonitorId ? 'currentColor' : 'none'} /></button>
            <div className="stage-camera" style={{ transform: `perspective(1200px) translate(${project.cameraX * 0.28}%, ${project.cameraY * 0.28}%) scale(${project.cameraZoom / 100}) rotateX(${project.tiltX}deg) rotateY(${project.tiltY}deg) rotateZ(${project.tilt}deg)` }}>
                <div className={`device-stage model-${frame.id} kind-${frame.kind} finish-${frame.finish} stand-${frame.stand} detail-${frame.detail} ${project.wireframeEnabled ? 'wireframe' : ''}`} ref={stageRef} style={deviceStageStyle}>
                  {(frame.kind === 'monitor' || frame.kind === 'custom') && <>
                    {project.stemVisible && <div className={`monitor-stem component-editable ${stemJoinsWireframeBase ? 'joined-to-base' : ''}`} style={stemStyle}><button className="component-remove" type="button" title={language === 'tr' ? 'Boruyu kaldır' : 'Remove stem'} onClick={() => removeDeviceComponent('stem', copy.stand)}><X size={11} /></button></div>}
                    {project.baseVisible && <div className="monitor-base component-editable" style={baseStyle}><button className="component-remove" type="button" title={language === 'tr' ? 'Tabanı kaldır' : 'Remove base'} onClick={() => removeDeviceComponent('base', copy.base)}><X size={11} /></button></div>}
                  </>}
                  {frame.kind === 'laptop' && project.deckVisible && <div className="laptop-deck component-editable" style={deckStyle}><span className="laptop-deck-notch" aria-hidden="true" /><button className="component-remove" type="button" title={language === 'tr' ? 'Alt dudağı kaldır' : 'Remove front lip'} onClick={() => removeDeviceComponent('deck', copy.deck)}><X size={11} /></button></div>}
                  {frame.kind === 'phone' && project.phoneLeftControlsVisible && <div className="phone-side-control phone-side-left component-editable" style={phoneLeftControlsStyle}><i /><i /><button className="component-remove" type="button" title={language === 'tr' ? 'Sol yan tuşları kaldır' : 'Remove left side buttons'} onClick={() => removeDeviceComponent('phoneLeftControls', language === 'tr' ? 'Sol yan tuşlar' : 'Left side buttons')}><X size={11} /></button></div>}
                  {frame.kind === 'phone' && project.phoneRightButtonVisible && <div className="phone-side-control phone-side-right component-editable" style={phoneRightButtonStyle}><i /><button className="component-remove" type="button" title={language === 'tr' ? 'Sağ yan tuşu kaldır' : 'Remove right side button'} onClick={() => removeDeviceComponent('phoneRightButton', language === 'tr' ? 'Sağ yan tuş' : 'Right side button')}><X size={11} /></button></div>}
                  <div className="device-body" style={deviceBodyStyle} />
                  <div className="live-screen" style={liveSurfaceStyle}>
                    <div className="live-screen-content" style={liveScreenContentStyle}>
                      {runtime.desktop ? (
                        <webview ref={(node) => setWebviewNode(node)} src={activeUrl} partition="persist:responsive-mockup-studio" webpreferences="contextIsolation=yes,sandbox=yes,backgroundThrottling=no" style={browserStyle} />
                      ) : (
                        <iframe title="Live website preview" src={activeUrl} style={browserStyle} sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts" />
                      )}
                      {project.matte && <div className="matte-layer" />}
                      {project.glare > 0 && <div className="glare-layer" style={{ opacity: project.glare / 100 }} />}
                    </div>
                  </div>
                  <div className="device-overlay" style={bodyStyle} />
                  {project.detailVisible && frame.detail === 'dynamic-island' && <div className="phone-island component-editable" style={{ ...detailStyle(5.5, 2.1), top: `${(screenTopCenter + 0.012) * 100}%` }}><button className="component-remove" type="button" title={language === 'tr' ? 'Detayı kaldır' : 'Remove detail'} onClick={() => removeDeviceComponent('detail', copy.detail)}><X size={11} /></button></div>}
                  {project.detailVisible && frame.detail === 'notch' && <div className="screen-notch component-editable" style={{ ...detailStyle(8, 2.2), top: `${screenTopCenter * 100}%` }}><button className="component-remove" type="button" title={language === 'tr' ? 'Detayı kaldır' : 'Remove detail'} onClick={() => removeDeviceComponent('detail', copy.detail)}><X size={11} /></button></div>}
                  {project.detailVisible && (frame.detail === 'tablet-camera' || frame.detail === 'display-camera') && <div className="device-camera component-editable" style={{ ...detailStyle(.56, .56), top: `${displayCameraTop * 100}%` }}><button className="component-remove" type="button" title={language === 'tr' ? 'Detayı kaldır' : 'Remove detail'} onClick={() => removeDeviceComponent('detail', copy.detail)}><X size={11} /></button></div>}
                  {project.customFrameImage && geometryEditable && <img className="custom-frame-overlay" src={project.customFrameImage} alt="Custom frame" />}
                </div>
              </div>
            <div
              ref={deviceSettingsDockRef}
              className={`device-settings-dock ${deviceSettingsOpen ? 'open' : ''} ${isDeviceDockDragging ? 'dragging' : ''}`}
              style={deviceSettingsDockStyle}
              onPointerDown={beginDeviceSettingsDrag}
              onPointerMove={moveDeviceSettingsDrag}
              onPointerUp={endDeviceSettingsDrag}
              onPointerCancel={endDeviceSettingsDrag}
              onWheel={(event) => event.stopPropagation()}
            >
              <button
                className="device-settings-trigger"
                type="button"
                aria-expanded={deviceSettingsOpen}
                aria-controls="device-settings-panel"
                onClick={() => {
                  if (deviceDockDidDragRef.current) {
                    deviceDockDidDragRef.current = false;
                    return;
                  }
                  setDeviceSettingsOpen((open) => !open);
                }}
              >
                <span><SlidersHorizontal size={14} /> {copy.deviceSettings}</span>
                <small className="device-settings-drag-handle" data-dock-drag-handle="true" title={language === 'tr' ? 'Tut ve taşı' : 'Drag to move'}>{frame.name[language]}</small>
                <ChevronDown className={deviceSettingsOpen ? 'open' : ''} size={14} />
              </button>
              {deviceSettingsOpen && (
                <div
                  className="device-settings-glass"
                  id="device-settings-panel"
                >
                  <section className="device-settings-group">
                    <div className="device-settings-heading"><span>{copy.frame}</span>{geometryEditable ? <button type="button" onClick={resetFrameAppearance}><RefreshCw size={12} /> {copy.resetModel}</button> : <span className="technical-lock-badge"><LockKeyhole size={11} /> TECH</span>}</div>
                    {geometryEditable ? <>
                      <RangeField label={copy.frameThickness} value={project.frameThickness} defaultValue={frame.appearance.frameThickness} resetLabel={copy.resetControl} min={0} max={60} step={1} suffix="px" onChange={(frameThickness) => updateProject({ frameThickness })} />
                      <RangeField label={copy.frameCornerRadius} value={project.frameCornerRadius} defaultValue={frame.appearance.frameCornerRadius} resetLabel={copy.resetControl} min={0} max={90} step={1} suffix="px" onChange={(frameCornerRadius) => updateProject({ frameCornerRadius })} />
                      <RangeField label={copy.screenCornerRadius} value={project.screenCornerRadius} defaultValue={frame.appearance.screenCornerRadius} resetLabel={copy.resetControl} min={0} max={80} step={1} suffix="px" onChange={(screenCornerRadius) => updateProject({ screenCornerRadius })} />
                      <div className="inline-control-divider">{language === 'tr' ? 'Ekran geometrisi' : 'Screen geometry'}</div>
                      <RangeField label={copy.screenWidth} value={project.screenScaleX} defaultValue={100} resetLabel={copy.resetControl} min={45} max={135} step={1} suffix="%" onChange={(screenScaleX) => updateProject({ screenScaleX })} />
                      <RangeField label={copy.screenHeight} value={project.screenScaleY} defaultValue={100} resetLabel={copy.resetControl} min={45} max={135} step={1} suffix="%" onChange={(screenScaleY) => updateProject({ screenScaleY })} />
                    </> : <div className="technical-lock-note"><LockKeyhole size={14} /><span>{copy.technicalLocked}</span><small>{frame.nativeResolution}</small></div>}
                    <div className="inline-control-divider">{copy.screenSurface}</div>
                    <Toggle label={copy.matte} checked={project.matte} onChange={(matte) => updateProject({ matte })} />
                    <RangeField label={copy.glare} value={project.glare} defaultValue={defaultProject.glare} resetLabel={copy.resetControl} min={0} max={20} suffix="%" onChange={(glare) => updateProject({ glare })} />
                  </section>
                  <section className="device-settings-group">
                    <div className="device-settings-heading"><span>{copy.material}</span></div>
                    <ColorField label={copy.deviceColor} value={project.deviceColor} onChange={(deviceColor) => updateProject({ deviceColor })} />
                    <div className="device-material-field"><span>{copy.materialType}</span><div className="material-options">{([
                      ['metal', copy.metal],
                      ['matte', copy.materialMatte],
                      ['plastic', copy.plastic],
                      ['glass', copy.glass],
                    ] as Array<[ProjectState['deviceMaterial'], string]>).map(([material, label]) => <button key={material} type="button" data-material={material} className={project.deviceMaterial === material ? 'active' : ''} aria-pressed={project.deviceMaterial === material} onClick={() => updateProject({ deviceMaterial: material })}>{label}</button>)}</div></div>
                    <RangeField label={copy.roughness} value={project.materialRoughness} defaultValue={modelDefaults.materialRoughness} resetLabel={copy.resetControl} min={0} max={100} step={1} suffix="%" onChange={(materialRoughness) => updateProject({ materialRoughness })} />
                    <RangeField label={copy.reflectivity} value={project.materialReflectivity} defaultValue={modelDefaults.materialReflectivity} resetLabel={copy.resetControl} min={0} max={100} step={1} suffix="%" onChange={(materialReflectivity) => updateProject({ materialReflectivity })} />
                    <div className="inline-control-divider">WIREFRAME</div>
                    <Toggle label={copy.wireframe} checked={project.wireframeEnabled} onChange={(wireframeEnabled) => updateProject({ wireframeEnabled })} />
                    <div className={`device-settings-control-stack ${project.wireframeEnabled ? '' : 'disabled'}`}>
                      <label className="device-color-field"><span>{copy.wireframeColor}</span><input type="color" value={project.wireframeColor} onPointerDown={(event) => event.stopPropagation()} onInput={(event) => updateProject({ wireframeColor: event.currentTarget.value })} /></label>
                      <RangeField label={copy.wireframeThickness} value={project.wireframeThickness} defaultValue={2} resetLabel={copy.resetControl} min={0.5} max={12} step={0.5} suffix="px" onChange={(wireframeThickness) => updateProject({ wireframeThickness })} />
                    </div>
                  </section>
                  <section className="device-settings-group">
                    <div className="device-settings-heading"><span>{copy.structure}</span></div>
                    <div className="inline-control-divider">{copy.partGradient}</div>
                    <Toggle label={copy.partGradient} checked={project.partGradientEnabled} onChange={(partGradientEnabled) => updateProject({ partGradientEnabled })} />
                    <div className={`device-settings-control-stack ${project.partGradientEnabled ? '' : 'disabled'}`}>
                      <RangeField label={copy.gradientAngle} value={project.partGradientAngle} defaultValue={105} resetLabel={copy.resetControl} min={0} max={360} step={1} suffix="°" onChange={(partGradientAngle) => updateProject({ partGradientAngle })} />
                      <RangeField label={copy.gradientSize} value={project.partGradientSize} defaultValue={240} resetLabel={copy.resetControl} min={100} max={480} step={5} suffix="%" onChange={(partGradientSize) => updateProject({ partGradientSize })} />
                      <RangeField label={copy.gradientSoftness} value={project.partGradientSoftness} defaultValue={76} resetLabel={copy.resetControl} min={0} max={100} step={1} suffix="%" onChange={(partGradientSoftness) => updateProject({ partGradientSoftness })} />
                    </div>
                    {(frame.kind === 'monitor' || frame.kind === 'custom') && <>
                      <div className="component-heading"><span>{copy.stand}</span>{!project.stemVisible && <small>{language === 'tr' ? 'Üst bardan geri getir' : 'Restore from top bar'}</small>}</div>
                      {project.stemVisible && <><label className="device-color-field"><span>{copy.stemColor}</span><input type="color" value={project.stemColor} onPointerDown={(event) => event.stopPropagation()} onInput={(event) => updateProject({ stemColor: event.currentTarget.value })} /></label>{geometryEditable && <><RangeField label={copy.stemWidth} value={project.stemWidth} defaultValue={modelDefaults.stemWidth} resetLabel={copy.resetControl} min={0.5} max={12} step={0.1} suffix="%" onChange={(stemWidth) => updateProject({ stemWidth })} /><RangeField label={copy.stemHeight} value={project.stemHeight} defaultValue={modelDefaults.stemHeight} resetLabel={copy.resetControl} min={2} max={28} step={0.5} suffix="%" onChange={(stemHeight) => updateProject({ stemHeight })} /></>}</>}
                      <div className="component-heading"><span>{copy.base}</span>{!project.baseVisible && <small>{language === 'tr' ? 'Üst bardan geri getir' : 'Restore from top bar'}</small>}</div>
                      {project.baseVisible && <><label className="device-color-field"><span>{copy.baseColor}</span><input type="color" value={project.baseColor} onPointerDown={(event) => event.stopPropagation()} onInput={(event) => updateProject({ baseColor: event.currentTarget.value })} /></label>{geometryEditable && <><RangeField label={copy.baseWidth} value={project.baseWidth} defaultValue={modelDefaults.baseWidth} resetLabel={copy.resetControl} min={4} max={55} step={0.5} suffix="%" onChange={(baseWidth) => updateProject({ baseWidth })} /><RangeField label={copy.baseHeight} value={project.baseHeight} defaultValue={modelDefaults.baseHeight} resetLabel={copy.resetControl} min={0.5} max={10} step={0.1} suffix="%" onChange={(baseHeight) => updateProject({ baseHeight })} /><RangeField label={copy.baseRadius} value={project.baseRadius} defaultValue={modelDefaults.baseRadius} resetLabel={copy.resetControl} min={0} max={40} step={1} suffix="px" onChange={(baseRadius) => updateProject({ baseRadius })} /></>}</>}
                    </>}
                    {frame.kind === 'laptop' && <><div className="component-heading"><span>{copy.deck}</span>{!project.deckVisible && <small>{language === 'tr' ? 'Üst bardan geri getir' : 'Restore from top bar'}</small>}</div>{project.deckVisible && <><label className="device-color-field"><span>{copy.deckColor}</span><input type="color" value={project.deckColor} onPointerDown={(event) => event.stopPropagation()} onInput={(event) => updateProject({ deckColor: event.currentTarget.value })} /></label>{geometryEditable && <><RangeField label={copy.deckWidth} value={project.deckWidth} defaultValue={modelDefaults.deckWidth} resetLabel={copy.resetControl} min={30} max={100} step={1} suffix="%" onChange={(deckWidth) => updateProject({ deckWidth })} /><RangeField label={copy.deckHeight} value={project.deckHeight} defaultValue={modelDefaults.deckHeight} resetLabel={copy.resetControl} min={0.5} max={24} step={0.5} suffix="%" onChange={(deckHeight) => updateProject({ deckHeight })} /></>}</>}</>}
                    {frame.detail !== 'none' && <><div className="component-heading component-heading-toggle"><span>{copy.detail}</span><Toggle compact label={copy.detail} checked={project.detailVisible} onChange={(detailVisible) => updateProject({ detailVisible })} /></div><div className={`device-settings-control-stack ${project.detailVisible ? '' : 'disabled'}`}><label className="device-color-field"><span>{copy.detailColor}</span><input type="color" value={project.detailColor} onPointerDown={(event) => event.stopPropagation()} onInput={(event) => updateProject({ detailColor: event.currentTarget.value })} /></label>{geometryEditable && <RangeField label={copy.detailScale} value={project.detailScale} defaultValue={100} resetLabel={copy.resetControl} min={25} max={250} step={5} suffix="%" onChange={(detailScale) => updateProject({ detailScale })} />}</div></>}
                  </section>
                  <section className="device-settings-group">
                    <div className="device-settings-heading"><span>{copy.shadow}</span><Toggle label={copy.shadow} checked={project.shadowEnabled} onChange={(shadowEnabled) => updateProject({ shadowEnabled })} /></div>
                    <div className={`device-settings-control-stack ${project.shadowEnabled ? '' : 'disabled'}`}>
                      <RangeField label={copy.shadowX} value={project.shadowOffsetX} defaultValue={defaultProject.shadowOffsetX} resetLabel={copy.resetControl} min={-120} max={120} step={1} suffix="px" onChange={(shadowOffsetX) => updateProject({ shadowOffsetX })} />
                      <RangeField label={copy.shadowY} value={project.shadowOffsetY} defaultValue={defaultProject.shadowOffsetY} resetLabel={copy.resetControl} min={-120} max={120} step={1} suffix="px" onChange={(shadowOffsetY) => updateProject({ shadowOffsetY })} />
                      <RangeField label={copy.shadowBlur} value={project.shadowBlur} defaultValue={defaultProject.shadowBlur} resetLabel={copy.resetControl} min={0} max={180} step={1} suffix="px" onChange={(shadowBlur) => updateProject({ shadowBlur })} />
                      <RangeField label={copy.shadowSpread} value={project.shadowSpread} defaultValue={defaultProject.shadowSpread} resetLabel={copy.resetControl} min={-20} max={80} step={1} suffix="px" onChange={(shadowSpread) => updateProject({ shadowSpread })} />
                      <RangeField label={copy.shadowOpacity} value={project.shadowOpacity} defaultValue={defaultProject.shadowOpacity} resetLabel={copy.resetControl} min={0} max={100} step={1} suffix="%" onChange={(shadowOpacity) => updateProject({ shadowOpacity })} />
                    </div>
                  </section>
                </div>
              )}
            </div>
            {!runtime.desktop && <div className="web-limit-banner"><CircleAlert size={15} /> {copy.webNotice}</div>}
          </section>
        </main>

        <aside className="right-panel panel">
          <div className="inspector-tabs">
            <button className={activePanel === 'camera' ? 'active' : ''} onClick={() => setActivePanel('camera')}><Camera size={15} /><span>{copy.camera}</span></button>
            <button className={activePanel === 'background' ? 'active' : ''} onClick={() => setActivePanel('background')}><Sparkles size={15} /><span>{copy.background}</span></button>
            <button className={activePanel === 'advanced' ? 'active' : ''} onClick={() => setActivePanel('advanced')}><Settings2 size={15} /><span>{copy.advanced}</span></button>
            <button className={activePanel === 'output' ? 'active' : ''} onClick={() => setActivePanel('output')}><FileOutput size={15} /><span>{copy.output}</span></button>
          </div>
          <div className="inspector-scroll">
            {activePanel === 'camera' && <>
              <InspectorSection title={copy.viewport} icon={<Maximize2 size={14} />}>
                <label className="field-row"><span>{copy.fit}</span><select value={project.fitMode} onChange={(event) => updateProject({ fitMode: event.target.value as FitMode })}><option value="responsive">{copy.responsive}</option><option value="cover">{copy.cover}</option><option value="contain">{copy.contain}</option><option value="custom">{copy.customFit}</option></select></label>
                <Toggle label={copy.viewportAuto} checked={project.viewportAuto} onChange={toggleViewportAuto} />
                <div className={`number-pair ${project.viewportAuto ? 'auto' : ''}`}><NumberField label="W" value={effectiveViewport.width} disabled={project.viewportAuto} onChange={(width) => updateViewportSize({ width })} /><NumberField label="H" value={effectiveViewport.height} disabled={project.viewportAuto} onChange={(height) => updateViewportSize({ height })} /></div>
              </InspectorSection>
              <InspectorSection title={copy.camera} icon={<Move size={14} />}>
                <RangeField label={copy.zoom} value={project.cameraZoom} defaultValue={defaultProject.cameraZoom} resetLabel={copy.resetControl} min={45} max={220} suffix="%" onChange={(cameraZoom) => updateProject({ cameraZoom })} />
                <RangeField label={copy.panX} value={project.cameraX} defaultValue={defaultProject.cameraX} resetLabel={copy.resetControl} min={-100} max={100} onChange={(cameraX) => updateProject({ cameraX })} />
                <RangeField label={copy.panY} value={project.cameraY} defaultValue={defaultProject.cameraY} resetLabel={copy.resetControl} min={-100} max={100} onChange={(cameraY) => updateProject({ cameraY })} />
                <RangeField label={copy.tilt} value={project.tilt} defaultValue={defaultProject.tilt} resetLabel={copy.resetControl} min={-3} max={3} step={0.05} suffix="°" onChange={(tilt) => updateProject({ tilt })} />
                <RangeField label={copy.tiltX} value={project.tiltX} defaultValue={defaultProject.tiltX} resetLabel={copy.resetControl} min={-35} max={35} step={0.5} suffix="°" onChange={(tiltX) => updateProject({ tiltX })} />
                <RangeField label={copy.tiltY} value={project.tiltY} defaultValue={defaultProject.tiltY} resetLabel={copy.resetControl} min={-35} max={35} step={0.5} suffix="°" onChange={(tiltY) => updateProject({ tiltY })} />
              </InspectorSection>
            </>}

            {activePanel === 'background' && <>
              <InspectorSection title={copy.background} icon={<Sparkles size={14} />}>
                <div className="swatch-grid">
                  {(['black', 'white', 'transparent', 'custom', 'gradient', 'image'] as BackgroundMode[]).map((mode) => <button key={mode} className={`swatch ${mode} ${project.backgroundMode === mode ? 'selected' : ''}`} onClick={() => updateProject({ backgroundMode: mode })}><i style={mode === 'custom' ? { background: project.backgroundColor } : mode === 'gradient' ? { background: backgroundGradientCss } : undefined} /><span>{mode === 'black' ? copy.black : mode === 'white' ? copy.white : mode === 'transparent' ? copy.transparent : mode === 'custom' ? copy.customColor : mode === 'gradient' ? copy.gradient : copy.image}</span></button>)}
                </div>
                {project.backgroundMode === 'custom' && <label className="field-row"><span>{copy.customColor}</span><input type="color" value={project.backgroundColor} onPointerDown={(event) => event.stopPropagation()} onInput={(event) => updateProject({ backgroundColor: event.currentTarget.value })} /></label>}
                {project.backgroundMode === 'gradient' && <div className="gradient-settings">
                  <label className="field-row"><span>{copy.gradientType}</span><select value={project.backgroundGradientType} onChange={(event) => updateProject({ backgroundGradientType: event.target.value as ProjectState['backgroundGradientType'] })}><option value="linear">{copy.linear}</option><option value="radial">{copy.radial}</option></select></label>
                  <div className="gradient-stop-list">
                    {backgroundGradientStops.map((stop, index) => <div className="gradient-stop-row" key={stop.id} data-gradient-stop={stop.id}>
                      <input className="gradient-stop-swatch" aria-label={`${copy.hexColor} ${index + 1}`} type="color" value={canonicalHexColor(stop.color)} onPointerDown={(event) => event.stopPropagation()} onInput={(event) => updateGradientStop(stop.id, { color: event.currentTarget.value.toUpperCase() })} />
                      <HexColorInput label={`${copy.hexColor} ${index + 1}`} value={stop.color} onChange={(color) => updateGradientStop(stop.id, { color })} />
                      <label className="gradient-stop-position" title={copy.gradientPosition}><input aria-label={`${copy.gradientPosition} ${index + 1}`} type="number" min="0" max="100" value={stop.position} onInput={(event) => updateGradientStop(stop.id, { position: Number(event.currentTarget.value) })} /><span>%</span></label>
                      <button className="gradient-stop-remove" type="button" aria-label={`${copy.removeGradientColor} ${index + 1}`} title={copy.removeGradientColor} disabled={backgroundGradientStops.length <= 2} onClick={() => removeGradientStop(stop.id)}><Trash2 size={12} /></button>
                    </div>)}
                  </div>
                  <button className="wide-button compact-wide gradient-stop-add" type="button" onClick={addGradientStop}><Plus size={13} /> {copy.addGradientColor}</button>
                  {project.backgroundGradientType === 'linear' && <RangeField label={copy.gradientAngle} value={project.backgroundGradientAngle} defaultValue={defaultProject.backgroundGradientAngle} resetLabel={copy.resetControl} min={0} max={360} step={1} suffix="°" onChange={(backgroundGradientAngle) => updateProject({ backgroundGradientAngle })} />}
                </div>}
                {project.backgroundMode === 'image' && <button className="wide-button" onClick={() => importImage('background')}><ImagePlus size={14} /> {copy.uploadBackground}</button>}
              </InspectorSection>
            </>}

            {activePanel === 'output' && <>
              <InspectorSection title={copy.output} icon={<FileOutput size={14} />}>
                <label className="field-row"><span>{copy.format}</span><select value={project.exportSettings.format} onChange={(event) => updateProject({ exportSettings: { ...project.exportSettings, format: event.target.value as ExportFormat } })}><option value="png">PNG</option><option value="transparent-png">PNG · ALPHA</option><option value="jpeg">JPG</option><option value="svg">SVG · VECTOR</option><option value="webp">WEBP</option></select></label>
                <label className="field-row"><span>{copy.size}</span><select value={project.exportSettings.longEdge} onChange={(event) => updateProject({ exportSettings: { ...project.exportSettings, longEdge: Number(event.target.value) } })}><option value="1920">1920 px</option><option value="2560">2560 px</option><option value="3200">3200 px</option><option value="4000">4000 px</option><option value="0">{copy.custom}</option></select></label>
                {project.exportSettings.longEdge === 0 && <div className="number-pair"><NumberField label="W" value={project.exportSettings.customWidth} onChange={(customWidth) => updateProject({ exportSettings: { ...project.exportSettings, customWidth } })} /><NumberField label="H" value={project.exportSettings.customHeight} onChange={(customHeight) => updateProject({ exportSettings: { ...project.exportSettings, customHeight } })} /></div>}
                {project.exportSettings.format !== 'svg' && <label className="field-row"><span>{copy.dpi}</span><select value={project.exportSettings.dpi} onChange={(event) => updateProject({ exportSettings: { ...project.exportSettings, dpi: Number(event.target.value) } })}><option value="72">72 DPI</option><option value="150">150 DPI</option><option value="300">300 DPI</option></select></label>}
                {(project.exportSettings.format === 'jpeg' || project.exportSettings.format === 'webp') && <RangeField label={`${copy.quality} JPEG/WebP`} value={project.exportSettings.quality} min={30} max={100} suffix="%" onChange={(quality) => updateProject({ exportSettings: { ...project.exportSettings, quality } })} />}
                {project.exportSettings.format === 'svg' && <p className="vector-export-note">{language === 'tr' ? 'Site yazıları font değişimini önleyen düzenlenemez vektör konturlarına çevrilir. CSS şekilleri ve cihaz kasası vektör kalır; fotoğraf/video gibi raster kaynaklar özgün raster veri olarak korunur.' : 'Website text is converted to non-editable vector outlines so fonts cannot be substituted. CSS shapes and the device body remain vector; intrinsically raster assets remain raster data.'}</p>}
                <label className="field-column"><span>FILE NAME</span><input value={project.exportSettings.namingTemplate} onChange={(event) => updateProject({ exportSettings: { ...project.exportSettings, namingTemplate: event.target.value } })} /></label>
                <div className="inline-control-divider">{language === 'tr' ? 'Sayfa görünümü' : 'Page appearance'}</div>
                <Toggle label={copy.hideScrollbar} checked={project.hideScrollbar} onChange={(hideScrollbar) => updateProject({ hideScrollbar })} />
                <Toggle label={copy.hideCursor} checked={project.hideCursor} onChange={(hideCursor) => updateProject({ hideCursor })} />
                <button className="primary-wide" onClick={() => exportOne()} disabled={loading}>{loading ? <LoaderCircle className="spin" size={15} /> : <FileOutput size={15} />} {copy.export}</button>
              </InspectorSection>
            </>}

            {activePanel === 'advanced' && <>
              <InspectorSection title={language === 'tr' ? 'SAYFA' : 'PAGE'} icon={<Camera size={14} />}>
                <Toggle label={copy.freeze} checked={project.freezeAnimations} onChange={(freezeAnimations) => updateProject({ freezeAnimations })} />
                <Toggle label={copy.hideBackground} checked={project.hidePageBackground} onChange={(hidePageBackground) => updateProject({ hidePageBackground })} />
              </InspectorSection>
              <InspectorSection title={copy.customCss} icon={<MousePointer2 size={14} />}>
                <div className="page-elements-heading"><span>{copy.pageElements}</span><button type="button" title={copy.refreshElements} aria-label={copy.refreshElements} onClick={() => void refreshPageElements()}><RefreshCw className={pageElementsLoading ? 'spin' : ''} size={13} /></button></div>
                <div className="page-element-list">
                  {pageElements.map((item) => {
                    const hidden = selectorList(project.hiddenSelectors).includes(item.selector);
                    return <div className={`page-element-item ${hidden ? 'hidden' : ''}`} key={item.selector}>
                      <button type="button" className="page-element-eye" title={hidden ? (language === 'tr' ? 'Göster' : 'Show') : (language === 'tr' ? 'Gizle' : 'Hide')} aria-label={`${hidden ? 'Show' : 'Hide'} ${item.selector}`} onClick={() => toggleHiddenSelector(item.selector)}>{hidden ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                      <button type="button" className="page-element-label" title={item.selector} onClick={() => toggleHiddenSelector(item.selector)}><strong>{item.label}</strong><small>{item.selector}{item.count > 1 ? ` · ${item.count}` : ''}</small></button>
                    </div>;
                  })}
                  {!pageElementsLoading && pageElements.length === 0 && <p>{copy.noPageElements}</p>}
                </div>
                <label className="field-column"><span>{copy.customCss}</span><textarea rows={7} placeholder="body { ... }" value={project.customCss} onChange={(event) => updateProject({ customCss: event.target.value })} /></label>
              </InspectorSection>
              <InspectorSection title="RECENT URLS" icon={<Clock3 size={14} />}>
                <div className="recent-list">{recent.map((url) => {
                  const bookmarked = bookmarks.includes(url);
                  return <div className="recent-item" key={url}>
                    <button className={`recent-bookmark ${bookmarked ? 'active' : ''}`} type="button" title={bookmarked ? copy.removeBookmark : copy.bookmarkCurrent} aria-label={bookmarked ? copy.removeBookmark : copy.bookmarkCurrent} onClick={() => toggleBookmark(url)}><Heart size={13} fill={bookmarked ? 'currentColor' : 'none'} /></button>
                    <button className="recent-link" type="button" onClick={() => navigate(url)}><span>{url}</span><ArrowRight size={12} /></button>
                  </div>;
                })}</div>
              </InspectorSection>
            </>}
          </div>
        </aside>
      </div>

      <input ref={screenshotInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (file) setLastRaw(await dataUrlFromFile(file)); event.target.value = ''; }} />
      <input ref={fileInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => { await handleGenericFile(event.target.files?.[0]); event.target.value = ''; }} />
      {toast && <div className={`toast ${toast.tone}`}>{toast.tone === 'good' ? <Check size={16} /> : toast.tone === 'bad' ? <CircleAlert size={16} /> : <Sparkles size={16} />}<span>{toast.text}</span><button onClick={() => setToast(null)}><X size={14} /></button></div>}
    </div>
  );
}

function InspectorSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return <section className="inspector-section"><button className="section-title" onClick={() => setOpen(!open)}>{icon}<span>{title}</span><ChevronDown className={open ? 'open' : ''} size={14} /></button>{open && <div className="section-content">{children}</div>}</section>;
}

function HexColorInput({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  const [draft, setDraft] = useState(canonicalHexColor(value));
  useEffect(() => setDraft(canonicalHexColor(value)), [value]);
  const commit = () => {
    if (!HEX_COLOR.test(draft.trim())) {
      setDraft(canonicalHexColor(value));
      return;
    }
    const next = canonicalHexColor(draft);
    setDraft(next);
    onChange(next);
  };
  return <input className="gradient-hex-input" aria-label={label} type="text" inputMode="text" spellCheck={false} maxLength={7} value={draft} onChange={(event) => setDraft(event.currentTarget.value.toUpperCase())} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); event.currentTarget.blur(); } }} />;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  const canonicalValue = canonicalHexColor(value);
  const [draft, setDraft] = useState(canonicalValue);
  useEffect(() => setDraft(canonicalValue), [canonicalValue]);
  const commit = () => {
    if (!HEX_COLOR.test(draft.trim())) {
      setDraft(canonicalValue);
      return;
    }
    const next = canonicalHexColor(draft);
    setDraft(next);
    onChange(next);
  };
  const choose = (next: string) => {
    const color = canonicalHexColor(next);
    setDraft(color);
    onChange(color);
  };
  return (
    <div className="device-color-field">
      <span>{label}</span>
      <div className="device-color-editor">
        <input aria-label={`${label} swatch`} type="color" value={canonicalValue} onInput={(event) => choose(event.currentTarget.value)} onChange={(event) => choose(event.currentTarget.value)} />
        <input aria-label={`${label} HEX`} className="device-color-hex" type="text" inputMode="text" spellCheck={false} maxLength={7} value={draft} onChange={(event) => setDraft(event.currentTarget.value.toUpperCase())} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); event.currentTarget.blur(); } }} />
      </div>
    </div>
  );
}

function RangeField({ label, value, defaultValue, resetLabel = 'Reset', min, max, step = 1, suffix = '', onChange }: { label: string; value: number; defaultValue?: number; resetLabel?: string; min: number; max: number; step?: number; suffix?: string; onChange(value: number): void }) {
  const canReset = typeof defaultValue === 'number';
  return (
    <div className="range-field">
      <span>
        <b>{label}</b>
        <span className="range-readout">
          <output>{Number(value).toFixed(step < 1 ? 2 : 0)}{suffix}</output>
          {canReset && (
            <button
              className="range-reset"
              type="button"
              title={`${label}: ${resetLabel}`}
              aria-label={`${label}: ${resetLabel}`}
              disabled={value === defaultValue}
              onClick={() => { if (defaultValue !== undefined) onChange(defaultValue); }}
            ><RotateCcw size={11} /></button>
          )}
        </span>
      </span>
      <input
        aria-label={label}
        title={canReset ? `${label}: ${resetLabel} (double click)` : label}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        onDoubleClick={() => { if (defaultValue !== undefined) onChange(defaultValue); }}
      />
    </div>
  );
}

function NumberField({ label, value, disabled = false, onChange }: { label: string; value: number; disabled?: boolean; onChange(value: number): void }) {
  return <label><span>{label}</span><input type="number" value={Math.round(value)} min="1" disabled={disabled} onInput={(event) => onChange(Number(event.currentTarget.value))} /></label>;
}

function Toggle({ label, checked, compact = false, onChange }: { label: string; checked: boolean; compact?: boolean; onChange(value: boolean): void }) {
  return <label className={`toggle-row ${compact ? 'compact' : ''}`} aria-label={label}><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /></label>;
}

export default App;
