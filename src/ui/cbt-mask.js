import { getCbtMaskReadiness } from '../cbt/cbt-mask.js';
import {
  createViewportGeometry,
  projectPdfRectToViewport,
} from '../pdf/pdf-coordinate-space.js';

const MASK_LABELS = Object.freeze({
  solution: '해설 가림',
  answer: '정답 가림',
});

function setRectGeometry(element, rect) {
  element.style.left = `${rect.x}px`;
  element.style.top = `${rect.y}px`;
  element.style.width = `${rect.width}px`;
  element.style.height = `${rect.height}px`;
}

function createRegionElement(document, { kind, rect }) {
  const element = document.createElement('div');
  element.className = 'cbt-mask-region';
  element.dataset.kind = kind;
  setRectGeometry(element, rect);
  const label = document.createElement('span');
  label.textContent = MASK_LABELS[kind];
  element.append(label);
  return element;
}

/** Keep Unit 3.1 masks separate from the Unit 4.1 setup preview overlay. */
export function initializeCbtMask(document, { disabled = false } = {}) {
  const overlay = document.querySelector('#cbt-mask-overlay');
  const message = document.querySelector('#cbt-mask-message');
  const status = document.querySelector('#cbt-mask-status');
  const statusSection = document.querySelector('.cbt-mask-status-section');
  const canvas = document.querySelector('#pdf-canvas');
  let renderedPage = null;

  const setStatus = (state, text) => {
    status.dataset.state = state;
    status.textContent = text;
  };

  const hideOverlay = () => {
    overlay.replaceChildren();
    overlay.hidden = true;
    delete overlay.dataset.state;
    delete overlay.dataset.pageNumber;
  };

  const sizeOverlayToCanvas = () => {
    const bounds = canvas.getBoundingClientRect();
    const width = bounds.width || Number.parseFloat(canvas.style.width);
    const height = bounds.height || Number.parseFloat(canvas.style.height);
    if (![width, height].every(Number.isFinite) || width <= 0 || height <= 0)
      return null;
    overlay.style.width = `${width}px`;
    overlay.style.height = `${height}px`;
    return { width, height };
  };

  const showBlocked = (code) => {
    sizeOverlayToCanvas();
    overlay.replaceChildren(message);
    overlay.hidden = false;
    overlay.dataset.state = 'blocked';
    if (renderedPage)
      overlay.dataset.pageNumber = String(renderedPage.pageNumber);
    message.hidden = false;
    message.textContent =
      code === 'RENDER_NOT_READY'
        ? '가림을 준비하고 있습니다. 준비가 끝날 때까지 원문을 표시하지 않습니다.'
        : '이 페이지는 확정된 해설·정답 영역이 없어 전체 가림 상태입니다. 오른쪽의 영역 설정을 시작하면 원문에서 범위를 지정할 수 있습니다.';
    setStatus(
      'blocked',
      '현재 페이지는 CBT 가림을 준비하지 않았습니다. 원문은 영역 설정 화면에서만 확인할 수 있습니다.',
    );
  };

  const showReady = (mask) => {
    const viewport = createViewportGeometry(renderedPage.page, {
      scale: renderedPage.scale,
    });
    const size = sizeOverlayToCanvas();
    if (!size) {
      showBlocked('RENDER_NOT_READY');
      return;
    }
    const { width, height } = size;
    const scaleX = width / viewport.width;
    const scaleY = height / viewport.height;
    const regions = mask.regions.map((region) => {
      const projected = projectPdfRectToViewport(viewport, region.rect);
      return {
        kind: region.kind,
        rect: {
          x: projected.x * scaleX,
          y: projected.y * scaleY,
          width: projected.width * scaleX,
          height: projected.height * scaleY,
        },
      };
    });
    overlay.replaceChildren(
      ...regions.map((region) => createRegionElement(document, region)),
    );
    overlay.hidden = false;
    overlay.dataset.state = 'ready';
    overlay.dataset.pageNumber = String(mask.pageNumber);
    overlay.dataset.questionId = mask.questionId;
    setStatus(
      'ready',
      '해설과 정답을 가렸습니다. 답 선택과 공개는 다음 단계에서 추가됩니다.',
    );
  };

  if (disabled) {
    overlay.hidden = true;
    statusSection.hidden = true;
    status.hidden = true;
    return Object.freeze({ reset() {}, blockUntilReady() {}, sync() {} });
  }

  const reset = () => {
    renderedPage = null;
    hideOverlay();
    status.hidden = true;
    statusSection.hidden = true;
    canvas.removeAttribute('aria-hidden');
  };

  return Object.freeze({
    reset,
    blockUntilReady() {
      if (!renderedPage) return;
      canvas.setAttribute('aria-hidden', 'true');
      status.hidden = false;
      showBlocked('RENDER_NOT_READY');
    },
    sync({ rendered, confirmation, setupActive = false } = {}) {
      renderedPage = rendered ?? null;
      if (!renderedPage) {
        reset();
        return;
      }
      statusSection.hidden = false;
      if (setupActive) {
        hideOverlay();
        status.hidden = false;
        setStatus(
          'setup',
          '영역 설정 화면입니다. 설정 중에는 원문이 표시될 수 있습니다.',
        );
        canvas.removeAttribute('aria-hidden');
        return;
      }
      const result = getCbtMaskReadiness({
        rendered: renderedPage,
        confirmation,
      });
      status.hidden = false;
      canvas.setAttribute('aria-hidden', 'true');
      if (result.status === 'ready') showReady(result.mask);
      else showBlocked(result.code);
    },
  });
}
