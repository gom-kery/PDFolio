import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MANUAL_REGION_SETUP_CONTRACT_VERSION,
  MANUAL_REGION_SOURCE,
  createManualRegionSetupStore,
  createPdfRectFromViewportDrag,
  validateManualRegionRects,
} from '../src/cbt/manual-region-setup.js';
import {
  createViewportGeometry,
  projectPdfRectToViewport,
} from '../src/pdf/pdf-coordinate-space.js';

const page = Object.freeze({
  viewBox: [10, 20, 210, 320],
  userUnit: 2,
  rotation: 0,
});

function pdfRect(x, y, width, height) {
  return { coordinateSpace: 'pdf-user-space', x, y, width, height };
}

function deterministicIds() {
  let sequence = 0;
  return (prefix) => `${prefix}-opaque-${++sequence}`;
}

test('round-trips manual rectangles through every supported viewport rotation', () => {
  const expected = pdfRect(40, 70, 80, 50);
  for (const rotation of [0, 90, 180, 270]) {
    const rotatedPage = { ...page, rotation };
    const viewport = createViewportGeometry(rotatedPage, { scale: 1.5 });
    const projected = projectPdfRectToViewport(viewport, expected);
    const result = createPdfRectFromViewportDrag({
      viewport,
      page: rotatedPage,
      start: { x: projected.x, y: projected.y },
      end: {
        x: projected.x + projected.width,
        y: projected.y + projected.height,
      },
    });
    assert.equal(result.status, 'ready');
    assert.deepEqual(result.rect, expected);
  }
});

test('rejects tiny, invalid and out-of-page Region geometry', () => {
  const viewport = createViewportGeometry(page, { scale: 1 });
  assert.equal(
    createPdfRectFromViewportDrag({
      viewport,
      page,
      start: { x: 10, y: 10 },
      end: { x: 15, y: 40 },
    }).code,
    'REGION_TOO_SMALL',
  );
  assert.equal(
    validateManualRegionRects({
      page,
      rects: {
        solution: pdfRect(0, 70, 80, 50),
        answer: pdfRect(40, 140, 80, 30),
      },
    }).code,
    'REGION_OUT_OF_PAGE',
  );
  assert.equal(
    validateManualRegionRects({
      page,
      rects: {
        solution: pdfRect(40, 70, 80, 50),
        answer: pdfRect(100, 100, 50, 30),
      },
    }).code,
    'REGIONS_OVERLAP',
  );
  assert.equal(
    validateManualRegionRects({
      page,
      rects: { solution: pdfRect(40, 70, 80, 50) },
    }).code,
    'REGIONS_INCOMPLETE',
  );
});

test('requires preview and creates one owned solution and answer Region', () => {
  const store = createManualRegionSetupStore({
    createId: deterministicIds(),
  });
  assert.equal(
    store.begin({ pageNumber: 1, page }).code,
    'INVALID_SETUP_CONTEXT',
  );
  assert.equal(
    store.openDocument({
      documentId: 'document-opaque',
      documentRevision: 7,
    }).status,
    'ready',
  );
  assert.equal(store.begin({ pageNumber: 2, page }).status, 'editing');
  assert.equal(
    store.setRect('solution', pdfRect(40, 70, 80, 50)).status,
    'editing',
  );
  assert.equal(store.preview().code, 'REGIONS_INCOMPLETE');
  assert.equal(
    store.setRect('answer', pdfRect(40, 140, 80, 30)).status,
    'editing',
  );
  assert.equal(store.confirm().code, 'PREVIEW_REQUIRED');
  assert.equal(store.preview().status, 'preview');
  const confirmed = store.confirm();
  assert.equal(confirmed.status, 'confirmed');
  const { question, regions } = confirmed.confirmation;
  assert.equal(question.contractVersion, MANUAL_REGION_SETUP_CONTRACT_VERSION);
  assert.equal(question.documentId, 'document-opaque');
  assert.equal(question.documentRevision, 7);
  assert.equal(question.sourceKind, MANUAL_REGION_SOURCE);
  assert.deepEqual(question.pageRefs, [2]);
  assert.equal(question.choiceCount, 4);
  assert.equal(question.setupStatus, 'confirmed');
  assert.equal(regions.length, 2);
  assert.deepEqual(
    regions.map((region) => region.kind),
    ['solution', 'answer'],
  );
  for (const region of regions) {
    assert.equal(region.questionId, question.questionId);
    assert.equal(region.documentRevision, 7);
    assert.equal(region.pageNumber, 2);
    assert.equal(region.coordinateSpace, 'pdf-user-space');
    assert.equal(region.source, 'manual');
    assert.equal(region.confirmation, 'confirmed');
  }
  assert.deepEqual(
    question.regionIds,
    regions.map((region) => region.regionId),
  );
  assert.equal(new Set([question.questionId, ...question.regionIds]).size, 3);
});

test('cancel preserves a prior confirmation and reconfirming replaces its IDs', () => {
  const store = createManualRegionSetupStore({
    createId: deterministicIds(),
  });
  store.openDocument({ documentId: 'document-a', documentRevision: 1 });
  store.begin({ pageNumber: 1, page });
  store.setRect('solution', pdfRect(30, 60, 70, 40));
  store.setRect('answer', pdfRect(30, 120, 70, 30));
  store.preview();
  const first = store.confirm().confirmation;

  store.begin({ pageNumber: 1, page });
  store.setRect('answer', pdfRect(40, 180, 60, 30));
  assert.equal(store.cancel().status, 'canceled');
  assert.deepEqual(store.getConfirmation(1), first);

  store.begin({ pageNumber: 1, page });
  store.setRect('answer', pdfRect(40, 180, 60, 30));
  store.preview();
  const second = store.confirm().confirmation;
  assert.notEqual(second.question.questionId, first.question.questionId);
  assert.notDeepEqual(second.question.regionIds, first.question.regionIds);
  assert.deepEqual(second.regions[1].rect, pdfRect(40, 180, 60, 30));
});

test('page changes cancel only drafts and document replacement clears confirmations', () => {
  const store = createManualRegionSetupStore({
    createId: deterministicIds(),
  });
  store.openDocument({ documentId: 'document-a', documentRevision: 1 });
  store.begin({ pageNumber: 1, page });
  store.setRect('solution', pdfRect(30, 60, 70, 40));
  assert.equal(store.leavePage(2).status, 'canceled');
  assert.equal(store.getDraft(), null);

  store.begin({ pageNumber: 1, page });
  store.setRect('solution', pdfRect(30, 60, 70, 40));
  store.setRect('answer', pdfRect(30, 120, 70, 30));
  store.preview();
  store.confirm();
  assert.ok(store.getConfirmation(1));
  store.openDocument({ documentId: 'document-b', documentRevision: 2 });
  assert.equal(store.getConfirmation(1), null);
  assert.deepEqual(store.getDocumentContext(), {
    documentId: 'document-b',
    documentRevision: 2,
  });
});
