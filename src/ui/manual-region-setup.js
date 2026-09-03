import {
  MINIMUM_REGION_DRAG_CSS_PX,
  createManualRegionSetupStore,
  createPdfRectFromViewportDrag,
  validateManualRegionRects,
} from '../cbt/manual-region-setup.js';
import {
  createViewportGeometry,
  projectPdfRectToViewport,
} from '../pdf/pdf-coordinate-space.js';

const KIND_LABELS = Object.freeze({ solution: '해설', answer: '정답' });
let documentIdSequence = 0;

function createDocumentId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `document-${uuid}`;
  documentIdSequence += 1;
  return `document-session-${documentIdSequence}`;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function setRectGeometry(element, rect) {
  element.style.left = `${rect.x}px`;
  element.style.top = `${rect.y}px`;
  element.style.width = `${rect.width}px`;
  element.style.height = `${rect.height}px`;
}

function createRegionElement(document, kind, rect, mode) {
  const element = document.createElement('div');
  element.className = 'manual-region-rect';
  element.dataset.kind = kind;
  element.dataset.mode = mode;
  setRectGeometry(element, rect);
  const label = document.createElement('span');
  label.textContent =
    mode === 'preview'
      ? `${KIND_LABELS[kind]} 가림 미리보기`
      : `${KIND_LABELS[kind]} 영역`;
  element.append(label);
  return element;
}

function messageForCode(code) {
  switch (code) {
    case 'REGIONS_INCOMPLETE':
      return '해설 영역과 정답 영역을 각각 하나씩 지정해주세요.';
    case 'REGIONS_OVERLAP':
      return '해설 영역과 정답 영역이 겹칩니다. 서로 겹치지 않게 다시 지정해주세요.';
    case 'REGION_TOO_SMALL':
      return '영역이 너무 작습니다. 가릴 내용을 포함하도록 조금 더 크게 드래그해주세요.';
    case 'REGION_OUT_OF_PAGE':
    case 'INVALID_REGION_RECT':
      return 'PDF 페이지 안의 유효한 영역을 지정해주세요.';
    default:
      return '영역 설정을 완료하지 못했습니다. 다시 시도해주세요.';
  }
}

