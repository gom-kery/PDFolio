import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCbtMaskReadiness } from '../src/cbt/cbt-mask.js';

const rendered = Object.freeze({
  documentRevision: 4,
  pageNumber: 2,
  scale: 1,
  page: {
    viewBox: [0, 0, 300, 400],
    userUnit: 1,
    rotation: 0,
  },
});

function confirmedSetup({ revision = 4, pageNumber = 2 } = {}) {
  const question = {
    contractVersion: 1,
    questionId: 'question-opaque',
    documentId: 'document-opaque',
    documentRevision: revision,
    sourceKind: 'manual-page-single-v1',
    pageRefs: [pageNumber],
    regionIds: ['region-solution', 'region-answer'],
    choiceCount: 4,
    setupStatus: 'confirmed',
  };
  return {
    question,
    regions: [
      {
        contractVersion: 1,
        regionId: 'region-solution',
        questionId: question.questionId,
        documentRevision: revision,
        pageNumber,
        kind: 'solution',
        coordinateSpace: 'pdf-user-space',
        rect: {
          coordinateSpace: 'pdf-user-space',
          x: 24,
          y: 44,
          width: 160,
          height: 70,
        },
        source: 'manual',
        confirmation: 'confirmed',
      },
      {
        contractVersion: 1,
        regionId: 'region-answer',
        questionId: question.questionId,
        documentRevision: revision,
        pageNumber,
        kind: 'answer',
        coordinateSpace: 'pdf-user-space',
        rect: {
          coordinateSpace: 'pdf-user-space',
          x: 24,
          y: 144,
          width: 100,
          height: 40,
        },
        source: 'manual',
        confirmation: 'confirmed',
      },
    ],
  };
}

test('only a matching confirmed page-single setup can create a CBT mask', () => {
  const confirmation = confirmedSetup();
  const result = getCbtMaskReadiness({ rendered, confirmation });
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.mask, {
    contractVersion: 1,
    questionId: 'question-opaque',
    documentRevision: 4,
    pageNumber: 2,
    coordinateSpace: 'pdf-user-space',
    regions: [
      {
        kind: 'solution',
        rect: {
          coordinateSpace: 'pdf-user-space',
          x: 24,
          y: 44,
          width: 160,
          height: 70,
        },
      },
      {
        kind: 'answer',
        rect: {
          coordinateSpace: 'pdf-user-space',
          x: 24,
          y: 144,
          width: 100,
          height: 40,
        },
      },
    ],
  });
  confirmation.regions[0].rect.x = 999;
  assert.equal(result.mask.regions[0].rect.x, 24);
});

test('missing, stale, incomplete and overlapping setup evidence remains fully blocked', () => {
  assert.deepEqual(getCbtMaskReadiness({ rendered }), {
    status: 'blocked',
    code: 'NO_CONFIRMED_SETUP',
  });
  assert.deepEqual(
    getCbtMaskReadiness({
      rendered,
      confirmation: confirmedSetup({ revision: 3 }),
    }),
    { status: 'blocked', code: 'INVALID_CONFIRMED_SETUP' },
  );
  const incomplete = confirmedSetup();
  incomplete.regions.pop();
  assert.deepEqual(
    getCbtMaskReadiness({ rendered, confirmation: incomplete }),
    {
      status: 'blocked',
      code: 'INVALID_CONFIRMED_SETUP',
    },
  );
  const overlapping = confirmedSetup();
  overlapping.regions[1].rect.y = 90;
  assert.deepEqual(
    getCbtMaskReadiness({ rendered, confirmation: overlapping }),
    {
      status: 'blocked',
      code: 'INVALID_CONFIRMED_SETUP',
    },
  );
});

test('a not-yet-rendered page never exposes a confirmed setup', () => {
  assert.deepEqual(
    getCbtMaskReadiness({
      confirmation: confirmedSetup(),
    }),
    { status: 'blocked', code: 'RENDER_NOT_READY' },
  );
});
