const VIEWER_FAILURE_MESSAGES = {
  PASSWORD_REQUIRED:
    '암호가 필요한 PDF는 현재 표시할 수 없습니다. 암호를 해제한 복사본을 선택해주세요.',
  INVALID_PDF_STRUCTURE:
    'PDF 구조가 손상됐거나 지원할 수 없는 형식입니다. 다른 PDF를 선택해주세요.',
  PDF_RENDER_FAILED:
    'PDF 페이지를 표시하지 못했습니다. 다른 페이지나 PDF를 선택해주세요.',
};

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
  const nextButton = document.querySelector('#next-page');
  const lastButton = document.querySelector('#last-page');
  const pageForm = document.querySelector('#page-number-form');
  const pageInput = document.querySelector('#page-number');
  const pageTotal = document.querySelector('#page-total');
  let requestId = 0;
  let currentPage = 0;
  let requestedPage = 0;
  let totalPages = 0;

  const showViewer = (state, message, { preserveCanvas = false } = {}) => {
    empty.hidden = true;
    viewer.hidden = false;
    viewer.dataset.state = state;
    status.dataset.state = state;
    status.textContent = message;
    canvas.hidden = state !== 'ready' && !preserveCanvas;
  };

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
    firstButton.disabled = !hasDocument || targetPage <= 1;
    previousButton.disabled = !hasDocument || targetPage <= 1;
    nextButton.disabled = !hasDocument || targetPage >= totalPages;
    lastButton.disabled = !hasDocument || targetPage >= totalPages;
  };

  const applyRenderedPage = (rendered) => {
    currentPage = rendered.pageNumber;
    requestedPage = rendered.pageNumber;
    totalPages = rendered.pageCount;
    pageCount.textContent = `${currentPage} / ${totalPages}`;
    canvas.dataset.pageNumber = String(currentPage);
    canvas.setAttribute(
      'aria-label',
      `선택한 PDF의 ${currentPage.toLocaleString('ko-KR')}페이지`,
    );
    documentState.textContent = `원문 보기 · ${currentPage} / ${totalPages}`;
    updateControls();
    showViewer(
      'ready',
      `${currentPage.toLocaleString('ko-KR')}페이지를 표시했습니다. 전체 ${totalPages.toLocaleString('ko-KR')}페이지입니다.`,
    );
    pageScroll.scrollTop = 0;
    pageScroll.scrollLeft = 0;
  };

  const showInvalidPage = () => {
    requestedPage = currentPage;
    updateControls();
    viewer.dataset.state = 'ready';
    status.dataset.state = 'error';
    status.textContent = `페이지 번호는 1부터 ${totalPages.toLocaleString('ko-KR')} 사이의 정수여야 합니다. 현재 페이지를 유지합니다.`;
    canvas.hidden = false;
  };

  const goToPage = async (pageNumber) => {
    if (totalPages < 1) return { status: 'error', code: 'INVALID_PAGE_NUMBER' };

    const ownRequestId = ++requestId;
    if (
      !Number.isSafeInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > totalPages
    ) {
      const rejected = await adapter.renderPage({ pageNumber, canvas });
      if (ownRequestId === requestId) showInvalidPage();
      return rejected;
    }

    requestedPage = pageNumber;
    updateControls();
    showViewer(
      'loading',
      `${pageNumber.toLocaleString('ko-KR')}페이지를 불러오고 있습니다.`,
      { preserveCanvas: currentPage > 0 },
    );
    const rendered = await adapter.renderPage({ pageNumber, canvas });
    if (ownRequestId !== requestId || rendered.status === 'canceled')
      return rendered;
    if (rendered.status === 'rendered') applyRenderedPage(rendered);
    else if (rendered.code === 'INVALID_PAGE_NUMBER') showInvalidPage();
    else {
      requestedPage = currentPage;
      updateControls();
      showViewer(
        'error',
        VIEWER_FAILURE_MESSAGES[rendered.code] ||
          VIEWER_FAILURE_MESSAGES.PDF_RENDER_FAILED,
      );
    }
    return rendered;
  };

  firstButton.addEventListener('click', () => void goToPage(1));
  previousButton.addEventListener(
    'click',
    () => void goToPage(requestedPage - 1),
  );
  nextButton.addEventListener('click', () => void goToPage(requestedPage + 1));
  lastButton.addEventListener('click', () => void goToPage(totalPages));
  pageForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const rawPage = pageInput.value.trim();
    const pageNumber = /^\d+$/.test(rawPage) ? Number(rawPage) : Number.NaN;
    void goToPage(pageNumber);
  });

  updateControls();

  return {
    async open(result) {
      const ownRequestId = ++requestId;
      currentPage = 0;
      requestedPage = 0;
      totalPages = 0;
      delete canvas.dataset.pageNumber;
      updateControls();
      showViewer('loading', 'PDF 첫 페이지를 불러오고 있습니다.');
      pageCount.textContent = '확인 중';
      const rendered = await adapter.open({ data: result.data, canvas });
      if (ownRequestId !== requestId || rendered.status === 'canceled')
        return rendered;
      if (rendered.status === 'rendered') applyRenderedPage(rendered);
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
      await adapter.dispose();
    },
  };
}
