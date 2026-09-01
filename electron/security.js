import {
  APP_HOST,
  APP_SCHEME,
  DEV_ORIGIN,
  DEV_SOCKET_ORIGIN,
} from './config.js';

/**
 * Limit requests to bundled assets, with fixed loopback origins only in development.
 * @param {string} value - Request URL.
 * @param {boolean} isDevelopment - Whether the unpackaged dev entry was selected.
 * @returns {boolean} False for malformed URLs or any unapproved destination.
 */
export function isAllowedRequest(value, isDevelopment = false) {
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (isDevelopment) {
      return url.origin === DEV_ORIGIN || url.origin === DEV_SOCKET_ORIGIN;
    }
    return url.protocol === `${APP_SCHEME}:` && url.host === APP_HOST;
  } catch {
    return false;
  }
}
