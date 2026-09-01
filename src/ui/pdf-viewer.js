import { MAX_RENDER_SCALE, MIN_RENDER_SCALE } from '../pdf/pdf-adapter-core.js';
import { assessPageText } from '../analysis/page-text-assessment.js';

const VIEWER_FAILURE_MESSAGES = {
  PASSWORD_REQUIRED:
    '암호가 필요한 PDF는 현재 표시할 수 없습니다. 암호를 해제한 복사본을 선택해주세요.',
  INVALID_PDF_STRUCTURE:
    'PDF 구조가 손상됐거나 지원할 수 없는 형식입니다. 다른 PDF를 선택해주세요.',
  PDF_RENDER_FAILED:
    'PDF 페이지를 표시하지 못했습니다. 다른 페이지나 PDF를 선택해주세요.',
};
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const FIT_RESIZE_DELAY_MS = 120;

/** Present one adapter-owned Canvas and keep PDF.js details out of selection UI. */
export function initializePdfViewer(document, adapter) {
  const empty = document.querySelector('#viewer-empty');
  const viewer = document.querySelector('#pdf-viewer');
  const status = document.querySelector('#viewer-status');
  const canvas = document.querySelector('#pdf-canvas');
  const pageScroll = document.querySelector('.pdf-page-scroll');
  const pageCount = document.querySelector('#pdf-page-count');
  const documentState = document.querySelector('#document-state');
  const navigation = document.querySelector('#pdf-page-navigation');
  const firstButton = document.querySelector('#first-page');
  const previousButton = document.querySelector('#previous-page');
  const sidePreviousButton = document.querySelector('#side-previous-page');
  const nextButton = document.querySelector('#next-page');
  const sideNextButton = document.querySelector('#side-next-page');
  const lastButton = document.querySelector('#last-page');
  const pageForm = document.querySelector('#page-number-form');
  const pageInput = document.querySelector('#page-number');
  const pageTotal = document.querySelector('#page-total');
  const textAnalysisStatus = document.querySelector('#text-analysis-status');
  const zoomOutButton = document.querySelector('#zoom-out');
  const zoomInButton = document.querySelector('#zoom-in');
  const fitHeightButton = document.querySelector('#fit-height');
  const zoomLevel = document.querySelector('#zoom-level');
  let requestId = 0;
  let currentPage = 0;
  let requestedPage = 0;
  let totalPages = 0;
  let currentScale = 1;
  let requestedScale = 1;
  let scaleMode = 'fixed';
  let resizeTimer = null;
  let analysisRequestId = 0;

  const showTextAnalysisStatus = (state, message, reasonCodes = []) => {
    textAnalysisStatus.dataset.state = state;
    textAnalysisStatus.textContent = message;
    if (reasonCodes.length > 0)
      textAnalysisStatus.dataset.reasonCodes = reasonCodes.join(' ');
    else delete textAnalysisStatus.dataset.reasonCodes;
  };

  const resetTextAnalysis = (message) => {
    analysisRequestId++;
    showTextAnalysisStatus('idle', message);
  };

  const analyzePageText = async (pageNumber) => {
    const ownAnalysisRequestId = ++analysisRequestId;
    showTextAnalysisStatus(
      'analyzing',
      `${pageNumber.toLocaleString('ko-KR')}페이지의 텍스트를 확인하고 있습니다.`,
    );
    let extraction;
    try {
      extraction = await adapter.extractPageText({ pageNumber });
    } catch {
      extraction = null;
    }
    if (
      ownAnalysisRequestId !== analysisRequestId ||
      extraction?.status === 'canceled'
    )
      return;
    const assessment = assessPageText(extraction);
    if (!assessment) {
      showTextAnalysisStatus(
        'unknown',
        '현재 페이지의 텍스트 상태를 확인할 수 없습니다.',
      );
      return;
    }
    if (assessment.quality === 'text-usable') {
      showTextAnalysisStatus(
        'text-usable',
        '현재 페이지의 텍스트를 분석할 수 있습니다.',
      );
      return;
    }
    if (assessment.quality === 'unknown') {
      showTextAnalysisStatus(
        'unknown',
        '현재 페이지의 텍스트 상태를 확인할 수 없습니다.',
        assessment.reasonCodes,
      );
      return;
    }
    const message = assessment.reasonCodes.includes('NO_TEXT_ITEMS')
      ? '현재 페이지에서 분석할 텍스트를 찾지 못했습니다.'
      : assessment.reasonCodes.includes('WHITESPACE_ONLY')
        ? '현재 페이지에서 유효한 텍스트를 찾지 못했습니다.'
        : assessment.reasonCodes.includes('TOO_LITTLE_TEXT')
          ? '현재 페이지는 분석하기에 텍스트가 너무 적습니다.'
          : '현재 페이지의 텍스트 품질이 충분하지 않습니다.';
    showTextAnalysisStatus(
      'text-insufficient',
      message,
      assessment.reasonCodes,
    );
  };

  const showViewer = (state, message, { preserveCanvas = false } = {}) => {
    empty.hidden = true;
    viewer.hidden = false;
    viewer.dataset.state = state;
    status.dataset.state = state;
    status.textContent = message;
    status.hidden = !message;
    canvas.hidden = state !== 'ready' && !preserveCanvas;
  };

  const getFitHeight = () => {
    const styles = document.defaultView?.getComputedStyle(pageScroll);
    const verticalPadding = styles
      ? Number.parseFloat(styles.paddingTop) +
        Number.parseFloat(styles.paddingBottom)
      : 0;
    return Math.max(1, pageScroll.clientHeight - verticalPadding);
  };

  const getRenderOptions = (pageNumber) => ({
    pageNumber,
    canvas,
    ...(scaleMode === 'fit-height'
      ? { fitHeight: getFitHeight() }
      : { scale: requestedScale }),
  });

  const updateControls = () => {
    const hasDocument = totalPages > 0;
    navigation.hidden = !hasDocument;
    pageInput.disabled = !hasDocument;
    pageInput.max = hasDocument ? String(totalPages) : '';
    pageInput.value = hasDocument ? String(requestedPage || currentPage) : '';
    pageTotal.textContent = hasDocument
      ? totalPages.toLocaleString('ko-KR')
      : '—';
    const targetPage = requestedPage || currentPage;
    const atFirstPage = !hasDocument || targetPage <= 1;
    const atLastPage = !hasDocument || targetPage >= totalPages;
    firstButton.disabled = atFirstPage;
    previousButton.disabled = atFirstPage;
    sidePreviousButton.disabled = atFirstPage;
    nextButton.disabled = atLastPage;
    sideNextButton.disabled = atLastPage;
    lastButton.disabled = atLastPage;
    const displayedScale =
      scaleMode === 'fit-height' ? currentScale : requestedScale;
    zoomOutButton.disabled = !hasDocument || displayedScale <= MIN_RENDER_SCALE;
    zoomInButton.disabled = !hasDocument || displayedScale >= MAX_RENDER_SCALE;
    fitHeightButton.disabled = !hasDocument;
    fitHeightButton.setAttribute(
      'aria-pressed',
      String(scaleMode === 'fit-height'),
    );
    zoomLevel.textContent = `${Math.round(displayedScale * 100)}%`;
  };

  const applyRenderedPage = (rendered, { resetScroll = false } = {}) => {
    const pageChanged = currentPage !== rendered.pageNumber;
    currentPage = rendered.pageNumber;
    requestedPage = rendered.pageNumber;
    totalPages = rendered.pageCount;
    currentScale = rendered.scale;
    requestedScale = scaleMode === 'fixed' ? rendered.scale : requestedScale;
    pageCount.textContent = `${currentPage} / ${totalPages}`;
    canvas.dataset.pageNumber = String(currentPage);
    canvas.dataset.scale = String(rendered.scale);
    canvas.dataset.rotation = String(rendered.rotation);
    canvas.dataset.pixelRatio = String(rendered.pixelRatio);
    canvas.dataset.resolutionLimited = String(rendered.resolutionLimited);
    canvas.setAttribute(
      'aria-label',
      `선택한 PDF의 ${currentPage.toLocaleString('ko-KR')}페이지, ${Math.round(rendered.scale * 100)}퍼센트`,
    );
    documentState.textContent = `원문 보기 · ${currentPage} / ${totalPages}`;
    navigation.dataset.resolutionLimited = String(rendered.resolutionLimited);
    zoomLevel.title = rendered.resolutionLimited
      ? '메모리 보호를 위해 화면 배율은 유지하고 렌더 해상도만 제한했습니다.'
      : '';
    updateControls();
    showViewer('ready', '');
    if (resetScroll) {
      pageScroll.scrollTop = 0;
      pageScroll.scrollLeft = 0;
    }
    if (pageChanged) void analyzePageText(rendered.pageNumber);
  };

  const showInvalidPage = () => {
    requestedPage = currentPage;
    updateControls();
    viewer.dataset.state = 'ready';
    status.hidden = false;
    status.dataset.state = 'error';
    status.textContent = `페이지 번호는 1부터 ${totalPages.toLocaleString('ko-KR')} 사이의 정수여야 합니다. 현재 페이지를 유지합니다.`;
    canvas.hidden = false;
  };

  const renderPage = async (pageNumber, { resetScroll = false } = {}) => {
    if (totalPages < 1) return { status: 'error', code: 'INVALID_PAGE_NUMBER' };

    const ownRequestId = ++requestId;
    if (
      !Number.isSafeInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > totalPages
    ) {
      const rejected = await adapter.renderPage(getRenderOptions(pageNumber));
      if (ownRequestId === requestId) showInvalidPage();
      return rejected;
    }

    requestedPage = pageNumber;
    if (pageNumber !== currentPage)
      resetTextAnalysis('페이지를 표시한 뒤 텍스트를 확인합니다.');
    updateControls();
    showViewer(
      'loading',
      `${pageNumber.toLocaleString('ko-KR')}페이지를 불러오고 있습니다.`,
      { preserveCanvas: currentPage > 0 },
    );
    const rendered = await adapter.renderPage(getRenderOptions(pageNumber));
    if (ownRequestId !== requestId || rendered.status === 'canceled')
      return rendered;
    if (rendered.status === 'rendered')
      applyRenderedPage(rendered, { resetScroll });
    else if (rendered.code === 'INVALID_PAGE_NUMBER') showInvalidPage();
    else {
      requestedPage = currentPage;
      updateControls();
      resetTextAnalysis('페이지를 표시한 뒤 텍스트를 확인합니다.');
      showViewer(
        'error',
        VIEWER_FAILURE_MESSAGES[rendered.code] ||
          VIEWER_FAILURE_MESSAGES.PDF_RENDER_FAILED,
      );
    }
    return rendered;
  };

  const goToPage = (pageNumber) =>
    renderPage(pageNumber, { resetScroll: true });

  const changeZoom = (direction) => {
    if (totalPages < 1) return;
    const referenceScale =
      scaleMode === 'fit-height' ? currentScale : requestedScale;
    const nextScale =
      direction > 0
        ? ZOOM_STEPS.find((step) => step > referenceScale + 0.001)
        : [...ZOOM_STEPS]
            .reverse()
            .find((step) => step < referenceScale - 0.001);
    if (nextScale === undefined) return;
    scaleMode = 'fixed';
    requestedScale = nextScale;
    updateControls();
    void renderPage(currentPage);
  };

  firstButton.addEventListener('click', () => void goToPage(1));
  previousButton.addEventListener(
    'click',
    () => void goToPage(requestedPage - 1),
  );
  sidePreviousButton.addEventListener(
    'click',
    () => void goToPage(requestedPage - 1),
  );
  nextButton.addEventListener('click', () => void goToPage(requestedPage + 1));
  sideNextButton.addEventListener(
    'click',
    () => void goToPage(requestedPage + 1),
  );
  lastButton.addEventListener('click', () => void goToPage(totalPages));
  zoomOutButton.addEventListener('click', () => changeZoom(-1));
  zoomInButton.addEventListener('click', () => changeZoom(1));
  fitHeightButton.addEventListener('click', () => {
    if (totalPages < 1) return;
    scaleMode = 'fit-height';
    updateControls();
    void renderPage(currentPage);
  });
  pageForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const rawPage = pageInput.value.trim();
    const pageNumber = /^\d+$/.test(rawPage) ? Number(rawPage) : Number.NaN;
    void goToPage(pageNumber);
  });

  const ResizeObserverClass = document.defaultView?.ResizeObserver;
  const resizeObserver = ResizeObserverClass
    ? new ResizeObserverClass(() => {
        if (scaleMode !== 'fit-height' || totalPages < 1) return;
        if (resizeTimer !== null)
          document.defaultView.clearTimeout(resizeTimer);
        resizeTimer = document.defaultView.setTimeout(() => {
          resizeTimer = null;
          if (scaleMode === 'fit-height' && totalPages > 0)
            void renderPage(currentPage);
        }, FIT_RESIZE_DELAY_MS);
      })
    : null;
  resizeObserver?.observe(pageScroll);
  updateControls();

  return {
    async open(result) {
      const ownRequestId = ++requestId;
      currentPage = 0;
      requestedPage = 0;
      totalPages = 0;
      currentScale = 1;
      requestedScale = 1;
      scaleMode = 'fixed';
      resetTextAnalysis('PDF를 열면 현재 페이지의 텍스트를 확인합니다.');
      for (const key of [
        'pageNumber',
        'scale',
        'rotation',
        'pixelRatio',
        'resolutionLimited',
      ]) {
        delete canvas.dataset[key];
      }
      updateControls();
      showViewer('loading', 'PDF 첫 페이지를 불러오고 있습니다.');
      pageCount.textContent = '확인 중';
      const rendered = await adapter.open({
        data: result.data,
        canvas,
        scale: 1,
      });
      if (ownRequestId !== requestId || rendered.status === 'canceled')
        return rendered;
      if (rendered.status === 'rendered')
        applyRenderedPage(rendered, { resetScroll: true });
      else {
        pageCount.textContent = '표시 불가';
        showViewer(
          'error',
          VIEWER_FAILURE_MESSAGES[rendered.code] ||
            VIEWER_FAILURE_MESSAGES.PDF_RENDER_FAILED,
        );
      }
      return rendered;
    },

    goToPage,

    async dispose() {
      requestId++;
      resetTextAnalysis('PDF를 열면 현재 페이지의 텍스트를 확인합니다.');
      resizeObserver?.disconnect();
      if (resizeTimer !== null) document.defaultView?.clearTimeout(resizeTimer);
      await adapter.dispose();
    },
  };
}
