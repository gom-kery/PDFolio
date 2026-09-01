# Local PDF CBT — Changelog

프로젝트 문서와 구현의 변경을 구분해 기록한다. 앱 버전·릴리스·테스트 결과를 추정하여 적지 않는다. 기준은 [PROJECT_BIBLE](PROJECT_BIBLE.md), 진행 상태는 [ROADMAP](ROADMAP.md)을 따른다.

## 0.1.5 작업 기록 — 2026-09-01

**Unit 1.5 PDF 확대·축소·너비 맞춤과 채택한 Viewer 배치를 구현하고 기능 검사를 통과했다. 최종 종료 반복에서 기존 OPEN-09가 재현되어 전체 무오류 완료 판정은 보류한다.**

작업 전에 현재 프로젝트 파일·PROJECT_BIBLE·ROADMAP·DECISIONS와 Git 상태를 확인했다. 사용자의 명시적 Unit 1.5 요청과 앞서 검토한 IDEA-029 포함 지시에 따라 배율·너비 맞춤·관련 Viewer 배치만 진행했다. Unit 0.4의 과거 간헐적 GPU 문제나 Unit 1.0 미착수를 완료로 바꾸지 않았고, 사용자 회전 버튼·Text Layer·링크/양식·분석·CBT·저장은 추가하지 않았다.

### Unit 1.5 — 1. 구현한 내용

- 50·75·100·125·150·175·200% 단계 확대·축소와 페이지별 `너비 맞춤`을 추가했다. 새 문서는 100%에서 시작하고 너비 맞춤 중 창 크기가 바뀌면 현재 페이지를 새 폭으로 다시 렌더한다.
- PDF.js viewport가 문서의 고유 회전을 반영한다. CSS 페이지 크기와 고해상도 backing bitmap을 구분하고, 최대 16,777,216픽셀·한 변 8,192픽셀 상한을 넘으면 화면 배율을 유지한 채 backing 해상도만 낮춘다.
- 페이지 이동·배율·너비 맞춤·창 크기 재렌더가 같은 최신 요청 우선/cancel 경로를 사용한다. 모든 페이지나 배율 결과를 캐시하지 않고 현재 Canvas 한 장만 유지한다.
- IDEA-029를 채택했다. 페이지·배율 도구를 PDF 아래로 옮기고 PDF 좌우에 같은 상태를 공유하는 이전·다음 버튼을 추가했다. 40rem 이하에서는 좌우 버튼을 숨기고 하단 이동 도구를 유지한다.
- 정상 렌더의 `n페이지를 표시했습니다. 전체 nn페이지입니다.` 행을 제거했다. 로딩·오류·잘못된 번호 안내는 유지하고, 정상 성공 안내는 footer에서 `PDF를 열었습니다. 원본 파일은 변경하지 않았습니다.`로 표시한다.

### Unit 1.5 — 2. 수정/생성된 파일

| 구분 | 파일·변경 |
| --- | --- |
| 렌더 계약 | `src/pdf/pdf-adapter-core.js` — 배율·fit width·고유 회전·DPI·Canvas 상한·최신 렌더 |
| Viewer UI | `index.html`, `src/ui/pdf-viewer.js`, `src/ui/pdf-selection.js`, `src/styles/shell.css` — 하단 도구·좌우 이동·footer 상태·반응형 배치 |
| 검사 | `tests/pdf-adapter.test.js`, `tests/electron.test.js`, `tests/native-dialog.test.js`, `tests/helpers/pdf-fixtures.js`, `tests/helpers/pdf-selection-checks.js` |
| 버전 | `package.json`, `package-lock.json` — 0.1.5 |
| 문서 | `README.md`, `docs/PROJECT_BIBLE.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/CHANGELOG.md`, `docs/IDEA_PARKING.md` |

생성된 `dist/`, `release/`, `work/`는 Git 대상이 아니다. 기존 0.1.4 패키지는 자동 삭제하지 않고 `work/unit-1.5-before-package/release/`에 보존한 뒤 0.1.5 패키지를 생성했다.

### Unit 1.5 — 3. 실행 방법

프로젝트 루트에서 `npm run dev`로 개발 앱을 실행한다. `npm run build` 후 `npm start`는 빌드 자산 모드이며, `release/local-pdf-cbt-win32-x64/local-pdf-cbt.exe`는 버전 0.1.5 패키지다. 실행 중인 이전 앱은 완전히 닫고 다시 시작한다.

### Unit 1.5 — 4. 사용자가 직접 테스트할 방법

1. 앱을 열어 하단의 `Unit 1.5 · PDF 확대·축소·너비 맞춤`을 확인한다.
2. 여러 페이지인 작은 로컬 PDF를 연다. 완료 문구가 PDF 위에 반복되지 않고 footer에 `PDF를 열었습니다. 원본 파일은 변경하지 않았습니다.`가 표시되어야 한다.
3. PDF 좌우의 이전·다음 버튼과 PDF 아래의 처음·이전·번호·다음·마지막 버튼을 사용한다. 첫/마지막 페이지에서 두 위치의 바깥 방향 버튼이 함께 비활성화되어야 한다.
4. `−`와 `+`를 눌러 50%와 200% 경계까지 확인한다. 표시 배율과 PDF 크기가 함께 변하고 경계 버튼이 비활성화되어야 한다.
5. `너비 맞춤`을 누르고 창 폭을 넓히거나 최소 크기까지 줄인다. PDF가 사용 가능한 폭에 다시 맞고 작은 창에서는 좌우 버튼이 사라지되 하단 이동은 남아야 한다. 문서 전체에 가로 넘침이 없어야 한다.
6. 고유 회전이 지정된 PDF를 열어 방향이 올바른지 확인한다. 앱이 원본을 수정하거나 별도 사용자 회전 상태를 저장하지 않아야 한다.
7. 확대·축소나 창 크기를 빠르게 반복한 뒤 마지막 요청의 배율·페이지가 유지되는지 확인한다. 암호·손상·비PDF·취소 안내와 원본 불변도 다시 확인한다.

### Unit 1.5 — 5. 정상 동작 기준과 실제 검증 결과

| 검사 | 결과 | 확인 범위 |
| --- | --- | --- |
| `npm run format:check` | 통과 | 전체 형식 |
| `npm test` | 통과, 49/49 | 배율 경계·fit width·고유 회전·DPI/Canvas 상한·최신 렌더와 기존 회귀 |
| `npm run build` | 통과 | Vite 배포 자산 |
| 개발 Electron | 통과, 1/1 | Viewer 배치·좌우/하단 이동·배율·너비 맞춤·창 크기·오류·보안 |
| 빌드 Electron | 통과, 1/1 | 같은 기능과 로컬 PDF.js 자산 |
| `npm run package` | 통과 | Electron 44.0.0 Windows x64/ASAR 버전 0.1.5 생성 |
| 패키지 Electron | 통과, 1/1 | 오프라인 조건·Viewer·PDF.js 자산·보안·원본 해시 |
| `npm run test:native` | 통과, 1/1 | 실제 Windows 선택 창의 한글 PDF 선택·렌더·취소 보존 |
| `npm run test:shutdown` | **실패, 15/18** | 개발 모드 즉시 종료 3회에서 기존 GPU 진단 재현. 패키지 9/9, 개발 250ms·1500ms 6/6, 모든 종료 코드·포트 정리는 정상 |

실제 화면 캡처에서 하단 페이지/배율 도구, 좌우 버튼, footer 성공 안내와 PDF 본문 비가림을 확인했다. 최종 종료 반복에서는 OPEN-09가 개발 모드 즉시 종료 3회 모두 재현됐다. Unit 1.5 기능 성공과 프로젝트 전체 무오류 완료를 구분한다.

### Unit 1.5 — 6. 예상되는 Edge Case

- 너비 맞춤 값이 50%보다 작거나 200%보다 크면 지원 경계로 제한된다.
- 세로 스크롤바가 생겨도 안정된 scrollbar 공간을 예약해 맞춤 폭이 뒤늦게 넘치지 않게 한다.
- 매우 큰 페이지·고DPI 화면에서는 backing 해상도가 낮아져 확대 시 선명도가 줄 수 있지만 Canvas 상한과 CSS 배율은 유지된다.
- 페이지마다 크기·고유 회전이 다르면 이동할 때 해당 페이지 viewport로 배율과 방향을 다시 계산한다.
- 배율/창 크기 요청이 겹치면 이전 render task는 취소되고 최신 요청만 상태를 갱신한다.

### Unit 1.5 — 7. 알려진 제한사항

키보드 배율 단축키·핀치·사용자 회전 버튼·썸네일·Text Layer·링크/양식 실행은 없다. 모든 실제 출판 PDF의 회전·`userUnit`·복잡한 글꼴/이미지 성능과 Windows 디스플레이 배율 조합을 검증한 것은 아니다. 50 MiB 입력 상한은 렌더 시간 보장이 아니며 파서·캐시·시간 예산은 Unit 1.6 범위다.

### Unit 1.5 — 8. Technical Debt

- OPEN-04: Canvas backing bitmap 상한은 정했지만 파서·캐시·렌더 시간 예산과 성능 측정은 남아 있다.
- OPEN-09: 최종 종료 반복은 15/18이며 개발 모드 즉시 종료 3회에서 기존 GPU 오류가 재현됐다. 원인은 확정하지 못했다.
- 스크린 리더, 실제 다중 모니터와 여러 Windows 디스플레이 배율 실사용 검증은 남아 있다.

### Unit 1.5 — 9. 다음 Unit 진행 전 수정이 필요한 사항

Unit 1.5 기능 자체의 확인된 선행 수정 사항은 없다. 다만 프로젝트 전체 무오류 완료를 위해 OPEN-09 해결과 반복 재검증이 필요하고 Unit 1.0 전체 샘플 행렬도 미착수다. Unit 1.6의 PDF 기초 통합 검증, Text Layer·분석·CBT·저장은 별도 요청 전에는 진행하지 않는다.

### Unit 1.5 — 10. Git Commit Message

제안 메시지: `feat(pdf): add responsive zoom controls for unit 1.5`

실제 Git 커밋은 만들지 않았다. 메시지는 사용자가 현재 변경을 검토한 뒤 사용할 제안이다.

## 0.1.4 작업 기록 — 2026-09-01

**Unit 1.4 PDF 페이지 이동 구현·기능 검사 통과. 기존 GPU 종료 회귀가 실패하여 전체 무오류 완료 판정은 보류한다.**

작업 전에 현재 프로젝트 파일·PROJECT_BIBLE·ROADMAP·DECISIONS와 Git 상태를 확인했다. Unit 1.3 커밋과 깨끗한 작업 트리에서 사용자의 명시적 Unit 1.4 요청에 따라 페이지 이동만 진행했다. Unit 0.4의 미해결 상태나 Unit 1.0 미착수를 완료로 바꾸지 않았고, 확대·축소·너비 맞춤·회전 버튼·Text Layer·분석·CBT·저장은 추가하지 않았다.

### Unit 1.4 — 1. 구현한 내용

- 현재 PDF document를 유지하면서 처음·이전·번호 입력·다음·마지막 페이지를 같은 Canvas 한 장에 렌더한다. UI와 어댑터의 공개 번호는 모두 1부터 시작한다.
- 첫 페이지에서는 처음·이전, 마지막 페이지에서는 다음·마지막 버튼을 비활성화한다. 번호 입력은 1부터 전체 페이지 수 사이의 정수만 허용하고 0·초과·소수·빈 값을 한국어로 안내하며 현재 페이지와 픽셀을 유지한다.
- 문서 요청과 페이지 렌더 요청 식별자를 분리했다. 새 이동은 이전 render task를 취소하고 getPage/render의 늦은 결과가 최신 Canvas·번호·상태를 덮지 못하게 한다. 연속 버튼 계산은 마지막 요청 페이지를 기준으로 한다.
- 새 PDF를 선택하거나 드롭하면 이전 렌더와 document를 정리하고 1페이지부터 시작한다. 입력 실패·취소와 암호·손상 처리의 기존 계약은 유지한다.
- 렌더 완료 시 Canvas 접근성 이름, 번호 입력, 작업 공간 상태, 상태 패널을 함께 갱신하고 페이지 스크롤을 좌상단으로 초기화한다.
- 사용자 문서가 아닌 서로 다른 색의 5페이지 vector 합성 PDF를 동적으로 만들어 페이지 결과와 원본 불변을 검사한다.

### Unit 1.4 — 2. 수정/생성된 파일

| 구분 | 프로젝트 루트 기준 파일 |
| --- | --- |
| 페이지 렌더 요청 수명 | src/pdf/pdf-adapter-core.js |
| 페이지 이동 UI·상태 | src/ui/pdf-viewer.js, src/ui/pdf-selection.js, index.html, src/styles/shell.css |
| 다중 페이지 경계·Electron 검사 | tests/pdf-adapter.test.js, tests/electron.test.js, tests/helpers/pdf-fixtures.js, tests/helpers/pdf-selection-checks.js |
| 버전 | package.json, package-lock.json — 0.1.4 |
| 실행·상태·결정 기록 | README.md, PROJECT_BIBLE.md, ROADMAP.md, DECISIONS.md, CHANGELOG.md |

