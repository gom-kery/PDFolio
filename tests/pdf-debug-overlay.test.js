import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPdfDebugOverlayModel } from '../src/pdf/pdf-debug-overlay-model.js';

function coordinateEvidence({ rotation = 0 } = {}) {
  return {
    contractVersion: 1,
    sourceContractVersion: 1,
    documentRevision: 8,
    pageNumber: 2,
    coordinateSpace: 'pdf-user-space',
    page: { viewBox: [0, 0, 200, 100], userUnit: 1, rotation },
    items: [
      {
        sourceIndex: 0,
        text: 'Private question text',
        x: 20,
        y: 60,
        width: 80,
        height: 10,
        page: 2,
      },
      {
        sourceIndex: 1,
        text: 'Answer: B must not enter the overlay model',
        x: 20,
        y: 10,
        width: 40,
        height: 10,
        page: 2,
      },
    ],
  };
}

function keywordEvidence() {
  return {
    contractVersion: 1,
    sourceContractVersion: 1,
    documentRevision: 8,
    pageNumber: 2,
    candidateCount: 1,
    candidates: [
      {
        kind: 'answer-heading',
        sourceIndexes: [1],
      },
    ],
  };
}

function regionEvidence(overrides = {}) {
  return {
    contractVersion: 1,
    sourceContractVersion: 1,
    coordinateContractVersion: 1,
    keywordContractVersion: 1,
    documentRevision: 8,
    pageNumber: 2,
    coordinateSpace: 'pdf-user-space',
    outcome: 'candidate-regions',
    sequence: 'single-answer',
    reasonCodes: ['MISSING_SOLUTION_HEADING', 'NON_TEXT_CONTENT_UNVERIFIED'],
    regionCount: 1,
    regions: [
      {
        kind: 'answer-region',
        bounds: { x: 20, y: 10, width: 40, height: 10, page: 2 },
        textRects: [{ x: 20, y: 10, width: 40, height: 10, page: 2 }],
      },
    ],
    ...overrides,
  };
}

test('projects text, keyword and region evidence without copying PDF text', () => {
  const result = createPdfDebugOverlayModel({
    coordinates: coordinateEvidence(),
    keywordCandidates: keywordEvidence(),
    answerRegions: regionEvidence(),
    scale: 1,
    canvasWidth: 200,
    canvasHeight: 100,
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.model.itemCount, 2);
  assert.equal(result.model.keywordCount, 1);
  assert.equal(result.model.regionCount, 1);
  assert.deepEqual(result.model.layers.textItems[1], {
    sourceIndex: 1,
    rect: { x: 20, y: 80, width: 40, height: 10 },
  });
  assert.deepEqual(result.model.layers.keywordMarks[0].rect, {
    x: 20,
    y: 80,
    width: 40,
    height: 10,
  });
  const serialized = JSON.stringify(result.model);
  assert.ok(!serialized.includes('Private question'));
  assert.ok(!serialized.includes('Answer: B'));
  assert.ok(!Object.hasOwn(result.model.layers.textItems[0], 'text'));
});

test('reprojects CSS geometry when the render scale changes', () => {
  const input = {
    coordinates: coordinateEvidence(),
    keywordCandidates: keywordEvidence(),
    answerRegions: regionEvidence(),
  };
  const oneX = createPdfDebugOverlayModel({
    ...input,
    scale: 1,
    canvasWidth: 200,
    canvasHeight: 100,
  }).model.layers.textItems[1].rect;
  const twoX = createPdfDebugOverlayModel({
    ...input,
    scale: 2,
    canvasWidth: 400,
    canvasHeight: 200,
  }).model.layers.textItems[1].rect;
  assert.deepEqual(twoX, {
    x: oneX.x * 2,
    y: oneX.y * 2,
    width: oneX.width * 2,
    height: oneX.height * 2,
  });
});

test('uses intrinsic page rotation for the overlay viewport', () => {
  const result = createPdfDebugOverlayModel({
    coordinates: coordinateEvidence({ rotation: 90 }),
    keywordCandidates: keywordEvidence(),
    answerRegions: regionEvidence(),
    scale: 1,
    canvasWidth: 100,
    canvasHeight: 200,
  });
  assert.equal(result.model.pageRotation, 90);
  assert.deepEqual(result.model.layers.textItems[1].rect, {
    x: 10,
    y: 20,
    width: 10,
    height: 40,
  });
});

test('keeps uncertain analysis visible as diagnostics without region boxes', () => {
  const result = createPdfDebugOverlayModel({
    coordinates: coordinateEvidence(),
    keywordCandidates: keywordEvidence(),
    answerRegions: regionEvidence({
      outcome: 'uncertain',
      sequence: null,
      reasonCodes: ['POSSIBLE_MULTI_COLUMN_LAYOUT'],
      regionCount: 0,
      regions: [],
    }),
    scale: 1,
    canvasWidth: 200,
    canvasHeight: 100,
  });
  assert.equal(result.model.regionOutcome, 'uncertain');
  assert.deepEqual(result.model.reasonCodes, ['POSSIBLE_MULTI_COLUMN_LAYOUT']);
  assert.deepEqual(result.model.layers.regionBounds, []);
  assert.equal(result.model.layers.keywordMarks.length, 1);
});

test('rejects mismatched or malformed debug evidence with public codes', () => {
  const mismatch = createPdfDebugOverlayModel({
    coordinates: coordinateEvidence(),
    keywordCandidates: { ...keywordEvidence(), pageNumber: 3 },
    answerRegions: regionEvidence(),
    scale: 1,
    canvasWidth: 200,
    canvasHeight: 100,
  });
  assert.deepEqual(mismatch, {
    status: 'error',
    code: 'INVALID_DEBUG_OVERLAY_INPUT',
  });
  assert.deepEqual(createPdfDebugOverlayModel({}), mismatch);
  const wrongRectPage = createPdfDebugOverlayModel({
    coordinates: coordinateEvidence(),
    keywordCandidates: keywordEvidence(),
    answerRegions: regionEvidence({
      regions: [
        {
          kind: 'answer-region',
          bounds: { x: 20, y: 10, width: 40, height: 10, page: 3 },
          textRects: [{ x: 20, y: 10, width: 40, height: 10, page: 3 }],
        },
      ],
    }),
    scale: 1,
    canvasWidth: 200,
    canvasHeight: 100,
  });
  assert.deepEqual(wrongRectPage, mismatch);
  assert.ok(!JSON.stringify(mismatch).includes('Private'));
});
