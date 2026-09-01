import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createPageTextCoordinates,
  DEFAULT_FONT_ASCENT,
  DEFAULT_FONT_DESCENT,
} from '../src/analysis/page-text-coordinates.js';
import {
  convertPdfPointToViewport,
  convertViewportPointToPdf,
  createViewportGeometry,
  projectPdfRectToViewport,
} from '../src/pdf/pdf-coordinate-space.js';

function textItem(overrides = {}) {
  return {
    sourceIndex: 0,
    sourceText: '좌표',
    direction: 'ltr',
    transform: [10, 0, 0, 10, 15, 25],
    width: 40,
    height: 10,
    fontName: 'font-1',
    hasEOL: false,
    ...overrides,
  };
}

function textSource({ items, styles, page } = {}) {
  const sourceItems = items ?? [textItem()];
  return {
    contractVersion: 1,
    documentRevision: 3,
    pageNumber: 2,
    pageCount: 4,
    language: 'ko',
    page: page ?? { viewBox: [10, 20, 210, 320], userUnit: 2, rotation: 0 },
    items: sourceItems,
    styles:
      styles ??
      (sourceItems.length
        ? [
            {
              fontName: 'font-1',
              ascent: 0.8,
              descent: -0.2,
              vertical: false,
              fontFamily: 'sans-serif',
            },
          ]
        : []),
  };
}

