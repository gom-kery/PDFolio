# Local PDF CBT

**Unit 4.1 한 페이지·한 문제용 수동 해설·정답 영역 확정**을 구현했습니다. PDF를 연 뒤 Viewer 오른쪽에서 해설과 정답 사각형을 각각 드래그하고, 불투명 가림 미리보기를 확인한 후 현재 세션의 Question/Region으로 확정할 수 있습니다. 설정 화면은 원문과 정답이 보일 수 있는 확인 단계이며 아직 CBT Mask, 답 선택·공개·채점 기능은 아닙니다.

버전 0.3.0의 Node 108개, 실제 PDF.js, 개발·빌드·패키지 Electron 4경로와 실제 Windows 선택 창 검사는 통과했습니다. 확대·높이 맞춤·고유 회전에서 영역 좌표를 유지하고, 취소·재편집·페이지 이동·파일 교체 상태도 확인했습니다. 최종 종료 반복은 개발 7/9·패키지 9/9이며 개발 즉시 종료 두 번에서 기존 OPEN-09가 재현되어 전체 무오류 완료 판정은 보류합니다. 18회 모두 창 종료·종료 코드 0·포트 해제는 정상이었습니다. Unit 1.0은 미착수이며 다음 계획 Unit은 3.1 Mask Layer입니다. [Project Bible](docs/PROJECT_BIBLE.md), [Roadmap](docs/ROADMAP.md), [Decisions](docs/DECISIONS.md), [Changelog](docs/CHANGELOG.md)를 확인하세요.

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

## Unit 4.1 직접 확인하기

1. `npm run dev`로 일반 앱을 열어 footer의 `Unit 4.1 · 수동 영역 확정`을 확인하고 한 페이지에 한 문제와 해설·정답이 함께 있는 PDF를 엽니다.
2. 오른쪽 `해설·정답 영역 설정`에서 `영역 설정 시작`을 누릅니다. 원문과 정답이 보일 수 있고 아직 CBT가 아니라는 안내가 보여야 합니다.
3. `해설`을 선택해 PDF 위 해설 전체를 드래그하고, `정답`을 선택해 정답 전체를 겹치지 않게 드래그합니다. 너무 작은 영역이나 겹친 영역은 미리보기로 넘어가지 않아야 합니다.
4. `가림 미리보기`를 누르면 두 범위가 불투명하게 가려져야 합니다. 범위가 틀리면 `수정`, 맞으면 `영역 확정`, 저장하지 않으려면 `취소`를 누릅니다.
5. 확정 뒤 `확정 영역 수정`을 열고 취소했을 때 이전 확정이 유지되는지 확인합니다. 다시 확정하면 새 영역으로 교체되어야 합니다.
6. 미리보기 중 확대·축소와 `높이 맞춤`을 사용해도 두 사각형이 같은 PDF 내용 위에 유지되는지 확인합니다. PDF 고유 회전이 있는 문서에서도 페이지 밖으로 벗어나지 않아야 합니다.
7. 다페이지 PDF에서 확정하지 않은 채 다음 페이지로 이동하면 초안 취소 안내가 보여야 합니다. 확정한 페이지는 같은 세션에서 재방문하면 유지되고, 다른 PDF를 열면 이전 확정이 사라져야 합니다.
8. 확정해도 실제 CBT 가림, 보기 선택, 답 확인·공개·채점 UI는 나타나지 않아야 합니다. `npm run dev:debug`에서는 좌표 진단 Overlay와 혼동하지 않도록 수동 설정 카드가 숨겨져야 합니다.

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

- `npm test`: 108개. 기존 103개에 PDF user space 수동 사각형의 0/90/180/270도 왕복, 최소 크기·범위·겹침 거부, 미리보기 선행 확정, Question/Region 소유, 취소·재확정·페이지/문서 무효화 5개를 더했습니다.
- `test:electron`: 진단 1경로와 일반 개발·빌드·패키지 3경로, 총 4개를 검사합니다. 일반 경로는 수동 드래그·불투명 미리보기·확정·취소 복원·파일 교체·페이지 초안 취소, 확대·높이 맞춤·고유 회전 투영과 원본 불변을 확인합니다. 기존 Viewer·분석·오프라인·입력·보안 회귀와 진단 좌표 대조도 유지합니다.
- `test:native`: 실제 패키지의 Windows 선택 창에서 한글 합성 PDF 선택·텍스트와 위치 분석 가능·프로파일 미지원·접힌 문서 정보·취소·원본 불변을 검사합니다. 해당 앱 소유 대화상자만 조작합니다.
- `test:shutdown`: 개발/패키지를 표시 직후·250ms 후·1500ms 후 닫는 검사를 3회 반복합니다. Unit 4.1 최종 결과는 개발 7/9·패키지 9/9이며 개발 즉시 종료 두 번에서 OPEN-09 GPU 진단이 재현됐습니다. 모든 창 종료·종료 코드 0·포트 해제는 정상이었습니다.

