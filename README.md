# Local PDF CBT

**Unit 2.6의 첫 MVP 분석 프로파일 판정**을 구현했습니다. 현재 페이지의 기존 텍스트·제목 키워드·해설/정답 영역 근거를 이용해 프로파일 일치·미지원·보류를 구분합니다. 프로파일이 일치해도 안전한 가림과 Question 소유 관계를 아직 입증하지 못했으므로 CBT 시작은 승인하지 않습니다. 기존 원문 Viewer와 명시적 개발 진단 Overlay는 그대로 유지됩니다.

버전 0.2.6의 단위·실제 PDF.js·개발·빌드·패키지·실제 Windows 선택 창 검사는 통과했습니다. Notion/Chromium PDF에서 PDF.js가 글꼴 ascent/descent와 vertical 정보를 제공하지 않는 경우도 실제 텍스트를 보존하도록 보완했습니다. 종료 반복은 기존 OPEN-09가 개발 모드 즉시 종료 2회에서 재현되어 16/18이므로 **전체 무오류 완료 판정은 보류**합니다. 18회 모두 종료 코드와 포트 정리는 정상입니다. Unit 1.0은 미착수이며 Phase 3 기능은 시작하지 않았습니다. [Project Bible](docs/PROJECT_BIBLE.md), [Roadmap](docs/ROADMAP.md), [Decisions](docs/DECISIONS.md), [Changelog](docs/CHANGELOG.md)를 확인하세요.

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

## Unit 2.6 직접 확인하기

1. `npm run dev`로 일반 앱을 열어 footer의 `Unit 2.6 · 지원 프로파일 판정`을 확인합니다.
2. 충분한 문제·보기 뒤에 줄 시작 `해설:`과 `정답:`이 각각 한 번 있는 단일 열 PDF를 엽니다. 앱 상태의 `지원 프로파일`에 첫 MVP 분석 프로파일 후보와 맞지만 CBT 시작은 아직 승인되지 않았다는 안내가 보여야 합니다.
3. `정답:` 뒤 `해설:`이 오는 PDF도 같은 일치 안내를 표시해야 합니다. 두 경우 모두 Mask·문제 선택·답 확인·채점 기능은 나타나지 않아야 합니다.
4. 제목이 없거나 한 종류만 있으면 미지원 안내가 보여야 합니다. 같은 제목이 반복되거나 다단처럼 보이는 페이지, 고유 회전 페이지, 텍스트가 너무 적거나 이미지·수식 위주인 페이지는 현재 근거로 판정할 수 없다는 보류 안내가 보여야 합니다.
5. 페이지 이동과 PDF 교체 뒤 이전 판정이 남지 않는지 확인합니다. 상태 영역에는 전체 문제·해설·정답 문장, 파일 경로와 좌표가 추가로 노출되지 않아야 합니다.
6. 페이지 이동·50–200% 배율·높이 맞춤·좌우 이동과 footer의 원본 불변 안내가 그대로 동작하는지 확인합니다.
7. 좌표 진단이 필요할 때만 `npm run dev:debug`를 사용합니다. 패키지는 PowerShell에서 `& '.\release\local-pdf-cbt-win32-x64\local-pdf-cbt.exe' --debug-overlay`로 진단 모드를 열 수 있습니다.

Notion 문서를 브라우저에서 PDF로 인쇄할 때는 인쇄 설정의 **머리글과 바닥글**을 끄세요. 켜져 있으면 PDF.js 원본 순서에서 답 값 바로 뒤에 문서 제목·페이지 번호가 붙어 `정답 ④제목 없음1`처럼 추출될 수 있습니다. 앱은 오탐을 막기 위해 이 문자열을 정답 제목으로 억지 인식하지 않으므로, 텍스트 분석은 가능해도 두 제목 프로파일에는 미지원으로 표시됩니다.

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