/** Manage the Unit 4.1 setup-only Region overlay without enabling CBT masks. */
export function initializeManualRegionSetup(
  document,
  { disabled = false } = {},
) {
  const section = document.querySelector('#manual-region-setup');
  const status = document.querySelector('#manual-region-status');
  const startButton = document.querySelector('#start-manual-region-setup');
  const editor = document.querySelector('#manual-region-editor');
  const instruction = document.querySelector('#manual-region-instruction');
  const selectionSummary = document.querySelector(
    '#manual-region-selection-summary',
  );
  const solutionButton = document.querySelector('#select-solution-region');
  const answerButton = document.querySelector('#select-answer-region');
  const previewButton = document.querySelector('#preview-manual-regions');
  const editButton = document.querySelector('#edit-manual-regions');
  const confirmButton = document.querySelector('#confirm-manual-regions');
  const cancelButton = document.querySelector('#cancel-manual-regions');
  const overlay = document.querySelector('#manual-region-overlay');
  const canvas = document.querySelector('#pdf-canvas');
  const store = createManualRegionSetupStore();
  let renderedPage = null;
  let viewport = null;
  let activeKind = 'solution';
  let pointerDrag = null;
  let draftCanceledByNavigation = false;

  if (disabled) {
    section.hidden = true;
    overlay.hidden = true;
    return Object.freeze({
      enabled: false,
      resetDocument() {},
      openDocument() {},
      prepareForPageChange() {},
      setViewport() {},
      getConfirmation: () => null,
      dispose() {},
    });
  }

  const setStatus = (state, message) => {
    section.dataset.state = state;
    status.dataset.state = state;
    status.textContent = message;
  };

  const getDisplayGeometry = () => {
    if (!viewport) return null;
    const bounds = canvas.getBoundingClientRect();
    const width = bounds.width || Number.parseFloat(canvas.style.width);
    const height = bounds.height || Number.parseFloat(canvas.style.height);
    if (
      !Number.isFinite(width) ||
      width <= 0 ||
      !Number.isFinite(height) ||
      height <= 0
    )
      return null;
    return {
      width,
      height,
      scaleX: width / viewport.width,
      scaleY: height / viewport.height,
    };
  };

  const projectRect = (rect) => {
    const display = getDisplayGeometry();
    if (!display) return null;
    const projected = projectPdfRectToViewport(viewport, rect);
    return {
      x: projected.x * display.scaleX,
      y: projected.y * display.scaleY,
      width: projected.width * display.scaleX,
      height: projected.height * display.scaleY,
    };
  };

  const updateKindButtons = () => {
    solutionButton.setAttribute(
      'aria-pressed',
      String(activeKind === 'solution'),
    );
    answerButton.setAttribute('aria-pressed', String(activeKind === 'answer'));
  };

  const describeDraft = () => {
    const draft = store.getDraft();
    if (!draft) {
      selectionSummary.textContent = '';
      return;
    }
    const hasSolution = Boolean(draft.rects.solution);
    const hasAnswer = Boolean(draft.rects.answer);
    const validation = validateManualRegionRects(draft);
    selectionSummary.textContent = `해설 ${hasSolution ? '지정됨' : '미지정'} · 정답 ${hasAnswer ? '지정됨' : '미지정'}`;
    previewButton.disabled = validation.status !== 'ready';
    if (hasSolution && hasAnswer && validation.code === 'REGIONS_OVERLAP')
      setStatus('error', messageForCode(validation.code));
  };

  const renderOverlay = () => {
    const draft = store.getDraft();
    const display = getDisplayGeometry();
    if (!draft || !display) {
      overlay.replaceChildren();
      overlay.hidden = true;
      return;
    }
    overlay.style.width = `${display.width}px`;
    overlay.style.height = `${display.height}px`;
    overlay.dataset.mode = draft.mode;
    overlay.dataset.pageNumber = String(draft.pageNumber);
    overlay.tabIndex = draft.mode === 'editing' ? 0 : -1;
    const elements = [];
    for (const kind of ['solution', 'answer']) {
      const rect = draft.rects[kind];
      if (!rect) continue;
      const projected = projectRect(rect);
      if (projected)
        elements.push(
          createRegionElement(document, kind, projected, draft.mode),
        );
    }
    if (pointerDrag) {
      const x = Math.min(pointerDrag.start.x, pointerDrag.end.x);
      const y = Math.min(pointerDrag.start.y, pointerDrag.end.y);
      elements.push(
        createRegionElement(
          document,
          activeKind,
          {
            x,
            y,
            width: Math.abs(pointerDrag.end.x - pointerDrag.start.x),
            height: Math.abs(pointerDrag.end.y - pointerDrag.start.y),
          },
          'drawing',
        ),
      );
    }
    overlay.replaceChildren(...elements);
    overlay.hidden = false;
  };

  const closeEditor = () => {
    pointerDrag = null;
    editor.hidden = true;
    startButton.hidden = false;
    overlay.replaceChildren();
    overlay.hidden = true;
  };

  const refreshPageStatus = (message = '') => {
    if (!renderedPage || !store.getDocumentContext()) {
      section.hidden = true;
      closeEditor();
      return;
    }
    section.hidden = false;
    const confirmation = store.getConfirmation(renderedPage.pageNumber);
    if (confirmation)
      section.dataset.questionId = confirmation.question.questionId;
    else delete section.dataset.questionId;
    startButton.textContent = confirmation
      ? '확정 영역 수정'
      : '영역 설정 시작';
    if (message) setStatus('idle', message);
    else if (confirmation)
      setStatus(
        'confirmed',
        `${renderedPage.pageNumber.toLocaleString('ko-KR')}페이지의 해설·정답 영역을 확정했습니다. CBT 가림은 아직 시작하지 않습니다.`,
      );
    else
      setStatus(
        'idle',
        `${renderedPage.pageNumber.toLocaleString('ko-KR')}페이지에는 확정된 수동 영역이 없습니다.`,
      );
  };

  const startEditing = () => {
    if (!renderedPage?.page || !viewport) return;
    const result = store.begin({
      pageNumber: renderedPage.pageNumber,
      page: renderedPage.page,
    });
    if (result.status !== 'editing') {
      setStatus('error', messageForCode(result.code));
      return;
    }
    activeKind = result.draft.rects.solution ? 'answer' : 'solution';
    delete section.dataset.questionId;
    pointerDrag = null;
    solutionButton.disabled = false;
    answerButton.disabled = false;
    startButton.hidden = true;
    editor.hidden = false;
    previewButton.hidden = false;
    editButton.hidden = true;
    confirmButton.hidden = true;
    instruction.textContent = `${KIND_LABELS[activeKind]} 버튼을 선택한 뒤 PDF 위에서 가릴 범위를 드래그하세요.`;
    updateKindButtons();
    describeDraft();
    setStatus(
      'editing',
      '설정 화면입니다. 원문과 정답이 보일 수 있으며 아직 CBT가 아닙니다.',
    );
    renderOverlay();
    overlay.focus({ preventScroll: true });
  };

  const selectKind = (kind) => {
    if (store.getDraft()?.mode !== 'editing') return;
    activeKind = kind;
    instruction.textContent = `${KIND_LABELS[kind]} 버튼을 선택한 뒤 PDF 위에서 가릴 범위를 드래그하세요.`;
    updateKindButtons();
    overlay.focus({ preventScroll: true });
  };

  const localPointer = (event) => {
    const bounds = overlay.getBoundingClientRect();
    return {
      x: clamp(event.clientX - bounds.left, 0, bounds.width),
      y: clamp(event.clientY - bounds.top, 0, bounds.height),
    };
  };

  const toViewportPoint = (point) => {
    const display = getDisplayGeometry();
    return display
      ? { x: point.x / display.scaleX, y: point.y / display.scaleY }
      : null;
  };

  const finishPointerDrag = (event) => {
    if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
    pointerDrag.end = localPointer(event);
    const display = getDisplayGeometry();
    const start = toViewportPoint(pointerDrag.start);
    const end = toViewportPoint(pointerDrag.end);
    const minimumSize = display
      ? MINIMUM_REGION_DRAG_CSS_PX / Math.min(display.scaleX, display.scaleY)
      : MINIMUM_REGION_DRAG_CSS_PX;
    pointerDrag = null;
    const result = createPdfRectFromViewportDrag({
      viewport,
      page: renderedPage.page,
      start,
      end,
      minimumSize,
    });
    if (result.status !== 'ready') {
      setStatus('error', messageForCode(result.code));
      renderOverlay();
      return;
    }
    const updated = store.setRect(activeKind, result.rect);
    if (updated.status !== 'editing') {
      setStatus('error', messageForCode(updated.code));
      renderOverlay();
      return;
    }
    if (activeKind === 'solution' && !updated.draft.rects.answer)
      selectKind('answer');
    const validation = validateManualRegionRects(updated.draft);
    describeDraft();
    if (validation.status === 'ready')
      setStatus(
        'editing',
        '두 영역을 지정했습니다. 가림 미리보기로 범위를 확인해주세요.',
      );
    else if (validation.code !== 'REGIONS_OVERLAP')
      setStatus(
        'editing',
        `${KIND_LABELS[activeKind]} 영역을 지정했습니다. 나머지 영역도 지정해주세요.`,
      );
    renderOverlay();
  };

  startButton.addEventListener('click', startEditing);
  solutionButton.addEventListener('click', () => selectKind('solution'));
  answerButton.addEventListener('click', () => selectKind('answer'));
  overlay.addEventListener('pointerdown', (event) => {
    if (store.getDraft()?.mode !== 'editing' || event.button !== 0) return;
    event.preventDefault();
    const point = localPointer(event);
    pointerDrag = {
      pointerId: event.pointerId,
      start: point,
      end: point,
    };
    overlay.setPointerCapture?.(event.pointerId);
    renderOverlay();
  });
  overlay.addEventListener('pointermove', (event) => {
    if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
    pointerDrag.end = localPointer(event);
    renderOverlay();
  });
  overlay.addEventListener('pointerup', finishPointerDrag);
  overlay.addEventListener('pointercancel', () => {
    pointerDrag = null;
    renderOverlay();
  });
  previewButton.addEventListener('click', () => {
    const result = store.preview();
    if (result.status !== 'preview') {
      setStatus('error', messageForCode(result.code));
      return;
    }
    previewButton.hidden = true;
    editButton.hidden = false;
    confirmButton.hidden = false;
    solutionButton.disabled = true;
    answerButton.disabled = true;
    instruction.textContent =
      '불투명한 두 영역이 해설과 정답만 가리는지 확인한 뒤 확정하세요.';
    setStatus(
      'preview',
      '가림 미리보기입니다. 이 화면은 설정 확인용이며 CBT 가림 상태가 아닙니다.',
    );
    describeDraft();
    renderOverlay();
  });
  editButton.addEventListener('click', () => {
    const result = store.edit();
    if (result.status !== 'editing') return;
    previewButton.hidden = false;
    editButton.hidden = true;
    confirmButton.hidden = true;
    solutionButton.disabled = false;
    answerButton.disabled = false;
    instruction.textContent = `${KIND_LABELS[activeKind]} 영역을 다시 드래그해 수정할 수 있습니다.`;
    setStatus('editing', '영역 수정 화면으로 돌아왔습니다.');
    describeDraft();
    renderOverlay();
  });
  confirmButton.addEventListener('click', () => {
    const result = store.confirm();
    if (result.status !== 'confirmed') {
      setStatus('error', messageForCode(result.code));
      return;
    }
    section.dataset.questionId = result.confirmation.question.questionId;
    closeEditor();
    refreshPageStatus();
  });
  cancelButton.addEventListener('click', () => {
    const hadConfirmation = Boolean(
      renderedPage && store.getConfirmation(renderedPage.pageNumber),
    );
    store.cancel();
    closeEditor();
    refreshPageStatus(
      hadConfirmation
        ? '영역 편집을 취소했습니다. 이전 확정 상태는 유지합니다.'
        : '영역 편집을 취소했습니다. 저장된 영역은 없습니다.',
    );
  });

  const resetDocument = () => {
    store.clearDocument();
    renderedPage = null;
    viewport = null;
    pointerDrag = null;
    draftCanceledByNavigation = false;
    delete section.dataset.questionId;
    closeEditor();
    section.hidden = true;
  };

  return Object.freeze({
    enabled: true,
    resetDocument,
    openDocument(rendered) {
      resetDocument();
      if (!rendered?.page || !rendered.documentRevision) return;
      store.openDocument({
        documentId: createDocumentId(),
        documentRevision: rendered.documentRevision,
      });
    },
    prepareForPageChange(pageNumber) {
      if (renderedPage && pageNumber !== renderedPage.pageNumber) {
        draftCanceledByNavigation = Boolean(store.getDraft());
        store.cancel();
        closeEditor();
        if (draftCanceledByNavigation)
          setStatus(
            'idle',
            '페이지 이동을 시작해 완료하지 않은 영역 편집을 취소했습니다.',
          );
      }
    },
    setViewport(rendered) {
      const documentContext = store.getDocumentContext();
      if (!rendered?.page || !documentContext) {
        renderedPage = null;
        viewport = null;
        refreshPageStatus();
        return;
      }
      if (rendered.documentRevision !== documentContext.documentRevision)
        return;
      const previousPageNumber = renderedPage?.pageNumber;
      renderedPage = {
        documentRevision: rendered.documentRevision,
        pageNumber: rendered.pageNumber,
        page: {
          viewBox: [...rendered.page.viewBox],
          userUnit: rendered.page.userUnit,
          rotation: rendered.page.rotation,
        },
      };
      viewport = createViewportGeometry(renderedPage.page, {
        scale: rendered.scale,
      });
      const pageResult = store.leavePage(rendered.pageNumber);
      const canceledDraft =
        draftCanceledByNavigation || pageResult.status === 'canceled';
      draftCanceledByNavigation = false;
      if (pageResult.status === 'canceled') closeEditor();
      if (store.getDraft()) {
        describeDraft();
        renderOverlay();
      } else {
        closeEditor();
        refreshPageStatus(
          canceledDraft &&
            previousPageNumber &&
            previousPageNumber !== rendered.pageNumber
            ? '페이지가 바뀌어 완료하지 않은 영역 편집을 취소했습니다.'
            : '',
        );
      }
    },
    getConfirmation(pageNumber) {
      if (store.getDraft()?.pageNumber === pageNumber) return null;
      return store.getConfirmation(pageNumber);
    },
    dispose() {
      resetDocument();
    },
  });
}