생성된 `dist/`, `release/`, `work/`는 Git 대상이 아니다. 기존 0.1.3 패키지는 자동 삭제하지 않고 `work/unit-1.4-before-package/`에 보존한 뒤 0.1.4 패키지를 생성했다.

### Unit 1.4 — 3. 실행 방법

프로젝트 루트에서 `npm run dev`로 개발 앱을 실행한다. `npm run build` 후 `npm start`는 빌드 자산 모드이며, `release/local-pdf-cbt-win32-x64/local-pdf-cbt.exe`는 버전 0.1.4 패키지다. 실행 중인 이전 앱은 완전히 닫고 다시 시작한다.

### Unit 1.4 — 4. 사용자가 직접 테스트할 방법

1. 앱을 열어 하단의 `Unit 1.4 · PDF 페이지 이동`을 확인한다.
2. 5페이지 이상인 작은 로컬 PDF를 선택한다. 첫 페이지와 `1 / 전체 페이지 수`, 페이지 이동 컨트롤이 보여야 한다.
3. 처음·이전·다음·마지막 버튼을 사용한다. 첫 페이지와 마지막 페이지의 바깥 방향 버튼이 비활성화되어야 한다.
4. 번호 칸에 중간 페이지를 입력하고 Enter를 누른다. 해당 페이지와 번호·상태가 함께 바뀌어야 한다.
5. 번호 칸에 0, 전체 페이지 수보다 큰 값, 소수, 빈 값을 각각 입력한다. 1부터 마지막 페이지 사이의 정수 안내가 나오고 직전 페이지가 유지되어야 한다.
6. 첫 페이지에서 다음을 빠르게 여러 번 누른다. 마지막으로 요청한 페이지에서 멈추고 앞선 페이지가 뒤늦게 나타나지 않아야 한다.
7. 중간 페이지에서 다른 정상 PDF를 선택하거나 드롭한다. 새 파일은 항상 1페이지에서 시작해야 한다.
8. 원본 PDF의 크기·수정 시각·해시를 전후 비교한다. 앱이 원본을 바꾸지 않아야 한다.

### Unit 1.4 — 5. 정상 동작 기준과 실제 검증 결과

| 검사 | 결과 | 확인 내용 |
| --- | --- | --- |
| `npm run format:check` | 통과 | Prettier 대상 전체 |
| `npm test` | 통과, 48/48 | 페이지 첫/마지막·잘못된 번호·문서 없음, 연속 렌더 취소·최신 결과, 기존 입력·자산·보안 회귀 |
| `npm run build` | 통과 | 페이지 이동 HTML/CSS/JS와 기존 로컬 PDF.js 자산 포함 |
| `npm run package` | 통과 | Electron 44.0.0 Windows x64/ASAR 버전 0.1.4 생성 |
| `npm run test:electron` | 통과, 3/3 | 개발·빌드·패키지에서 5페이지 처음/마지막/이전, 잘못된 번호와 픽셀 유지, 빠른 다음 3회 후 4페이지, 파일 교체 후 1/1, 정상 Console·오프라인·보안 회귀 |
| `npm run test:native` | 통과, 1/1 | 실제 Windows 선택 창의 한글 PDF 선택·첫 페이지·취소 보존 |
| 페이지 화면 시각 확인 | 통과 | 4/5 번호와 합성 4페이지의 보라색 Canvas, 경계 버튼·작은 창 배치 확인 |
| `npm run test:shutdown` | 실패, 16/18 | 개발 모드 즉시 종료 2회에서 기존 GPU 진단 재현. 전부 exit code 0, 창 종료·포트 해제 정상 |
| 전체 무오류 완료 | **보류** | OPEN-09 미해결. Unit 1.4 기능 성공과 구분 |

최종 Electron 기능 증거는 `work/electron-tests/dev-OdaLO8`, `built-zBsWOc`, `packaged-SIyR6z`, 실제 선택 창 증거는 `work/native-dialog-tests/case-TbpgDo`, 종료 결과는 `work/shutdown-tests/cb63450b1ea54f4c86b756e1a2bace78`에 있다. 생성 자료는 Git과 앱 패키지에서 제외한다.

검증 중 새 페이지 번호 입력의 HTML 기본 유효성 검사가 submit을 막아 앱의 한국어 범위 안내가 나오지 않는 문제를 발견했다. form의 기본 팝업을 사용하지 않고 앱이 정수·범위를 일관되게 검사하도록 수정한 뒤 개발·빌드·패키지에서 재검증했다.

### Unit 1.4 — 6. 예상되는 Edge Case

- 빠른 연속 이동: 진행 중인 render task를 취소하고 마지막 문서·렌더 요청과 일치하는 결과만 적용한다.
- 렌더 시작 전 getPage 대기: 뒤 요청이 먼저 오면 이전 page 객체를 정리하고 Canvas 상태를 갱신하지 않는다.
- 잘못된 번호 중 진행 중 렌더: 잘못된 입력도 직전 렌더 요청을 무효화해 늦은 정상 결과가 현재 페이지를 바꾸지 못하게 한다.
- 첫/마지막 경계: 버튼으로 범위 밖 요청을 만들지 않고 직접 입력한 범위 밖 값도 거부한다.
- 파일 교체: 이전 페이지 번호를 새 문서에 재사용하지 않고 1페이지부터 다시 렌더한다.
- 페이지 렌더 실패: 오류를 안내하고 해당 Canvas를 숨기지만 열린 문서의 다른 페이지 이동 컨트롤은 유지해 다시 시도할 수 있다.

### Unit 1.4 — 7. 알려진 제한사항

확대·축소·너비 맞춤·사용자 회전, 페이지 썸네일, 키보드 페이지 단축키는 없다. PDF 고유 회전은 기존 scale 1 viewport가 반영하지만 다양한 회전·서로 다른 페이지 크기의 실제 문서는 독립 검증하지 않았다. 큰 문서의 페이지 전환 시간과 Canvas 픽셀·메모리 상한은 Unit 1.5/1.6 범위다.

Text Layer·검색·링크·양식·첨부·스크립트 실행, 문제/보기/해설 분석, 가림·답 선택·채점·저장은 없다. 이 화면은 원문 Viewer 단계이며 CBT 화면이 아니다.

### Unit 1.4 — 8. Technical Debt

- OPEN-09: 빠른 종료 GPU 진단의 원인 규명·안전한 수정과 반복 검증이 필요하다.
- Unit 1.0: 전체 문서 유형·실패 정책·대표 샘플 행렬은 여전히 미착수다. 이번 5페이지 fixture는 이동 경계만 검증한다.
- Unit 1.5/1.6: 확대·너비 맞춤·고유 회전 실물·페이지별 크기·Canvas 픽셀·메모리·시간·50 MiB 상한과 오프라인 통합 예산을 측정해야 한다.
- PDF 바이트의 IPC 복사 비용은 50 MiB 상한 안에서만 검증했다.

### Unit 1.4 — 9. 다음 Unit 진행 전 수정이 필요한 사항

Unit 1.4의 페이지 이동 기능 검사는 통과했지만 전체 오류 없음 기준을 충족하려면 OPEN-09를 해결해야 한다. Unit 0.4·Phase 0·Unit 1.1~1.4를 무조건 완료로 표시하지 않는다. Unit 1.0과 Unit 1.5 이후 기능은 이번 요청에 포함하지 않았으며 별도 요청 전에는 진행하지 않는다.

### Unit 1.4 — 10. Git Commit Message

제안: `feat(pdf): add page navigation for unit 1.4`

---

## 0.1.3 작업 기록 — 2026-09-01

**Unit 1.3 PDF.js 첫 페이지 렌더링 구현·기능 검사 통과. 기존 GPU 종료 회귀가 실패하여 전체 무오류 완료 판정은 보류한다.**

작업 전에 현재 프로젝트 파일·PROJECT_BIBLE·ROADMAP·DECISIONS와 Git 상태를 확인했다. 사용자의 명시적 Unit 1.3 요청에 따라 로컬 PDF.js 첫 페이지 표시와 한글·이미지·암호 필요·손상 처리만 진행했다. Unit 0.4의 미해결 상태나 Unit 1.0 미착수를 완료로 바꾸지 않았고, 페이지 이동·확대·축소·너비 맞춤·Text Layer·분석·CBT·저장은 추가하지 않았다.

### Unit 1.3 — 1. 구현한 내용

- `pdfjs-dist` 6.3.289를 정확히 고정하고 PDF.js 본체와 worker를 같은 버전으로 빌드한다.
- CMap·ICC·표준 글꼴·WASM·PDF.js 라이선스를 설치 패키지에서 준비해 개발 서버와 `dist/pdfjs/`의 로컬 자산으로 제공한다. worker는 별도 로컬 모듈로 출력하며 외부 CDN·원격 글꼴을 사용하지 않는다.
- 선택·드롭으로 승인된 PDF를 main의 같은 `r` 핸들에서 전체 읽고, 읽기 전후 크기·수정 시각을 확인한다. renderer에는 이름·크기·바이트만 전달하고 로컬 경로는 반환하지 않는다.
- PDF.js 객체·문서 요청 식별자·loading/render task·정리를 `src/pdf/` 어댑터에 한정한다. 새 파일이나 종료 시 이전 작업을 취소·파기하고 늦은 결과가 최신 화면을 덮지 못하게 한다.
- 첫 페이지만 scale 1 viewport로 Canvas에 표시하고 backing pixel에는 디스플레이 픽셀 비율을 적용한다. 전체 페이지 수는 안내하지만 페이지 이동·배율 제어는 제공하지 않는다.
- 암호가 필요한 PDF는 암호 입력 없이 미지원 안내를 표시하고, 손상/지원 불가 PDF는 별도 상태로 안내한다. 파서 실패 시 이전 Canvas를 확실히 숨긴다.
- 배포 CSP에 같은 origin worker·자산 fetch만 허용하고 로컬 프로토콜에 필요한 PDF.js 확장자만 추가했다. Electron 세션의 외부 요청 차단은 유지한다.

### Unit 1.3 — 2. 수정/생성된 파일

| 구분 | 프로젝트 루트 기준 파일 |
| --- | --- |
| 읽기 전용 전체 바이트 경계 | electron/pdf-file.js, electron/pdf-input.js, electron/pdf-selection.js |
| 로컬 자산 CSP·프로토콜 | electron/config.js, electron/local-protocol.js, vite.config.js |
| PDF.js 어댑터 신규 | src/pdf/pdf-adapter.js, src/pdf/pdf-adapter-core.js |
| 첫 페이지 Viewer 신규·연결 | src/ui/pdf-viewer.js, src/ui/pdf-selection.js, src/main.js, index.html, src/styles/base.css, src/styles/shell.css |
| 합성 PDF·검사 | tests/fixtures/, tests/pdf-adapter.test.js, tests/pdf-file.test.js, tests/foundation.test.js, tests/electron.test.js, tests/helpers/ |
| 버전·의존성 | package.json, package-lock.json — 0.1.3, pdfjs-dist 6.3.289 |
| 실행·상태·결정 기록 | README.md, PROJECT_BIBLE.md, ROADMAP.md, DECISIONS.md, CHANGELOG.md |

생성된 `dist/`, `release/`, `work/`는 Git 대상이 아니다. 두 PDF fixture는 사용자 문서가 아닌 합성 자료이며 일반 fixture에는 SIL Open Font License 1.1의 Noto Sans KR subset이 포함된다.

### Unit 1.3 — 3. 실행 방법

프로젝트 루트에서 `npm run dev`로 개발 앱을 실행한다. `npm run build` 후 `npm start`는 빌드 자산 모드이며, `release/local-pdf-cbt-win32-x64/local-pdf-cbt.exe`는 버전 0.1.3 패키지다. main·renderer·자산 변경이므로 실행 중인 이전 앱은 완전히 닫고 다시 시작한다.

### Unit 1.3 — 4. 사용자가 직접 테스트할 방법

1. 앱을 열어 하단의 `Unit 1.3 · PDF.js 첫 페이지 렌더링`을 확인한다.
2. 한글 글자와 포함 이미지가 있는 작은 로컬 PDF를 선택한다. 첫 페이지가 Canvas에 보이고 상태 패널에 `1 / 전체 페이지 수`가 표시되어야 한다.
3. 다른 정상 PDF를 작업 공간에 드롭한다. 첫 페이지와 파일명·크기·페이지 수가 새 파일로 바뀌고 이전 화면이 남지 않아야 한다.
4. 암호가 필요한 PDF 복사본을 연다. 암호 입력창이나 원문이 나오지 않고 현재 미지원 안내가 표시되어야 한다.
5. `%PDF-1.7` 서명만 있고 구조가 잘린 별도 합성 파일을 연다. 손상/지원 불가 안내가 나오고 직전 Canvas가 숨겨져야 한다.
6. 비PDF·다중 드롭·폴더·URL·취소를 다시 확인한다. 기본 입력 실패·취소는 직전 정상 문서를 유지해야 한다.
7. 원본 PDF의 크기·수정 시각·해시를 전후 비교한다. 앱이 원본을 바꾸지 않아야 한다.
8. 네트워크를 사용하지 않아도 생성된 Windows 패키지에서 같은 첫 페이지가 보여야 한다.

