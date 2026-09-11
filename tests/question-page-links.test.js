import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  QUESTION_PAGE_LINK_CONTRACT_VERSION,
  QUESTION_PAGE_LINK_SOURCE,
  createQuestionPageLinkStore,
} from '../src/cbt/question-page-links.js';

const page = Object.freeze({
  viewBox: [0, 0, 300, 400],
  userUnit: 1,
  rotation: 0,
});

function rect(x, y, width, height) {
  return { coordinateSpace: 'pdf-user-space', x, y, width, height };
}

function question(questionId = 'question-a', pageNumber = 1) {
  return {
    contractVersion: 1,
    questionId,
    documentId: 'document-a',
    documentRevision: 2,
    sourceKind: 'manual-page-single-v1',
    setupStatus: 'confirmed',
    pageRefs: [pageNumber],
    regionIds: [`${questionId}-solution`, `${questionId}-answer`],
    choiceCount: 4,
  };
}

function linkedRegions() {
  return [
    { pageNumber: 2, page, kind: 'solution', rect: rect(20, 40, 180, 70) },
    { pageNumber: 3, page, kind: 'answer', rect: rect(20, 160, 80, 35) },
  ];
}

function deterministicIds() {
  let sequence = 0;
  return (prefix) => `${prefix}-${++sequence}`;
}

test('creates one source-owned multi-page link without changing its page-single Question', () => {
  const source = question();
  const sourceBefore = structuredClone(source);
  const store = createQuestionPageLinkStore({ createId: deterministicIds() });
  assert.equal(
    store.openDocument({ documentId: 'document-a', documentRevision: 2 })
      .status,
    'ready',
  );

  const result = store.upsertLink({
    question: source,
    pageRegions: linkedRegions(),
  });
  assert.equal(result.status, 'linked');
  assert.equal(
    result.link.contractVersion,
    QUESTION_PAGE_LINK_CONTRACT_VERSION,
  );
  assert.equal(result.link.sourceKind, QUESTION_PAGE_LINK_SOURCE);
  assert.equal(result.link.questionId, source.questionId);
  assert.deepEqual(result.link.pageRefs, [
    { pageNumber: 1, role: 'prompt' },
    { pageNumber: 2, role: 'solution' },
    { pageNumber: 3, role: 'answer' },
  ]);
  assert.equal(result.link.regionIds.length, 2);
  assert.equal(result.link.regions[0].questionId, source.questionId);
  assert.equal(result.link.regions[1].questionId, source.questionId);
  assert.notDeepEqual(result.link.regionIds, source.regionIds);
  assert.deepEqual(source, sourceBefore);
});

test('replacing or unlinking one Question link leaves another Question link and both source Questions intact', () => {
  const first = question('question-a', 1);
  const second = question('question-b', 4);
  const firstBefore = structuredClone(first);
  const secondBefore = structuredClone(second);
  const store = createQuestionPageLinkStore({ createId: deterministicIds() });
  store.openDocument({ documentId: 'document-a', documentRevision: 2 });
  store.upsertLink({ question: first, pageRegions: linkedRegions() });
  const secondResult = store.upsertLink({
    question: second,
    pageRegions: [
      {
        pageNumber: 5,
        page,
        kind: 'solution',
        rect: rect(20, 40, 160, 60),
      },
      {
        pageNumber: 5,
        page,
        kind: 'answer',
        rect: rect(20, 130, 70, 30),
      },
    ],
  });
  const firstReplacement = store.upsertLink({
    question: first,
    pageRegions: [
      {
        pageNumber: 6,
        page,
        kind: 'solution',
        rect: rect(40, 50, 150, 60),
      },
      {
        pageNumber: 6,
        page,
        kind: 'answer',
        rect: rect(40, 140, 80, 30),
      },
    ],
  });

  assert.equal(secondResult.status, 'linked');
  assert.equal(firstReplacement.status, 'updated');
  assert.equal(store.getLink(first).pageRefs[1].pageNumber, 6);
  assert.equal(store.getLink(second).pageRefs[1].pageNumber, 5);
  assert.equal(store.unlink(first).status, 'unlinked');
  assert.equal(store.getLink(first), null);
  assert.equal(store.getLink(second).questionId, second.questionId);
  assert.deepEqual(first, firstBefore);
  assert.deepEqual(second, secondBefore);
});

test('failed replacement is atomic and stale or same-page links remain blocked', () => {
  const source = question();
  const store = createQuestionPageLinkStore({ createId: deterministicIds() });
  store.openDocument({ documentId: 'document-a', documentRevision: 2 });
  store.upsertLink({ question: source, pageRegions: linkedRegions() });
  const before = store.getLink(source);

  assert.equal(
    store.upsertLink({
      question: source,
      pageRegions: [
        {
          pageNumber: 1,
          page,
          kind: 'solution',
          rect: rect(20, 40, 150, 60),
        },
        {
          pageNumber: 1,
          page,
          kind: 'answer',
          rect: rect(20, 130, 80, 30),
        },
      ],
    }).code,
    'LINK_PAGE_NOT_DIFFERENT',
  );
  assert.deepEqual(store.getLink(source), before);
  assert.equal(
    store.upsertLink({
      question: { ...source, documentRevision: 3 },
      pageRegions: linkedRegions(),
    }).code,
    'STALE_SOURCE_QUESTION',
  );
  assert.equal(
    store.unlink({ questionId: 'missing', documentRevision: 2 }).code,
    'LINK_NOT_FOUND',
  );
});
