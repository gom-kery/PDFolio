import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { APP_SCHEME, createContentSecurityPolicy } from '../electron/config.js';
import { registerLocalProtocol } from '../electron/local-protocol.js';
import { isAllowedRequest } from '../electron/security.js';

const fixtureRoot = path.resolve(
  fileURLToPath(new URL('../work/protocol-tests/', import.meta.url)),
);
let fixtureDirectory;
let handle;

before(async () => {
  await mkdir(fixtureRoot, { recursive: true });
  fixtureDirectory = await mkdtemp(path.join(fixtureRoot, 'case-'));
  const assets = path.join(fixtureDirectory, 'dist');
  await mkdir(assets);
  await writeFile(path.join(assets, 'index.html'), '<h1>로컬 화면</h1>');
  await writeFile(path.join(assets, 'app.js'), 'export const local = true;');
  await writeFile(path.join(assets, 'app.css'), 'body { color: green; }');
  for (const name of [
    'worker.mjs',
    'font.bcmap',
    'color.icc',
    'font.pfb',
    'font.ttf',
    'decoder.wasm',
  ])
    await writeFile(path.join(assets, name), `fixture:${name}`);
  await writeFile(path.join(fixtureDirectory, 'outside.js'), 'PRIVATE_FIXTURE');
  registerLocalProtocol(
    {
      handle(scheme, handler) {
        assert.equal(scheme, APP_SCHEME);
        handle = handler;
      },
    },
    assets,
  );
});

after(async () => {
  if (!fixtureDirectory) return;
  assert.ok(
    path.resolve(fixtureDirectory).startsWith(`${fixtureRoot}${path.sep}`),
  );
  await rm(fixtureDirectory, { recursive: true, force: true });
});

test('local application and PDF.js assets are served with the bundled CSP and correct content type', async () => {
  for (const [name, contentType] of [
    ['index.html', 'text/html'],
    ['app.js', 'text/javascript'],
    ['app.css', 'text/css'],
    ['worker.mjs', 'text/javascript'],
    ['font.bcmap', 'application/octet-stream'],
    ['color.icc', 'application/octet-stream'],
    ['font.pfb', 'application/octet-stream'],
    ['font.ttf', 'font/ttf'],
    ['decoder.wasm', 'application/wasm'],
  ]) {
    const response = await handle({
      url: `local-cbt://app/${name}`,
      method: 'GET',
    });
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('Content-Type').startsWith(contentType));
    assert.equal(
      response.headers.get('Content-Security-Policy'),
      createContentSecurityPolicy(false),
    );
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(
      await response.text(),
      await readFile(path.join(fixtureDirectory, 'dist', name), 'utf8'),
    );
  }
});

for (const [name, url, method, status] of [
  ['other host', 'local-cbt://other/index.html', 'GET', 403],
  ['credentials', 'local-cbt://user:password@app/index.html', 'GET', 403],
  ['port', 'local-cbt://app:123/index.html', 'GET', 403],
  ['POST', 'local-cbt://app/index.html', 'POST', 403],
  ['encoded traversal', 'local-cbt://app/%2e%2e%2foutside.js', 'GET', 403],
  ['Windows separator', 'local-cbt://app/%5c..%5coutside.js', 'GET', 403],
  ['Windows drive', 'local-cbt://app/C%3a/fixture.js', 'GET', 403],
  ['alternate stream', 'local-cbt://app/index.html%3ahidden.js', 'GET', 403],
  ['NUL', 'local-cbt://app/bad%00.js', 'GET', 403],
  ['malformed encoding', 'local-cbt://app/%E0%A4%A.js', 'GET', 400],
  ['unsupported file', 'local-cbt://app/package.json', 'GET', 403],
  ['missing file', 'local-cbt://app/missing.js', 'GET', 404],
  [
    'normalized traversal remains inside assets',
    'local-cbt://app/../outside.js',
    'GET',
    404,
  ],
]) {
  test(`asset protocol rejects ${name}`, async () => {
    const response = await handle({ url, method });
    assert.equal(response.status, status);
    assert.ok(!(await response.text()).includes('PRIVATE_FIXTURE'));
  });
}

test('network allowlist separates bundled and development origins', () => {
  assert.equal(isAllowedRequest('local-cbt://app/index.html'), true);
  assert.equal(isAllowedRequest('http://127.0.0.1:5173/', true), true);
  assert.equal(isAllowedRequest('ws://127.0.0.1:5173/', true), true);
  for (const url of [
    'https://example.invalid/',
    'http://127.0.0.1:5174/',
    'http://localhost:5173/',
    'http://127.0.0.1:5173.evil.invalid/',
    'http://user@127.0.0.1:5173/',
    'file:///C:/fixture.html',
    'data:text/html,fixture',
    'invalid',
  ]) {
    assert.equal(isAllowedRequest(url), false, url);
    assert.equal(isAllowedRequest(url, true), false, url);
  }
  assert.equal(isAllowedRequest('http://127.0.0.1:5173/'), false);
  assert.equal(isAllowedRequest('ws://127.0.0.1:5173/'), false);
  assert.equal(
    isAllowedRequest('local-cbt://app.evil.invalid/index.html'),
    false,
  );
  assert.equal(isAllowedRequest('local-cbt://user@app/index.html'), false);
  assert.equal(isAllowedRequest('local-cbt://app:123/index.html'), false);
});

test('bundled CSP permits only same-origin PDF.js workers/assets and no development sockets', () => {
  const bundled = createContentSecurityPolicy(false);
  assert.ok(bundled.includes("connect-src 'self'"));
  assert.ok(bundled.includes("script-src 'self'"));
  assert.ok(bundled.includes("worker-src 'self'"));
  assert.ok(!bundled.includes('unsafe-inline'));
  assert.ok(!bundled.includes('unsafe-eval'));
  assert.ok(!bundled.includes('127.0.0.1'));
  assert.ok(createContentSecurityPolicy(true).includes('ws://127.0.0.1:5173'));
});