개인 문서를 손상·암호 시험용으로 변경하지 않는다. 별도 복사본이나 `tests/fixtures/`의 합성 PDF를 사용한다.

### Unit 1.3 — 5. 정상 동작 기준과 실제 검증 결과

| 검사 | 결과 | 확인 내용 |
| --- | --- | --- |
| `npm run format:check` | 통과 | Prettier 대상 전체 |
| `npm test` | 통과, 47/47 | 자산 프로토콜·CSP, 읽기 전용 전체 바이트, PDF 어댑터 첫 페이지·오류 분류·취소/정리, 기존 입력 회귀 |
| `npm run build` | 통과 | PDF.js 본체 번들, 별도 worker, CMap·ICC·표준 글꼴·WASM·라이선스 포함 |
| `npm run package` | 통과 | Electron 44.0.0 Windows x64/ASAR 버전 0.1.3 재생성 |
| `npm run test:electron` | 통과, 3/3 | 개발·빌드·패키지에서 한글·포함 이미지 Canvas 유색 픽셀, worker·내부 자산, 암호·손상, 이전 Canvas 숨김, 원본 해시, 보안·앱 전용 오프라인 회귀 |
| `npm run test:native` | 통과, 1/1 | 실제 Windows 선택 창의 한글 PDF 선택·첫 페이지 렌더·취소 보존 |
| fixture 시각 확인 | 통과 | Poppler 120 DPI 렌더에서 한글 글리프·포함 raster 이미지·테두리의 깨짐·잘림 없음 |
| `npm run test:shutdown` | 실패, 16/18 | 개발 모드 즉시 종료 2회에서 기존 GPU 진단 재현. 전부 exit code 0, 창 종료·포트 해제 정상 |
| 전체 무오류 완료 | **보류** | OPEN-09 미해결. Unit 1.3 기능 성공과 구분 |

최종 Electron 기능 증거는 `work/electron-tests/dev-6EAHY4`, `built-yjuvXg`, `packaged-qIrREz`, 실제 선택 창 증거는 `work/native-dialog-tests/case-ZRCI46`, 종료 결과는 `work/shutdown-tests/f6242c08e20f418c9b3858e6754a6f3b`에 있다. 생성 자료는 Git과 앱 패키지에서 제외한다.

통합 검사 과정에서 두 가지 검증 결함을 고쳤다. 이전 오류 상태를 새 오류 완료로 오인하던 대기 조건을 새 입력 결과만 기다리도록 변경했고, Canvas의 `display` 규칙이 `hidden` 속성을 덮어 이전 페이지가 남던 실제 UI 문제는 `[hidden]`을 강제 적용해 해결했다. PDF.js 문서 정리 실패가 새 문서 열기를 막지 않도록 정리 경계도 방어하고, 손상 fixture의 예상된 parser 경고는 오류 수준 verbosity로 제한했다. 최종 검사는 정상 Console error/warning 없이 통과했다.

### Unit 1.3 — 6. 예상되는 Edge Case

- 빠른 파일 교체·종료: 이전 loading/render task를 취소하고 문서 요청 식별자가 다른 결과는 적용하지 않는다.
- 암호 PDF: 비밀번호를 추측하거나 저장하지 않는다. 현재는 암호 해제 복사본을 요구한다.
- 손상·지원 불가: 기본 서명을 통과해도 PDF.js 구조 판정에서 실패할 수 있으며 이전 Canvas를 현재 문서처럼 남기지 않는다.
- 포함 글꼴·CMap·이미지: 로컬 자산 경로만 사용한다. 합성 한글·raster 이미지는 검증했지만 모든 출판 PDF 호환성을 보장하지 않는다.
- 큰 문서·고해상도 화면: 입력은 50 MiB 이하이고 첫 페이지만 유지하지만 Canvas 픽셀·시간·메모리 상한은 아직 측정하지 않았다.
- 기본 입력 실패·취소: 파서에 들어가지 않으며 직전 정상 문서와 메타데이터를 유지한다.

### Unit 1.3 — 7. 알려진 제한사항

첫 페이지만 표시한다. 페이지 이동·번호 입력·확대·축소·너비 맞춤·사용자 회전 버튼은 없다. PDF 고유 회전은 PDF.js viewport가 반영하지만 다양한 실제 회전 문서의 독립 검증은 아직 없다.

Text Layer·검색·링크·양식·첨부·스크립트 실행, 문제/보기/해설 분석, 가림·답 선택·채점·저장은 없다. 이 화면은 원문 Viewer 단계이며 CBT 화면이 아니다. 암호 입력/해제도 지원하지 않는다.

### Unit 1.3 — 8. Technical Debt

- OPEN-09: 빠른 종료 GPU 진단의 원인 규명·안전한 수정과 반복 검증이 필요하다.
- Unit 1.0: 전체 문서 유형·실패 정책·대표 샘플 행렬은 여전히 미착수다. 이번 합성 fixture는 Unit 1.3 렌더 경로만 검증한다.
- Unit 1.4: 페이지 이동과 빠른 연속 이동·파일 교체의 현재 페이지 계약을 구현·검증해야 한다.
- Unit 1.5/1.6: 확대·너비 맞춤·고유 회전 실물·Canvas 픽셀·메모리·시간·50 MiB 상한과 오프라인 통합 예산을 측정해야 한다.
- PDF 바이트의 IPC 복사 비용은 50 MiB 상한 안에서만 검증했다. 측정 결과가 필요하면 전송/수명 구조를 재검토한다.

### Unit 1.3 — 9. 다음 Unit 진행 전 수정이 필요한 사항

Unit 1.3의 PDF.js 기능 검사는 통과했지만 전체 오류 없음 기준을 충족하려면 OPEN-09를 해결해야 한다. Unit 0.4·Phase 0·Unit 1.1~1.3을 무조건 완료로 표시하지 않는다. Unit 1.4 페이지 이동과 이후 기능은 이번 요청에 포함하지 않았으며 별도 요청 전에는 진행하지 않는다.

### Unit 1.3 — 10. Git Commit Message

제안: `feat(pdf): render first page offline for unit 1.3`

---

## 0.1.2 작업 기록 — 2026-09-01

**Unit 1.2 파일 드롭 구현·기능 검사 통과. 기존 GPU 종료 회귀가 실패하여 전체 무오류 완료 판정은 보류한다.**

작업 전에 현재 프로젝트 파일·PROJECT_BIBLE·ROADMAP·DECISIONS와 Git 상태를 확인했다. 사용자의 명시적 Unit 1.2 요청에 따라 드롭을 Unit 1.1 검사 경로에 연결하는 범위만 진행했다. Unit 0.4의 미해결 상태나 Unit 1.0 미착수를 완료로 바꾸지 않았고, PDF.js·페이지 표시·파일 감시·다중 파일 가져오기·CBT는 추가하지 않았다.

### Unit 1.2 — 1. 구현한 내용

- Windows 탐색기의 실제 로컬 PDF 한 개를 문서 작업 공간에 드롭해 Unit 1.1과 같은 확장자·경로·파일·크기·서명·변경 검사를 수행한다.
- sandbox preload에서 Electron `webUtils.getPathForFile(File)`로 실제 파일 경로를 얻어 고정 IPC로 main에 전달한다. renderer에는 경로·내용·원시 IPC·범용 파일 API를 반환하지 않는다.
- main에서 소유 창·mainFrame·정확한 URL·인자 모양을 재검사하고 빈 배열·다중 경로·빈 경로를 읽기 전에 거절한다. 폴더는 공통 파일 검사에서 거절한다.
- 파일 선택과 드롭이 같은 실행 잠금과 UI 진행 상태를 사용한다. 성공은 이름·크기를 교체하고 실패·취소는 직전 성공 정보를 유지한다.
- 드래그 중인 작업 공간의 시각 상태, 드롭 성공/실패 한국어 안내와 기존 키보드 사용 가능한 선택 버튼을 제공한다. 브라우저 기본 파일/URL 탐색은 차단한다.

### Unit 1.2 — 2. 수정/생성된 파일

| 구분 | 프로젝트 루트 기준 파일 |
| --- | --- |
| 입력 공통 경계 신규 | electron/pdf-input.js |
| 드롭 IPC 신규 | electron/pdf-drop.js |
| 선택/드롭 공통 잠금·등록 | electron/pdf-selection.js, electron/main.js |
| 실제 File 경로 추출 API | electron/preload.cjs |
| 드롭 UI·안내·스타일 | src/ui/pdf-selection.js, index.html, src/styles/shell.css |
| 드롭 경계/실제 Electron 검사 | tests/pdf-drop.test.js, tests/electron.test.js, tests/helpers/pdf-selection-checks.js |
| 버전·검사 명령 | package.json, package-lock.json |
| 실행·상태·결정 기록 | README.md, PROJECT_BIBLE.md, ROADMAP.md, DECISIONS.md, CHANGELOG.md |

새 런타임·개발 의존성은 추가하지 않았다. PDF.js도 아직 설치하지 않았다.

### Unit 1.2 — 3. 실행 방법

프로젝트 루트에서 `npm run dev`로 개발 앱을 실행한다. `npm run build` 후 `npm start`는 빌드 자산 모드이며, 현재 생성된 `release/local-pdf-cbt-win32-x64/local-pdf-cbt.exe`는 버전 0.1.2 패키지다. main/preload 변경이므로 실행 중이던 앱은 완전히 닫고 다시 시작한다.

### Unit 1.2 — 4. 사용자가 직접 테스트할 방법

1. 앱의 `Unit 1.2 · PDF 파일 선택과 드롭`과 문서 작업 공간의 한 파일 안내를 확인한다.
2. Windows 탐색기의 작은 로컬 PDF 한 개를 작업 공간에 드롭한다. 파일 이름·크기와 드롭 완료 안내가 표시되고 PDF 본문은 아직 보이지 않아야 한다.
3. 다른 정상 PDF를 드롭한 뒤 PDF 두 개를 함께 드롭한다. 한 파일 안내와 함께 직전 정상 PDF 정보를 유지해야 한다.
4. 폴더, 브라우저의 URL, PDF가 아닌 파일, 확장자만 PDF인 파일을 각각 드롭한다. 앱이 탐색하거나 다운로드하지 않고 처리된 오류를 표시해야 한다.
5. 선택 버튼과 드롭을 번갈아 사용하고 선택 창에서 취소한다. 입력이 겹칠 때 중복 처리하지 않고 직전 성공 상태를 유지해야 한다.
6. 필요하면 드롭 전후 원본 PDF의 수정 시각·크기·해시를 비교한다. 원본이 바뀌지 않아야 한다.

개인 문서로 오류 사례를 만들기 위해 이름·내용·권한을 변경하지 않는다. 별도 복사본이나 합성 시험 파일을 사용한다.

### Unit 1.2 — 5. 정상 동작 기준과 실제 검증 결과

| 검사 | 결과 | 확인 내용 |
| --- | --- | --- |
| `npm test` | 통과, 43/43 | 공통 파일 검사, 신뢰 경계, 한/다중/빈 경로, 폴더 결과, 오류 매핑, 선택/드롭 경쟁 |
| `npm run build` | 통과 | Vite 8.2.2 renderer 빌드, 새 드롭 UI 포함 |
| `npm run package` | 통과 | Electron 44.0.0 Windows x64/ASAR 버전 0.1.2 재생성 |
| `npm run test:electron` | 통과, 3/3 | 개발·빌드·패키지에서 실제 디스크 파일 drag event, 다중·폴더·URL·빈 경로·빈 전송 거절, UI·원본 해시·보안 회귀 |
| `npm run test:native` | 통과, 1/1 | 실제 Windows 선택 창의 한글 PDF 선택·취소와 원본 불변 회귀 |
| 화면 확인 | 통과 | 드롭 성공 화면의 이름·크기·상태·작은 창 배치와 Unit 1.2 안내 확인 |
| `npm run test:shutdown` | 실패, 16/18 | 개발 모드 즉시 종료 2회에서 기존 GPU 진단 재현. 전부 exit code 0, 창 종료·포트 해제 정상 |
| 전체 무오류 완료 | **보류** | OPEN-09 미해결. Unit 1.2 기능 성공과 구분 |
| PDF 파싱·렌더링 | 미실행 | Unit 1.3 범위이며 의존성/기능 미추가 |

최종 Electron 기능 증거는 `work/electron-tests/dev-zF6jot`, `built-lu6uI4`, `packaged-2VAOk0`, 실제 선택 창 증거는 `work/native-dialog-tests/case-4Jy4Mp`, 종료 결과는 `work/shutdown-tests/c3483c482ca840cfb2b93245efc7d490`에 있다. 생성 자료는 Git과 앱 패키지에서 제외한다.

