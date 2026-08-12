import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('ships all required frame groups and viewport families', () => {
  const presets = read('src/presets.ts');
  for (const required of ['16:9', '16:10', '21:9 ultrawide', '32:9 super ultrawide', 'Düz monitör', 'Laptop', 'Tablet', 'Telefon', 'Özel ölçü']) {
    assert.match(presets, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.equal((presets.match(/id: '/g) || []).length, 11);
  assert.doesNotMatch(presets, /curved|soft-curve/i);
  for (const removedModel of ['Apple Studio Display', 'Dell UltraSharp', 'LG UltraGear', 'Samsung Odyssey', 'MacBook Pro', 'iPad Pro', 'iPhone']) assert.doesNotMatch(presets, new RegExp(removedModel));
  assert.match(presets, /FRAME_PRESETS: FramePreset\[\] = \[\s*\{\s*id: 'custom'/);
  assert.match(presets, /id: 'custom',[\s\S]*?customVariant: 'desktop'/);
  assert.match(presets, /id: 'custom-tablet',[\s\S]*?customVariant: 'tablet'/);
  assert.match(presets, /id: 'custom-phone',[\s\S]*?customVariant: 'phone'/);
  for (const ratioName of ["name: { tr: '16:9', en: '16:9' }", "name: { tr: '16:10', en: '16:10' }", "name: { tr: '21:9', en: '21:9' }", "name: { tr: '32:9', en: '32:9' }", "name: { tr: '417:605', en: '417:605' }", "name: { tr: '201:437', en: '201:437' }"]) assert.match(presets, new RegExp(ratioName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('frame controls drive the preview and export without a detached back mask', () => {
  const app = read('src/App.tsx');
  const composer = read('src/composer.ts');
  assert.doesNotMatch(app, /className="device-shadow"/);
  for (const control of ['frameThickness', 'frameCornerRadius', 'screenCornerRadius', 'shadowEnabled', 'shadowOffsetX', 'shadowOffsetY', 'shadowBlur', 'shadowSpread', 'shadowOpacity']) {
    assert.match(app, new RegExp(control));
    assert.match(composer, new RegExp(control));
  }
  assert.match(app, /frameId: 'custom'/);
  assert.match(app, /data-frame-id=\{item\.id\}/);
});

test('viewport gestures and three-axis tilt are connected to camera state', () => {
  const app = read('src/App.tsx');
  const composer = read('src/composer.ts');
  assert.match(app, /onPointerDown=\{beginViewportPan\}/);
  assert.match(app, /onWheel=\{zoomViewport\}/);
  assert.match(app, /cameraX:/);
  assert.match(app, /cameraZoom:/);
  assert.match(app, /rotateX\(\$\{project\.tiltX\}deg\)/);
  assert.match(app, /rotateY\(\$\{project\.tiltY\}deg\)/);
  assert.match(composer, /state\.tiltX/);
  assert.match(composer, /state\.tiltY/);
});

test('desktop webview keeps the full CSS viewport and scales it into the screen', () => {
  const app = read('src/App.tsx');
  const styles = read('src/styles.css');
  assert.match(app, /const screenPixelSize = useMemo/);
  assert.match(app, /const effectiveViewport = useMemo/);
  assert.match(app, /width: `\$\{effectiveViewport\.width\}px`/);
  assert.match(app, /height: `\$\{effectiveViewport\.height\}px`/);
  assert.match(app, /translate\(-50%, -50%\) scale\(\$\{liveScale\}\)/);
  assert.match(app, /webviewNode\.setZoomFactor\(1\)/);
  assert.match(app, /window\.dispatchEvent\(new Event\(\"resize\"\)\)/);
  assert.match(app, /const updateViewportSize = useCallback/);
  assert.match(app, /viewportAuto: true/);
  assert.match(app, /responsiveViewportSize/);
  assert.match(app, /state\.viewportWidth \* state\.screenScaleX \/ 100/);
  assert.match(app, /disabled=\{project\.viewportAuto\}/);
  assert.match(app, /fitMode: 'responsive'/);
  assert.doesNotMatch(app, /webviewNode\.setZoomFactor\(clamp\(liveScale/);
  assert.match(styles, /\.live-screen webview \{ display: inline-flex; \}/);
  assert.doesNotMatch(styles, /\.live-screen webview,[^\n]*display: block/);
});

test('address Enter navigation and persistent bookmarks are wired to the live screen', () => {
  const app = read('src/App.tsx');
  assert.match(app, /BOOKMARKS_KEY = 'rms\.bookmarks\.v1'/);
  assert.match(app, /event\.key !== 'Enter'/);
  assert.match(app, /navigate\(event\.currentTarget\.value\)/);
  assert.match(app, /onChange=\{\(event\) => setAddress\(event\.currentTarget\.value\)\}/);
  assert.match(app, /onPointerDown=\{\(event\) => \{ event\.stopPropagation\(\); addressEditingRef\.current = true; \}\}/);
  assert.match(app, /addressEditingRef\.current/);
  assert.match(app, /src=\{activeUrl\}/);
  assert.match(app, /localStorage\.setItem\(BOOKMARKS_KEY/);
  assert.match(app, /className="bookmark-menu"/);
  assert.match(app, /onClick=\{\(\) => navigate\(url\)\}/);
});

test('preview toolbar swaps viewport dimensions and omits dead preview actions', () => {
  const app = read('src/App.tsx');
  const styles = read('src/styles.css');
  assert.match(app, /className="viewport-swap"/);
  assert.match(app, /viewportWidth: effectiveViewport\.height, viewportHeight: effectiveViewport\.width, viewportAuto: false, fitMode: 'responsive'/);
  assert.match(app, /<ArrowLeftRight size=\{14\}/);
  assert.doesNotMatch(app, /className="live-pill"/);
  assert.doesNotMatch(styles, /\.live-pill/);
  assert.match(app, /className="page-element-eye"/);
  assert.match(app, /<EyeOff size=/);
  assert.match(app, /setBreakpoint\(1920, 1080, 'custom'\)/);
  assert.match(app, /setBreakpoint\(834, 1210, 'custom-tablet'\)/);
  assert.match(app, /setBreakpoint\(402, 874, 'custom-phone'\)/);
  assert.doesNotMatch(app, /copy\.compare/);
  assert.doesNotMatch(app, /<button onClick=\{\(\) => setActivePanel\('camera'\)\}><Maximize2/);
});

test('camera sliders expose default reset buttons and double-click reset', () => {
  const app = read('src/App.tsx');
  assert.match(app, /className="range-reset"/);
  assert.match(app, /onDoubleClick=\{\(\) => \{ if \(defaultValue !== undefined\) onChange\(defaultValue\); \}\}/);
  assert.ok((app.match(/resetLabel=\{copy\.resetControl\}/g) || []).length >= 16);
});

test('device appearance controls live in a collapsible glass viewport drawer', () => {
  const app = read('src/App.tsx');
  const styles = read('src/styles.css');
  assert.match(app, /className=\{`device-settings-dock/);
  assert.match(app, /aria-controls="device-settings-panel"/);
  assert.match(app, /className="device-settings-glass"/);
  assert.match(styles, /\.device-settings-glass/);
  assert.match(styles, /backdrop-filter: blur\(42px\) saturate\(72%\)/);
  assert.match(styles, /background: color-mix\(in srgb,var\(--panel\) 92%,transparent\)/);
  assert.equal((app.match(/<section className="device-settings-group">/g) || []).length, 4);
  assert.doesNotMatch(app, /device-settings-group compact/);
  assert.match(styles, /grid-template-columns: repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.device-settings-group \{[^}]*overflow-y: auto/);
  assert.match(styles, /\*::\-webkit-scrollbar-thumb \{[^}]*border-radius: 0/);
  assert.match(styles, /\*::\-webkit-scrollbar-button \{[^}]*display: none/);
  assert.match(app, /onPointerDown=\{beginDeviceSettingsDrag\}/);
  assert.match(app, /onPointerMove=\{moveDeviceSettingsDrag\}/);
  assert.match(app, /deviceSettingsDockStyle/);
  assert.match(styles, /\.device-settings-glass \{[^}]*cursor: grab/);
  assert.match(styles, /\.device-settings-dock\.dragging \.device-settings-glass/);
  assert.match(app, /data-dock-drag-handle="true"/);
  assert.match(styles, /\.device-settings-dock:not\(\.open\)/);
});

test('application chrome cannot accidentally select labels while inputs remain editable', () => {
  const styles = read('src/styles.css');
  assert.match(styles, /\.app-shell, \.app-shell \* \{[^}]*user-select: none/);
  assert.match(styles, /\.app-shell input, \.app-shell textarea, \.app-shell select, \.app-shell \[contenteditable="true"\] \{[^}]*user-select: text/);
});

test('device drawer edits screen geometry, materials, wireframe, and removable parts', () => {
  const app = read('src/App.tsx');
  const composer = read('src/composer.ts');
  const renderEngine = `${composer}\n${read('src/geometry.ts')}`;
  const styles = read('src/styles.css');
  for (const control of ['screenScaleX', 'screenScaleY', 'screenOffsetX', 'screenOffsetY', 'deviceColor', 'deviceMaterial', 'materialRoughness', 'materialReflectivity', 'wireframeEnabled', 'wireframeColor', 'wireframeThickness', 'stemWidth', 'stemHeight', 'baseWidth', 'baseHeight', 'baseRadius', 'deckWidth', 'deckHeight', 'detailScale', 'partGradientEnabled', 'partGradientAngle', 'partGradientSize', 'partGradientSoftness']) {
    assert.match(app, new RegExp(control));
    assert.match(renderEngine, new RegExp(control));
  }
  assert.match(app, /removeDeviceComponent/);
  assert.match(app, /window\.confirm/);
  assert.match(app, /className="hidden-component-restores"/);
  assert.match(app, /className="restore-component-button"/);
  assert.match(styles, /\.preview-actions \{ margin-left: auto; \}/);
  assert.match(app, /stemVisible: true/);
  assert.match(app, /baseVisible: true/);
  assert.match(styles, /\.component-editable:hover > \.component-remove/);
  assert.match(styles, /\.wireframe \.live-screen/);
  assert.match(composer, /!state\.wireframeEnabled/);
  assert.doesNotMatch(app, /!project\.wireframeEnabled && \(runtime\.desktop/);
  assert.doesNotMatch(styles, /\.wireframe \.live-screen webview/);
  assert.match(styles, /\.wireframe \.monitor-stem\.joined-to-base \{[^}]*border: 0[^}]*box-shadow: none/);
  assert.match(styles, /\.wireframe \.monitor-stem\.joined-to-base::before/);
  assert.match(composer, /state\.wireframeEnabled && state\.baseVisible/);
  assert.match(composer, /const partSurface/);
  assert.match(composer, /if \(source && state\.exportSettings\.outputKind !== 'empty'\)/);
  assert.doesNotMatch(app, /RangeField label=\{copy\.screenPositionX\}/);
  assert.doesNotMatch(app, /RangeField label=\{copy\.screenPositionY\}/);
});

test('wireframe outlines stay outside the glass in preview and export', () => {
  const app = read('src/App.tsx');
  const composer = read('src/composer.ts');
  const styles = read('src/styles.css');
  assert.match(styles, /\.wireframe \.live-screen \{[^}]*border: 0[^}]*box-shadow: 0 0 0 var\(--wire-size\)/);
  assert.match(styles, /\.wireframe \.device-overlay \{[^}]*border: 0[^}]*box-shadow: 0 0 0 var\(--wire-size\)/);
  assert.match(composer, /const expandGeometry/);
  assert.match(composer, /screenOutlineGeometry = state\.wireframeEnabled/);
  assert.doesNotMatch(app, /curve-screen-outside/);
});

test('screen curve feature is completely removed', () => {
  const app = read('src/App.tsx');
  const composer = read('src/composer.ts');
  const types = read('src/types.ts');
  const styles = read('src/styles.css');
  for (const source of [app, composer, types, styles]) assert.doesNotMatch(source, /screenCurve|curveEnabled|curved-surface|device-curve-outline|feDisplacementMap/);
  assert.doesNotMatch(app, /RangeField label="Curve"/);
  assert.match(composer, /drawScreenToGeometry/);
});

test('camera inspector omits the screen calibration editor', () => {
  const app = read('src/App.tsx');
  const styles = read('src/styles.css');
  assert.doesNotMatch(app, /Ekran kalibrasyonu|Screen calibration|copy\.calibrate|updateGeometry|activeCustomGeometry/);
  assert.doesNotMatch(styles, /\.corner-row/);
});

test('preset frames expose persistent favorites and editable material controls', () => {
  const app = read('src/App.tsx');
  assert.match(app, /FAVORITE_FRAMES_KEY/);
  assert.match(app, /toggleFavoriteFrame/);
  assert.match(app, /className="frame-favorite active"/);
  assert.match(app, /favoriteReadyFrames/);
  assert.match(app, /value=\{project\.deviceColor\}/);
  assert.match(app, /data-material=\{material\}/);
  assert.match(app, /onClick=\{\(\) => updateProject\(\{ deviceMaterial: material \}\)\}/);
});

test('device detail starts hidden and its webcam follows the frame geometry', () => {
  const app = read('src/App.tsx');
  const composer = read('src/composer.ts');
  assert.match(app, /detailVisible: false/);
  assert.match(app, /hydrated\.detailVisible = false/);
  assert.match(app, /displayCameraTop/);
  assert.match(composer, /const bodyTop = pointAt\(bodyGeometry, 0\.5/);
  assert.match(composer, /ctx\.arc\(bodyTop\.x, bodyTop\.y/);
});

test('frames panel collapse, background gradient, and output cleanup are wired', () => {
  const app = read('src/App.tsx');
  const composer = read('src/composer.ts');
  const styles = read('src/styles.css');
  assert.match(app, /FRAMES_PANEL_KEY/);
  assert.match(app, /className="frames-collapse"/);
  assert.match(app, /className="frames-reveal"/);
  assert.match(styles, /\.workspace-grid\.frames-collapsed/);
  assert.match(app, /backgroundGradientType/);
  assert.match(app, /backgroundGradientStops/);
  assert.match(app, /className="gradient-hex-input"/);
  assert.match(app, /addGradientStop/);
  assert.match(app, /removeGradientStop/);
  assert.match(composer, /mode === 'gradient'/);
  assert.match(composer, /for \(const stop of stops\)/);
  assert.match(styles, /\.preview-canvas\.gradient/);
  assert.doesNotMatch(app, /className="import-stack"/);
  assert.doesNotMatch(app, /className="canvas-meta"/);
  assert.doesNotMatch(app, /className="status-bar/);
  assert.doesNotMatch(app, /className="output-kind-grid"/);
  assert.match(app, /<FileOutput size=/);
  assert.doesNotMatch(app, /<Download size=/);
});

test('device detail has a direct visibility toggle and frames start collapsed', () => {
  const app = read('src/App.tsx');
  assert.match(app, /<Toggle compact label=\{copy\.detail\} checked=\{project\.detailVisible\}/);
  assert.match(app, /localStorage\.getItem\(FRAMES_PANEL_KEY\) === 'open'/);
});

test('color swatches use live input events and sharp monochrome styling', () => {
  const app = read('src/App.tsx');
  const styles = read('src/styles.css');
  assert.match(app, /function ColorField/);
  assert.match(app, /<ColorField label=\{copy\.deviceColor\} value=\{project\.deviceColor\}/);
  assert.match(app, /type="color" value=\{canonicalValue\} onInput=.*onChange=/);
  assert.match(app, /className="device-color-hex"/);
  assert.match(app, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(styles, /input\[type="color"\]::\-webkit-color-swatch/);
  assert.match(styles, /\.device-color-hex/);
});

test('capture and export contracts cover high-density and alpha workflows', () => {
  const main = read('electron/main.cjs');
  const app = read('src/App.tsx');
  const composer = read('src/composer.ts');
  assert.match(main, /Page\.captureScreenshot/);
  assert.match(main, /deviceScaleFactor: pixelRatio/);
  assert.doesNotMatch(main, /scale: pixelRatio/);
  assert.match(main, /liveTarget\.getType\?\.\(\) === 'webview'/);
  assert.match(main, /DETACHED_CAPTURE/);
  assert.match(main, /embeddedWebviewHighDensitySingleViewport/);
  assert.match(main, /withMetadata\(\{ density:/);
  assert.match(app, /transparent-png/);
  assert.match(app, /outputKind: 'mockup'/);
  assert.match(app, /fullPage: false/);
  assert.match(app, /readPreviewLayout/);
  assert.match(app, /requiredDensity \* 1\.4/);
  assert.match(composer, /previewLayout\?: PreviewLayout/);
  assert.match(composer, /previewLayout\.stageWidth \* previewScale/);
  assert.doesNotMatch(app, />MODE</);
  assert.doesNotMatch(app, /copy\.delay/);
  assert.match(app, /customMaskImage/);
});

test('JPG PNG and native SVG exports are wired without foreignObject raster wrappers', () => {
  const app = read('src/App.tsx');
  const main = read('electron/main.cjs');
  const preload = read('electron/preload.cjs');
  const vector = read('src/svgComposer.ts');
  const pkg = JSON.parse(read('package.json'));
  assert.match(app, /<option value="svg">SVG · VECTOR<\/option>/);
  assert.match(app, /composeMockupSvg/);
  assert.match(app, /captureCurrentSvg/);
  assert.match(main, /async function capturePageSvg/);
  assert.match(main, /function inlineSvgImageNode/);
  assert.match(main, /data-rms-inline-svg/);
  assert.match(main, /RMSSVG\.documentToSVG/);
  assert.match(main, /outlineSvgText/);
  assert.match(main, /async function saveSvg/);
  assert.match(main, /vectorWebsiteAndDeviceExport/);
  assert.match(preload, /capturePageSvg/);
  assert.match(preload, /saveSvg/);
  assert.match(vector, /data-rms-vector="true"/);
  assert.match(vector, /rms-device-material/);
  assert.doesNotMatch(vector, /foreignObject/i);
  assert.equal(pkg.dependencies['dom-to-svg'], '^0.12.2');
  assert.equal(pkg.dependencies.fontkit, '^2.0.4');
  assert.equal(pkg.dependencies['@xmldom/xmldom'], '^0.9.10');
});

test('preview framing offers toggleable ratios and landscape or portrait export crops', () => {
  const app = read('src/App.tsx');
  const types = read('src/types.ts');
  const styles = read('src/styles.css');
  assert.match(types, /CompositionFrameRatio = 'none' \| '1:1' \| '4:5' \| '16:9'/);
  assert.match(types, /CompositionFrameOrientation = 'landscape' \| 'portrait'/);
  assert.match(app, /className="composition-frame-controls"/);
  assert.match(app, /RectangleHorizontal/);
  assert.match(app, /RectangleVertical/);
  assert.match(app, /compositionFrameRatio === ratio \? 'none' : ratio/);
  assert.match(app, /ref=\{compositionFrameRef\}/);
  assert.match(app, /stageX: stage\.offsetLeft - \(frameRect\.left - viewportRect\.left\)/);
  assert.match(styles, /\.composition-frame-guide \{[^}]*box-shadow: 0 0 0 9999px/);
  assert.match(styles, /\.composition-frame-guide \{[^}]*pointer-events: none/);
});

test('real device geometry is locked while removable parts remain available', () => {
  const app = read('src/App.tsx');
  const presets = read('src/presets.ts');
  assert.match(app, /const geometryEditable = Boolean\(frame\.customVariant\)/);
  assert.match(app, /frameGeometryDefaults/);
  assert.match(app, /technical-lock-note/);
  assert.match(app, /removeDeviceComponent\('stem'/);
  assert.match(app, /stemVisible: true/);
  assert.match(presets, /body: rect/);
  assert.match(presets, /parts: \{ deckWidth: 62\.2, deckHeight: 2\.6 \}/);
  assert.match(app, /className="laptop-deck-notch"/);
});

test('output cleanup and live page controls match the working UI', () => {
  const app = read('src/App.tsx');
  assert.doesNotMatch(app, /batchExport/);
  assert.doesNotMatch(app, /HISTORY_KEY/);
  assert.doesNotMatch(app, /className="history-list"/);
  assert.match(app, /guestPresentationCss/);
  assert.match(app, /className="page-element-list"/);
  assert.match(app, /className=\{`recent-bookmark/);
  assert.match(app, /toggleBookmark\(url\)/);
  assert.doesNotMatch(app, /MoreHorizontal/);
  assert.doesNotMatch(app, /FAVORITES_KEY/);
  assert.match(app, /dangerousPageSelector/);
  assert.match(app, /pageRoot = !semantic/);
  assert.match(app, /directlyHidden/);
});

test('header contains only left language and right theme controls while browser chrome has no decorative dots', () => {
  const app = read('src/App.tsx');
  const styles = read('src/styles.css');
  assert.match(app, /<header className="app-header">\s*<button className="language-button"[\s\S]*<button\s*className="theme-toggle"[\s\S]*<\/header>/);
  assert.doesNotMatch(app, /header-project-actions|header-actions|onClick=\{openProject\}|onClick=\{saveProject\}|\n\s*FolderOpen,|\n\s*Save,/);
  assert.doesNotMatch(app, /brand-lockup|brand-mark|MoreHorizontal/);
  assert.doesNotMatch(styles, /\.brand-lockup|\.brand-mark|\.header-divider|\.header-project-actions|\.header-actions|\.traffic|\.secure-dot/);
  assert.doesNotMatch(app, /className="export-button"|openOutputPanel/);
  assert.doesNotMatch(styles, /\.export-button/);
});

test('desktop removes the native menu and the obsolete project-file system', () => {
  const main = read('electron/main.cjs');
  const preload = read('electron/preload.cjs');
  const types = read('src/types.ts');
  const app = read('src/App.tsx');
  const pkg = JSON.parse(read('package.json'));
  const appManifest = JSON.parse(read('app.manifest.json'));
  const toolManifest = JSON.parse(read('metadata/manifest/tool.manifest.json'));
  assert.match(main, /Menu\.setApplicationMenu\(null\)/);
  assert.match(main, /autoHideMenuBar: true/);
  assert.match(main, /mainWindow\.setMenuBarVisibility\(false\)/);
  assert.doesNotMatch(main, /pendingProjectPath|rms:save-project|rms:open-project|\.rmsproject/);
  assert.doesNotMatch(preload, /saveProject|openProject|rms:save-project|rms:open-project/);
  assert.doesNotMatch(types, /saveProject|openProject/);
  assert.doesNotMatch(app, /\.rmsproject|projectSaved|projectOpened/);
  assert.equal(pkg.build.fileAssociations, undefined);
  assert.equal(appManifest.inputFormats.includes('RMSPROJECT'), false);
  assert.equal(toolManifest.capabilities.includes('project-files'), false);
});

test('hot UI and export paths avoid obsolete work and synchronous full-canvas encoding', () => {
  const app = read('src/App.tsx');
  const composer = read('src/composer.ts');
  const main = read('electron/main.cjs');
  const preload = read('electron/preload.cjs');
  assert.doesNotMatch(app, /setStatus|ZoomIn|outputKind === 'raw'|outputKind === 'layers'|selectDirectory/);
  assert.doesNotMatch(main, /rms:select-directory/);
  assert.doesNotMatch(preload, /selectDirectory/);
  assert.match(app, /window\.setTimeout\(\(\) => localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(project\)\), 140\)/);
  assert.match(app, /Object\.entries\(patch\)\.every/);
  assert.match(app, /await import\('\.\/svgComposer'\)/);
  assert.doesNotMatch(composer, /const raw = canvas|raw: HTMLCanvasElement|rawCtx/);
  assert.match(composer, /target\.toBlob/);
});

test('output is last and toolbar separates centered device, restores, and right-aligned frame controls', () => {
  const app = read('src/App.tsx');
  const styles = read('src/styles.css');
  assert.match(app, /copy\.background[\s\S]*copy\.advanced[\s\S]*copy\.output/);
  assert.match(app, /className="center-device-button"[\s\S]*onClick=\{centerDeviceInPreview\}/);
  assert.match(app, /centerDeviceInPreview = \(\) => updateProject\(\{[\s\S]*cameraX: defaultProject\.cameraX,[\s\S]*cameraY: defaultProject\.cameraY/);
  assert.match(app, /center-device-button[\s\S]*Crosshair[\s\S]*preview-actions[\s\S]*hidden-component-restores[\s\S]*composition-frame-controls[\s\S]*\['1:1', '4:5', '16:9'\]/);
  assert.match(styles, /\.center-device-button \{[^}]*position: absolute;[^}]*left: 50%;[^}]*top: 50%;[^}]*transform: translate\(-50%,-50%\)/);
  assert.match(styles, /\.preview-actions \{ margin-left: auto; \}/);
  assert.match(styles, /\.composition-frame-controls \{ flex: 0 0 auto;/);
});

test('compact frame hierarchy and persistent saved-device actions are wired', () => {
  const app = read('src/App.tsx');
  const composer = read('src/composer.ts');
  const styles = read('src/styles.css');
  assert.match(app, /SAVED_MONITORS_KEY = 'rms\.saved-monitors\.v1'/);
  assert.match(app, /className="frame-group custom-frame-group"/);
  assert.match(app, /<details className="ready-frame-details">/);
  assert.match(app, /className="saved-monitor-section"/);
  assert.match(app, /className=\{`preview-save-monitor/);
  assert.match(app, /onClick=\{toggleSaveCurrentMonitor\}/);
  assert.match(app, /thumbnail: createDeviceThumbnail\(frame, project\)/);
  assert.match(app, /localStorage\.setItem\(SAVED_MONITORS_KEY/);
  assert.match(app, /className="saved-monitor-export"/);
  assert.match(app, /backgroundMode: 'transparent'/);
  assert.match(app, /format: 'transparent-png', outputKind: 'empty'/);
  assert.match(app, /Kaydedilen cihazlar/);
  assert.match(app, /className="viewport-reset"/);
  assert.match(app, /onClick=\{resetViewportAndFrame\}/);
  assert.match(app, /phoneLeftControlsVisible: true/);
  assert.match(app, /phoneRightButtonVisible: true/);
  assert.match(app, /phone-side-left/);
  assert.match(app, /phone-side-right/);
  assert.match(composer, /phoneLeftControlsVisible/);
  assert.match(composer, /phoneRightButtonVisible/);
  assert.match(styles, /\.workspace-grid \{[^}]*grid-template-columns: 205px minmax\(640px, 1fr\) 260px/);
  assert.match(styles, /\.saved-monitor-load img \{[^}]*width: 44px; height: 30px/);
});

test('all application UI controls and panels use square zero-radius corners', () => {
  const styles = read('src/styles.css');
  for (const selector of ['theme-toggle', 'center-device-button', 'frame-card', 'frame-glyph', 'frames-reveal', 'bookmark-menu', 'bookmark-item', 'address-field', 'restore-component-button', 'viewport-mode-toggle', 'device-settings-trigger', 'device-settings-glass', 'technical-lock-note', 'field-row select', 'number-pair label', 'range-reset', 'toggle-row i', 'swatch', 'field-column input', 'recent-item', 'toast']) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(styles, new RegExp(`\\.${escaped}[^\\n]*border-radius: 0`));
  }
  assert.match(styles, /input\[type="range"\]::\-webkit-slider-thumb \{[^}]*border-radius: 0/);
});

test('Windows release produces setup and portable artifacts', () => {
  const pkg = JSON.parse(read('package.json'));
  const releaseScript = read('scripts/package-release.mjs');
  assert.deepEqual(pkg.build.win.target, ['nsis', 'portable']);
  assert.match(pkg.build.nsis.artifactName, /Setup/);
  assert.match(pkg.build.portable.artifactName, /Portable/);
  assert.equal(pkg.build.nsis.createDesktopShortcut, true);
  assert.equal(pkg.build.nsis.createStartMenuShortcut, true);
  assert.match(releaseScript, /!first\.startsWith\('\.tmp-'\)/);
});

test('YCSWU manifest is catalog ready', () => {
  const manifest = JSON.parse(read('app.manifest.json'));
  assert.equal(manifest.category, 'CreativeTool');
  assert.equal(manifest.publisher, 'YCSWU');
  assert.ok(manifest.outputFormats.includes('Transparent PNG'));
  assert.ok(manifest.outputFormats.includes('SVG'));
});

test('application logo is the flat double-outline frame on black', () => {
  const icon = read('public/icon.svg');
  const webManifest = JSON.parse(read('public/site.webmanifest'));
  assert.equal((icon.match(/<rect\b/g) || []).length, 3);
  assert.match(icon, /<rect width="512" height="512" fill="#000000"\/>/);
  assert.equal((icon.match(/class="outline"/g) || []).length, 2);
  assert.doesNotMatch(icon, /<path\b|<circle\b|<ellipse\b|<polygon\b/);
  assert.doesNotMatch(icon, /quadratic|curve|stand|camera/i);
  assert.ok(webManifest.icons.some((entry) => entry.src === './icon.svg' && entry.type === 'image/svg+xml'));
});

test('web release is subfolder-safe and ships complete search and AI discovery metadata', () => {
  const index = read('index.html');
  const packageScript = read('scripts/package-release.mjs');
  const robots = read('public/robots.txt');
  const sitemap = read('public/sitemap.xml');
  const llms = read('public/llms.txt');
  const htaccess = read('public/.htaccess');
  assert.match(index, /rel="canonical" href="https:\/\/ycswu\.co\/mockup-studio\/"/);
  assert.match(index, /type="application\/ld\+json"/);
  assert.match(index, /"@type": \["SoftwareApplication", "WebApplication"\]/);
  assert.match(index, /property="og:image"/);
  assert.match(index, /name="twitter:card" content="summary_large_image"/);
  assert.match(index, /rel="alternate" type="text\/plain" href="\/llms\.txt"/);
  assert.match(robots, /Sitemap: https:\/\/ycswu\.co\/mockup-studio\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/ycswu\.co\/mockup-studio\/<\/loc>/);
  assert.match(llms, /## Core capabilities/);
  assert.match(htaccess, /RewriteBase \/mockup-studio\//);
  assert.match(htaccess, /DirectoryIndex index\.html/);
  for (const entry of ['.htaccess', 'index.html', 'og-image.png', 'robots.txt', 'sitemap.xml', 'site.webmanifest', 'llms.txt']) {
    assert.match(packageScript, new RegExp(entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(packageScript, /Web-cPanel-\$\{version\}\.zip/);
});
