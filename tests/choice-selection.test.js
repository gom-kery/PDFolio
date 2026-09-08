import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHOICE_SELECTION_CONTRACT_VERSION,
  createChoiceSelectionStore,
} from '../src/cbt/choice-selection.js';

const question = Object.freeze({
  questionId: 'question-one',
  documentRevision: 7,
  choiceCount: 4,
});

test('starts with the confirmed Question choice count and stores one selection only in memory', () => {
  const store = createChoiceSelectionStore();
  const opened = store.syncQuestion(question);
  assert.equal(opened.status, 'ready');
  assert.deepEqual(opened.selection, {
    contractVersion: CHOICE_SELECTION_CONTRACT_VERSION,
    questionId: 'question-one',
    documentRevision: 7,
    choiceCount: 4,
    selectedChoice: null,
    selectionStatus: 'unselected',
  });
  assert.equal(
    store.selectChoice({
      questionId: 'question-one',
      documentRevision: 7,
      choiceNumber: 3,
    }).selection.selectedChoice,
    3,
  );
  assert.equal(
    store.selectChoice({
      questionId: 'question-one',
      documentRevision: 7,
      choiceNumber: 1,
    }).selection.selectedChoice,
    1,
  );
  assert.equal(
    store.getSelection({ questionId: 'question-one', documentRevision: 7 })
      .selectedChoice,
    1,
  );
});

test('allows only four or five choices and clears the selected answer when the count changes', () => {
  const store = createChoiceSelectionStore();
  store.syncQuestion(question);
  store.selectChoice({
    questionId: 'question-one',
    documentRevision: 7,
    choiceNumber: 4,
  });
  const configured = store.configureChoiceCount({
    questionId: 'question-one',
    documentRevision: 7,
    choiceCount: 5,
  });
  assert.equal(configured.status, 'ready');
  assert.equal(configured.selection.choiceCount, 5);
  assert.equal(configured.selection.selectedChoice, null);
  assert.equal(configured.selection.selectionStatus, 'unselected');
  assert.equal(
    store.selectChoice({
      questionId: 'question-one',
      documentRevision: 7,
      choiceNumber: 5,
    }).selection.selectedChoice,
    5,
  );
  assert.equal(
    store.configureChoiceCount({
      questionId: 'question-one',
      documentRevision: 7,
      choiceCount: 6,
    }).code,
    'INVALID_CHOICE_COUNT',
  );
  assert.equal(
    store.selectChoice({
      questionId: 'question-one',
      documentRevision: 7,
      choiceNumber: 6,
    }).code,
    'INVALID_CHOICE_NUMBER',
  );
});

test('requires a selected choice, then locks exactly one confirmation without revealing or grading', () => {
  const store = createChoiceSelectionStore();
  store.syncQuestion(question);
  assert.equal(
    store.confirmChoice({
      questionId: 'question-one',
      documentRevision: 7,
    }).code,
    'CHOICE_NOT_SELECTED',
  );
  store.selectChoice({
    questionId: 'question-one',
    documentRevision: 7,
    choiceNumber: 2,
  });
  const confirmed = store.confirmChoice({
    questionId: 'question-one',
    documentRevision: 7,
  });
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.selection.selectedChoice, 2);
  assert.equal(confirmed.selection.selectionStatus, 'locked');
  assert.equal(
    store.selectChoice({
      questionId: 'question-one',
      documentRevision: 7,
      choiceNumber: 3,
    }).code,
    'CHOICE_LOCKED',
  );
  assert.equal(
    store.configureChoiceCount({
      questionId: 'question-one',
      documentRevision: 7,
      choiceCount: 5,
    }).code,
    'CHOICE_LOCKED',
  );
  assert.equal(
    store.confirmChoice({
      questionId: 'question-one',
      documentRevision: 7,
    }).code,
    'CHOICE_ALREADY_CONFIRMED',
  );
});

test('keeps selections separate by Question/revision and clears them on invalidation or document reset', () => {
  const store = createChoiceSelectionStore();
  store.syncQuestion(question);
  store.selectChoice({
    questionId: 'question-one',
    documentRevision: 7,
    choiceNumber: 2,
  });
  store.syncQuestion({
    ...question,
    questionId: 'question-two',
    choiceCount: 5,
  });
  assert.equal(
    store.getSelection({ questionId: 'question-two', documentRevision: 7 })
      .selectedChoice,
    null,
  );
  store.clearQuestion({ questionId: 'question-one', documentRevision: 7 });
  assert.equal(
    store.getSelection({ questionId: 'question-one', documentRevision: 7 }),
    null,
  );
  store.resetDocument();
  assert.equal(
    store.getSelection({ questionId: 'question-two', documentRevision: 7 }),
    null,
  );
  assert.equal(
    store.syncQuestion({ ...question, choiceCount: 3 }).code,
    'INVALID_QUESTION_CONTEXT',
  );
});