격리된 도구 환경에서 먼저 시도한 GUI 검사는 GPU subprocess 종료와 초기 자산 URL `ERR_FAILED`로 시작 단계에서 실패했다. 제품의 그래픽·sandbox 설정을 바꾸지 않고 사용자 Windows 실행 환경에서 다시 검사해 세 Electron 모드가 통과했다. 이후 종료 전용 검사에서는 기존 OPEN-09가 별도로 재현됐으므로 환경 실패와 기능 통과를 합쳐 숨기지 않는다.

### Unit 1.2 — 6. 예상되는 Edge Case

- PDF 여러 개: 첫 파일만 임의 선택하지 않고 전체 입력을 거절한다.
- 폴더·shell 항목: 폴더를 순회하지 않는다. 일반 파일이 아니면 공통 검사에서 거절하며 가상 항목의 호환성은 보장하지 않는다.
- URL·텍스트·빈 전송: 외부 요청이나 페이지 탐색 없이 안내한다.
- 메모리 File·빈 경로: preload의 지원 API가 빈 경로를 반환하면 파일시스템 접근 전에 거절한다.
- 선택/드롭 중복과 늦은 결과: 같은 잠금으로 한 번만 처리하며 창/프레임이 바뀐 결과는 적용하지 않는다.
- 잘못된 확장자·서명·권한·용량: Unit 1.1과 같은 처리이며 실패 시 이전 성공 정보를 유지한다.

### Unit 1.2 — 7. 알려진 제한사항

Windows 탐색기의 일반 로컬 파일 드롭만 검증했다. 브라우저·메일·압축 프로그램의 가상 파일, shell namespace, 클라우드 자리표시자, 매핑 드라이브의 실제 저장 위치는 보장하지 않는다. 다중 파일 큐·폴더 재귀·URL 다운로드는 지원하지 않는다.

파일 이름과 크기만 표시한다. PDF.js·본문·페이지 수·손상/암호 판정·파일 감시·영구 저장은 없다. 기존 간헐 GPU 종료 오류와 서명 없는 로컬 테스트 패키지 제한도 유지한다.

### Unit 1.2 — 8. Technical Debt

- OPEN-09: 빠른 종료 GPU 진단의 원인 규명·안전한 수정과 반복 검증이 필요하다.
- Unit 1.0: 전체 문서 유형·실패 정책·대표 샘플 행렬은 여전히 미착수다.
- Unit 1.3: 선택/드롭된 승인 파일을 PDF.js에 전달할 main 보유 수명·교체/취소·파서 오류 계약을 설계해야 한다.
- Unit 1.6: 임시 50 MiB 상한과 실제 파서·렌더 성능·메모리 예산을 측정해야 한다.
- 가상 파일/클라우드 항목 지원이 실제 요구가 되면 Windows 제공자별 경로·다운로드 동작과 Local First 경계를 별도 검토해야 한다.

### Unit 1.2 — 9. 다음 Unit 진행 전 수정이 필요한 사항

Unit 1.2의 드롭 기능 검사는 통과했지만 전체 오류 없음 기준을 충족하려면 OPEN-09를 해결해야 한다. Unit 0.4·Phase 0·Unit 1.1·1.2를 무조건 완료로 표시하지 않는다. Unit 1.3 PDF.js 렌더링은 이번 요청에 포함하지 않았으며 별도 요청과 구조 검토 후 진행한다.

### Unit 1.2 — 10. Git Commit Message

제안: `feat(pdf): add validated drag and drop for unit 1.2`

---

## 0.1.1 작업 기록 — 2026-09-01

**Unit 1.1 파일 선택 구현·기능 검사 통과. 기존 GPU 종료 회귀가 실패하여 전체 무오류 완료 판정은 보류한다.**

작업 전에 현재 파일·PROJECT_BIBLE·ROADMAP·DECISIONS를 확인했다. 사용자의 명시적 Unit 1.1 요청에 따라 이번 범위만 진행했다. Unit 0.4의 미해결 상태나 Unit 1.0 미착수를 완료로 바꾸지 않았고, 전체 샘플 행렬·드롭·PDF 파서/렌더링·CBT는 추가하지 않았다.

### Unit 1.1 — 1. 구현한 내용

- 소유 창에 연결한 실제 Windows PDF 선택 창, 한 번에 한 파일, 선택 중 중복 방지와 최근 문서 등록 방지 옵션.
- 일반 로컬 경로·확장자·파일 여부·읽기 가능·크기·첫 줄 서명 검사. 임시 상한 50 MiB, 읽기 전용 핸들로 앞 9바이트만 읽고 닫음.
- preload의 인자 없는 selectPdfFile()과 main 발신 창/프레임/URL 검증. 임의 경로·범용 파일 API·원시 IPC는 노출하지 않음.
- 이름·크기·선택/검사 중·성공·취소·실패 표시. 취소·오류는 이전 선택 유지, 성공은 교체. 경로/본문 저장 없음.
- 본문 표시·손상/암호 확인이 아직 없음을 UI에 표시. 50 MiB는 성능 보장이 아닌 임시 입력 제한.

### Unit 1.1 — 2. 수정/생성된 파일

| 구분 | 프로젝트 루트 기준 파일 |
| --- | --- |
| PDF 기본 검사 신규 | electron/pdf-file.js |
| 제한된 선택 처리 신규 | electron/pdf-selection.js |
| IPC 등록·preload 연결 | electron/main.js, electron/preload.cjs |
| UI 신규·연결·표시 | src/ui/pdf-selection.js, src/main.js, index.html, src/styles/shell.css |
| 경계 검사 신규 | tests/pdf-file.test.js, tests/pdf-selection.test.js |
| Electron 파일 선택 검사 | tests/electron.test.js, tests/helpers/pdf-selection-checks.js |
| 실제 Windows 선택 창 검사 신규 | tests/native-dialog.test.js, tests/helpers/native-dialog.ps1 |
| 생성 입력·권한 fixture | tests/helpers/pdf-fixtures.js, tests/helpers/deny-file-read.ps1 |
| 버전·명령 | package.json, package-lock.json — 0.1.1, 의존성 버전 변경 없음 |
| 문서 | README.md, PROJECT_BIBLE.md, ROADMAP.md, DECISIONS.md, CHANGELOG.md |
| 생성 패키지 | release/local-pdf-cbt-win32-x64/ — Git 제외 |

기존 CSP·프로토콜 자산 유형·네트워크 허용 목록·sandbox·그래픽 설정·종료 방식은 바꾸지 않았다. IDEA_PARKING은 변경하지 않았다. 원격 저장소·공개 배포·시스템 설치 변경도 없다.

### Unit 1.1 — 3. 실행 방법

현재 PC의 Node 24.20.0 / npm 11.19.0에서 프로젝트 폴더의 npm run dev를 실행한다. 빌드 자산은 npm run build 후 npm start로 확인한다. 처음 준비하는 복사본은 npm ci → npm run setup:electron을 먼저 수행한다.

Node/npm 없이 실행하려면 release/local-pdf-cbt-win32-x64/local-pdf-cbt.exe를 연다. 다른 위치로 옮길 때 앱 폴더 전체를 복사한다. 현재 패키지는 0.1.1 소스로 재생성했다. 기존 출력이 있는 상태에서 npm run package는 오류 코드 1로 중단하므로 이전 생성 폴더를 먼저 보관한다.

### Unit 1.1 — 4. 사용자가 직접 테스트할 방법

1. PDF 선택 버튼을 눌러 일반 로컬 디스크의 작은 PDF 한 개를 고른다. 한글·공백·대문자 .PDF 이름과 크기가 표시되어야 한다.
2. PDF 내용이 보이지 않고 기본 검사만 완료했으며 손상/암호를 판정하지 않았다는 안내가 있는지 확인한다.
3. 다른 PDF 선택 후 취소하거나 잘못된 별도 시험 파일을 고른다. 안내와 함께 이전 선택을 유지해야 한다.
4. 정상 PDF로 다시 선택하면 이름·크기가 바뀌고 오류 안내가 사라져야 한다. 선택/검사 중 버튼은 비활성화된다.
5. 작은 창·키보드 Tab으로 버튼 포커스와 세로 스크롤을 확인한다. 종료/재실행하면 선택은 초기화된다.
6. 개발 창을 닫고 npm run format:check → npm test → npm run test:electron → npm run test:native를 순서대로 실행한다. 각각 기본 36개, Electron 3경로, 실제 선택/취소 검사 1개가 통과해야 한다.
7. npm run test:shutdown으로 기존 종료 문제를 별도 확인한다. 간헐적 GPU 로그가 재현되면 실패한다. 한 번 통과했다고 해결로 처리하지 않는다.

권한 검사는 생성된 fixture 한 개만 임시 변경·복원한다. 개인 PDF의 이름·권한·내용을 테스트 목적으로 바꿀 필요는 없다. 자세한 명령과 제한은 [README](../README.md)를 따른다.

### Unit 1.1 — 5. 정상 동작 기준과 실제 검증 결과

환경: Windows 11 x64 / Node 24.20.0 / npm 11.19.0 / Electron 44.0.0. 새로운 OS·GPU·PDF 파서 호환성 검증은 아니다.

| 검사 | 결과 | 근거/범위 |
| --- | --- | --- |
| 형식·기본 검사 | 통과 | Prettier 및 Node 테스트 36개(기존 경계 16 + 파일/선택 20) |
| 실제 Electron | 통과 | 개발·빌드·패키지 3경로, 상태 UI·취소/오류 시 이전 선택 유지·교체·중복 방지 |
| 실제 Windows 선택 창 | 통과 | 패키지의 OS 대화상자에서 한글 이름 PDF 선택·취소. 원본 해시 불변 |
| 읽기 권한 거부 | 통과 | 생성한 파일의 실제 읽기 권한 거부 → 한국어 안내 → 원래 권한 복원 → 같은 해시로 읽기 성공 |
| 원본 불변·읽기 범위 | 통과 | 실제 입력 해시/수정 시각 유지, r 모드·최대 9바이트·짧은 읽기·핸들 정리 검사 |
| 입력 거부 | 통과 | 빈 파일·위장/짧은/고비트 서명·확장자·폴더·50 MiB 초과·사라진 파일·UNC/장치/ADS 경로 |
| 크기 경계 | 통과 | 52,428,800바이트 허용, 1바이트 초과 거절. 렌더 성능을 검사한 것은 아님 |
| IPC 경계 | 통과 | 다른 창·프레임·주소·경로 인자 거부, 대화상자 결과 지연/창 종료 후 읽기 방지. 동일 앱 URL의 다른 실제 창 요청도 거부 |
| 기존 보안·오프라인 | 통과 | CSP·격리·권한·외부 탐색/요청 거부, 앱 전용 연결 불가 프록시와 대조 요청. OS 네트워크 설정 변경 없음 |
| 파일 선택 경로의 오류 | 통과 | 위 기능 검사에서 정상 renderer/main 오류·미처리 예외 없음. 잘못된 입력은 상태 메시지로 처리 |
| 종료 회귀 | **실패** | 18회 중 1회, 패키지 표시 250ms 후 닫기에서 기존 GPU 오류 2줄. 모든 창 종료 코드 0·개발 포트 해제는 정상 |
| 전체 무오류 완료 | **보류** | 기존 종료 GPU 진단 OPEN-09 미해결. 파일 선택 검사 성공과 구분 |
| PDF 파싱·손상/암호·페이지 표시 | 미실행 | Unit 1.3 범위, 의존성/기능 미추가 |

검사 도구의 초기 실패도 기록한다. Windows 선택 창 소유 PID가 실행용 PID와 달랐고 기본 컨트롤이 UIA Pane으로 노출되어, 실제 main PID와 해당 대화상자 안의 네이티브 핸들을 사용하도록 고쳤다. 권한 fixture의 PowerShell 모듈 충돌 및 변경 표시 없는 ACL 복원 문제도 수정했다. 실패 과정에서 읽기가 막힌 생성 파일 한 개는 추가한 거부 규칙만 제거해 복구했고, 최종 검사에서 실제 권한 복원과 해시 불변을 확인했다. 이를 앱 기능 실패나 통과로 잘못 집계하지 않았다.

최종 기능 증거는 work/electron-tests/packaged-qlZ4eD, 실제 대화상자는 work/native-dialog-tests/case-50KrVA, 종료 실패는 work/shutdown-tests/3e7ac5cdb30e48a6b9a232aa42fe9156에 있다. 이 자료는 생성 데이터이며 Git/패키지에서 제외한다.

### Unit 1.1 — 6. 예상되는 Edge Case

