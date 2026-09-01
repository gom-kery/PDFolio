import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPdfSelectionHandler } from '../electron/pdf-selection.js';

function harness(overrides = {}) {
  const frame = { url: 'local-cbt://app/index.html' };
  const contents = { mainFrame: frame, isDestroyed: () => false };
  const window = { webContents: contents, isDestroyed: () => false };
  const event = { sender: contents, senderFrame: frame };
  const record = { dialogCalls: 0, inspectCalls: 0 };
  const handler = createPdfSelectionHandler({
    window,
    rendererUrl: frame.url,
    showOpenDialog: async (owner, options) => {
      record.dialogCalls++;
      assert.equal(owner, window);
      assert.deepEqual(options.properties, ['openFile', 'dontAddToRecent']);
      assert.deepEqual(options.filters, [
        { name: 'PDF 문서', extensions: ['pdf'] },
      ]);
      return { canceled: false, filePaths: ['C:\\chosen.pdf'] };
    },
    inspectFile: async (value) => {
      record.inspectCalls++;
      assert.equal(value, 'C:\\chosen.pdf');
      return {
        status: 'selected',
        document: { name: 'chosen.pdf', sizeBytes: 100 },
      };
    },
    ...overrides,
  });
  return { window, contents, frame, event, record, handler };
}

test('trusted main frame can select exactly one file via parented native dialog', async () => {
  const h = harness();
  assert.equal((await h.handler(h.event)).status, 'selected');
  assert.deepEqual(h.record, { dialogCalls: 1, inspectCalls: 1 });
});

test('reject foreign windows, subframes, URL lookalikes, destroyed frame and arguments before dialog', async () => {
  for (const mutate of [
    (h) => {
      h.event.sender = {};
    },
    (h) => {
      h.event.senderFrame = { url: h.frame.url };
    },
    (h) => {
      h.frame.url = 'local-cbt://app.evil/index.html';
    },
    (h) => {
      h.frame.url = 'local-cbt://app/other.html';
    },
    (h) => {
      h.frame.url = 'http://127.0.0.1:5173/';
    },
    (h) => {
      h.window.isDestroyed = () => true;
    },
    (h) => {
      Object.defineProperty(h.event, 'senderFrame', {
        get() {
          throw new Error('disposed');
        },
      });
    },
  ]) {
    const h = harness();
    mutate(h);
    assert.deepEqual(await h.handler(h.event), {
      status: 'error',
      code: 'INVALID_REQUEST',
    });
    assert.equal(h.record.dialogCalls, 0);
  }
  const h = harness();
  assert.equal(
    (await h.handler(h.event, 'C:\\unselected.pdf')).code,
    'INVALID_REQUEST',
  );
  assert.equal(h.record.dialogCalls, 0);
});

test('cancel and invalid multi-file result perform no reads', async () => {
  for (const [selection, expected] of [
    [
      { canceled: true, filePaths: ['C:\\unselected.pdf'] },
      { status: 'canceled' },
    ],
    [
      { canceled: false, filePaths: [] },
      { status: 'error', code: 'ONE_FILE_REQUIRED' },
    ],
    [
      { canceled: false, filePaths: ['a.pdf', 'b.pdf'] },
      { status: 'error', code: 'ONE_FILE_REQUIRED' },
    ],
  ]) {
    const h = harness({ showOpenDialog: async () => selection });
    assert.deepEqual(await h.handler(h.event), expected);
    assert.equal(h.record.inspectCalls, 0);
  }
});

test('concurrent calls open one dialog and release the lock after cancel', async () => {
  let resolve;
  let dialogs = 0;
  const h = harness({
    showOpenDialog: () => {
      dialogs++;
      return new Promise((done) => {
        resolve = done;
      });
    },
  });
  const pending = h.handler(h.event);
  assert.deepEqual(await h.handler(h.event), { status: 'busy' });
  assert.equal(dialogs, 1);
  resolve({ canceled: true });
  assert.deepEqual(await pending, { status: 'canceled' });
  const next = h.handler(h.event);
  assert.equal(dialogs, 2);
  resolve({ canceled: true });
  await next;
});

test('a closed or navigated owner cannot read a late dialog result', async () => {
  for (const close of [true, false]) {
    let resolve;
    const h = harness({
      showOpenDialog: () =>
        new Promise((done) => {
          resolve = done;
        }),
    });
    const pending = h.handler(h.event);
    if (close) h.window.isDestroyed = () => true;
    else h.frame.url = 'local-cbt://app/other.html';
    resolve({ canceled: false, filePaths: ['C:\\chosen.pdf'] });
    assert.deepEqual(await pending, { status: 'canceled' });
    assert.equal(h.record.inspectCalls, 0);
  }
});

test('filesystem failures are handled without exposing private messages and permit retry', async () => {
  for (const [code, expected] of [
    ['EACCES', 'ACCESS_DENIED'],
    ['EPERM', 'ACCESS_DENIED'],
    ['ENOENT', 'FILE_MISSING'],
    ['EBUSY', 'FILE_BUSY'],
    ['UNKNOWN', 'READ_FAILED'],
  ]) {
    let attempts = 0;
    const h = harness({
      inspectFile: async () => {
        if (attempts++ === 0)
          throw Object.assign(new Error('C:\\private\\personal.pdf'), { code });
        return {
          status: 'selected',
          document: { name: 'chosen.pdf', sizeBytes: 100 },
        };
      },
    });
    assert.deepEqual(await h.handler(h.event), {
      status: 'error',
      code: expected,
    });
    assert.equal((await h.handler(h.event)).status, 'selected');
  }
});

test('dialog failure is a handled public result, not an unhandled rejection', async () => {
  const h = harness({
    showOpenDialog: async () => {
      throw new Error('Private native error');
    },
  });
  assert.deepEqual(await h.handler(h.event), {
    status: 'error',
    code: 'READ_FAILED',
  });
});
