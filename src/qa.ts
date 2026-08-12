import { createDefaultProject } from './App';
import { canvasToDataUrl, composeMockup } from './composer';
import type { PreviewLayout } from './composer';
import { getFrame } from './presets';
import { composeMockupSvg } from './svgComposer';
import type { ProjectState } from './types';

interface QARequest {
  captureDataUrl?: string;
  websiteSvg?: string;
  frameId: string;
  project?: Partial<ProjectState> & { exportSettings?: Partial<ProjectState['exportSettings']> };
  previewLayout?: PreviewLayout;
}

const projectState = (request: QARequest) => {
  const base = createDefaultProject();
  const preset = getFrame(request.frameId);
  const state: ProjectState = {
    ...base,
    frameThickness: preset.appearance.frameThickness,
    frameCornerRadius: preset.appearance.frameCornerRadius,
    screenCornerRadius: preset.appearance.screenCornerRadius,
    ...request.project,
    frameId: request.frameId,
    exportSettings: { ...base.exportSettings, ...(request.project?.exportSettings || {}) },
  };
  return { preset, state };
};

const compose = async (request: QARequest) => {
  const { preset, state } = projectState(request);
  const layers = await composeMockup(request.captureDataUrl, state, preset, request.previewLayout);
  return {
    width: layers.composite.width,
    height: layers.composite.height,
    composite: await canvasToDataUrl(layers.composite, state.exportSettings.format, state.exportSettings.quality / 100),
    background: await canvasToDataUrl(layers.background, 'png'),
    screen: await canvasToDataUrl(layers.screen, 'png'),
    frame: await canvasToDataUrl(layers.frame, 'png'),
  };
};

const composeSvg = (request: QARequest) => {
  const { preset, state } = projectState(request);
  return composeMockupSvg(request.websiteSvg, state, preset, request.previewLayout);
};

(window as unknown as { __RMS_QA__: { compose: typeof compose; composeSvg: typeof composeSvg } }).__RMS_QA__ = { compose, composeSvg };
document.getElementById('qa-status')!.textContent = 'RMS_QA_READY';
