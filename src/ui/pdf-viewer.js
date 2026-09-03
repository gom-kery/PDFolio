import { MAX_RENDER_SCALE, MIN_RENDER_SCALE } from '../pdf/pdf-adapter-core.js';
import { assessPageText } from '../analysis/page-text-assessment.js';
import { createPageTextCoordinates } from '../analysis/page-text-coordinates.js';
import { findPageKeywordCandidates } from '../analysis/page-keyword-candidates.js';
import { inferPageAnswerRegions } from '../analysis/page-answer-regions.js';
import { classifyPageSupportProfile } from '../analysis/page-support-profile.js';
import { initializePdfDebugOverlay } from './pdf-debug-overlay.js';
import { initializeManualRegionSetup } from './manual-region-setup.js';

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
const FIT_SCALE_EPSILON = 0.001;

/** Keep the visible Canvas stable until a PDF.js render is complete. */
export function initializePdfViewer(document, adapter) {
  const empty = document.querySelector('#viewer-empty');
  const viewer = document.querySelector('#pdf-viewer');
  const status = document.querySelector('#viewer-status');
  const canvas = document.querySelector('#pdf-canvas');
  const canvasContext = canvas.getContext('2d');
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
  const keywordAnalysisStatus = document.querySelector(
    '#keyword-analysis-status',
  );
  const regionAnalysisStatus = document.querySelector(
    '#region-analysis-status',
  );
  const supportProfileStatus = document.querySelector(
    '#support-profile-status',
  );
  const zoomOutButton = document.querySelector('#zoom-out');
  const zoomInButton = document.querySelector('#zoom-in');
  const fitHeightButton = document.querySelector('#fit-height');
  const zoomLevel = document.querySelector('#zoom-level');
  const debugOverlay = initializePdfDebugOverlay(document);
  const manualRegionSetup = initializeManualRegionSetup(document, {
    disabled: debugOverlay.enabled,
  });
  let requestId = 0;
  let currentPage = 0;
  let requestedPage = 0;
  let totalPages = 0;
  let currentScale = 1;
  let currentPageBaseHeight = 0;
  let requestedScale = 1;
  let scaleMode = 'fixed';
  let resizeTimer = null;
  let analysisRequestId = 0;

  const createRenderCanvas = () => document.createElement('canvas');

  const releaseRenderCanvas = (renderCanvas) => {
    renderCanvas.width = 1;
    renderCanvas.height = 1;
  };

  const commitRenderCanvas = (renderCanvas) => {
    canvas.width = renderCanvas.width;
    canvas.height = renderCanvas.height;
    canvas.style.width = renderCanvas.style.width;
    canvas.style.height = renderCanvas.style.height;
    canvasContext.drawImage(renderCanvas, 0, 0);
    releaseRenderCanvas(renderCanvas);
  };

  const showTextAnalysisStatus = (state, message, reasonCodes = []) => {
    textAnalysisStatus.dataset.state = state;
    textAnalysisStatus.textContent = message;
    if (reasonCodes.length > 0)
      textAnalysisStatus.dataset.reasonCodes = reasonCodes.join(' ');
    else delete textAnalysisStatus.dataset.reasonCodes;
  };

  const showKeywordAnalysisStatus = (state, message) => {
    keywordAnalysisStatus.dataset.state = state;
    keywordAnalysisStatus.textContent = message;
  };

  const showRegionAnalysisStatus = (state, message, reasonCodes = []) => {
    regionAnalysisStatus.dataset.state = state;
    regionAnalysisStatus.textContent = message;
    if (reasonCodes.length > 0)
      regionAnalysisStatus.dataset.reasonCodes = reasonCodes.join(' ');
    else delete regionAnalysisStatus.dataset.reasonCodes;
  };

  const showSupportProfileStatus = (state, message, reasonCodes = []) => {
    supportProfileStatus.dataset.state = state;
    supportProfileStatus.textContent = message;
    if (reasonCodes.length > 0)
      supportProfileStatus.dataset.reasonCodes = reasonCodes.join(' ');
    else delete supportProfileStatus.dataset.reasonCodes;
  };

  const applySupportProfileResult = (profileResult) => {
    if (profileResult.status !== 'profile-ready') {
      showSupportProfileStatus(
        'unknown',
        '현재 페이지의 지원 프로파일 근거를 확인할 수 없습니다.',
        [profileResult.code],
      );
      return;
    }
    const { verdict, reasonCodes } = profileResult.result;
    if (verdict === 'profile-match') {
      showSupportProfileStatus(
        'profile-match',
        '현재 페이지는 첫 MVP 분석 프로파일 후보와 맞습니다. 안전한 가림과 CBT 시작은 아직 승인되지 않았습니다.',
        reasonCodes,
      );
    } else if (verdict === 'not-supported') {
      showSupportProfileStatus(
        'not-supported',
        '현재 페이지는 첫 MVP 분석 프로파일을 지원하지 않습니다.',
        reasonCodes,
      );
    } else {
      showSupportProfileStatus(
        'hold',
        '현재 근거로 첫 MVP 분석 프로파일 지원 여부를 판정할 수 없습니다.',
        reasonCodes,
      );
    }
  };

  const resetTextAnalysis = (message) => {
    analysisRequestId++;
    debugOverlay.reset(message);
    showTextAnalysisStatus('idle', message);
    showKeywordAnalysisStatus(
      'idle',
      'PDF를 열면 현재 페이지의 제목 키워드를 확인합니다.',
    );
    showRegionAnalysisStatus(
      'idle',
      'PDF를 열면 현재 페이지의 해설·정답 영역 후보를 확인합니다.',
    );
    showSupportProfileStatus(
      'idle',
      'PDF를 열면 현재 페이지의 첫 MVP 분석 프로파일을 확인합니다.',
    );
  };

  const analyzePageText = async (pageNumber) => {
    const ownAnalysisRequestId = ++analysisRequestId;
    showTextAnalysisStatus(
      'analyzing',
      `${pageNumber.toLocaleString('ko-KR')}페이지의 텍스트를 확인하고 있습니다.`,
    );
    showKeywordAnalysisStatus(
      'analyzing',
      `${pageNumber.toLocaleString('ko-KR')}페이지의 제목 키워드를 확인하고 있습니다.`,
    );
    showRegionAnalysisStatus(
      'analyzing',
      `${pageNumber.toLocaleString('ko-KR')}페이지의 영역 경계를 확인하고 있습니다.`,
    );
    showSupportProfileStatus(
      'analyzing',
      `${pageNumber.toLocaleString('ko-KR')}페이지의 지원 프로파일을 확인하고 있습니다.`,
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
      debugOverlay.setUnavailable(
        '현재 페이지의 텍스트 상태를 확인할 수 없습니다.',
      );
      showTextAnalysisStatus(
        'unknown',
        '현재 페이지의 텍스트 상태를 확인할 수 없습니다.',
      );
      showKeywordAnalysisStatus(
        'skipped',
        '텍스트 분석이 보류되어 키워드를 찾지 않았습니다.',
      );
      showRegionAnalysisStatus(
        'skipped',
        '텍스트 분석이 보류되어 영역을 계산하지 않았습니다.',
      );
      showSupportProfileStatus(
        'unknown',
        '현재 페이지의 지원 프로파일 근거를 확인할 수 없습니다.',
      );
      return;
    }
    if (assessment.quality === 'text-usable') {
      const coordinateResult = createPageTextCoordinates(extraction.source);
      if (coordinateResult.status !== 'coordinates-ready') {
        debugOverlay.setUnavailable(
          '현재 페이지의 텍스트 위치를 확인할 수 없습니다.',
          [coordinateResult.code],
        );
        showTextAnalysisStatus(
          'unknown',
          '현재 페이지의 텍스트 위치를 확인할 수 없습니다.',
          [coordinateResult.code],
        );
        showKeywordAnalysisStatus(
          'skipped',
          '텍스트 위치를 확인할 수 없어 키워드 결과를 보류했습니다.',
        );
        showRegionAnalysisStatus(
          'skipped',
          '텍스트 위치를 확인할 수 없어 영역 결과를 보류했습니다.',
        );
        showSupportProfileStatus(
          'unknown',
          '현재 페이지의 지원 프로파일 근거를 확인할 수 없습니다.',
          [coordinateResult.code],
        );
        return;
      }
      showTextAnalysisStatus(
        'text-usable',
        '현재 페이지의 텍스트와 위치를 분석할 수 있습니다.',
      );
      const keywordResult = findPageKeywordCandidates({
        source: extraction.source,
        assessment,
      });
      if (keywordResult.status !== 'candidates-ready') {
        debugOverlay.setAnalysis({
          coordinates: coordinateResult.coordinates,
        });
        showKeywordAnalysisStatus(
          'unknown',
          '현재 페이지의 제목 키워드를 확인할 수 없습니다.',
        );
        showRegionAnalysisStatus(
          'skipped',
          '제목 키워드를 확인할 수 없어 영역 결과를 보류했습니다.',
        );
        showSupportProfileStatus(
          'unknown',
          '현재 페이지의 지원 프로파일 근거를 확인할 수 없습니다.',
        );
        return;
      }
      const count = keywordResult.result.candidateCount;
      showKeywordAnalysisStatus(
        count > 0 ? 'found' : 'none',
        count > 0
          ? `현재 페이지에서 제목 키워드 후보 ${count.toLocaleString('ko-KR')}개를 찾았습니다.`
          : '현재 페이지에서 제목 키워드 후보를 찾지 못했습니다.',
      );
      const regionResult = inferPageAnswerRegions({
        source: extraction.source,
        assessment,
        coordinates: coordinateResult.coordinates,
        keywordCandidates: keywordResult.result,
      });
      if (regionResult.status !== 'regions-ready') {
        debugOverlay.setAnalysis({
          coordinates: coordinateResult.coordinates,
          keywordCandidates: keywordResult.result,
        });
        showRegionAnalysisStatus(
          'unknown',
          '현재 페이지의 영역 후보를 확인할 수 없습니다.',
        );
        showSupportProfileStatus(
          'unknown',
          '현재 페이지의 지원 프로파일 근거를 확인할 수 없습니다.',
        );
        return;
      }
      debugOverlay.setAnalysis({
        coordinates: coordinateResult.coordinates,
        keywordCandidates: keywordResult.result,
        answerRegions: regionResult.result,
      });
      const regionOutcome = regionResult.result.outcome;
      if (regionOutcome === 'candidate-regions') {
        const regionCount = regionResult.result.regionCount;
        showRegionAnalysisStatus(
          'found',
          `현재 페이지에서 영역 후보 ${regionCount.toLocaleString('ko-KR')}개를 계산했습니다. 안전한 가림은 아직 확인하지 않았습니다.`,
          regionResult.result.reasonCodes,
        );
      } else if (regionOutcome === 'no-candidates') {
        showRegionAnalysisStatus(
          'none',
          '제목 키워드 후보가 없어 영역을 계산하지 않았습니다.',
          regionResult.result.reasonCodes,
        );
      } else {
        showRegionAnalysisStatus(
          'uncertain',
          '현재 페이지의 영역 경계를 안전하게 계산하지 못했습니다.',
          regionResult.result.reasonCodes,
        );
      }
      applySupportProfileResult(
        classifyPageSupportProfile({
          assessment,
          keywordCandidates: keywordResult.result,
          answerRegions: regionResult.result,
        }),
      );
      return;
    }
    if (assessment.quality === 'unknown') {
      debugOverlay.setUnavailable(
        '현재 페이지의 텍스트 상태를 확인할 수 없습니다.',
        assessment.reasonCodes,
      );
      showTextAnalysisStatus(
        'unknown',
        '현재 페이지의 텍스트 상태를 확인할 수 없습니다.',
        assessment.reasonCodes,
      );
      showKeywordAnalysisStatus(
        'skipped',
        '텍스트 분석이 보류되어 키워드를 찾지 않았습니다.',
      );
      showRegionAnalysisStatus(
        'skipped',
        '텍스트 분석이 보류되어 영역을 계산하지 않았습니다.',
      );
      applySupportProfileResult(classifyPageSupportProfile({ assessment }));
      return;
    }
    const message = assessment.reasonCodes.includes('NO_TEXT_ITEMS')
      ? '현재 페이지에서 분석할 텍스트를 찾지 못했습니다.'
      : assessment.reasonCodes.includes('WHITESPACE_ONLY')
        ? '현재 페이지에서 유효한 텍스트를 찾지 못했습니다.'
        : assessment.reasonCodes.includes('TOO_LITTLE_TEXT')
          ? '현재 페이지는 분석하기에 텍스트가 너무 적습니다.'
          : '현재 페이지의 텍스트 품질이 충분하지 않습니다.';
    debugOverlay.setUnavailable(message, assessment.reasonCodes);
    showTextAnalysisStatus(
      'text-insufficient',
      message,
      assessment.reasonCodes,
    );
    showKeywordAnalysisStatus(
      'skipped',
      '텍스트 분석이 보류되어 키워드를 찾지 않았습니다.',
    );
    showRegionAnalysisStatus(
      'skipped',
      '텍스트 분석이 보류되어 영역을 계산하지 않았습니다.',
    );
    applySupportProfileResult(classifyPageSupportProfile({ assessment }));
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

  const getFitTargetScale = () => {
    if (!Number.isFinite(currentPageBaseHeight) || currentPageBaseHeight <= 0)
      return null;
    return Math.min(
      MAX_RENDER_SCALE,
      Math.max(MIN_RENDER_SCALE, getFitHeight() / currentPageBaseHeight),
    );
  };

  const needsFitHeightRender = () => {
    const targetScale = getFitTargetScale();
    return (
      targetScale === null ||
      Math.abs(targetScale - currentScale) > FIT_SCALE_EPSILON
    );
  };

  const getRenderOptions = (pageNumber, renderCanvas) => ({
    pageNumber,
    canvas: renderCanvas,
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
    currentPageBaseHeight = rendered.height / rendered.scale;
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
    debugOverlay.setViewport(rendered);
    manualRegionSetup.setViewport(rendered);
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

  const renderPage = async (
    pageNumber,
    { resetScroll = false, announceLoading = true } = {},
  ) => {
    if (totalPages < 1) return { status: 'error', code: 'INVALID_PAGE_NUMBER' };

    const ownRequestId = ++requestId;
    const renderCanvas = createRenderCanvas();
    if (
      !Number.isSafeInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > totalPages
    ) {
      const rejected = await adapter.renderPage(
        getRenderOptions(pageNumber, renderCanvas),
      );
      releaseRenderCanvas(renderCanvas);
      if (ownRequestId === requestId) showInvalidPage();
      return rejected;
    }

    requestedPage = pageNumber;
    if (pageNumber !== currentPage) {
      manualRegionSetup.prepareForPageChange(pageNumber);
      resetTextAnalysis('페이지를 표시한 뒤 텍스트를 확인합니다.');
    }
    updateControls();
    showViewer(
      'loading',
      announceLoading
        ? `${pageNumber.toLocaleString('ko-KR')}페이지를 불러오고 있습니다.`
        : '',
      { preserveCanvas: currentPage > 0 },
    );
    const rendered = await adapter.renderPage(
      getRenderOptions(pageNumber, renderCanvas),
    );
    if (ownRequestId !== requestId || rendered.status === 'canceled') {
      releaseRenderCanvas(renderCanvas);
      return rendered;
    }
    if (rendered.status === 'rendered') {
      commitRenderCanvas(renderCanvas);
      applyRenderedPage(rendered, { resetScroll });
    } else if (rendered.code === 'INVALID_PAGE_NUMBER') {
      releaseRenderCanvas(renderCanvas);
      showInvalidPage();
    } else {
      releaseRenderCanvas(renderCanvas);
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
          if (
            scaleMode === 'fit-height' &&
            totalPages > 0 &&
            needsFitHeightRender()
          )
            void renderPage(currentPage, { announceLoading: false });
        }, FIT_RESIZE_DELAY_MS);
      })
    : null;
  resizeObserver?.observe(pageScroll);
  updateControls();

  return {
    async open(result) {
      const ownRequestId = ++requestId;
      manualRegionSetup.resetDocument();
      currentPage = 0;
      requestedPage = 0;
      totalPages = 0;
      currentScale = 1;
      currentPageBaseHeight = 0;
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
      const renderCanvas = createRenderCanvas();
      const rendered = await adapter.open({
        data: result.data,
        canvas: renderCanvas,
        scale: 1,
      });
      if (ownRequestId !== requestId || rendered.status === 'canceled') {
        releaseRenderCanvas(renderCanvas);
        return rendered;
      }
      if (rendered.status === 'rendered') {
        manualRegionSetup.openDocument(rendered);
        commitRenderCanvas(renderCanvas);
        applyRenderedPage(rendered, { resetScroll: true });
      } else {
        releaseRenderCanvas(renderCanvas);
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

    getManualRegionConfirmation(pageNumber = currentPage) {
      return manualRegionSetup.getConfirmation(pageNumber);
    },

    async dispose() {
      requestId++;
      resetTextAnalysis('PDF를 열면 현재 페이지의 텍스트를 확인합니다.');
      resizeObserver?.disconnect();
      if (resizeTimer !== null) document.defaultView?.clearTimeout(resizeTimer);
      await adapter.dispose();
      debugOverlay.dispose();
      manualRegionSetup.dispose();
    },
  };
}
