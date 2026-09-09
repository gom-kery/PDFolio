function hideStatus(section, status) {
  section.hidden = true;
  delete status.dataset.state;
  delete status.dataset.reasonCodes;
  status.textContent = '';
}

/** Render a Unit 3.6 grade only after the matching answer has been revealed. */
export function initializeGradeStatus(document, { disabled = false } = {}) {
  const section = document.querySelector('.grade-status-section');
  const status = document.querySelector('#grade-status');

  const hide = () => hideStatus(section, status);
  if (disabled) {
    hide();
    return Object.freeze({ reset() {}, sync() {} });
  }

  return Object.freeze({
    reset: hide,
    sync({ selection, grade } = {}) {
      if (selection?.selectionStatus !== 'locked' || !grade) {
        hide();
        return;
      }
      section.hidden = false;
      status.dataset.state = grade.gradeStatus;
      status.dataset.reasonCodes = grade.reasonCodes.join(' ');
      if (grade.gradeStatus === 'correct') {
        status.textContent = `정답입니다. ${grade.selectedChoice}번을 선택했습니다.`;
      } else if (grade.gradeStatus === 'incorrect') {
        status.textContent = `오답입니다. ${grade.selectedChoice}번을 선택했고 정답은 ${grade.answerValue}번입니다.`;
      } else if (grade.reasonCodes.includes('ANSWER_NOT_READY')) {
        status.textContent =
          '정답 분석이 준비되지 않아 채점할 수 없습니다. 이 선택은 자동으로 다시 채점하지 않습니다.';
      } else {
        status.textContent =
          '정답 값을 하나로 확정하지 못해 채점할 수 없습니다.';
      }
    },
  });
}
