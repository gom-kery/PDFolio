export const APP_NAME = 'Local PDF CBT';
export const APP_SCHEME = 'local-cbt';
export const APP_HOST = 'app';
export const APP_URL = `${APP_SCHEME}://${APP_HOST}/index.html`;

export const DEV_HOST = '127.0.0.1';
export const DEV_PORT = 5173;
export const DEV_ORIGIN = `http://${DEV_HOST}:${DEV_PORT}`;
export const DEV_SOCKET_ORIGIN = `ws://${DEV_HOST}:${DEV_PORT}`;

// Bounds include the native window frame; smaller content can scroll vertically.
export const WINDOW_SIZE = {
  width: 1120,
  height: 760,
  minWidth: 640,
  minHeight: 480,
};

/** Build separate development and bundled-asset content policies. */
export function createContentSecurityPolicy(isDevelopment) {
  return [
    "default-src 'none'",
    "script-src 'self'",
    isDevelopment ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    isDevelopment
      ? `connect-src 'self' ${DEV_SOCKET_ORIGIN}`
      : "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}
