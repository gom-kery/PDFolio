const FAILURE_MESSAGES = {
  NOT_PDF:
    'PDF 확장자와 기본 파일 서명을 확인할 수 없습니다. 다른 PDF를 선택해주세요.',
  EMPTY_FILE: '내용이 없는 파일입니다. 다른 PDF를 선택해주세요.',
  NOT_A_FILE: '폴더 대신 PDF 파일 한 개를 선택해주세요.',
  ONE_FILE_REQUIRED: 'PDF 파일은 한 개씩 선택해주세요.',
  FILE_TOO_LARGE:
    '현재 선택 가능한 크기는 50 MiB 이하입니다. 더 작은 PDF를 선택해주세요.',
  LOCAL_FILE_REQUIRED:
    '일반 로컬 경로의 PDF를 선택해주세요. 네트워크·장치 경로는 지원하지 않습니다.',
  ACCESS_DENIED:
    '파일을 읽을 권한이 없습니다. 읽을 수 있는 PDF를 선택해주세요.',
  FILE_MISSING:
    '선택한 파일을 찾을 수 없습니다. 파일 위치를 확인하고 다시 선택해주세요.',
  FILE_BUSY:
    '다른 프로그램이 파일을 사용 중입니다. 사용을 마친 뒤 다시 선택해주세요.',
  FILE_CHANGED:
    '검사 중 파일이 변경됐습니다. 저장을 마친 뒤 다시 선택해주세요.',
  INVALID_REQUEST:
    '파일 선택 요청을 확인할 수 없습니다. 앱을 다시 실행해주세요.',
  READ_FAILED:
    '파일을 확인하지 못했습니다. 읽을 수 있는 PDF로 다시 시도해주세요.',
};
const sizeFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 });
const KIB_BYTES = 1024;
const MIB_BYTES = KIB_BYTES * KIB_BYTES;

function formatFileSize(sizeBytes) {
  const bytes = `${sizeBytes.toLocaleString('ko-KR')} 바이트`;
  if (sizeBytes < KIB_BYTES) return bytes;
  const unit = sizeBytes < MIB_BYTES ? 'KiB' : 'MiB';
  const divisor = sizeBytes < MIB_BYTES ? KIB_BYTES : MIB_BYTES;
  return `${sizeFormat.format(sizeBytes / divisor)} ${unit} (${bytes})`;
}

/**
 * Connect the native picker to selection-only UI; retain the last success on cancel/error.
 * File names are untrusted text. No path, PDF bytes, parsing or persistence lives here.
 * @param {Document} document - Shell document.
 * @param {{selectPdfFile?: Function} | undefined} bridge - Narrow preload API.
 */
export function initializePdfSelection(document, bridge) {
  const button = document.querySelector('#select-pdf');
  const message = document.querySelector('#selection-status');
  const workspace = document.querySelector('.workspace');
  let selected = null;
  let isSelecting = false;
  const showMessage = (state, text) => {
    message.dataset.state = state;
    message.textContent = text;
  };
  if (typeof bridge?.selectPdfFile !== 'function') {
    button.disabled = true;
    showMessage(
      'unavailable',
      'PDF 선택은 Electron 앱에서 사용할 수 있습니다.',
    );
    return;
  }
  button.addEventListener('click', async () => {
    if (isSelecting) return;
    isSelecting = true;
    button.disabled = true;
    workspace.setAttribute('aria-busy', 'true');
    showMessage(
      'selecting',
      '파일을 선택하거나 기본 정보를 확인하고 있습니다.',
    );
    try {
      const result = await bridge.selectPdfFile();
      if (result?.status === 'selected') {
        if (
          typeof result.document?.name !== 'string' ||
          !Number.isSafeInteger(result.document.sizeBytes)
        )
          throw new Error('Invalid file metadata');
        selected = result.document;
        document.querySelector('#document-title').textContent = selected.name;
        document.querySelector('#document-description').textContent =
          '기본 파일 검사만 완료했습니다. PDF 페이지 표시와 손상·암호 확인은 아직 지원하지 않습니다.';
        document.querySelector('#document-state').textContent = '파일 선택됨';
        document.querySelector('#selected-file-name').textContent =
          selected.name;
        document.querySelector('#selected-file-size').textContent =
          formatFileSize(selected.sizeBytes);
        button.textContent = '다른 PDF 선택';
        showMessage(
          'selected',
          '파일 선택을 완료했습니다. 원본 파일은 변경하지 않았습니다.',
        );
      } else if (result?.status === 'canceled') {
        showMessage(
          'canceled',
          selected
            ? '선택을 취소했습니다. 이전 선택을 유지합니다.'
            : '선택을 취소했습니다. 선택한 파일이 없습니다.',
        );
      } else if (result?.status === 'busy') {
        showMessage(
          'busy',
          '파일 선택이 이미 진행 중입니다. 선택 창을 확인해주세요.',
        );
      } else {
        showMessage(
          'error',
          (FAILURE_MESSAGES[result?.code] || FAILURE_MESSAGES.READ_FAILED) +
            (selected ? ' 이전 선택을 유지합니다.' : ''),
        );
      }
    } catch {
      showMessage(
        'error',
        FAILURE_MESSAGES.READ_FAILED +
          (selected ? ' 이전 선택을 유지합니다.' : ''),
      );
    } finally {
      isSelecting = false;
      button.disabled = false;
      workspace.setAttribute('aria-busy', 'false');
    }
  });
}
