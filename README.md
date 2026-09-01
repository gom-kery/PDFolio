# Local PDF CBT

**Unit 1.4의 PDF 페이지 이동**을 구현했습니다. 선택하거나 드롭한 PDF를 한 페이지씩 표시하며 처음·이전·번호 입력·다음·마지막 이동을 사용할 수 있습니다. 배율·문제풀이는 아직 없습니다.

파일 입력 검사는 통과했지만 기존 Unit 0.4의 빠른 종료 GPU 오류가 재현되어 **전체 무오류 완료 판정은 보류**합니다. Unit 1.0도 미착수 상태를 유지합니다. [Project Bible](docs/PROJECT_BIBLE.md), [Roadmap](docs/ROADMAP.md), [Decisions](docs/DECISIONS.md), [Changelog](docs/CHANGELOG.md)를 확인하세요.

## 실행 환경

- 검증 대상: Windows 11 x64. 다른 OS/CPU는 검증하지 않았습니다.
- 개발 Node: 24.19.0 이상인 24 LTS. 이 PC는 Node 24.20.0 / npm 11.19.0이며 전역 설치·영구 PATH를 변경하지 않았습니다.
- Electron 44.0.0, Vite 8.2.2, Packager 20.3.0, Prettier 3.9.6, 개발 검사 전용 playwright-core 1.62.1을 유지합니다. PDF 렌더링은 정확히 고정한 `pdfjs-dist` 6.3.289를 사용합니다.

개발 도구 설치에는 인터넷이 필요할 수 있습니다. 준비된 앱은 계정·서버를 사용하지 않습니다. Electron 내장 Node와 개발 Node는 별개입니다.

## 설치·실행·패키지

이 README와 package.json이 있는 폴더에서 실행합니다. 현재 작업 폴더에는 의존성과 패키지가 준비되어 있습니다.

```powershell
node --version
npm --version
# 새 복사본에서 처음 준비할 때만 실행합니다.
npm ci
npm run setup:electron
npm run dev
```

개발 서버는 `127.0.0.1:5173`만 사용합니다. 포트가 사용 중이면 실패하고 창을 닫으면 서버도 종료합니다. main/preload 변경 후에는 앱을 다시 실행하세요.

```powershell
npm run build
npm start
```

위 명령은 빌드 자산을 설치된 Electron으로 실행합니다. dist/index.html이 없으면 한국어 실행 실패 안내가 나옵니다. 일반 브라우저에서는 Electron 실행 안내와 비활성화된 파일 선택 버튼이 표시됩니다.

탐색기에서 `release/local-pdf-cbt-win32-x64/local-pdf-cbt.exe`를 실행하면 Node/npm·개발 서버가 필요하지 않습니다. 다른 위치로 옮길 때는 **앱 폴더 전체**를 복사해 DLL·resources·locales·라이선스 파일을 유지하세요.

`npm run package`는 현재 소스의 Windows 패키지를 만듭니다. 기존 출력 폴더가 있으면 안내와 오류 코드 1로 중단하므로 이전 생성 폴더를 보관한 후 재생성합니다. 자동 삭제·덮어쓰기·서명·설치 프로그램·공개 배포·자동 업데이트는 하지 않습니다.

## Unit 1.4 직접 확인하기

1. 앱을 열고 `연결 완료`·`Unit 1.4 · PDF 페이지 이동`을 확인합니다.
2. `PDF 선택`으로 2페이지 이상인 작은 로컬 PDF 한 개를 고릅니다. 첫 페이지가 보이고 번호 입력과 상태 패널에 `1 / 전체 페이지 수`가 표시되어야 합니다.
3. `다음`, `이전`, `처음`, `마지막`을 차례로 확인합니다. 첫 페이지에서는 처음·이전, 마지막 페이지에서는 다음·마지막 버튼이 비활성화되어야 합니다.
4. 페이지 번호 칸에 중간 번호를 입력하고 Enter를 누릅니다. 입력한 페이지 한 장만 표시되고 상태·번호가 함께 바뀌어야 합니다.
5. `0`, 전체 페이지 수보다 큰 번호, 소수를 입력합니다. 범위 안내가 나오며 직전 페이지와 Canvas가 유지되어야 합니다.
6. 첫 페이지에서 `다음`을 빠르게 여러 번 누릅니다. 마지막으로 요청한 페이지에서 멈추고 이전 페이지가 뒤늦게 덮어쓰지 않아야 합니다.
7. 중간 페이지에서 다른 정상 PDF를 선택하거나 드롭합니다. 새 문서는 항상 `1 / 전체 페이지 수`로 시작해야 합니다.
8. 암호·손상·비PDF·다중 드롭·폴더·URL·취소의 기존 안내와 원본 불변을 다시 확인합니다. 입력 자체의 실패·취소는 직전 정상 문서를 유지해야 합니다.

