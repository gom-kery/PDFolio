/**
 * Display the preload connection without exposing file or IPC access.
 * @param {HTMLElement} element - The shell's runtime status region.
 * @param {{ electronVersion: string } | undefined} runtimeInfo - Preload metadata.
 * Missing metadata is shown as an Electron launch hint, never a successful connection.
 * @returns {void}
 */
export function renderRuntimeStatus(element, runtimeInfo) {
  const isConnected =
    typeof runtimeInfo?.electronVersion === 'string' &&
    runtimeInfo.electronVersion.trim().length > 0;

  element.dataset.state = isConnected ? 'connected' : 'unavailable';
  element.querySelector('[data-status-label]').textContent = isConnected
    ? '연결 완료'
    : 'Electron 실행 필요';
  element.querySelector('[data-status-detail]').textContent = isConnected
    ? `Electron ${runtimeInfo.electronVersion}`
    : '프로젝트에서 npm run dev로 앱을 실행해주세요.';
}
