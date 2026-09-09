import { getCbtMaskReadiness } from '../cbt/cbt-mask.js';
import {
  createChoiceSelectionStore,
  SUPPORTED_CHOICE_COUNTS,
} from '../cbt/choice-selection.js';

function createChoiceOption(document, number, selected) {
  const label = document.createElement('label');
  label.className = 'choice-option';
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = 'answer-choice';
  input.value = String(number);
  input.checked = selected === number;
  const text = document.createElement('span');
  text.textContent = `${number}번`;
  label.append(input, text);
  return label;
}

/** Render the Unit 3.4 single-choice confirmation and reveal handoff. */
export function initializeChoiceSelection(
  document,
  {
    disabled = false,
    onConfirmed = () => {},
    onChanged = () => {},
    isRevealed = () => false,
  } = {},
) {
  const section = document.querySelector('#choice-selection');
  const status = document.querySelector('#choice-selection-status');
  const countControls = document.querySelector('#choice-count-controls');
  const options = document.querySelector('#choice-options');
  const confirmButton = document.querySelector('#confirm-choice');
  const store = createChoiceSelectionStore();
  let activeQuestion = null;

  const hide = () => {
    section.hidden = true;
    delete section.dataset.questionId;
  };

  if (disabled) {
    hide();
    return Object.freeze({ sync() {}, resetDocument() {} });
  }

  const render = (selection, message) => {
    section.hidden = false;
    section.dataset.questionId = selection.questionId;
    section.dataset.choiceCount = String(selection.choiceCount);
    section.dataset.selectedChoice = String(selection.selectedChoice ?? '');
    section.dataset.selectionStatus = selection.selectionStatus;
    status.textContent = message;
    const isLocked = selection.selectionStatus === 'locked';
    const revealed = isLocked && isRevealed(selection);
    for (const input of countControls.querySelectorAll('input')) {
      input.checked = Number(input.value) === selection.choiceCount;
      input.disabled = isLocked;
    }
    options.replaceChildren(
      ...Array.from({ length: selection.choiceCount }, (_, index) =>
        createChoiceOption(document, index + 1, selection.selectedChoice),
      ),
    );
    for (const input of options.querySelectorAll('input'))
      input.disabled = isLocked;
    confirmButton.disabled =
      isLocked || selection.selectionStatus !== 'selected';
    confirmButton.textContent = isLocked
      ? revealed
        ? '해설·정답 공개됨'
        : '답 선택 확정됨'
      : '답 확인';
  };

  const showActiveQuestion = (question) => {
    const result = store.syncQuestion(question);
    if (result.status !== 'ready') {
      hide();
      return;
    }
    activeQuestion = {
      questionId: question.questionId,
      documentRevision: question.documentRevision,
    };
    const { selection } = result;
    render(
      selection,
      selection.selectionStatus === 'locked'
        ? isRevealed(selection)
          ? `${selection.selectedChoice}번 선택을 확정했고 해설과 정답을 공개했습니다. 채점은 아직 하지 않습니다.`
          : `${selection.selectedChoice}번 선택을 확정했습니다. 해설과 정답을 아직 공개하지 않았습니다.`
        : selection.selectedChoice === null
          ? '보기 수를 고르고 답을 하나 선택하세요. 답 확인 전까지 선택을 바꿀 수 있습니다.'
          : `${selection.selectedChoice}번을 선택했습니다. 답 확인 전까지 선택을 바꿀 수 있습니다.`,
    );
  };

  const invalidateActiveQuestion = () => {
    if (activeQuestion) store.clearQuestion(activeQuestion);
    activeQuestion = null;
  };

  countControls.addEventListener('change', (event) => {
    if (!activeQuestion || !(event.target instanceof HTMLInputElement)) return;
    const result = store.configureChoiceCount({
      ...activeQuestion,
      choiceCount: Number(event.target.value),
    });
    if (result.status === 'ready')
      render(
        result.selection,
        '보기 수를 변경해 이전 선택을 지웠습니다. 답을 다시 선택하세요.',
      );
    if (result.status === 'ready') onChanged(result.selection);
  });

  options.addEventListener('change', (event) => {
    if (!activeQuestion || !(event.target instanceof HTMLInputElement)) return;
    const result = store.selectChoice({
      ...activeQuestion,
      choiceNumber: Number(event.target.value),
    });
    if (result.status === 'ready')
      render(
        result.selection,
        `${result.selection.selectedChoice}번을 선택했습니다. 답 확인 전까지 선택을 바꿀 수 있습니다.`,
      );
  });

  confirmButton.addEventListener('click', () => {
    if (!activeQuestion) return;
    const result = store.confirmChoice(activeQuestion);
    if (result.status === 'confirmed') {
      onConfirmed(result.selection);
      render(
        result.selection,
        isRevealed(result.selection)
          ? `${result.selection.selectedChoice}번 선택을 확정했고 해설과 정답을 공개했습니다. 채점은 아직 하지 않습니다.`
          : `${result.selection.selectedChoice}번 선택을 확정했습니다. 해설과 정답을 아직 공개하지 않았습니다.`,
      );
    }
  });

  return Object.freeze({
    sync({ rendered, confirmation, setupActive } = {}) {
      if (setupActive) {
        invalidateActiveQuestion();
        hide();
        return;
      }
      const readiness = getCbtMaskReadiness({ rendered, confirmation });
      if (readiness.status !== 'ready') {
        activeQuestion = null;
        hide();
        return;
      }
      showActiveQuestion(confirmation.question);
    },
    resetDocument() {
      activeQuestion = null;
      store.resetDocument();
      hide();
    },
    getActiveSelection() {
      return activeQuestion ? store.getSelection(activeQuestion) : null;
    },
  });
}
