const VIEWER_FAILURE_MESSAGES = {
  PASSWORD_REQUIRED:
    '암호가 필요한 PDF는 현재 표시할 수 없습니다. 암호를 해제한 복사본을 선택해주세요.',
  INVALID_PDF_STRUCTURE:
    'PDF 구조가 손상됐거나 지원할 수 없는 형식입니다. 다른 PDF를 선택해주세요.',
  PDF_RENDER_FAILED:
    'PDF 첫 페이지를 표시하지 못했습니다. 다른 PDF를 선택해주세요.',
};

/** Present one adapter-owned Canvas and keep PDF.js details out of selection UI. */
export function initializePdfViewer(document, adapter) {
  const empty = document.querySelector('#viewer-empty');
  const viewer = document.querySelector('#pdf-viewer');
  const status = document.querySelector('#viewer-status');
  const canvas = document.querySelector('#pdf-canvas');
  const pageCount = document.querySelector('#pdf-page-count');
  let requestId = 0;

  const showViewer = (state, message) => {
    empty.hidden = true;
    viewer.hidden = false;
    viewer.dataset.state = state;
    status.dataset.state = state;
    status.textContent = message;
    canvas.hidden = state !== 'ready';
  };

  return {
    async open(result) {
      const ownRequestId = ++requestId;
      showViewer('loading', 'PDF 첫 페이지를 불러오고 있습니다.');
      pageCount.textContent = '확인 중';
      const rendered = await adapter.open({ data: result.data, canvas });
      if (ownRequestId !== requestId || rendered.status === 'canceled')
        return rendered;
      if (rendered.status === 'rendered') {
        pageCount.textContent = `1 / ${rendered.pageCount}`;
        showViewer(
          'ready',
          `첫 페이지를 표시했습니다. 전체 ${rendered.pageCount.toLocaleString('ko-KR')}페이지입니다.`,
        );
      } else {
        pageCount.textContent = '표시 불가';
        showViewer(
          'error',
          VIEWER_FAILURE_MESSAGES[rendered.code] ||
            VIEWER_FAILURE_MESSAGES.PDF_RENDER_FAILED,
        );
      }
      return rendered;
    },

    async dispose() {
      requestId++;
      await adapter.dispose();
    },
  };
}