- `npm test`: 103개. 기존 경계·텍스트 품질·좌표·키워드·영역·Debug Overlay 검증에 프로파일 A/B·미지원·보류·고정 행렬·계약, 실제 PDF.js 역순 fixture와 누락된 글꼴 보조값 정규화를 더했습니다.
- `test:electron`: 진단 1경로와 일반 개발·빌드·패키지 3경로, 총 4개를 검사합니다. 일반 경로는 프로파일 세 상태, A/B 일치와 CBT 미승인, 원문 DOM 비복사, 기존 Viewer·오프라인 자산·입력·보안 회귀를 확인합니다. 진단 경로는 기존 좌표 대조를 유지합니다. 실제 읽기 권한 거부는 **생성한 시험 파일 하나의 권한만 임시 변경하고 복원**합니다.
- `test:native`: 실제 패키지의 Windows 선택 창에서 한글 합성 PDF 선택·텍스트와 위치 분석 가능·프로파일 미지원·취소·원본 불변을 검사합니다. 해당 앱 소유 대화상자만 조작합니다.
- `test:shutdown`: 개발/패키지를 표시 직후·250ms 후·1500ms 후 닫는 검사를 3회 반복합니다. 최종 Unit 2.6 보완 실행은 개발 즉시 종료 2회에서 기존 GPU 오류가 재현되어 개발 7/9·패키지 9/9입니다. 모든 창 종료·종료 코드·포트 정리는 정상입니다.

결과·캡처·합성 입력은 `work/pdf-file-tests/`, `work/electron-tests/`, `work/native-dialog-tests/`, `work/shutdown-tests/`에 남습니다. Git/앱 패키지에는 포함하지 않습니다. 의도적 CSP 거부 진단은 정상 화면 오류와 구분합니다. 오프라인 조건은 앱 전용 연결 불가 프록시이며 PC 전체 네트워크 설정은 바꾸지 않습니다.

Windows PowerShell/GUI 실행이 허용된 환경이 필요합니다. 실행 정책이 검사를 차단하면 정책을 낮추지 말고 수동 검사와 미실행 범위를 기록하세요. 복사한 패키지는 `$env:LOCAL_PDF_CBT_PACKAGE_PATH = '전체 경로\local-pdf-cbt.exe'`로 지정하고, 검사 후 `Remove-Item Env:LOCAL_PDF_CBT_PACKAGE_PATH`로 해제할 수 있습니다.

## 구조와 현재 제한

```text
electron/       창·preload·자산 프로토콜·요청 제한·PDF 선택/드롭/읽기
src/pdf/        PDF.js 현재 페이지·TextContent·렌더 수명·PDF ↔ viewport 좌표 변환·진단 overlay 모델
src/analysis/   페이지 Text Content 품질·PDF user space bbox·제목/영역 후보·지원 프로파일 판정
src/shared/     PageTextSource v1 검증과 계약 버전
src/ui/         실행·파일 입력·페이지 이동·배율·Canvas·분석 상태 요약·명시적 진단 overlay
src/styles/     기본 스타일·Shell 배치
scripts/        런타임 검사·개발 실행·패키징
tests/          경계·PDF 어댑터·Electron·Windows 선택 창 검사와 합성 PDF
docs/           기준·계획·결정·변경 기록
```

renderer에는 `runtimeInfo`, 인자 없는 `selectPdfFile()`, 실제 `File` 객체만 받는 `inspectDroppedPdfFiles()`를 노출합니다. preload는 Electron의 지원 API로 경로를 얻어 main에 전달하지만 renderer에 경로를 반환하지 않습니다. main은 승인된 PDF 바이트만 제한된 결과로 전달하며 범용 파일 읽기·쓰기나 원시 IPC는 제공하지 않습니다. 입력 정보와 PDF.js 객체는 화면 메모리에만 있으며 원본 PDF는 수정하지 않습니다.

Unit 1.0의 전체 샘플 행렬과 안전한 Mask·Question 소유 관계·CBT는 미구현입니다. Unit 2.6 고정 행렬은 합성 Text Item과 작은 PDF.js fixture만 사용했으며 일치 2/8, 미지원 2/8, 보류 4/8, CBT 착수 가능 0/8입니다. 별도의 사용자 제공 Notion/Chromium PDF 한 건은 읽기 전용으로 진단했고 글꼴 보조값 누락 호환성은 보완했지만, 머리글·바닥글의 잘못된 source 순서까지 추정 복원하지 않습니다. 현재 bbox는 글리프 윤곽·잉크·클리핑을 보장하지 않는 근사 축 정렬 사각형이고 이미지·수식과 마지막 닫힌 경계를 입증하지 못합니다. 따라서 프로파일 일치는 실제 가림 안전이나 CBT 지원을 뜻하지 않습니다. 최소 비공백 12자·판독 가능 비율 0.8도 초기 보류선입니다. 사용자 회전·Text Layer는 없습니다. Canvas backing bitmap은 최대 16,777,216픽셀·한 변 8,192픽셀로 제한합니다. 기존 GPU 문제는 DECISIONS의 OPEN-09로 추적합니다. 이 프로젝트의 Git 저장소는 Unit 1.1 기준 커밋부터 시작했습니다.
