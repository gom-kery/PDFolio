import { createQuestionNavigationStore } from '../cbt/question-navigation.js';

function linkedPageSummary(pageRefs) {
  const linkedPages = [
    ...new Set(
      pageRefs
        .filter((pageRef) => pageRef.role !== 'prompt')
        .map((pageRef) => pageRef.pageNumber),
    ),
  ];
  return linkedPages.length > 0
    ? ` · 연결 ${linkedPages.join(', ')}페이지`
    : '';
}

/** Keep Question navigation distinct from the ordinary PDF page controls. */
export function initializeQuestionNavigation(
  document,
  { disabled = false, onNavigate = () => {} } = {},
) {
  const section = document.querySelector('#question-navigation');
  const status = document.querySelector('#question-navigation-status');
  const previousButton = document.querySelector('#previous-question');
  const nextButton = document.querySelector('#next-question');
  const store = createQuestionNavigationStore();

  if (disabled) {
    section.hidden = true;
    return Object.freeze({
      enabled: false,
      reset() {},
      sync() {},
      getActiveQuestion: () => null,
    });
  }

  const render = (state, { setupActive = false } = {}) => {
    section.hidden = state.items.length === 0;
    if (section.hidden) return;
    const active = state.activeQuestion;
    previousButton.disabled = setupActive || !state.canGoPrevious;
    nextButton.disabled = setupActive || !state.canGoNext;
    if (!active) {
      status.textContent =
        '현재 페이지에 확정된 문제가 없습니다. 페이지 이동과 문제 이동은 별도입니다.';
      return;
    }
    status.textContent = `문제 ${state.activeIndex + 1} / ${state.items.length} · ${active.promptPageNumber}페이지${linkedPageSummary(active.pageRefs)}`;
  };

  const move = (direction) => {
    const result = store.move(direction);
    if (result.status !== 'active') return;
    render(result.state);
    onNavigate(result.state.activeQuestion);
  };

  previousButton.addEventListener('click', () => move(-1));
  nextButton.addEventListener('click', () => move(1));

  return Object.freeze({
    enabled: true,
    reset() {
      store.reset();
      section.hidden = true;
      status.textContent =
        '확정된 문제가 생기면 문제 단위로 이동할 수 있습니다.';
    },
    sync({
      revision,
      confirmations,
      getLink,
      pageNumber,
      setupActive = false,
    }) {
      const synced = store.sync({ revision, confirmations, getLink });
      if (synced.status !== 'ready') {
        section.hidden = true;
        return synced;
      }
      const active = store.activateForPage(pageNumber);
      const state = active.state || store.getState();
      render(state, { setupActive });
      return { status: active.status, state };
    },
    getActiveQuestion() {
      return store.getState().activeQuestion;
    },
  });
}