- 취소/실패: 이전 파일명을 새 성공처럼 바꾸지 않고 유지 사실을 안내한다.
- 검사 도중 파일 삭제·변경·접근 거부: 정해진 오류 코드로 안내하고 핸들을 정리한다. 창이 사라진 뒤 도착한 선택 결과는 읽지 않는다.
- 앞에 데이터가 붙은 비표준 PDF·알 수 없는 버전: 현재 기본 서명 검사에서 거부할 수 있다.
- 서명만 있는 손상 파일·암호 PDF: 구조를 판정하지 않으므로 기본 검사 통과 가능. PDF 정상 열람을 약속하지 않는다.
- 큰 파일·중복 클릭: 상한 초과는 본문을 읽지 않고 거절하며 대화상자는 하나만 진행한다.
- UNC·장치 경로는 거절하지만 매핑 드라이브/클라우드의 실제 저장 매체를 판별하지 않는다.

### Unit 1.1 — 7. 알려진 제한사항

선택한 파일의 메타데이터만 표시하며 PDF.js·본문·페이지 수·암호 입력·드롭·파일 감시·저장은 없다. 현재 메타데이터는 선택 시점 정보이며 앱 종료/새로고침 후 복원하지 않는다. 원본 경로·바이트를 다음 단계용으로 미리 보관하지 않는다.

기존 GPU 오류는 재현됐고 해결하지 않았다. 서명 없는 Windows 테스트 패키지이며 다른 OS/CPU·새 PC·네트워크 저장소·클라우드 자리표시자·스크린 리더 검증은 수행하지 않았다.

### Unit 1.1 — 8. Technical Debt

- OPEN-09: 기존 종료 GPU 오류 원인 규명·안전한 수정과 반복 검증 필요.
- Unit 1.0: 전체 문서 유형/실패 정책 행렬은 별도로 남아 있다. 이번 합성 입력은 파일 선택 경계용이다.
- Unit 1.3: 실제 승인 파일 읽기/교체 계약, PDF 파서의 암호/손상 판정·자원 정리·오프라인 자산을 설계·검증해야 한다.
- Unit 1.6: 임시 50 MiB 상한과 실제 파서·렌더·메모리 예산을 측정해 재검토한다.

### Unit 1.1 — 9. 다음 Unit 진행 전 수정이 필요한 사항

파일 선택 기능 검사는 통과했으나 무오류 완료 기준을 충족하려면 기존 종료 GPU 오류가 해결되어야 한다. Unit 0.4·Phase 0·Unit 1.1을 무조건 완료로 표시하지 않는다. Unit 1.0과 Unit 1.2 이후 기능은 이번 요청에 포함하지 않았다.

### Unit 1.1 — 10. Git Commit Message

제안: `feat(pdf): add read-only file selection for unit 1.1`

실제 Git 초기화·커밋·원격 저장소 생성·공개 배포는 수행하지 않았다.

---

아래 Unit 0.4 기록은 당시 결과다. GPU 항목의 중복 ID는 현재 OPEN-09로 정정했다.

## 0.0.4 작업 기록 — 2026-08-31~2026-09-01

**Unit 0.4 주요 구현·환경 검사 수행. 빠른 종료 GPU 진단 미해결로 Unit/Phase 0 완료 보류. 공개 배포 릴리스 아님.**

작업 전에 현재 프로젝트 파일과 PROJECT_BIBLE/ROADMAP/DECISIONS를 확인했다. Unit 0.4의 검증과 그 과정에서 발견한 환경 오류만 수정했다. PDF·파일 입력·학습 기능이나 Unit 1.0에는 착수하지 않았다.

### Unit 0.4 — 1. 구현한 내용

- 실제 Windows x64 앱 폴더/ASAR 생성, 개발 서버 없는 실행, 앱 폴더만 복사한 독립 실행 검증.
- Node 내장 테스트 16개와 실제 Electron 개발/빌드/패키지 검사 3개를 재실행할 명령 추가. playwright-core 1.62.1은 개발용으로만 설치하고 브라우저는 추가 설치하지 않음.
- Windows 실제 닫기 동작 18회와 종료 전후 로그를 수집하는 test:shutdown 추가. 오류 로그가 있으면 실패하며 간헐적 GPU 진단을 추적.
- 정상 화면·격리·CSP·권한·외부 요청/탐색·자산 경로·종료·앱 네트워크 차단 조건 검사.
- 기존 패키지 폴더가 있으면 성공으로 건너뛰던 동작을 한국어 안내/exit code 1로 수정. 자동 덮어쓰기 없음.
- Electron 패키지의 고정 체크섬을 재사용해 캐시가 있을 때 체크섬 재조회에 불필요하게 의존하지 않도록 수정.
- dist/index.html 누락 시 일반 창을 열던 문제를 필수 파일 확인과 실제 오류 대화상자로 수정.
- 개발 서버의 로컬 데이터 감시 오류와 상위 work 폴더 이름에 의한 전체 프로젝트 차단 수정. 제외 규칙을 프로젝트 내부 경로에 고정.
- 요청 허용 함수를 검사 가능한 작은 모듈로 분리. 실제 허용 목록·preload 권한·sandbox는 유지.
- 작업 버전 0.0.4, 화면의 Unit 표기와 실제 npm 검증 기준 갱신. Shell 배치·PDF/CBT 기능은 변경하지 않음.

### Unit 0.4 — 2. 수정/생성된 파일

| 구분 | 프로젝트 루트 기준 파일 |
| --- | --- |
| 시작 오류 처리·요청 판단 연결 | electron/main.js |
| 요청 허용 판단 모듈 신규 | electron/security.js |
| 패키지 출력 확인·체크섬 | scripts/package.js |
| 개발 서버 감시·제공 제외 경로 | vite.config.js |
| 반복 가능한 검증 신규 | tests/foundation.test.js, tests/electron.test.js, tests/shutdown.ps1 |
| 버전·검증 명령·개발 의존성 | package.json, package-lock.json |
| 현재 Unit 표시 | index.html |
| 실행·직접 검사 안내 | [README.md](../README.md) |
| 진행·기준·결정·결과 문서 | PROJECT_BIBLE.md, ROADMAP.md, DECISIONS.md, CHANGELOG.md |
| 생성된 실행 패키지 | release/local-pdf-cbt-win32-x64/ — Git 제외 |

preload·로컬 프로토콜·Shell 스타일·문제풀이 코드는 확장하지 않았다. IDEA_PARKING은 변경하지 않았다. 분리된 테스트 프로필·임시 복사본·진단 자료는 work에 두며 Git/패키지에는 포함하지 않는다. 원격 저장소·공개 배포·시스템 설정 변경은 없다.

### Unit 0.4 — 3. 실행 방법

현재 PC의 시스템 Node는 **24.20.0**, npm은 **11.19.0**이다. 이 작업에서 전역 설치를 변경하지 않았다. 이전 Unit 당시의 Node 20 안내는 현재에 해당하지 않는다. 별도 Node 24.19.0도 검증했으며 자세한 방법은 README에 있다.

개발 실행은 프로젝트 폴더에서 `npm run dev`, 빌드 자산 실행은 `npm run build` 후 `npm start`다. 실제 패키지는 탐색기에서 아래 파일을 연다.

```text
release/local-pdf-cbt-win32-x64/local-pdf-cbt.exe
```

패키지 실행에는 Node/npm·node_modules·개발 서버가 필요 없다. DLL·locales·resources·라이선스 파일을 포함한 **앱 폴더 전체**를 유지한다. 실행 파일 하나만 복사하면 안 된다. 패키지를 다시 만들려면 기존 출력 폴더를 보관한 뒤 `npm run package`를 실행한다.

### Unit 0.4 — 4. 사용자가 직접 테스트할 방법

1. `node --version`과 `npm --version`으로 지원 환경을 확인한 뒤 `npm run dev`를 실행한다.
2. 빈 문서 작업 공간과 `연결 완료`·Electron 버전·`Unit 0.4 · 기본 화면`을 확인한다. 창 크기를 바꾸고 작은 창에서 아래 안내까지 스크롤한다.
3. 창을 닫고 다시 실행한다. 개발 명령이 종료되고 포트 충돌이 없어야 한다. 터미널 Ctrl+C로 중단할 때도 개발 포트가 남지 않아야 한다.
4. 개발 창을 닫고 `npm run format:check`, `npm test`, `npm run build`, `npm start`를 확인한다. npm test는 16개 검사를 통과해야 한다.
5. 개발 창을 닫고 패키지 실행 파일을 연다. 같은 Shell이 표시되어야 하며 Node/npm을 실행할 필요가 없다. 폴더 전체를 한글·공백이 포함된 다른 위치에 복사해 다시 실행할 수 있다.
6. 현재 소스에 맞는 패키지를 준비한 뒤 `npm run test:electron`을 실행한다. 세 경로가 모두 통과해야 한다. 이 검사는 앱에만 연결 불가능한 프록시를 적용하고 실제 차단을 대조 확인한다. PC 네트워크 설정은 바꾸지 않는다.
7. 선택적으로 사용자가 네트워크 연결을 끊은 상태에서 패키지의 같은 화면을 직접 확인한다. 테스트 중 끊었던 PC 연결은 사용자가 복원한다.
8. 새 프로젝트 복사본에서 `npm ci` → `npm run setup:electron` → `npm test` → `npm run package` → `npm run test:electron`을 실행하면 재설치 과정을 확인할 수 있다. 기존 프로젝트의 개인 파일이나 빌드를 삭제할 필요는 없다.
9. 패키지 폴더가 이미 있을 때 다시 패키징하면 안내/exit code 1이 나오는 것이 정상이다. 별도 검증용 복사본에 dist/index.html이 없으면 한국어 빌드 안내 대화상자 후 exit code 1이어야 한다.
10. 다른 검사와 개발 창을 닫고 `npm run test:shutdown`을 실행한다. Windows 닫기 동작 18회와 종료 전후 stderr가 work/shutdown-tests에 남는다. GPU 오류가 재현되면 검사 실패가 정상이며 통과한 한 번의 실행을 해결 근거로 삼지 않는다. PowerShell 실행 정책은 변경하지 않는다.

### Unit 0.4 — 5. 정상 동작 기준과 실제 검증 결과

환경: Windows 11 x64 / OS build 26200, 별도 Node 24.19.0 및 시스템 Node 24.20.0, npm 11.19.0, Electron 44.0.0. 기존 버전 제한은 유지했다.

| 검사 | 결과 | 확인한 범위 |
| --- | --- | --- |
| 형식·구문·빌드 | 통과 | Prettier, 소스/검증 JS·CJS 구문, Vite 번들 |
| Node 경계 검사 | 통과 | 16개. HTML/JS/CSS·CSP/타입·호스트/자격증명/포트/메서드·경로 탈출/Windows 문자·누락/잘못된 인코딩·요청 허용 목록 |
| 실제 Electron 통합 검사 | 통과 | 개발/빌드 자산/패키지 3경로. 한국어 Shell·기본/최소 배치·preload 연결·정상 종료 |
| 보안 설정 회귀 | 통과 | require/process 미노출, bridge/정보 동결, 제한된 runtimeInfo만 노출, sandbox/contextIsolation/webSecurity 활성화, nodeIntegration/webviewTag 비활성화 |
| 실제 거부 경로 | 통과 | 인라인 스크립트, 배포 인라인 스타일, CSP 연결, CSP와 독립된 세션 요청, 알림/위치 권한, 새 창, 외부/파일 탐색, 패키지 자산 경로 |
| 패키지 포함 범위 | 통과 | app.isPackaged true, app.asar에서 실행, ASAR 루트 dist/·electron/·package.json만 포함. 패키지에 --dev를 전달해도 개발 주소 사용 안 함 |
| 앱 네트워크 차단 조건 | 통과 | 연결 불가능한 앱 전용 프록시로 새 프로필 시작, 캐시·연결 정리 후 Shell 로드. 대조 세션 직접 요청 성공·동일 프록시 요청 실패 확인 |
| 새 프로젝트 재설치 | 통과 | 한글·공백 경로의 새 복사본에 npm ci로 68개 패키지 설치, Electron 준비·Node 검사·빌드·패키지·Electron 검사 재현. npm audit 당시 알려진 취약점 0 |
| 독립 앱 복사본 | 통과 | 앱 폴더만 별도 한글·공백 경로로 복사해 실행·차단 조건·보안 경계 검사 |
| 개발 서버 경로/포트 | 통과 | 앱 소스 제공, work/docs/release HTTP 접근 403, 5173 점유 시 재실행 exit code 1 및 다른 포트 우회 없음 |
| 실제 창 종료 | 통과 | 개발/패키지 각각 표시 직후·250ms 후·1500ms 후 닫기, 명령 exit code 0, 5173 해제 |
| 빠른 종료 로그 무오류 | **미충족** | 패키지 250ms 종료에서 GPU 오류 2줄 재현. 종료 전 로그는 비어 있었으며 닫기 요청 후 출력. 후속 18회 재검사는 통과했으나 간헐적 문제 해결 근거는 아님 |
| 종료 원인 대조 | 원인 미확정 | 동일 Electron/Shell 자산을 파일로 여는 작은 대조 창 39회에서 미재현. 제품 패키지와 로딩 조건이 달라 원인을 특정할 수 없음 |
| 터미널 중단 | 통과 | 실제 Ctrl+C 후 개발 포트 해제. Windows 도구 세션은 중단 코드 1로 종료되었으며 정상 창 닫기의 exit code 0과 구분 |
| 빌드 누락 실패 안내 | 통과 | 수정 전 일반 창/exit code 0 재현 → 수정 후 실제 한국어 안내 대화상자를 캡처해 확인, 닫은 후 exit code 1 |
| 기존 패키지 재생성 거부 | 통과 | 수정 전 빈 결과/exit code 0 → 수정 후 명확한 안내/exit code 1. 기존 출력 자동 덮어쓰기 없음 |
| 정상 화면 오류 | 통과 | Electron 통합 검사 세 경로의 정상 renderer Console Error·pageerror·경고 및 해당 실행의 관측한 main 오류 0. 별도 빠른 종료 GPU 진단은 위 실패 항목으로 구분 |
| 새 Windows/VM·물리적 네트워크 차단 | 미실행 | 현재 PC의 새 폴더/새 의존성·프로필과 앱 전용 차단 조건을 사용. OS 전체 환경을 바꾸지 않음 |
| PDF·CBT·worker | 해당 없음 | 기능·의존성·샘플을 추가하지 않음 |