결과·캡처·합성 입력은 `work/pdf-file-tests/`, `work/electron-tests/`, `work/native-dialog-tests/`, `work/shutdown-tests/`에 남습니다. Git/앱 패키지에는 포함하지 않습니다. 의도적 CSP 거부 진단은 정상 화면 오류와 구분합니다. 오프라인 조건은 앱 전용 연결 불가 프록시이며 PC 전체 네트워크 설정은 바꾸지 않습니다.

Windows PowerShell/GUI 실행이 허용된 환경이 필요합니다. 실행 정책이 검사를 차단하면 정책을 낮추지 말고 수동 검사와 미실행 범위를 기록하세요. 복사한 패키지는 `$env:LOCAL_PDF_CBT_PACKAGE_PATH = '전체 경로\local-pdf-cbt.exe'`로 지정하고, 검사 후 `Remove-Item Env:LOCAL_PDF_CBT_PACKAGE_PATH`로 해제할 수 있습니다.

## 구조와 현재 제한

```text
electron/       창·preload·자산 프로토콜·요청 제한·PDF 선택/드롭/읽기
src/pdf/        PDF.js 현재 페이지·TextContent·렌더 수명·PDF ↔ viewport 좌표 변환·진단 overlay 모델
src/analysis/   페이지 Text Content 품질·PDF user space bbox·제목/영역 후보·지원 프로파일 판정
src/cbt/        수동 page-single Question/Region 설정·검증·세션 확정
src/shared/     PageTextSource v1 검증과 계약 버전
src/ui/         실행·Viewer·분석 상태·수동 영역 설정·명시적 진단 overlay
src/styles/     기본 스타일·Shell 배치
scripts/        런타임 검사·개발 실행·패키징
tests/          경계·PDF 어댑터·Electron·Windows 선택 창 검사와 합성 PDF
docs/           기준·계획·결정·변경 기록
```

renderer에는 `runtimeInfo`, 인자 없는 `selectPdfFile()`, 실제 `File` 객체만 받는 `inspectDroppedPdfFiles()`를 노출합니다. preload는 Electron의 지원 API로 경로를 얻어 main에 전달하지만 renderer에 경로를 반환하지 않습니다. main은 승인된 PDF 바이트만 제한된 결과로 전달하며 범용 파일 읽기·쓰기나 원시 IPC는 제공하지 않습니다. 입력 정보와 PDF.js 객체는 화면 메모리에만 있으며 원본 PDF는 수정하지 않습니다.

Unit 1.0의 전체 샘플 행렬과 실제 CBT Mask는 미구현입니다. Unit 4.1은 한 페이지·한 문제, 해설·정답 사각형 각 하나만 지원하며 여러 문제·여러 열·여러 영역·여러 페이지 연결과 영구 저장은 지원하지 않습니다. 사용자가 직접 범위를 확인해야 하고 자동 후보는 확정을 대신하지 않습니다. 사각형은 포인터로만 만들 수 있어 키보드 좌표 입력·손잡이 크기 조절·터치 실기기 검증이 남았습니다. 현재 확정은 메모리 전용으로 파일 교체·새로고침·종료 때 사라집니다. 640×480에서는 앱 main 내부 스크롤이 필요하며 실제 Windows 200% 디스플레이 배율·스크린 리더는 검증하지 않았습니다. 사용자 회전·Text Layer는 없습니다. Canvas backing bitmap은 최대 16,777,216픽셀·한 변 8,192픽셀로 제한합니다. 기존 GPU 문제는 DECISIONS의 OPEN-09로 추적합니다. 이 프로젝트의 Git 저장소는 Unit 1.1 기준 커밋부터 시작했습니다.
