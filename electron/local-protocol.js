import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { APP_HOST, APP_SCHEME, createContentSecurityPolicy } from './config.js';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.bcmap': 'application/octet-stream',
  '.icc': 'application/octet-stream',
  '.pfb': 'application/octet-stream',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

/**
 * Serve only the renderer build, never an arbitrary filesystem path.
 * @param {import('electron').Protocol} protocol
 * @param {string} rendererDirectory Absolute path to dist/.
 */
export function registerLocalProtocol(protocol, rendererDirectory) {
  protocol.handle(APP_SCHEME, async (request) => {
    try {
      const url = new URL(request.url);
      if (
        url.host !== APP_HOST ||
        url.username ||
        url.password ||
        request.method !== 'GET'
      ) {
        return new Response('Forbidden', { status: 403 });
      }

      const pathname = decodeURIComponent(url.pathname);
      // Windows separators, drive letters and alternate data streams are not assets.
      if (/[\\:\0]/u.test(pathname)) {
        return new Response('Forbidden', { status: 403 });
      }

      const filePath = path.resolve(rendererDirectory, `.${pathname}`);
      const relativePath = path.relative(rendererDirectory, filePath);
      const contentType = CONTENT_TYPES[path.extname(filePath)];
      if (
        !relativePath ||
        relativePath.startsWith('..') ||
        path.isAbsolute(relativePath) ||
        !contentType
      ) {
        return new Response('Forbidden', { status: 403 });
      }

      return new Response(await readFile(filePath), {
        headers: {
          'Content-Type': contentType,
          'Content-Security-Policy': createContentSecurityPolicy(false),
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
        return new Response('Not found', { status: 404 });
      }
      if (error instanceof URIError) {
        return new Response('Bad request', { status: 400 });
      }
      console.error('Local application asset could not be read.', error);
      return new Response('Internal error', { status: 500 });
    }
  });
}
