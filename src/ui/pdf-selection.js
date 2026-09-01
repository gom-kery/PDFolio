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
    'PDF 입력 요청을 확인할 수 없습니다. 앱을 다시 실행해주세요.',
  NO_FILE_DROPPED: '드롭한 항목에서 파일을 찾지 못했습니다.',
  EMPTY_DROP_PATH:
    '드롭한 항목의 로컬 파일 경로를 확인할 수 없습니다. 탐색기의 PDF 파일을 사용해주세요.',
  INVALID_DROP_DATA:
    '드롭한 항목을 파일로 확인할 수 없습니다. 탐색기의 PDF 파일을 사용해주세요.',
  URL_DROP_NOT_SUPPORTED:
    '웹 주소는 열 수 없습니다. 로컬 PDF 파일 한 개를 드롭해주세요.',
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
 * Connect native selection and file drop to one result UI and retain the last success on failure.
 * File names are untrusted text. No path, PDF bytes, parsing or persistence lives here.
 * @param {Document} document - Shell document.
 * @param {{selectPdfFile?: Function, inspectDroppedPdfFiles?: Function} | undefined} bridge
 */
export function initializePdfSelection(document, bridge) {
  const button = document.querySelector('#select-pdf');
  const message = document.querySelector('#selection-status');
  const workspace = document.querySelector('.workspace');
  let selected = null;
  let isSelecting = false;
  let dragDepth = 0;
  const showMessage = (state, text) => {
    message.dataset.state = state;
    message.textContent = text;
  };

  const showFailure = (code) => {
    showMessage(
      'error',
      (FAILURE_MESSAGES[code] || FAILURE_MESSAGES.READ_FAILED) +
        (selected ? ' 이전 선택을 유지합니다.' : ''),
    );
  };

  const handleResult = (result, source) => {
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
      document.querySelector('#selected-file-name').textContent = selected.name;
      document.querySelector('#selected-file-size').textContent =
        formatFileSize(selected.sizeBytes);
      button.textContent = '다른 PDF 선택';
      showMessage(
        'selected',
        source === 'drop'
          ? 'PDF 파일 드롭을 완료했습니다. 원본 파일은 변경하지 않았습니다.'
          : '파일 선택을 완료했습니다. 원본 파일은 변경하지 않았습니다.',
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
        '다른 PDF 입력을 확인하고 있습니다. 진행 중인 작업을 완료해주세요.',
      );
    } else {
      showFailure(result?.code);
    }
  };

  const runInput = async (operation, source) => {
    if (isSelecting) {
      handleResult({ status: 'busy' }, source);
      return;
    }
    isSelecting = true;
    button.disabled = true;
    workspace.setAttribute('aria-busy', 'true');
    showMessage(
      'selecting',
      source === 'drop'
        ? '드롭한 PDF의 기본 정보를 확인하고 있습니다.'
        : '파일을 선택하거나 기본 정보를 확인하고 있습니다.',
    );
    try {
      handleResult(await operation(), source);
    } catch {
      showFailure('READ_FAILED');
    } finally {
      isSelecting = false;
      button.disabled = false;
      workspace.setAttribute('aria-busy', 'false');
    }
  };

  if (typeof bridge?.selectPdfFile !== 'function') {
    button.disabled = true;
    showMessage(
      'unavailable',
      'PDF 선택은 Electron 앱에서 사용할 수 있습니다.',
    );
    return;
  }
  button.addEventListener('click', () =>
    runInput(() => bridge.selectPdfFile(), 'picker'),
  );

  const clearDragState = () => {
    dragDepth = 0;
    delete workspace.dataset.dropState;
  };
  document.addEventListener('dragover', (event) => event.preventDefault());
  document.addEventListener('drop', (event) => {
    event.preventDefault();
    clearDragState();
  });
  document.addEventListener('dragend', clearDragState);
  document.addEventListener('dragleave', (event) => {
    if (event.relatedTarget === null) clearDragState();
  });
  workspace.addEventListener('dragenter', (event) => {
    event.preventDefault();
    dragDepth++;
    workspace.dataset.dropState = 'over';
  });
  workspace.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  });
  workspace.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) delete workspace.dataset.dropState;
  });
  workspace.addEventListener('drop', async (event) => {
    event.preventDefault();
    clearDragState();
    const transfer = event.dataTransfer;
    const files = Array.from(transfer?.files || []);
    if (files.length > 1) {
      showFailure('ONE_FILE_REQUIRED');
      return;
    }
    if (files.length === 0) {
      const types = Array.from(transfer?.types || []);
      const isUrl =
        types.includes('text/uri-list') ||
        /^https?:\/\//iu.test(transfer?.getData('text/plain') || '');
      showFailure(isUrl ? 'URL_DROP_NOT_SUPPORTED' : 'NO_FILE_DROPPED');
      return;
    }
    if (typeof bridge.inspectDroppedPdfFiles !== 'function') {
      showFailure('INVALID_REQUEST');
      return;
    }
    await runInput(() => bridge.inspectDroppedPdfFiles(files), 'drop');
  });
}