의도적인 CSP/권한/경로 거부와 빌드 누락 검사는 오류 진단이 기대 결과다. 이를 정상 화면의 무오류 검사와 섞어 전부 오류 0이라고 보고하지 않는다. 보안 검사에는 외부 사이트 대신 로컬 대조 서버와 생성한 시험 파일만 사용했다.

초기 자동화의 실패도 구분했다. Playwright 진단 컨텍스트의 동적 import/종료 후 프로세스 조회와 먼저 취소되는 탐색 이벤트에 대한 잘못된 가정을 수정했다. 네트워크 에뮬레이션 호출이나 navigator.onLine 값만으로 차단을 주장하지 않고 실제 대조 요청이 실패하는 프록시 방식으로 바꿨다. 개발 서버의 실제 감시/경로 오류는 제품 설정에서 수정한 뒤 새 복사본을 다시 검사했다. 검사를 겹쳐 실행해 생긴 포트 충돌은 검증 순서를 직렬화하여 다시 확인했다.

마지막 빠른 종료 검사에서 기존 GPU 진단이 다시 나타나 미재현/완료로 작성했던 초안을 정정했다. 관측 결과는 work/shutdown-tests/observed-gpu-error.json에 보존했다. 종료 검사에서 Windows PowerShell 5.1의 초기 ExitCode가 null이던 수집 문제는 프로세스 핸들을 먼저 보관해 수정하고 18회 다시 확인했다. 제품의 GPU 오류를 테스트 수집 오류로 취급하지 않는다. 원인은 확정하지 못했으며 안전성 근거 없는 종료 지연·그래픽/보안 해제·로그 숨김으로 우회하지 않는다.

### Unit 0.4 — 6. 예상되는 Edge Case

- 기존 release 출력: 안내 후 실패 종료. 새 결과처럼 보이게 하지 않으며 자동 삭제하지 않는다.
- dist/index.html 누락/필수 파일 접근 검사 실패: 정상 창 대신 실행 실패 안내. Node/npm이 없는 사용자도 패키지 폴더가 온전하면 실행 가능하다.
- 5173 점유: 다른 포트로 바꾸지 않고 실패한다. 기존 프로세스를 임의로 종료하지 않는다.
- 한글·공백·상위 work 경로: 새 복사본에서 검증했다. 작업 자료를 감시/제공 대상에서 제외하되 앱 전체를 막지 않는다.
- 개발 다운로드 차단: 처음 설치/캐시 준비에는 인터넷이 필요하다. 설치 준비의 온라인 요구와 앱 실행의 오프라인 원칙은 구분한다.
- 미지원/잘못된 요청: 거부 진단은 기대 동작이며 권한을 열거나 CSP를 완화해 성공시키지 않는다.
- 빠른 창 닫기: 종료 자체는 정상이어도 GPU 오류가 간헐적으로 남는다. 로그와 종료 코드를 별도로 확인하며 OPEN-09을 해결하기 전 Unit 완료로 보지 않는다.

### Unit 0.4 — 7. 알려진 제한사항

패키지는 서명 없는 Windows x64 로컬 테스트 앱이다. 설치 프로그램·공개 배포·자동 업데이트·다른 OS/CPU 지원은 제공하지 않는다. 다른 PC의 Windows 보안 정책이나 SmartScreen 허용 여부는 검증하지 않았으며 보안 설정을 끄라고 안내하지 않는다.

실제 문제풀이·PDF·파일 선택/드롭은 여전히 없다. 오프라인 검사는 앱 전용 프록시 조건이며 OS 전체의 네트워크 어댑터를 끈 시험과 구분한다. 스크린 리더·다중 모니터·다양한 GPU·실제 Windows 배율별 보장은 없다. Unit 0.3의 GPU 로그는 이번에도 재현됐고 원인과 수정 방법은 미확정이다.

### Unit 0.4 — 8. Technical Debt

- PDF.js 도입 시 worker/CMap/font/WASM의 포함 범위·CSP·프로토콜 유형·오프라인·자원 정리를 다시 검증한다. 현재 검사는 HTML/JS/CSS Shell에 한정한다.
- 향후 main 런타임 npm 의존성이 생기면 패키징 허용 목록과 prune 정책을 먼저 재검토한다.
- 배포를 요청받는 시점에 서명·설치 방식·새 PC/VM 지원 행렬과 보안 경고 처리 정책을 검토한다.
- 테스트 도구의 디버깅 연결은 검증 실행에만 사용한다. 앱 자체에 디버그 메뉴나 추가 IPC를 만들지 않았다.
- OPEN-09: 빠른 종료의 GPU 진단 원인을 분리하고 안전한 수정 후 반복 검사할 것. 현재의 성공한 한 번의 검사를 근거로 삭제할 부채가 아니다.

### Unit 0.4 — 9. 다음 Unit 진행 전 수정이 필요한 사항

Unit 0.4를 닫기 전에 OPEN-09의 간헐적 GPU 진단을 해결하고 종료 반복 검사를 다시 수행해야 한다. 사용자 원문의 Console Error 없음 및 ROADMAP의 오류 없음 기준을 낮추지 않는다. Unit 1.0은 시작하지 않았으며 이번 검사를 PDF 호환성/분석 정확도 통과로 해석하지 않는다.

**현재 중단점: Unit 0.4 검증 중 / 빠른 종료 GPU 진단 미해결 / Phase 0 완료 보류. Unit 1.0 및 이후는 미착수.**

### Unit 0.4 — 10. Git Commit Message

제안: `test(foundation): verify offline package and startup for unit 0.4`

실제 Git 초기화·커밋·원격 저장소 생성·공개 배포는 수행하지 않았다.

---

아래는 Unit 0.3 완료 당시의 기록이다. 당시 미완료였던 패키지 검증과 GPU 진단 관찰은 이력으로 보존하며, 현재 상태는 위 Unit 0.4 기록을 따른다.

## 0.0.3 — 2026-08-31

**Unit 0.3 완료: 기본 Application Shell. 배포 릴리스 아님.**

작업 전에 현재 프로젝트 파일과 PROJECT_BIBLE/ROADMAP/DECISIONS를 확인했다. 사용자가 요청한 Unit 0.3의 한국어 빈 화면·상태 영역·창 크기 대응만 구현했다. Unit 0.4나 PDF/CBT 기능에는 착수하지 않았다.

### Unit 0.3 — 1. 구현한 내용

- 앱 이름·로컬 전용 안내, 문서 작업 공간의 빈 상태, 앱 상태, 하단 안내로 구성한 한국어 Shell.
- 기존 preload 정보로 실행 연결과 Electron 버전 표시. 정보가 없으면 성공 표시 대신 Electron 실행 방법 안내.
- 기본 1120×760, 최소 640×480 창. 좁은 화면에서는 상태 영역을 아래로 옮기고 세로 스크롤 허용.
- 의미 있는 HTML 영역·제목, 문구를 동반한 상태 색상, 상태 안내용 접근성 속성, 장식 SVG의 접근성 제외.
- 화면 초기화와 상태 표시 모듈 분리, 기본 색상/글꼴과 Shell 배치 CSS 분리. 시스템 글꼴과 인라인 SVG만 사용.
- package.json/lockfile의 작업 버전을 0.0.3으로 맞춤. 의존성·파일 접근·CSP·preload 권한·패키징 방식은 변경하지 않음.

파일 선택·드롭·PDF.js·렌더링·페이지 이동·배율 제어·가림·답 선택·채점·저장·OCR·AI는 구현하지 않았다. 이를 위한 빈 서비스나 미래 기능 버튼도 만들지 않았다.

### Unit 0.3 — 2. 수정/생성된 파일

프로젝트 루트 기준:

| 구분 | 파일 |
| --- | --- |
| Shell 구조·초기화·기본 스타일 수정 | index.html, src/main.js, src/styles/base.css |
| 상태 표시·반응형 배치 신규 | src/ui/runtime-status.js, src/styles/shell.css |
| 창 크기·배경색 수정 | electron/config.js, electron/main.js |
| 작업 버전 갱신 | package.json, package-lock.json |
| 실행·수동 검사 안내 | [README.md](../README.md) |
| 현재 상태·구조·결정·검증 기록 | PROJECT_BIBLE.md, ROADMAP.md, DECISIONS.md, CHANGELOG.md |

IDEA_PARKING, preload, 로컬 프로토콜, 개발/패키징 스크립트와 Vite 설정은 변경하지 않았다. 검증용 임시 스크립트·로그·캡처·분리된 Electron 프로필은 프로젝트 밖 `work/`에 두었다. node_modules/dist와 함께 Git·배포 대상에 추가하지 않았다. 새 테스트 프레임워크나 제품 의존성도 설치하지 않았다.

### Unit 0.3 — 3. 실행 방법

프로젝트 폴더에서 Node 24.19 이상인 24 LTS를 사용한다. 현재 PC의 기본 Node 20은 바꾸지 않았으므로 [README의 이 PC용 Node 24 실행 절차](../README.md)를 먼저 적용한다.

```powershell
npm run dev
```

현재 작업 폴더에는 의존성과 Electron 바이너리가 이미 있다. 새 복사본에서만 README에 따라 `npm ci`와 `npm run setup:electron`으로 준비한다. 빌드 자산 모드는 `npm run build` 후 개발 창을 닫고 `npm start`로 실행한다. 패키징 명령은 이번에도 실행하지 않았다.

### Unit 0.3 — 4. 사용자가 직접 테스트할 방법

1. Node 24로 `npm run dev`를 실행한다. 이 PC의 별도 Node 사용 시 README처럼 `& $taskNode $taskNpmCli run dev`를 사용한다.
2. 상단 `Local PDF CBT`, 가운데 `아직 열린 PDF가 없습니다`, 앱 상태의 `연결 완료`와 `Electron 44.0.0`, 하단 `Unit 0.3 · 기본 화면`을 확인한다.
3. 창을 넓혔다가 좁힌다. 넓을 때 작업 공간과 앱 상태가 좌우에, 좁을 때 위아래에 있어야 한다.
4. 모서리를 끌어 최소 크기까지 줄인다. 가로 넘침이나 문구 겹침이 없어야 하고, 아래로 스크롤하면 상태·하단 안내까지 읽을 수 있어야 한다. 창의 최소 크기 640×480은 테두리를 포함한 논리 픽셀이다.
5. 파일 열기·드롭 영역·페이지 이동·답 확인 버튼이 없는지 확인한다. 실제 PDF를 가져올 수 없는 것이 현재 정상 동작이다.
6. 화면 표시 후 창을 닫고 재실행한다. 개발 명령이 끝나고 포트가 해제되어 다시 열 수 있어야 한다.
7. `npm run format:check`와 `npm run build`가 성공하는지 확인한다. 개발 창을 닫은 뒤 `npm start`에서도 같은 Shell과 연결 상태가 보여야 한다.
8. 선택적으로 개발 서버 실행 중 일반 브라우저에서 로컬 개발 주소를 연다. Electron 창과 달리 `Electron 실행 필요` 및 실행 방법이 표시되어야 한다. 외부 사이트 접속이나 파일 업로드는 필요 없다.

### Unit 0.3 — 5. 정상 동작 기준과 실제 검증 결과

환경: Windows 11 x64 / build 26200, 개발 Node 24.19.0, npm 10.8.2, Electron 44.0.0. 실제 Electron을 사용했으며 sandbox를 유지했다.

