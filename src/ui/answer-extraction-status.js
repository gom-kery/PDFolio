import { extractManualAnswerValue } from '../cbt/answer-extraction.js';

function getAnswerRegion(confirmation) {
  return confirmation?.regions?.find((region) => region.kind === 'answer');
}

/** Keep Unit 3.5 extraction evidence private until the current answer is revealed. */
export function initializeAnswerExtractionStatus(
  document,
  { disabled = false } = {},
) {
  const section = document.querySelector('.answer-extraction-status-section');
  const status = document.querySelector('#answer-extraction-status');

  const hide = () => {
    section.hidden = true;
    delete status.dataset.state;
    delete status.dataset.reasonCodes;
    status.textContent = '';
  };

  if (disabled) {
    hide();
    return Object.freeze({ reset() {}, sync() {} });
  }

  return Object.freeze({
    reset: hide,
    sync({ confirmation, analysis, revealed = false } = {}) {
      const answerRegion = getAnswerRegion(confirmation);
      if (!confirmation?.question || !answerRegion) {
        hide();
        return;
      }
      section.hidden = false;
      if (!analysis?.source || !analysis?.coordinates) {
        status.dataset.state = 'waiting';
        delete status.dataset.reasonCodes;
        status.textContent = '정답 영역의 텍스트를 확인하고 있습니다.';
        return;
      }
      const result = extractManualAnswerValue({
        source: analysis.source,
        coordinates: analysis.coordinates,
        question: confirmation.question,
        answerRegion,
      });
      if (result.status === 'error') {
        status.dataset.state = 'unknown';
        status.dataset.reasonCodes = result.code;
        status.textContent = '정답 영역의 값을 확인할 수 없습니다.';
        return;
      }
      status.dataset.state = result.status;
      status.dataset.reasonCodes = result.reasonCodes.join(' ');
      if (result.status === 'known') {
        status.textContent = revealed
          ? `정답 영역에서 ${result.value}번 값을 추출했습니다. 채점은 아직 하지 않습니다.`
          : '정답 값을 확인했습니다. 답 확인 전에는 값과 채점 결과를 표시하지 않습니다.';
      } else if (result.status === 'ambiguous') {
        status.textContent =
          '정답 영역에서 여러 값을 찾아 정답을 확정하지 않았습니다.';
      } else if (
        result.reasonCodes.includes('ANSWER_VALUE_EXCEEDS_CHOICE_COUNT')
      ) {
        status.textContent =
          '정답 값과 현재 보기 수가 맞지 않아 정답을 확정하지 않았습니다.';
      } else if (
        result.reasonCodes.includes('ANSWER_VALUE_OUT_OF_SUPPORTED_RANGE')
      ) {
        status.textContent =
          '정답 영역의 값이 지원 범위(1~5)를 벗어나 정답을 확정하지 않았습니다.';
      } else {
        status.textContent =
          '정답 영역에서 지원되는 단일 정답 값을 찾지 못했습니다.';
      }
    },
  });
}
