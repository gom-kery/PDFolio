# Local PDF CBT

**Unit 2.1의 현재 페이지 Text Content 추출·품질 분류**를 구현했습니다. 선택하거나 드롭한 PDF의 현재 페이지를 `텍스트 분석 가능 / 분석 보류 / 확인 불가`로 구분하며 추출 원문은 화면에 표시하지 않습니다. 기존 원문 Viewer의 페이지 이동, 50–200% 배율과 높이 맞춤은 그대로 사용할 수 있습니다. 좌표 분석과 문제풀이는 아직 없습니다.

버전 0.2.1의 단위·실제 PDF.js·개발·빌드·패키지·실제 Windows 선택 창 검사는 통과했습니다. 종료 반복은 기존 OPEN-09가 패키지 250ms 종료 1회에서 재현되어 17/18이므로 **전체 무오류 완료 판정은 보류**합니다. 18회 모두 종료 코드와 포트 정리는 정상입니다. Unit 1.0도 미착수 상태를 유지합니다. [Project Bible](docs/PROJECT_BIBLE.md), [Roadmap](docs/ROADMAP.md), [Decisions](docs/DECISIONS.md), [Changelog](docs/CHANGELOG.md)를 확인하세요.

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

## Unit 2.1 직접 확인하기

1. 앱을 열고 `연결 완료`·`Unit 2.1 · 페이지 텍스트 품질 분류`를 확인합니다.
2. 한글 본문이 충분한 PDF를 열고 앱 상태의 `텍스트 분석`이 `현재 페이지의 텍스트를 분석할 수 있습니다.`로 바뀌는지 확인합니다.
3. 빈 페이지나 글자 없이 그림·도형만 있는 페이지에서는 Viewer를 계속 사용할 수 있고 `분석할 텍스트를 찾지 못했습니다.`가 표시되어야 합니다.
4. 페이지 번호 수준의 매우 짧은 텍스트는 `분석하기에 텍스트가 너무 적습니다.`로 보류되어야 합니다. 이 상태를 스캔 PDF로 확정해 안내하지 않습니다.
5. 여러 페이지를 빠르게 이동하면 마지막으로 표시한 페이지의 상태만 남아야 합니다. 같은 페이지에서 확대·축소·높이 맞춤을 사용해도 품질 상태는 유지되어야 합니다.
6. 다른 PDF로 교체한 뒤 이전 페이지의 결과가 나타나지 않는지 확인합니다. footer에는 `PDF를 열었습니다. 원본 파일은 변경하지 않았습니다.`가 유지되어야 합니다.
7. 기존 처음·이전·번호·다음·마지막·좌우 버튼, 50–200% 배율, 높이 맞춤, 고유 회전과 잘못된 페이지 안내가 이전처럼 동작하는지 확인합니다.
8. 암호·손상·비PDF·다중 드롭·폴더·URL·취소의 기존 안내와 원본 불변을 다시 확인합니다. 입력 실패·취소는 직전 정상 문서를 유지해야 합니다.

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

- `npm test`: 60개. 기존 자산·파일·IPC·Viewer 어댑터 경계와 PageTextSource 복사, documentRevision/request id 취소, 세 품질 상태·reason code, 실제 PDF.js 한글+이미지 fixture·원본 해시를 확인합니다.
- `test:electron`: 개발·빌드·패키지 3경로에서 usable/insufficient 상태와 원문 DOM 비노출, 기존 Viewer·오프라인 자산·입력·보안 회귀를 검사합니다. 실제 읽기 권한 거부는 **생성한 시험 파일 하나의 권한만 임시 변경하고 복원**합니다.
- `test:native`: 실제 패키지의 Windows 선택 창에서 한글 합성 PDF 선택·텍스트 분석 가능·취소·원본 불변을 검사합니다. 해당 앱 소유 대화상자만 조작합니다.
- `test:shutdown`: 개발/패키지를 표시 직후·250ms 후·1500ms 후 닫는 검사를 3회 반복합니다. 최종 Unit 2.1 실행은 패키지 250ms 1회에서 기존 GPU 오류가 재현되어 개발 9/9·패키지 8/9입니다. 모든 창 종료·종료 코드·포트 정리는 정상입니다.

결과·캡처·합성 입력은 `work/pdf-file-tests/`, `work/electron-tests/`, `work/native-dialog-tests/`, `work/shutdown-tests/`에 남습니다. Git/앱 패키지에는 포함하지 않습니다. 의도적 CSP 거부 진단은 정상 화면 오류와 구분합니다. 오프라인 조건은 앱 전용 연결 불가 프록시이며 PC 전체 네트워크 설정은 바꾸지 않습니다.

Windows PowerShell/GUI 실행이 허용된 환경이 필요합니다. 실행 정책이 검사를 차단하면 정책을 낮추지 말고 수동 검사와 미실행 범위를 기록하세요. 복사한 패키지는 `$env:LOCAL_PDF_CBT_PACKAGE_PATH = '전체 경로\local-pdf-cbt.exe'`로 지정하고, 검사 후 `Remove-Item Env:LOCAL_PDF_CBT_PACKAGE_PATH`로 해제할 수 있습니다.

## 구조와 현재 제한

```text
electron/       창·preload·자산 프로토콜·요청 제한·PDF 선택/드롭/읽기
src/pdf/        PDF.js 현재 페이지·TextContent·배율·높이 맞춤·고유 회전·최신 요청·자원 정리
src/analysis/   페이지 Text Content 품질의 순수 분류
src/shared/     PageTextSource/PageTextAssessment 계약 버전
src/ui/         실행·파일 입력·페이지 이동·배율·Canvas·텍스트 품질 상태 표시
src/styles/     기본 스타일·Shell 배치
scripts/        런타임 검사·개발 실행·패키징
tests/          경계·PDF 어댑터·Electron·Windows 선택 창 검사와 합성 PDF
docs/           기준·계획·결정·변경 기록
```

renderer에는 `runtimeInfo`, 인자 없는 `selectPdfFile()`, 실제 `File` 객체만 받는 `inspectDroppedPdfFiles()`를 노출합니다. preload는 Electron의 지원 API로 경로를 얻어 main에 전달하지만 renderer에 경로를 반환하지 않습니다. main은 승인된 PDF 바이트만 제한된 결과로 전달하며 범용 파일 읽기·쓰기나 원시 IPC는 제공하지 않습니다. 입력 정보와 PDF.js 객체는 화면 메모리에만 있으며 원본 PDF는 수정하지 않습니다.

Unit 1.0의 전체 샘플 행렬과 Unit 2.2 이후 기능은 미구현입니다. 현재는 선택한 PDF를 한 페이지씩 원문으로 표시하고 현재 페이지의 텍스트 분석 가능 여부만 분류합니다. 최소 비공백 12자·판독 가능 비율 0.8은 초기 보류선이며 모든 실제 PDF의 품질이나 읽기 순서를 보장하지 않습니다. 사용자 회전·Text Layer·좌표·키워드·영역·CBT는 없습니다. Canvas backing bitmap은 최대 16,777,216픽셀·한 변 8,192픽셀로 제한합니다. 기존 GPU 문제는 DECISIONS의 OPEN-09로 추적합니다. 이 프로젝트의 Git 저장소는 Unit 1.1 기준 커밋부터 시작했습니다.