| 검증 | 결과 | 확인한 범위 |
| --- | --- | --- |
| 코드 형식·구문·Vite 빌드 | 통과 | Prettier 검사, JS/CJS 구문, dist의 HTML/JS/CSS 생성 |
| 개발/빌드 자산 화면 | 통과 | 루프백 Vite와 local-cbt 프로토콜 양쪽에서 한국어 Shell·빈 상태·실제 실행 정보 |
| 기본 1120×760 / 넓은 1400×900 | 통과 | 창 테두리 포함 크기. 두 열 배치, 불필요한 세로 스크롤·가로 넘침 없음 |
| 좁은 800×600 / 최소 640×480 | 통과 | 한 열 배치, 가로 넘침·영역 겹침 없음, 스크롤로 하단 도달 |
| 최소 창 + 화면 200% 확대 | 통과 | 약 312×220 CSS px에서 줄바꿈·한 열 배치·하단 도달. 확대는 도구로 적용했으며 앱 배율 기능은 없음 |
| 최소 크기 제한 | 통과 | 320×240으로 줄이는 시도에도 640×480 이상 유지 |
| 실행 정보 없는 상태 | 통과 | 개발 모드에서 표시 함수에 undefined 전달 → `Electron 실행 필요`·명령 안내. 실제 정보 복원 시 연결 완료 |
| 정상 경로 콘솔 | 통과 | 두 모드의 화면/크기 검사에서 renderer Console Error·pageerror·경고 0, 관측한 main 실행 오류 0 |
| 기존 보안 경계 회귀 | 통과 | require/process 미노출, runtimeInfo만 노출·동결, nodeIntegration false, sandbox/contextIsolation/webSecurity true, webviewTag false |
| 외부 화면 자산·미래 기능 UI | 통과 | 관측한 renderer 요청은 해당 로컬 경로뿐. 파일/학습 제어·Canvas·iframe·webview 없음 |
| 실제 개발 명령의 정상 창/종료 | 통과 | 보이는 창, 표시 후 닫기, 명령 exit code 0, 5173 포트 해제 |
| 생성 직후 즉시 종료 | 관찰 사항 있음 | 첫 시험에서 Chromium GPU 진단 stderr 2줄. 종료·exit code 0·포트 해제는 정상; 표시 후 종료에서 미재현 |
| ASAR 패키지·오프라인/보안 종합 시험 | 미실행 | Unit 0.4의 작업 |
| PDF·CBT 동작 | 해당 없음 | 이번 범위에 구현하지 않음 |

자동화에서 기본·최소 화면을 캡처해 직접 확인했다. 200% 확대의 Playwright 전체 페이지 캡처에는 크기 왜곡이 있어, Electron 네이티브 화면 캡처로 상단과 하단을 추가 확인했다. 자동화 초기 시도의 `ERR_ABORTED`는 앱 초기 로딩 완료 전에 검증 스크립트가 새로고침한 경우였다. 로딩을 기다리도록 검증 순서를 수정한 뒤 양쪽 실행 경로를 다시 통과했다. 앱의 오류 처리·보안 설정을 약화하지 않았다.

구조 검토: 정적 Shell은 HTML, 실행 상태 갱신은 작은 UI 모듈, 크기 대응은 CSS, 네이티브 창 범위는 Electron 설정에 둔다. 기존 개발 수명과 보안 코드를 유지하고 회귀 확인했다. 범용 상태 저장소나 실제로 사용하지 않는 폴더/서비스가 추가되지 않았다.

### Unit 0.3 — 6. 예상되는 Edge Case

- 최소 창·큰 글씨/확대: 상태 영역이 아래로 내려가고 세로 스크롤이 필요하다. 내용이 잘린 상태로 고정하지 않는다.
- Electron 밖에서 화면 열기·실행 정보 누락: 연결 완료로 표시하지 않고 Electron 실행 방법을 안내한다.
- 긴 상태 문구: 줄바꿈을 허용한다. 미래 파일명·오류 상세 문자열은 실제 해당 UI를 도입할 때 검증한다.
- 메인/프리로드 변경: 자동 재시작 대상이 아니므로 앱을 다시 실행한다. Node 20·5173 포트 점유·dist 없음의 기존 안내는 유지한다.
- 창 생성 직후 종료: 이번 관찰을 근거로 Unit 0.4에서 종료 시점별 반복 확인한다. GPU 진단의 일반적인 원인을 확정하지 않았다.

### Unit 0.3 — 7. 알려진 제한사항

기본 Shell만 있고 실제 학습 기능은 없다. 창 크기·위치나 학습 상태를 저장하지 않으며 사용자 조작용 확대 기능도 없다. 화면 폭이 좁으면 모든 영역이 한 번에 보이지 않고 세로로 스크롤해야 한다.

현재 PC의 개발/빌드 자산 모드만 검증했다. 200% 검사는 Electron 화면 확대이고 Windows 디스플레이 배율·다중 모니터 검증과 다르다. 스크린 리더 실사용·키보드 스크롤 전 경로·다른 OS·패키지 배포 검증은 수행하지 않았다. 초기 즉시 종료의 내부 GPU 로그 관찰을 전체 콘솔 무오류로 축약하지 않는다.

### Unit 0.3 — 8. Technical Debt

- Unit 0.4: Packager/ASAR·오프라인·CSP/권한 거부·재설치·종료 시나리오 검증. 창 생성 직후 GPU 진단의 재현 여부와 환경 조건도 확인한다.
- 실제 PDF 레이어 도입 시 작업 공간의 스크롤·배율·페이지 수명 경계를 다시 검토한다. 현재 문서 전체 스크롤은 빈 Shell에 한정한 결정이다.
- 일반 브라우저 안내 문구는 개발용 fallback이며 실제 preload 실패를 복구하는 기능은 아니다.
- 지속 실행형 테스트 체계와 접근성 실사용 검증은 필요한 범위에서 후속 도입한다. 이번 임시 자동화 검사는 제품에 테스트 의존성을 추가하지 않았다.

의도적으로 유보한 PDF/CBT 기능은 Shell의 결함으로 취급하지 않는다. 이번 정상 화면·창 크기 대응 검증에서 남은 차단 결함은 없다.

### Unit 0.3 — 9. 다음 Unit 진행 전 수정이 필요한 사항

Unit 0.4 착수를 막는 필수 코드 수정은 현재 확인되지 않았다. 다음 요청 시 기존 기준 문서와 실행 환경을 다시 확인하고, 위의 GPU 진단 관찰을 포함한 환경 검증을 진행한다. PDF 기능이나 패키지 검증을 이번 완료로 간주하지 않는다.

**현재 중단점: Unit 0.3 완료. Unit 0.4 및 이후 기능은 시작하지 않았다.**

### Unit 0.3 — 10. Git Commit Message

제안: `feat(shell): add responsive application shell for unit 0.3`

실제 Git 초기화·커밋·원격 저장소 생성·공개 배포는 수행하지 않았다.

---

아래는 Unit 0.2 완료 당시의 기록이다. 당시의 연결 확인 화면과 후속 Unit 미착수 상태를 이력으로 보존하며, 현재 상태는 위 Unit 0.3 기록을 따른다.

## 0.0.2 — 2026-08-31

**Unit 0.2 완료: Electron + Vite + Vanilla JavaScript 최소 실행 환경. 배포 릴리스 아님.**

사용자가 PROJECT_BIBLE과 ROADMAP을 기준으로 Unit 0.2 진행을 명시적으로 요청했다. 작업 전에 현재 파일과 PROJECT_BIBLE/ROADMAP/DECISIONS를 확인했다. 기존 프로젝트에는 문서 5개만 있었으며, 이번에 최소 실행 코드와 개발 설정을 추가했다.

### Unit 0.2 — 1. 구현한 내용

- Node 24 LTS 기반 npm 프로젝트, 고정 직접 의존성과 package-lock.json.
- Electron ESM main / CommonJS sandbox preload / Vite Vanilla JS renderer 연결.
- `npm run dev`의 루프백 서버 시작 → Electron 창 열기 → 창 종료 시 서버 정리.
- `npm run build`의 renderer 번들, `npm start`에서 사용하는 로컬 자산 프로토콜.
- 공식 Packager를 사용하는 Windows x64 패키징 명령 **설정만** 준비.
- 격리·CSP·권한/탐색 기본 거부와 읽기 전용 실행 정보만 노출하는 preload.
- Node 버전 검사, Electron 바이너리 준비 명령, Prettier·EditorConfig·Git 제외 규칙.
- 연결 확인 문구만 표시하는 최소 화면. PDF·파일 선택·CBT·Application Shell은 미구현.

실제 실행 명령 검사에서 `windowsHide: true`로 Electron GUI까지 숨겨지는 문제가 발견되어 GUI 프로세스에 한해 `false`로 고쳤다. 백그라운드 콘솔 helper를 숨기는 것과 사용자가 볼 앱 창을 숨기는 것은 구분했다. 변경 후 보이는 창·정상 종료를 다시 확인했다.

### Unit 0.2 — 2. 수정/생성된 파일

프로젝트 루트 기준:

| 구분 | 파일 |
| --- | --- |
| 패키지·실행 환경 | package.json, package-lock.json, .node-version, .npmrc |
| 코드 형식·제외 규칙 | .editorconfig, .prettierrc.json, .prettierignore, .gitignore |
| Electron | electron/main.js, electron/preload.cjs, electron/config.js, electron/local-protocol.js |
| 화면 진입점 | index.html, src/main.js, src/styles/base.css |
| 개발·빌드 | vite.config.js, scripts/dev.js, scripts/check-runtime.js, scripts/package.js |
| 사용 안내 | [README.md](../README.md) |
| 갱신 문서 | PROJECT_BIBLE.md, ROADMAP.md, DECISIONS.md, CHANGELOG.md |

IDEA_PARKING.md는 변경하지 않았다. 설치된 node_modules와 생성된 dist는 재생성 가능한 산출물이며 Git 대상이 아니다. 검증용 임시 스크립트·로그·화면 캡처·프로필은 프로젝트 밖 작업 폴더에 두었고 앱 코드나 패키징 대상에 넣지 않았다.

### Unit 0.2 — 3. 실행 방법

`package.json`이 있는 프로젝트 폴더에서 Node 24.19 이상인 24 LTS와 npm을 사용한다.

```powershell
npm ci
npm run setup:electron
npm run dev
```

현재 작업 폴더에는 의존성과 Electron 바이너리를 이미 준비했으므로 재설치 없이 개발 실행이 가능하다. 새 복사본에서 최초 준비할 때만 앞의 설치 두 명령이 필요하다.

**이 PC의 기본 Node는 20.19.1이며 전역 설치·영구 PATH를 바꾸지 않았다.** [README의 이 PC용 Node 24 실행 방법](../README.md)을 먼저 적용한다. 기존 npm.cmd가 Node 20을 사용할 수 있어 별도 Node 24로 npm CLI를 실행하는 예제를 제공했다.

빌드 후 로컬 파일 모드 실행은 `npm run build` → `npm start`다. 패키징은 `npm run package`로 준비했으나 이번 Unit에서 실행하지 않았다.

### Unit 0.2 — 4. 사용자가 직접 테스트할 방법

1. README에 따라 Node 24로 프로젝트 폴더에서 `npm run dev`를 실행한다.
2. 실제 Electron 창에 `Local PDF CBT`, `Unit 0.2 · 개발 환경 연결 확인`, `Electron 44.0.0 · Vite · Vanilla JavaScript 연결 완료`가 보이는지 확인한다.
3. 파일 열기·페이지 이동·답 확인 버튼이 없는지 확인한다. 현재는 연결 확인 화면만 있는 것이 정상이다.
4. 창을 닫는다. 실행 명령이 끝나고 다시 `npm run dev`를 실행했을 때 포트 충돌이 없어야 한다.
5. `npm run format:check`, `npm run build`를 실행한다. 둘 다 성공해야 한다.
6. 개발 서버를 종료한 상태에서 `npm start`를 실행한다. 같은 연결 문구가 나타나야 한다. 아직 설치형/ASAR 패키지 검증은 아니다.

### Unit 0.2 — 5. 정상 동작 기준과 실제 검증 결과

환경: Windows 11 x64 / OS build 26200, 개발 Node 24.19.0, npm 10.8.2. Electron 44.0.0 내부는 Node 24.18.1 / Chromium 152.0.7977.54였다.

