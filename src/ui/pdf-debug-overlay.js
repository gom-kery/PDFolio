import { createPdfDebugOverlayModel } from '../pdf/pdf-debug-overlay-model.js';

function appendTextElement(document, parent, tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function createLegendItem(document, parent, layer, text) {
  const item = document.createElement('li');
  item.dataset.layer = layer;
  const swatch = document.createElement('span');
  swatch.className = 'pdf-debug-legend-swatch';
  swatch.setAttribute('aria-hidden', 'true');
  item.append(swatch, document.createTextNode(text));
  parent.append(item);
}

function setRectGeometry(element, rect) {
  element.style.left = `${rect.x}px`;
  element.style.top = `${rect.y}px`;
  element.style.width = `${rect.width}px`;
  element.style.height = `${rect.height}px`;
}

function createRectElement(document, layer, entry, label) {
  const element = document.createElement('div');
  element.className = 'pdf-debug-rect';
  element.dataset.layer = layer;
  setRectGeometry(element, entry.rect);
  for (const [key, value] of Object.entries(entry)) {
    if (key !== 'rect') element.dataset[key] = String(value);
  }
  if (label) appendTextElement(document, element, 'span', '', label);
  return element;
}

/** Create an explicit command-line-only diagnostic overlay; normal mode is a no-op. */
export function initializePdfDebugOverlay(document) {
  const requested =
    new URL(document.defaultView.location.href).searchParams.get(
      'debugOverlay',
    ) === '1';
  if (!requested) {
    return Object.freeze({
      enabled: false,
      reset() {},
      setViewport() {},
      setAnalysis() {},
      setUnavailable() {},
      dispose() {},
    });
  }

  document.documentElement.dataset.debugOverlay = 'enabled';
  const viewer = document.querySelector('#pdf-viewer');
  const status = document.querySelector('#viewer-status');
  const surface = document.querySelector('.pdf-page-surface');
  const canvas = document.querySelector('#pdf-canvas');
  const panel = document.createElement('section');
  panel.id = 'pdf-debug-panel';
  panel.className = 'pdf-debug-panel';
  panel.dataset.state = 'idle';
  panel.setAttribute('aria-labelledby', 'pdf-debug-title');
  const header = document.createElement('div');
  header.className = 'pdf-debug-header';
  const title = appendTextElement(
    document,
    header,
    'h3',
    '',
    'PDF 좌표 Debug Overlay',
  );
  title.id = 'pdf-debug-title';
  const toggle = appendTextElement(
    document,
    header,
    'button',
    'secondary-button pdf-debug-toggle',
    '오버레이 숨기기',
  );
  toggle.type = 'button';
  toggle.setAttribute('aria-pressed', 'true');
  panel.append(header);
  const summary = appendTextElement(
    document,
    panel,
    'p',
    'pdf-debug-summary',
    'PDF를 연 뒤 좌표를 대조합니다.',
  );
  appendTextElement(
    document,
    panel,
    'p',
    'pdf-debug-note',
    '진단 모드입니다. 원문 문자열은 표시하지 않으며 이 결과는 가림 승인이 아닙니다.',
  );
  const legend = document.createElement('ul');
  legend.className = 'pdf-debug-legend';
  legend.setAttribute('aria-label', 'Debug Overlay 범례');
  createLegendItem(document, legend, 'text-item', 'Text Item / sourceIndex');
  createLegendItem(document, legend, 'keyword', '제목 키워드 근거');
  createLegendItem(document, legend, 'region-text', '영역 후보의 텍스트 줄');
  createLegendItem(document, legend, 'region-bound', '영역 후보 전체 경계');
  panel.append(legend);
  status.insertAdjacentElement('afterend', panel);

  const overlay = document.createElement('div');
  overlay.id = 'pdf-debug-overlay';
  overlay.className = 'pdf-debug-overlay';
  overlay.dataset.state = 'idle';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.hidden = true;
  surface.append(overlay);

  let isVisible = true;
  let viewport = null;
  let analysis = null;

  const updateVisibility = () => {
    overlay.hidden = !isVisible || overlay.dataset.state !== 'ready';
    toggle.textContent = isVisible ? '오버레이 숨기기' : '오버레이 표시';
    toggle.setAttribute('aria-pressed', String(isVisible));
  };

  const clearOverlay = () => {
    overlay.replaceChildren();
    overlay.dataset.state = 'idle';
    overlay.hidden = true;
    delete overlay.dataset.pageNumber;
    delete overlay.dataset.scale;
    delete overlay.dataset.rotation;
  };

  const render = () => {
    if (!viewport || !analysis) return;
    const canvasBounds = canvas.getBoundingClientRect();
    const canvasWidth =
      canvasBounds.width || Number.parseFloat(canvas.style.width);
    const canvasHeight =
      canvasBounds.height || Number.parseFloat(canvas.style.height);
    const result = createPdfDebugOverlayModel({
      ...analysis,
      scale: viewport.scale,
      canvasWidth,
      canvasHeight,
    });
    if (result.status !== 'ready') {
      clearOverlay();
      panel.dataset.state = 'error';
      summary.textContent = `Debug Overlay를 만들 수 없습니다. ${result.code}`;
      return;
    }
    const model = result.model;
    const elements = [];
    for (const entry of model.layers.regionBounds)
      elements.push(
        createRectElement(
          document,
          'region-bound',
          entry,
          `R${entry.regionIndex}`,
        ),
      );
    for (const entry of model.layers.regionTextRects)
      elements.push(createRectElement(document, 'region-text', entry));
    for (const entry of model.layers.textItems)
      elements.push(
        createRectElement(
          document,
          'text-item',
          entry,
          `T${entry.sourceIndex}`,
        ),
      );
    for (const entry of model.layers.keywordMarks)
      elements.push(
        createRectElement(
          document,
          'keyword',
          entry,
          `K${entry.candidateIndex}`,
        ),
      );
    overlay.replaceChildren(...elements);
    overlay.style.width = `${model.canvas.width}px`;
    overlay.style.height = `${model.canvas.height}px`;
    overlay.dataset.state = 'ready';
    overlay.dataset.pageNumber = String(model.pageNumber);
    overlay.dataset.scale = String(model.scale);
    overlay.dataset.rotation = String(model.pageRotation);
    panel.dataset.state = 'ready';
    summary.textContent = `페이지 ${model.pageNumber.toLocaleString('ko-KR')} · ${Math.round(model.scale * 100)}% · 회전 ${model.pageRotation}° · Text Item ${model.itemCount.toLocaleString('ko-KR')}개 · 키워드 ${model.keywordCount.toLocaleString('ko-KR')}개 · 영역 ${model.regionCount.toLocaleString('ko-KR')}개 (${model.regionOutcome})`;
    updateVisibility();
  };

  toggle.addEventListener('click', () => {
    isVisible = !isVisible;
    updateVisibility();
  });

  return {
    enabled: true,
    reset(message = '페이지 분석을 기다리고 있습니다.') {
      analysis = null;
      viewport = null;
      clearOverlay();
      panel.dataset.state = 'idle';
      summary.textContent = message;
    },
    setViewport(rendered) {
      viewport = rendered
        ? {
            pageNumber: rendered.pageNumber,
            scale: rendered.scale,
            rotation: rendered.rotation,
          }
        : null;
      if (analysis?.coordinates.pageNumber !== viewport?.pageNumber)
        analysis = null;
      if (analysis) render();
      else if (viewport) {
        panel.dataset.state = 'waiting';
        summary.textContent = `페이지 ${viewport.pageNumber.toLocaleString('ko-KR')} · ${Math.round(viewport.scale * 100)}% · 회전 ${viewport.rotation}° · 분석 대기`;
      }
    },
    setAnalysis({
      coordinates,
      keywordCandidates = null,
      answerRegions = null,
    }) {
      analysis = { coordinates, keywordCandidates, answerRegions };
      render();
    },
    setUnavailable(message, reasonCodes = []) {
      analysis = null;
      clearOverlay();
      panel.dataset.state = 'unavailable';
      summary.textContent = reasonCodes.length
        ? `${message} (${reasonCodes.join(', ')})`
        : message;
    },
    dispose() {
      analysis = null;
      viewport = null;
      clearOverlay();
    },
  };
}