main은 확장자, 일반 로컬 경로, 파일 여부·50 MiB 상한·읽기 가능 여부, `%PDF-1.0`~`%PDF-1.7` 또는 `%PDF-2.0` 서명을 확인한 뒤 같은 읽기 전용 핸들에서 전체 바이트를 읽습니다. PDF.js가 구조·페이지 수·암호 요구를 판정합니다. renderer에는 파일 경로를 반환하지 않고 바이트는 현재 화면 메모리에서만 사용합니다.

50 MiB(52,428,800바이트)는 임시 입력 상한으로 PDF 렌더링 성능 보장이 아닙니다. UNC·장치·상대 경로·대체 데이터 스트림은 거절합니다. 매핑 드라이브·클라우드 자리표시자의 실제 저장 매체 판별은 없으므로 일반 로컬 디스크 파일로 검사하세요.

## 자동 검사

개발 창과 다른 GUI 검사를 닫고 아래 명령을 **차례대로** 실행합니다. 현재 소스에 맞는 dist와 패키지가 준비되어 있어야 합니다.

```powershell
npm run format:check
npm test
npm run test:electron
npm run test:native
npm run test:shutdown
```

- `npm test`: 48개. 자산·CSP 경계, 읽기 전용 전체 바이트·원본 해시·크기 경계, 선택/드롭 IPC, PDF 어댑터의 페이지 경계·최신 렌더 우선·오류 분류·취소/정리를 확인합니다.
- `test:electron`: 개발·빌드·패키지 3경로에서 5페이지 이동·잘못된 번호·연속 이동·파일 교체 초기화와 실제 PDF.js worker, 한글·포함 이미지 Canvas 픽셀, 암호·손상 상태, 로컬 자산, 파일 입력·보안·앱 전용 오프라인 조건을 검사합니다. 실제 읽기 권한 거부는 **생성한 시험 파일 하나의 권한만 임시 변경하고 복원**합니다.
- `test:native`: 실제 패키지의 Windows 선택 창에서 한글 합성 PDF 선택·첫 페이지 렌더·취소·원본 불변을 검사합니다. 해당 앱 소유 대화상자만 조작합니다.
- `test:shutdown`: 개발/패키지를 표시 직후·250ms 후·1500ms 후 닫는 검사를 3회 반복합니다. Unit 1.4의 18회 중 개발 모드 즉시 종료 2회에서 기존 GPU 오류가 재현돼 실패했습니다. 모든 종료 코드와 개발 포트 정리는 정상입니다.

결과·캡처·합성 입력은 `work/pdf-file-tests/`, `work/electron-tests/`, `work/native-dialog-tests/`, `work/shutdown-tests/`에 남습니다. Git/앱 패키지에는 포함하지 않습니다. 의도적 CSP 거부 진단은 정상 화면 오류와 구분합니다. 오프라인 조건은 앱 전용 연결 불가 프록시이며 PC 전체 네트워크 설정은 바꾸지 않습니다.

Windows PowerShell/GUI 실행이 허용된 환경이 필요합니다. 실행 정책이 검사를 차단하면 정책을 낮추지 말고 수동 검사와 미실행 범위를 기록하세요. 복사한 패키지는 `$env:LOCAL_PDF_CBT_PACKAGE_PATH = '전체 경로\local-pdf-cbt.exe'`로 지정하고, 검사 후 `Remove-Item Env:LOCAL_PDF_CBT_PACKAGE_PATH`로 해제할 수 있습니다.

## 구조와 현재 제한

```text
electron/       창·preload·자산 프로토콜·요청 제한·PDF 선택/드롭/읽기
src/pdf/        PDF.js 현재 페이지 렌더·최신 요청 우선·자원 정리
src/ui/         실행·파일 입력·페이지 이동·Canvas 상태 표시
src/styles/     기본 스타일·Shell 배치
scripts/        런타임 검사·개발 실행·패키징
tests/          경계·PDF 어댑터·Electron·Windows 선택 창 검사와 합성 PDF
docs/           기준·계획·결정·변경 기록
```

renderer에는 `runtimeInfo`, 인자 없는 `selectPdfFile()`, 실제 `File` 객체만 받는 `inspectDroppedPdfFiles()`를 노출합니다. preload는 Electron의 지원 API로 경로를 얻어 main에 전달하지만 renderer에 경로를 반환하지 않습니다. main은 승인된 PDF 바이트만 제한된 결과로 전달하며 범용 파일 읽기·쓰기나 원시 IPC는 제공하지 않습니다. 입력 정보와 PDF.js 객체는 화면 메모리에만 있으며 원본 PDF는 수정하지 않습니다.

Unit 1.0의 전체 샘플 행렬과 Unit 1.5 이후 기능은 미구현입니다. 현재는 선택한 PDF를 한 페이지씩 원문으로 표시하며 확대·너비 맞춤·Text Layer·분석·CBT는 없습니다. 기존 GPU 문제는 DECISIONS의 OPEN-09로 추적합니다. 이 프로젝트의 Git 저장소는 Unit 1.1 기준 커밋부터 시작했습니다.