| 검증 | 결과 | 확인한 범위 |
| --- | --- | --- |
| 의존성 설치·정확한 버전 목록 | 통과 | Electron 44.0.0, Vite 8.2.2, Packager 20.3.0, Prettier 3.9.6 |
| Electron 바이너리 준비 | 통과 | 공식 install-electron으로 Windows x64 실행 파일 준비 |
| `npm run format:check` | 통과 | 코드·설정·README. 기존 docs는 자동 포맷 제외 |
| 소스 구문 검사 | 통과 | electron/scripts/src의 JS/CJS 8개 |
| `npm run build` | 통과 | dist의 HTML·JS·CSS 생성 |
| Electron 개발 모드 최소 연결 | 통과 | 루프백 Vite 화면·preload 정보·실제 렌더링 |
| Electron 빌드 자산 모드 최소 연결 | 통과 | 개발 서버 없이 local-cbt 프로토콜로 dist 표시 |
| renderer 격리 | 통과 | require/process 미노출, runtimeInfo만 노출, bridge 동결, sandbox/contextIsolation/webSecurity 활성화 |
| 정상 경로 콘솔·예외 | 통과 | 개발/빌드 자산 두 경로에서 관측한 renderer Console Error·pageerror 0, 경고 0. main 실행 오류 없음 |
| 실제 `npm run dev`의 창·종료 | 통과 | 보이는 창 열기·닫기, 명령 exit code 0, 5173 포트 해제 |
| Node 20 실행 거부 | 통과 | 프로젝트 버전 안내 메시지와 exit code 1 확인; Node 24는 허용 |
| ASAR 패키지 생성·실행 | 미실행 | Unit 0.4의 작업 |
| 네트워크 차단·권한 거부·경로 공격 종합 검증 | 미실행 | 정책은 구성했으나 전체 보안/오프라인 시험은 Unit 0.4 |
| 새 PC·깨끗한 설치·다른 OS 검증 | 미실행 | 현재 Windows 환경의 최소 연결만 확인 |
| PDF·마스크·채점 검증 | 해당 없음 | 이번 Unit 범위에 구현하지 않음 |

검증 도중 기본 격리 실행 환경의 연결/파일 접근 제한으로 일부 시도가 중단되었다. 앱의 sandbox 설정을 끄지 않고 허용된 로컬 실행 환경에서 다시 검증했다. 특히 Node 20의 초기 권한 오류를 버전 검사 성공으로 취급하지 않고, 프로젝트 안내 메시지가 실제 출력되는지 별도로 확인했다.

### Unit 0.2 — 6. 예상되는 Edge Case

- 시스템 Node 20 사용: 프로젝트가 명확한 버전 안내로 실행을 거부한다. Node 24 경로를 사용한다.
- 5173 포트 점유: 다른 포트로 조용히 바꾸지 않는다. 현재 사용 중인 앱을 확인한 뒤 재실행한다. 포트 충돌 자체의 종합 시험은 0.4에서 수행한다.
- 바이너리 미준비·다운로드 차단: 온라인 개발 준비 단계에서 setup:electron을 완료해야 한다. 패키지 설치 성공과 Electron 실행 파일 준비를 혼동하지 않는다.
- dist 누락: `npm start` 전에 빌드해야 한다. 실행 실패 안내 경로를 구성했지만 누락 파일 시나리오의 전체 시험은 0.4에 남겨둔다.
- main/preload 변경: Vite의 화면 갱신과 달리 개발 명령을 재시작해야 한다.
- 기존 패키지 출력: 덮어쓰지 않도록 설정했다. 사용자가 기존 결과를 보관/정리한 뒤 다시 생성한다.

### Unit 0.2 — 7. 알려진 제한사항

현재 결과물은 최소 실행 환경이다. 사용 가능한 PDF Viewer나 CBT가 아니며 기본 Application Shell도 아직 없다. Windows 11 x64 외 환경은 지원 검증하지 않았다. 실제 배포 패키지·오프라인 전체 동작을 통과했다고 주장하지 않는다.

학습 데이터 저장은 없지만 Electron 자체의 정상 실행 프로필은 기본 사용자 앱 데이터 위치에 생성될 수 있다. 자동화 연결 검증에는 작업 폴더의 분리된 프로필을 사용했다. 외부 자료 업로드·자동 업데이트 기능은 추가하지 않았다.

### Unit 0.2 — 8. Technical Debt

- Packager 출력·ASAR 내 자산·격리/CSP 거부 경로·오프라인·재설치는 Unit 0.4에서 검증해야 한다.
- 현재 프로토콜의 자산 유형은 HTML/JS/CSS만 허용한다. PDF.js 도입 시 필요한 자산과 CSP를 근거에 따라 확장하고 다시 검증해야 한다.
- 현재 패키지에는 런타임 npm 의존성이 없어 포함 규칙이 단순하다. 향후 main 의존성이 생기면 package.js의 허용 목록을 재검토한다.
- 실행 중 main/preload 자동 재시작과 지속 실행형 테스트 프레임워크는 현재 넣지 않았다. 필요성이 생기는 Unit에서 선택한다.
- 시스템 Node 업그레이드는 수행하지 않았다. 현재 PC에서는 README의 별도 Node 실행 절차가 필요하다.

이는 이번 Unit의 미완성 PDF 기능이 아니라 다음 단계에서 확인할 환경·구조 과제다. 최소 연결을 막는 알려진 코드 결함은 이번 검증 범위에서 남아 있지 않다.

### Unit 0.2 — 9. 다음 Unit 진행 전 수정이 필요한 사항

Unit 0.3의 기본 Application Shell을 막는 필수 수정 사항은 현재 확인되지 않았다. 다음 착수 시 이 문서와 실행 환경을 확인한다. 포트 충돌·부하 중 종료 같은 추가 수명 시나리오와 배포 패키지 검증은 0.4에서 이어서 확인한다.

**현재 중단점: Unit 0.2 완료. Unit 0.3 및 이후 기능은 시작하지 않았다.**

### Unit 0.2 — 10. Git Commit Message

제안: `build(foundation): scaffold Electron and Vite runtime for unit 0.2`

실제 Git 저장소 초기화·커밋·원격 저장소 생성·공개 배포는 수행하지 않았다.

---

아래는 Unit 0.1 완료 당시의 기록이다. 당시의 승인 대기·코드 없음 상태를 이력으로 보존하며, 현재 상태는 문서 맨 위의 최신 버전 기록을 따른다.

## 0.0.1-docs.1 — 2026-08-31

**문서 기준판. 앱 릴리스 아님. Unit 0.1 문서 작성 완료 / 사용자 승인 대기.**

### 추가

- Project Bible의 목적·Local First·기술·아키텍처·개발·보안·테스트 등 18개 기준 항목.
- 요구사항의 충돌·누락 검토, 5개 핵심 PDF 기술 질문에 대한 타당성 판단, 검증 우선순위.
- 단순 형식에 한정하는 첫 MVP 제안과 분석 실패·채점 불가·원문 보기 정책.
- Phase 0~10 로드맵, 샘플 검증 행렬, 구조 검토·통합 검증 관문.
- 기술 결정 10개, 결정 유보 사항, MVP 이후 아이디어 목록.

### 원래 계획에서 제안한 변경

- 좌표 검증을 위해 Unit 2.5 Debug Overlay를 2.2 직후로 이동하고 기존 번호를 유지.
- 샘플 준비, 분석·CBT 구조 검토, PDF 기초/분석/MVP 통합 검증 Unit 추가.
- Phase 4 이후를 보정·문제 분리, 저장, 시험, 통계/복습, 검색, OCR, AI로 세분화.
- 변경 이유와 미승인 제안의 범위는 [DECISIONS](DECISIONS.md)에 기록.

### 수행하지 않은 작업

애플리케이션 코드, package.json, Electron/Vite 설정, 의존성 설치, PDF 샘플 생성, OCR/AI 호출, DB, 실행 테스트, Git 초기화/커밋, 원격 저장소 생성, 공개 배포는 수행하지 않았다.

## Unit 0.1 완료 기록

### 1. 구현한 내용

요구사항 텍스트를 읽고 기능·원칙·예외·진행 제한을 분석했다. 공식 기술 자료로 사용 가능한 API와 주의점을 확인하고 프로젝트 기준 문서 5개를 작성했다. 구현물은 문서뿐이며 기술 실증은 후속 Unit의 일이다.

### 2. 수정/생성된 파일

프로젝트 루트 `outputs/local-pdf-cbt/` 기준, 아래 5개를 신규 생성했다. 기존 앱 파일은 없고 수정하지 않았다.

| 파일 | 역할 |
| --- | --- |
| [docs/PROJECT_BIBLE.md](PROJECT_BIBLE.md) | 최상위 개발 기준 18항목 |
| [docs/ROADMAP.md](ROADMAP.md) | Phase/Unit·순서·상태·완료 기준 |
| [docs/DECISIONS.md](DECISIONS.md) | 요구사항 분석·타당성·기술 결정·미정 사항 |
| [docs/CHANGELOG.md](CHANGELOG.md) | 변경 내용과 현재 Unit 완료 기록 |
| [docs/IDEA_PARKING.md](IDEA_PARKING.md) | 후속 아이디어와 채택 조건 |

### 3. 실행 방법

설치나 실행 명령은 없다. Markdown을 지원하는 편집기에서 PROJECT_BIBLE.md를 연 뒤 관련 문서 링크를 따라 읽는다. 아직 `npm install`, `npm run dev`, 빌드 명령을 실행할 프로젝트가 없다.

### 4. 사용자가 직접 테스트할 방법

1. PROJECT_BIBLE의 18개 항목이 의도한 제품 방향과 맞는지 확인한다.
2. DECISIONS의 쟁점 표와 A~G 처리 표에서 실제 사용할 PDF가 MVP 지원 대상인지 검토한다.
3. 특히 단일 페이지/문제 제한, Windows 우선, 메모리만 유지, 암호 PDF 유보, 불확실 시 가림 유지 제안을 확인한다.
4. ROADMAP에서 Unit 0.2가 승인 대기이고 이후 구현이 완료로 표시되지 않았는지 확인한다.
5. 다섯 문서의 상대 링크를 열어 보고 `local-pdf-cbt/` 아래 애플리케이션 코드가 없는지 확인한다.

이는 문서 검토 절차다. PDF 렌더링이나 CBT 실제 동작을 시험하는 절차가 아니다.

### 5. 정상 동작 기준

문서 5개가 존재하고, 사용자가 요청한 기준·분석·후속 계획·완료 기록이 누락 없이 연결되어야 한다. 제안과 확정 요구가 구분되고 현재 작업이 Unit 0.1에서 멈춰 있어야 한다.

| 확인 항목 | 결과 | 범위 |
| --- | --- | --- |
| 요구사항 읽기·공식 기술 문서 확인 | 수행 | 설계 자료 조사. 실제 PDF 검증 아님 |
| 문서 파일·내부 링크·필수 항목 점검 | 통과 | 파일 5개, 내부 링크 21개, Bible 18항목, Unit 보고 10항목 확인. UTF-8 대체 문자·미닫힌 코드 블록 없음 |
| 문서 간 범위·상태 검토 | 수행 | Unit 0.1만 문서 작성 완료, 0.2 승인 대기, 후속 기능 미착수/향후 표시 확인 |
| Electron 개발/빌드 실행 | 해당 없음 | 코드·패키지 없음 |
| PDF 텍스트·좌표·마스크·채점 시험 | 미실행 | 샘플 PDF·구현 없음 |
| Console Error 없음 | 해당 없음 | 앱을 실행하지 않아 판정할 수 없음 |
| 오프라인 앱·원본 해시 비교 | 미실행 | 후속 구현 Unit에서 수행 |

### 6. 예상되는 Edge Case

서로 다른 형식의 PDF, 분절된 한글, 정답 없는 문제, 복수 정답, 다단·다문제·페이지 연결, 스캔/혼합 문서, 확대·회전·DPI 오차, 렌더 지연에 따른 정답 노출, 암호·손상·대용량 입력을 문서와 샘플 행렬에 반영했다. 해당 사례가 이미 처리되는 앱이 있다는 뜻은 아니다.

### 7. 알려진 제한사항

실제 문제 PDF가 제공되지 않아 지원 프로파일·인식 정확도·성능을 확정하지 못했다. 문서는 승인 전 초안이다. Windows x64와 세션 메모리 정책 등은 사용자 명시 요구가 아닌 제안이다. 애플리케이션과 실행 가능한 CBT는 아직 없다.

### 8. Technical Debt

현재 코드가 없으므로 코드 부채는 없다. 후속 검증 과제로 정확한 버전/패키징 도구, preload 모듈 호환성, 실제 샘플, 텍스트 bbox·규칙 임계값·자원 예산이 남아 있다. 이는 숨겨진 완료 항목이 아니라 DECISIONS의 OPEN 목록으로 관리하는 유보 사항이다.

SQLite·OCR·AI·수동 보정의 미구현은 의도적인 범위 유보다. MVP가 실제 요구를 충족하지 못한다는 검증 결과가 나오면 일정·범위 결정부터 다시 해야 한다.

### 9. 다음 Unit 진행 전 수정이 필요한 사항

사용자가 문서와 제안한 MVP 경계를 검토·승인해야 한다. 수정 요청이 있으면 문서부터 갱신한다. 현재 발견된 선행 코드 수정 사항은 없다. 구체적인 버전과 런타임 조합은 Unit 0.2의 작업이고 실제 PDF 샘플은 Unit 1.0 이후의 작업이다.

**현재 중단점: Unit 0.1. 다음 Unit 0.2는 미착수이며 사용자 승인 전에는 시작하지 않는다.**

### 10. Git Commit Message

제안 메시지: `docs(foundation): define project bible and phased roadmap`

실제 Git 커밋은 만들지 않았다. 이 메시지는 사용자가 향후 문서 변경을 커밋할 때 사용할 수 있는 제안이다.
