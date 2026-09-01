import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPdfDropHandler } from '../electron/pdf-drop.js';
import { createPdfInputGate } from '../electron/pdf-input.js';
import { createPdfSelectionHandler } from '../electron/pdf-selection.js';

function harness(overrides = {}) {
  const frame = { url: 'local-cbt://app/index.html' };
  const contents = { mainFrame: frame, isDestroyed: () => false };
  const window = { webContents: contents, isDestroyed: () => false };
  const event = { sender: contents, senderFrame: frame };
  const record = { inspectCalls: 0, values: [] };
  const handler = createPdfDropHandler({
    window,
    rendererUrl: frame.url,
    inspectFile: async (value) => {
      record.inspectCalls++;
      record.values.push(value);
      return {
        status: 'selected',
        document: { name: 'dropped.pdf', sizeBytes: 100 },
      };
    },
    ...overrides,
  });
  return { window, contents, frame, event, record, handler };
}

test('trusted main frame sends one dropped path through the shared PDF inspection boundary', async () => {
  const h = harness();
  assert.deepEqual(await h.handler(h.event, ['C:\\dropped.pdf']), {
    status: 'selected',
    document: { name: 'dropped.pdf', sizeBytes: 100 },
  });
  assert.deepEqual(h.record, {
    inspectCalls: 1,
    values: ['C:\\dropped.pdf'],
  });
});

test('reject foreign frames, malformed arguments and non-string paths before inspection', async () => {
  for (const invoke of [
    (h) => h.handler({ sender: {}, senderFrame: h.frame }, ['C:\\a.pdf']),
    (h) => h.handler(h.event),
    (h) => h.handler(h.event, 'C:\\a.pdf'),
    (h) => h.handler(h.event, [42]),
    (h) => h.handler(h.event, ['C:\\a.pdf'], ['C:\\b.pdf']),
  ]) {
    const h = harness();
    assert.deepEqual(await invoke(h), {
      status: 'error',
      code: 'INVALID_REQUEST',
    });
    assert.equal(h.record.inspectCalls, 0);
  }
});

test('reject empty, pathless and multiple drops without filesystem inspection', async () => {
  for (const [paths, code] of [
    [[], 'NO_FILE_DROPPED'],
    [[''], 'EMPTY_DROP_PATH'],
    [['C:\\a.pdf', 'C:\\b.pdf'], 'ONE_FILE_REQUIRED'],
  ]) {
    const h = harness();
    assert.deepEqual(await h.handler(h.event, paths), {
      status: 'error',
      code,
    });
    assert.equal(h.record.inspectCalls, 0);
  }
});

test('folder and invalid PDF results come from the same Unit 1.1 inspector', async () => {
  for (const [filePath, code] of [
    ['C:\\folder.pdf', 'NOT_A_FILE'],
    ['C:\\renamed.pdf', 'NOT_PDF'],
  ]) {
    const h = harness({
      inspectFile: async (value) => {
        h.record.inspectCalls++;
        h.record.values.push(value);
        return { status: 'error', code };
      },
    });
    assert.deepEqual(await h.handler(h.event, [filePath]), {
      status: 'error',
      code,
    });
    assert.deepEqual(h.record.values, [filePath]);
  }
});

test('filesystem failures are public results and permit a later drop', async () => {
  let attempts = 0;
  const h = harness({
    inspectFile: async () => {
      if (attempts++ === 0)
        throw Object.assign(new Error('C:\\private\\personal.pdf'), {
          code: 'EACCES',
        });
      return {
        status: 'selected',
        document: { name: 'safe.pdf', sizeBytes: 100 },
      };
    },
  });
  assert.deepEqual(await h.handler(h.event, ['C:\\private.pdf']), {
    status: 'error',
    code: 'ACCESS_DENIED',
  });
  assert.equal((await h.handler(h.event, ['C:\\safe.pdf'])).status, 'selected');
});

test('picker and drop share one gate so overlapping input cannot reorder results', async () => {
  let resolveDialog;
  const gate = createPdfInputGate();
  const h = harness({ runExclusive: gate });
  const picker = createPdfSelectionHandler({
    window: h.window,
    rendererUrl: h.frame.url,
    runExclusive: gate,
    showOpenDialog: () =>
      new Promise((resolve) => {
        resolveDialog = resolve;
      }),
    inspectFile: async () => assert.fail('Canceled picker must not inspect'),
  });

  const pending = picker(h.event);
  assert.deepEqual(await h.handler(h.event, ['C:\\dropped.pdf']), {
    status: 'busy',
  });
  assert.equal(h.record.inspectCalls, 0);
  resolveDialog({ canceled: true, filePaths: [] });
  assert.deepEqual(await pending, { status: 'canceled' });
  assert.equal(
    (await h.handler(h.event, ['C:\\dropped.pdf'])).status,
    'selected',
  );
});

test('a destroyed or navigated owner cannot finish a late dropped inspection', async () => {
  for (const close of [true, false]) {
    let resolveInspect;
    const h = harness({
      inspectFile: () =>
        new Promise((resolve) => {
          resolveInspect = resolve;
        }),
    });
    const pending = h.handler(h.event, ['C:\\dropped.pdf']);
    if (close) h.window.isDestroyed = () => true;
    else h.frame.url = 'local-cbt://app/other.html';
    resolveInspect({
      status: 'selected',
      document: { name: 'late.pdf', sizeBytes: 100 },
    });
    assert.deepEqual(await pending, { status: 'canceled' });
  }
});
