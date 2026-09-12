import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createQuestionNavigationStore } from '../src/cbt/question-navigation.js';

function confirmation(questionId, pageNumber) {
  return {
    question: {
      contractVersion: 1,
      questionId,
      documentId: 'document-a',
      documentRevision: 4,
      sourceKind: 'manual-page-single-v1',
      setupStatus: 'confirmed',
      pageRefs: [pageNumber],
      regionIds: [`${questionId}-solution`, `${questionId}-answer`],
      choiceCount: 4,
    },
    regions: [],
  };
}

function pageLink(questionId, promptPageNumber) {
  return {
    contractVersion: 1,
    linkId: `${questionId}-link`,
    questionId,
    documentRevision: 4,
    sourceKind: 'manual-question-page-link-v1',
    linkStatus: 'confirmed',
    pageRefs: [
      { pageNumber: promptPageNumber, role: 'prompt' },
      { pageNumber: 6, role: 'solution' },
      { pageNumber: 7, role: 'answer' },
    ],
  };
}

test('keeps user-confirmed Question order separate from page-number order', () => {
  const secondPageQuestion = confirmation('question-second', 2);
  const firstPageQuestion = confirmation('question-first', 1);
  const store = createQuestionNavigationStore();
  const source = [secondPageQuestion, firstPageQuestion];
  const before = structuredClone(source);

  const synced = store.sync({
    revision: 4,
    confirmations: source,
    getLink: (question) =>
      question.questionId === 'question-second'
        ? pageLink(question.questionId, 2)
        : null,
  });
  assert.equal(synced.status, 'ready');
  assert.deepEqual(
    synced.state.items.map((item) => item.questionId),
    ['question-second', 'question-first'],
  );
  assert.deepEqual(synced.state.items[0].pageRefs, [
    { pageNumber: 2, role: 'prompt' },
    { pageNumber: 6, role: 'solution' },
    { pageNumber: 7, role: 'answer' },
  ]);
  assert.deepEqual(source, before);
});

test('page movement selects only its matching Question and Question movement returns its prompt page', () => {
  const first = confirmation('question-first', 1);
  const second = confirmation('question-second', 2);
  const store = createQuestionNavigationStore();
  store.sync({ revision: 4, confirmations: [first, second] });

  assert.equal(store.activateForPage(1).status, 'active');
  assert.equal(store.getState().activeQuestion.questionId, 'question-first');
  const next = store.move(1);
  assert.equal(next.status, 'active');
  assert.equal(next.state.activeQuestion.questionId, 'question-second');
  assert.equal(next.state.activeQuestion.promptPageNumber, 2);
  assert.equal(store.activateForPage(3).status, 'idle');
  assert.equal(store.getState().activeQuestion, null);
  assert.equal(store.move(1).code, 'NO_ACTIVE_QUESTION');
});

test('removing a Question invalidates only the active navigation target', () => {
  const first = confirmation('question-first', 1);
  const second = confirmation('question-second', 2);
  const store = createQuestionNavigationStore();
  store.sync({ revision: 4, confirmations: [first, second] });
  store.activateQuestion('question-second');

  const result = store.sync({ revision: 4, confirmations: [first] });
  assert.equal(result.status, 'ready');
  assert.equal(result.state.activeQuestion, null);
  assert.equal(result.state.items.length, 1);
  assert.equal(
    store.sync({ revision: 3, confirmations: [first] }).status,
    'ready',
  );
  assert.equal(store.getState().activeQuestion, null);
});
