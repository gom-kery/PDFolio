import { createQuestionPageLinkStore } from '../cbt/question-page-links.js';

function messageForCode(code) {
  switch (code) {
    case 'SOURCE_NOT_FOUND':
      return '연결할 문제 페이지에는 먼저 확정된 해설·정답 영역이 있어야 합니다.';
    case 'TARGET_NOT_READY':
      return '현재 페이지에서 먼저 해설·정답 영역을 확정해주세요.';
    case 'LINK_PAGE_NOT_DIFFERENT':
      return '문제 페이지와 다른 페이지의 영역만 연결할 수 있습니다.';
    case 'REGIONS_INCOMPLETE':
      return '해설과 정답 영역을 각각 하나 이상 연결해주세요.';
    case 'STALE_SOURCE_QUESTION':
      return 'PDF가 바뀌어 이전 문제와 연결할 수 없습니다.';
    case 'LINK_NOT_FOUND':
      return '해제할 페이지 간 연결이 없습니다.';
    default:
      return '페이지 간 연결을 처리하지 못했습니다. 문제와 현재 페이지의 확정 상태를 다시 확인해주세요.';
  }
}

/**
 * Collect a manual cross-page mapping without changing either page-single
 * Question. The connected Region copies stay owned by the source Question.
 */
export function initializeQuestionPageLinks(
  document,
  {
    disabled = false,
    getConfirmation = () => null,
    getRenderedPage = () => null,
  } = {},
) {
  const section = document.querySelector('#question-page-links');
  const status = document.querySelector('#question-page-link-status');
  const sourceInput = document.querySelector('#question-page-link-source');
  const connectButton = document.querySelector('#connect-question-pages');
  const unlinkButton = document.querySelector('#unlink-question-pages');
  const store = createQuestionPageLinkStore();

  if (disabled) {
    section.hidden = true;
    return Object.freeze({
      enabled: false,
      resetDocument() {},
      refresh() {},
      getLink: () => null,
    });
  }

  const setStatus = (state, message) => {
    section.dataset.state = state;
    status.dataset.state = state;
    status.textContent = message;
  };

  const selectedSource = () => {
    const raw = sourceInput.value.trim();
    const pageNumber = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
    return Number.isSafeInteger(pageNumber) && pageNumber > 0
      ? getConfirmation(pageNumber)
      : null;
  };

  const ensureDocument = (question) => {
    const current = store.getDocumentContext();
    if (
      current?.documentId === question.documentId &&
      current.documentRevision === question.documentRevision
    )
      return { status: 'ready' };
    return store.openDocument(question);
  };

  const refresh = () => {
    const rendered = getRenderedPage();
    section.hidden = !rendered;
    if (!rendered) return;
    const source = selectedSource();
    if (!source) {
      unlinkButton.disabled = true;
      return;
    }
    const link = store.getLink(source.question);
    unlinkButton.disabled = !link;
    if (link)
      setStatus(
        'linked',
        `${source.question.pageRefs[0]}페이지 문제를 ${link.pageRefs
          .filter((pageRef) => pageRef.role !== 'prompt')
          .map(
            (pageRef) =>
              `${pageRef.pageNumber}페이지 ${pageRef.role === 'solution' ? '해설' : '정답'}`,
          )
          .join('·')}에 연결했습니다.`,
      );
  };

  connectButton.addEventListener('click', () => {
    const rendered = getRenderedPage();
    const source = selectedSource();
    const target = rendered && getConfirmation(rendered.pageNumber);
    if (!source) {
      setStatus('error', messageForCode('SOURCE_NOT_FOUND'));
      return;
    }
    if (!target) {
      setStatus('error', messageForCode('TARGET_NOT_READY'));
      return;
    }
    const documentResult = ensureDocument(source.question);
    if (documentResult.status !== 'ready') {
      setStatus('error', messageForCode(documentResult.code));
      return;
    }
    const result = store.upsertLink({
      question: source.question,
      pageRegions: target.regions.map((region) => ({
        pageNumber: rendered.pageNumber,
        page: rendered.page,
        kind: region.kind,
        rect: region.rect,
      })),
    });
    if (result.status !== 'linked' && result.status !== 'updated') {
      setStatus('error', messageForCode(result.code));
      return;
    }
    unlinkButton.disabled = false;
    setStatus(
      'linked',
      result.status === 'updated'
        ? '페이지 간 연결을 현재 페이지의 확정 영역으로 수정했습니다. 기존 CBT 상태는 바꾸지 않았습니다.'
        : '페이지 간 연결을 확정했습니다. 기존 CBT 상태는 바꾸지 않았습니다.',
    );
  });

  unlinkButton.addEventListener('click', () => {
    const source = selectedSource();
    if (!source) {
      setStatus('error', messageForCode('SOURCE_NOT_FOUND'));
      return;
    }
    const result = store.unlink(source.question);
    if (result.status !== 'unlinked') {
      setStatus('error', messageForCode(result.code));
      return;
    }
    unlinkButton.disabled = true;
    setStatus(
      'idle',
      '페이지 간 연결을 해제했습니다. 원래 문제와 각 페이지의 CBT 상태는 유지합니다.',
    );
  });

  sourceInput.addEventListener('change', refresh);
  return Object.freeze({
    enabled: true,
    resetDocument() {
      store.clearDocument();
      sourceInput.value = '';
      unlinkButton.disabled = true;
      section.hidden = true;
      setStatus(
        'idle',
        '문제 페이지와 다른 페이지의 확정 영역을 연결할 수 있습니다.',
      );
    },
    refresh,
    getLink(question) {
      return store.getLink(question);
    },
  });
}