function assertClose(actual, expected, epsilon = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

test('creates the TextItemRecord contract in unrotated PDF user space', () => {
  const source = textSource();
  const result = createPageTextCoordinates(source);
  assert.equal(result.status, 'coordinates-ready');
  assert.deepEqual(result.coordinates, {
    contractVersion: 1,
    sourceContractVersion: 1,
    documentRevision: 3,
    pageNumber: 2,
    coordinateSpace: 'pdf-user-space',
    page: { viewBox: [10, 20, 210, 320], userUnit: 2, rotation: 0 },
    items: [
      {
        sourceIndex: 0,
        text: '좌표',
        x: 15,
        y: 23,
        width: 40,
        height: 10,
        page: 2,
      },
    ],
  });
  assert.ok(!Object.hasOwn(result.coordinates.items[0], 'transform'));
  assert.ok(!Object.hasOwn(result.coordinates, 'path'));

  source.page.viewBox[0] = -999;
  assert.equal(result.coordinates.page.viewBox[0], 10);
});

test('uses all transformed font-box corners for rotated and reflected text', () => {
  const rotated = createPageTextCoordinates(
    textSource({
      items: [textItem({ transform: [0, 10, -10, 0, 100, 50] })],
    }),
  );
  assert.equal(rotated.status, 'coordinates-ready');
  assert.deepEqual(rotated.coordinates.items[0], {
    sourceIndex: 0,
    text: '좌표',
    x: 92,
    y: 50,
    width: 10,
    height: 40,
    page: 2,
  });

  const reflected = createPageTextCoordinates(
    textSource({
      items: [textItem({ transform: [-10, 0, 0, 10, 100, 50] })],
    }),
  );
  assert.equal(reflected.status, 'coordinates-ready');
  assert.deepEqual(reflected.coordinates.items[0], {
    sourceIndex: 0,
    text: '좌표',
    x: 60,
    y: 48,
    width: 40,
    height: 10,
    page: 2,
  });
});

test('creates a conservative vertical-writing box and preserves zero advance', () => {
  const verticalStyle = [
    {
      fontName: 'font-1',
      ascent: 0.8,
      descent: -0.2,
      vertical: true,
      fontFamily: 'serif',
    },
  ];
  const vertical = createPageTextCoordinates(
    textSource({
      items: [
        textItem({
          direction: 'ttb',
          transform: [10, 0, 0, 10, 100, 100],
          width: 10,
          height: 30,
        }),
      ],
      styles: verticalStyle,
    }),
  );
  assert.equal(vertical.status, 'coordinates-ready');
  assert.deepEqual(vertical.coordinates.items[0], {
    sourceIndex: 0,
    text: '좌표',
    x: 98,
    y: 70,
    width: 10,
    height: 30,
    page: 2,
  });

  const emptyAdvance = createPageTextCoordinates(
    textSource({ items: [textItem({ sourceText: '', width: 0 })] }),
  );
  assert.equal(emptyAdvance.status, 'coordinates-ready');
  assert.equal(emptyAdvance.coordinates.items[0].width, 0);
  assert.equal(emptyAdvance.coordinates.items[0].height, 10);
});

test('uses named fallback font metrics only when both metrics are zero', () => {
  const result = createPageTextCoordinates(
    textSource({
      styles: [
        {
          fontName: 'font-1',
          ascent: 0,
          descent: 0,
          vertical: false,
          fontFamily: 'sans-serif',
        },
      ],
    }),
  );
  assert.equal(result.status, 'coordinates-ready');
  assert.equal(DEFAULT_FONT_ASCENT, 0.8);
  assert.equal(DEFAULT_FONT_DESCENT, -0.2);
  assert.equal(result.coordinates.items[0].y, 23);
  assert.equal(result.coordinates.items[0].height, 10);
});

test('returns public failure codes instead of partial coordinate records', () => {
  assert.deepEqual(createPageTextCoordinates({ pageNumber: 1 }), {
    status: 'error',
    code: 'INVALID_TEXT_SOURCE',
  });

  const badPage = createPageTextCoordinates(
    textSource({
      page: { viewBox: [0, 0, 0, 100], userUnit: 1, rotation: 0 },
    }),
  );
  assert.equal(badPage.status, 'unsupported');
  assert.equal(badPage.code, 'UNSUPPORTED_PAGE_GEOMETRY');

  const badMetrics = createPageTextCoordinates(
    textSource({
      styles: [
        {
          fontName: 'font-1',
          ascent: -0.2,
          descent: 0.8,
          vertical: false,
          fontFamily: 'sans-serif',
        },
      ],
    }),
  );
  assert.equal(badMetrics.code, 'UNSUPPORTED_FONT_METRICS');

  const badGeometry = createPageTextCoordinates(
    textSource({ items: [textItem({ transform: [0, 0, 0, 0, 15, 25] })] }),
  );
  assert.equal(badGeometry.code, 'UNSUPPORTED_TEXT_GEOMETRY');
  assert.ok(!Object.hasOwn(badGeometry, 'items'));
});

test('empty TextContent has a valid empty coordinate result', () => {
  const result = createPageTextCoordinates(textSource({ items: [] }));
  assert.equal(result.status, 'coordinates-ready');
  assert.deepEqual(result.coordinates.items, []);
});

test('matches the PDF.js viewport convention for offsets, userUnit and rotation', () => {
  const viewBox = [10, 20, 210, 320];
  const expectedCorners = new Map([
    [
      0,
      [
        [0, 900],
        [600, 0],
      ],
    ],
    [
      90,
      [
        [0, 0],
        [900, 600],
      ],
    ],
    [
      180,
      [
        [600, 0],
        [0, 900],
      ],
    ],
    [
      270,
      [
        [900, 600],
        [0, 0],
      ],
    ],
  ]);

  for (const rotation of [0, 90, 180, 270]) {
    const viewport = createViewportGeometry(
      { viewBox, userUnit: 2, rotation },
      { scale: 1.5 },
    );
    const [low, high] = expectedCorners.get(rotation);
    assert.deepEqual(convertPdfPointToViewport(viewport, 10, 20), low);
    assert.deepEqual(convertPdfPointToViewport(viewport, 210, 320), high);
    const roundTrip = convertViewportPointToPdf(viewport, ...high);
    assertClose(roundTrip[0], 210);
    assertClose(roundTrip[1], 320);
    assert.equal(viewport.width, rotation % 180 === 0 ? 600 : 900);
    assert.equal(viewport.height, rotation % 180 === 0 ? 900 : 600);
  }
});

test('projects PDF boxes in CSS pixels without a Canvas device-pixel ratio', () => {
  const page = { viewBox: [0, 0, 200, 100], userUnit: 1, rotation: 90 };
  const rect = { x: 20, y: 10, width: 40, height: 15 };
  const oneX = projectPdfRectToViewport(
    createViewportGeometry(page, { scale: 1 }),
    rect,
  );
  const twoX = projectPdfRectToViewport(
    createViewportGeometry(page, { scale: 2 }),
    rect,
  );
  assert.deepEqual(oneX, {
    coordinateSpace: 'viewport-css-px',
    x: 10,
    y: 20,
    width: 15,
    height: 40,
  });
  assert.deepEqual(twoX, {
    coordinateSpace: 'viewport-css-px',
    x: 20,
    y: 40,
    width: 30,
    height: 80,
  });
  assert.ok(!Object.hasOwn(oneX, 'devicePixelRatio'));
});

test('rejects invalid viewport inputs and non-right-angle page rotation', () => {
  assert.throws(
    () =>
      createViewportGeometry({
        viewBox: [0, 0, 100, 100],
        userUnit: 1,
        rotation: 45,
      }),
    /rotation/,
  );
  assert.throws(
    () =>
      createViewportGeometry(
        { viewBox: [0, 0, 100, 100], userUnit: 1, rotation: 0 },
        { scale: 0 },
      ),
    /scale/,
  );
  assert.throws(
    () =>
      createViewportGeometry(
        {
          viewBox: [0, 0, Number.MAX_VALUE, 100],
          userUnit: Number.MAX_VALUE,
          rotation: 0,
        },
        { scale: 2 },
      ),
    /finite/,
  );
});
