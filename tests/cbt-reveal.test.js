import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CBT_REVEAL_CONTRACT_VERSION,
  createCbtRevealStore,
} from '../src/cbt/cbt-reveal.js';

const mask = Object.freeze({
  questionId: 'question-one',
  documentRevision: 7,
  pageNumber: 3,
});

const lockedSelection = Object.freeze({
  questionId: 'question-one',
  documentRevision: 7,
  selectedChoice: 4,
  selectionStatus: 'locked',
});

test('reveals only a matching locked Question and keeps that page state for revisit', () => {
  const store = createCbtRevealStore();
  assert.equal(
    store.reveal({
      mask,
      selection: { ...lockedSelection, selectionStatus: 'selected' },
    }).code,
    'CHOICE_NOT_CONFIRMED',
  );
  assert.equal(
    store.reveal({
      mask,
      selection: { ...lockedSelection, questionId: 'question-two' },
    }).code,
    'REVEAL_CONTEXT_MISMATCH',
  );
  const result = store.reveal({ mask, selection: lockedSelection });
  assert.equal(result.status, 'revealed');
  assert.deepEqual(result.reveal, {
    contractVersion: CBT_REVEAL_CONTRACT_VERSION,
    questionId: 'question-one',
    documentRevision: 7,
    pageNumber: 3,
  });
  assert.deepEqual(store.getReveal(mask), result.reveal);
  assert.equal(
    store.getReveal({ ...mask, pageNumber: 4 }),
    null,
    'another page never inherits this Question reveal',
  );
  assert.equal(
    store.reveal({ mask, selection: lockedSelection }).status,
    'already-revealed',
  );
  store.clearQuestion(mask);
  assert.equal(store.getReveal(mask), null);
  store.reveal({ mask, selection: lockedSelection });
  store.resetDocument();
  assert.equal(store.getReveal(mask), null);
});
