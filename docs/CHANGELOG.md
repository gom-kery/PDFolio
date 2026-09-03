# Local PDF CBT — Changelog

프로젝트 문서와 구현의 변경을 구분해 기록한다. 앱 버전·릴리스·테스트 결과를 추정하여 적지 않는다. 기준은 [PROJECT_BIBLE](PROJECT_BIBLE.md), 진행 상태는 [ROADMAP](ROADMAP.md)을 따른다.

## 0.3.0 / Unit 4.1 작업 기록 — 2026-09-03

**Unit 3.1의 선행 관문인 한 페이지·한 문제용 수동 해설·정답 영역 설정을 구현했다. 사용자가 원문에서 두 사각형을 직접 지정하고 불투명 미리보기 뒤 확정한 Question/Region만 현재 세션에 유지한다. 이 설정 Overlay는 아직 CBT Mask가 아니며 정답 추출·선택·공개·채점은 추가하지 않았다.**

작업 전에 현재 프로젝트 파일, PROJECT_BIBLE, ROADMAP, DECISIONS와 Git 상태를 확인했다. 시작 작업 트리는 `main...origin/main` 기준으로 깨끗했고 HEAD는 `431078d`의 Unit 3.0 커밋이었다.

### Unit 4.1 — 1. 구현한 내용

- PDF를 연 일반 Viewer의 오른쪽 사이드에 `해설·정답 영역 설정` 카드를 추가했다. 설정 중 원문과 정답이 보일 수 있고 아직 CBT가 아니라는 안내를 유지한다.
- 현재 페이지에서 `solution`과 `answer` 사각형을 각각 하나 포인터로 지정한다. Canvas CSS 좌표를 회전 전 PDF user space로 역변환하고 유한한 양수 크기, 페이지 범위, 최소 8 CSS px와 상호 비겹침을 검증한다.
- 두 영역이 유효할 때만 불투명 가림 미리보기를 허용한다. 사용자가 확정하면 세션 독립 Question v1 하나와 소유된 Region v1 두 개를 원자적으로 만들고 설정 Overlay를 숨긴다.
- 기존 확정 수정 중에는 확정을 후속 Mask 입력으로 제공하지 않는다. 취소하면 이전 확정을 복원하고 재확정하면 새 ID로 교체한다.
- 페이지 이동은 미완료 초안만 취소하며 같은 페이지의 확정은 유지한다. 파일 교체·documentRevision 변경·새로고침·종료는 전체 수동 확정을 폐기한다. 원본 PDF에는 쓰지 않는다.
- 확대·축소·높이 맞춤·창 크기와 PDF 고유 회전마다 저장 PDF 좌표를 현재 viewport와 Canvas CSS 크기로 다시 투영한다.
- Debug Overlay 실행에서는 수동 설정 UI를 숨겨 좌표 진단과 사용자 확정을 동시에 수행하지 않게 했다.
- 첫 Phase 3 실행 전 코드 버전이므로 SemVer를 0.3.0으로 올리고 Windows x64/ASAR 패키지를 새로 생성했다. 이전 패키지는 `work/unit-4.1-before-package/release/`에 보관했다.

### Unit 4.1 — 2. 수정/생성된 파일

| 구분 | 파일·변경 |
| --- | --- |
| 수동 설정 도메인 | `src/cbt/manual-region-setup.js` — 사각형 검증·좌표 역변환·Question/Region 확정·세션 무효화 |
| 수동 설정 UI | `src/ui/manual-region-setup.js` — 드래그·미리보기·수정·확정·취소·viewport 재투영 |
| Viewer 연결 | `src/ui/pdf-viewer.js`, `src/pdf/pdf-adapter-core.js` — 페이지 geometry/revision 전달과 문서·페이지 수명 연결 |
| 화면 | `index.html`, `src/styles/shell.css` — 설정 카드·Overlay·상태·Unit footer |
| 단위·통합 검사 | `tests/manual-region-setup.test.js`, `tests/pdf-adapter.test.js`, `tests/helpers/pdf-selection-checks.js`, `tests/electron.test.js`, `tests/debug-overlay.test.js` |
| 버전·명령 | `package.json`, `package-lock.json` — 0.3.0과 새 단위 검사 포함 |
| 문서 | `README.md`, `docs/PROJECT_BIBLE.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/IDEA_PARKING.md`, `docs/CHANGELOG.md` |

`dist/`, `release/`, `work/`는 생성·검증 산출물이며 Git 대상이 아니다.

### Unit 4.1 — 3. 실행 방법

```powershell
npm run dev
```

빌드 결과는 `npm run build` 뒤 `npm start`, 새 패키지는 `release/local-pdf-cbt-win32-x64/local-pdf-cbt.exe`로 실행한다.

### Unit 4.1 — 4. 사용자가 직접 테스트할 방법

1. 한 페이지에 한 문제와 해설·정답이 함께 있는 PDF를 열고 오른쪽 `해설·정답 영역 설정`의 `영역 설정 시작`을 누른다.
2. `해설`과 `정답`을 각각 선택해 PDF 위에서 겹치지 않게 드래그한다. 두 영역을 모두 지정하기 전에는 `가림 미리보기`가 비활성인지 확인한다.
3. 일부러 8px보다 작은 영역이나 기존 영역과 겹치는 영역을 그려 안내와 미리보기 차단을 확인한 뒤 올바르게 다시 지정한다.
4. `가림 미리보기`에서 두 영역이 완전히 불투명하고 예상 내용만 덮는지 확인한다. `수정`으로 돌아갔다가 다시 미리보기하고 `영역 확정`을 누른다.
5. `확정 영역 수정` 뒤 `취소`해 이전 확정이 유지되는지, 다시 확정하면 새 영역으로 교체되는지 확인한다.
6. 미리보기 중 50–200% 확대·축소와 `높이 맞춤`, 창 크기 변경을 수행해 사각형이 같은 PDF 내용에 남는지 확인한다. 고유 회전 PDF에서도 페이지 안에 정렬되어야 한다.
7. 미완료 편집 중 다음 페이지로 이동해 초안 취소 안내를 확인한다. 확정 페이지를 재방문하면 같은 세션의 확정이 유지되고 다른 PDF를 열면 사라져야 한다.
8. 확정 뒤에도 CBT Mask·보기 선택·답 확인·공개·채점은 나타나지 않는지 확인한다. `npm run dev:debug`에서는 수동 설정 카드가 숨겨져야 한다.

### Unit 4.1 — 5. 정상 동작 기준과 실제 검증 결과

| 검사 | 결과 | 확인 범위 |
| --- | --- | --- |
| `npm run format:check` | 통과 | 프로젝트 형식 |
| `npm test` | 108/108 통과 | 수동 좌표 0/90/180/270도 왕복, 잘못된 영역, Question/Region 소유, 확정·취소·무효화 포함 |
| `npm run build` | 통과 | Vite 24 modules, 로컬 PDF.js 자산 |
| Windows x64/ASAR 패키지 | 통과 | 버전 0.3.0 새 패키지 생성 |
| `npm run test:electron` | 4/4 통과 | Debug 1, 일반 개발·빌드·패키지 3; 드래그·미리보기·확정·확대·높이 맞춤·회전·파일/페이지 수명·원본 해시 |
| `npm run test:native` | 1/1 통과 | 실제 Windows 소유 파일 선택 창·한글 PDF·취소·원본 불변 |
| `npm run test:shutdown` | 개발 7/9, 패키지 9/9 / 전체 무오류 보류 | 개발 즉시 종료 두 번에서 기존 OPEN-09 GPU 진단 재현. 18회 모두 창 종료·종료 코드 0·포트 해제 정상 |
| `git diff --check` | 통과 | 공백 오류 없음 |

### Unit 4.1 — 6. 예상되는 Edge Case

- 두 영역이 모두 없거나 하나만 있으면 부분 확정하지 않는다.
- 역방향 드래그는 정규화하지만 페이지 밖·0 크기·비유한 좌표와 실제 겹침은 거부한다. 경계가 닿기만 하는 경우는 겹침으로 보지 않는다.
- 텍스트가 없거나 분석 보류인 이미지·수식 페이지도 사용자가 렌더된 원문을 보고 지정할 수 있다. 자동 후보·분석 상태는 확정을 대신하지 않는다.
- 확대·높이 맞춤·고유 회전은 화면 사각형만 재투영하고 저장 PDF 좌표를 바꾸지 않는다.
- 렌더 중 빠르게 다른 페이지나 파일로 이동하면 미완료 초안과 이전 문서 확정을 현재 화면에 적용하지 않는다.

### Unit 4.1 — 7. 알려진 제한사항

- 한 페이지에 문제 하나, 해설·정답 사각형 각 하나만 지원한다. 여러 문제·여러 열·여러 사각형·여러 페이지 연결은 지원하지 않는다.
- 수동 확정은 앱 메모리에만 있어 파일 교체·새로고침·종료 뒤 복원되지 않는다.
- 설정 미리보기는 CBT Mask가 아니다. 준비 전 전체 덮개, Text Layer 우회 차단, 답 선택·공개·채점은 아직 없다.
- 포인터 드래그만 지원한다. 키보드 좌표 입력·경계 손잡이 크기 조절·터치 실기기 검증은 수행하지 않았다.
- 실제 사용자 PDF의 픽셀 수준 누출·과다 가림과 Windows 200% 디스플레이 배율·스크린 리더는 검증하지 않았다.
- 최종 종료 반복에서 개발 즉시 종료 두 번에 기존 Chromium GPU 진단이 재현되어 OPEN-09는 미해결로 유지한다. 모든 창 종료·종료 코드 0·포트 해제는 정상이었고 패키지는 9/9였다. Unit 1.0 대표 샘플 행렬도 미착수다.

### Unit 4.1 — 8. Technical Debt

- 사각형 키보드 지정·미세 조정, 크기 조절 손잡이와 터치 입력 접근성이 필요하다.
- 4/5지 선택은 Unit 3.2 범위다. 현재 Question은 기본 `choiceCount: 4`로 만들며 아직 풀이에 사용하지 않는다.
- 다문제·복수 Region·페이지 연결과 영구 보정 저장은 Phase 4 범용 확장과 Phase 5 범위다.
- 실제 출판물 샘플에서 사용자가 확정한 사각형의 픽셀 누출과 문제·보기 침범을 검증해야 한다.

### Unit 4.1 — 9. 다음 Unit 진행 전 수정이 필요한 사항

Unit 4.1 선행 관문에서 확인된 필수 수정은 없다. 다음 계획 Unit은 3.1이며, 여기서 확정 Question/Region만 입력으로 별도 불투명 CBT Mask, 준비 전 전체 덮개와 Text Layer 우회 차단을 구현·검증해야 한다. 정답 추출·선택·공개·채점은 Unit 3.1에 포함하지 않는다. 전체 프로젝트 완료 전에는 OPEN-09와 Unit 1.0을 계속 추적한다.

### Unit 4.1 — 10. Git Commit Message

제안: `feat(cbt): add Unit 4.1 manual region confirmation`

이번 작업에서 Git 커밋이나 push는 실행하지 않았다. 사용자가 현재 diff를 확인한 뒤 사용할 메시지다.

## Unit 3.0 작업 기록 — 2026-09-03

**CBT 구현 전 Question/Region/Answer/Attempt v1의 상태·소유·무효화 계약을 확정했다. 현재 자동 분석 후보를 Mask 입력으로 승인하지 않고, Unit 4.1의 한 페이지·한 문제 수동 영역 확정을 Unit 3.1보다 먼저 진행하도록 일정을 조정했다. 문서 전용 Unit이며 앱 코드는 바꾸지 않았다.**

작업 전에 현재 프로젝트 파일, PROJECT_BIBLE, ROADMAP, DECISIONS, CHANGELOG, IDEA_PARKING과 Git 상태를 확인했다. 시작 작업 트리는 `main...origin/main` 기준으로 깨끗했고 HEAD는 `5850eea`의 Unit 2.7.2 커밋이었다.

### Unit 3.0 — 1. 구현한 내용

- Question/Region/Answer/Attempt v1의 최소 필드와 세션 `documentRevision` 소유 관계를 확정했다.
- `CbtReadiness v1`을 `blocked/ready/active/original-view`의 파생 상태로 정의하고, Canvas·공개 우회 차단·현재 viewport Mask가 모두 준비되기 전에는 CBT를 시작하지 않게 했다.
- 미선택, 선택 변경, 보기 수 변경, 답 확인, 정답 불명, 페이지 재방문, 배율 변경, 원문 보기, 파일 교체와 수동 영역 재편집의 상태 전이·무효화 규칙을 확정했다.
- Unit 2.6의 세 대안을 검토했다. 프로파일 축소와 대표 샘플 확보만으로 비텍스트 경계·Question 소유권을 증명할 수 없어, Unit 4.1의 첫 MVP 수동 영역 지정·미리보기·확정을 Unit 3.1보다 먼저 배치했다.
- 자동 PageAnswerRegions와 `profile-match`는 계속 초안 참고 근거이며 사용자 확인 없이 Question/Region으로 승격하지 않도록 했다.
- ADR-003/005/006/007의 제안을 Unit 3.0 범위에서 채택하고 세부 결정은 ADR-033에 기록했다.

### Unit 3.0 — 2. 수정/생성된 파일

| 구분 | 파일·변경 |
| --- | --- |
| 기준 계약 | `docs/PROJECT_BIBLE.md` — CBT 준비 상태, 수동 확인 관문, v1 데이터·상태 전이·무효화 규칙 |
| 일정 | `docs/ROADMAP.md` — Unit 3.0 완료, Unit 4.1 첫 MVP 범위 선행, Unit 3.1 차단 조건 |
| 결정 | `docs/DECISIONS.md` — ADR-033과 관련 기존 ADR·OPEN 상태 갱신 |
| 아이디어 추적 | `docs/IDEA_PARKING.md` — IDEA-001 채택·미구현 및 선행 MVP 범위 표시 |
| 완료 기록 | `docs/CHANGELOG.md` — Unit 3.0 범위·검증·제한·인계 기록 |

소스 코드, 테스트 코드, `package.json`, `package-lock.json`, `dist/`, `release/`는 변경하지 않았다. 실행 앱과 패키지의 버전은 계속 0.2.7이다.

### Unit 3.0 — 3. 실행 방법

문서 전용 Unit이므로 런타임 실행은 해당 없다. PROJECT_BIBLE 9.9·10·11, ROADMAP Phase 3·4와 다음 착수 조건, DECISIONS ADR-033을 함께 열어 같은 계약과 순서인지 확인한다.

### Unit 3.0 — 4. 사용자가 직접 테스트할 방법

1. PROJECT_BIBLE 9.9에서 현재 자동 후보가 Question/Region으로 자동 승격되지 않는지 확인한다.
2. PROJECT_BIBLE 11에서 Question/Region/Answer/Attempt v1이 같은 `documentRevision`으로 연결되고, 페이지 번호·파일명·표시 문제 번호를 questionId로 쓰지 않는지 확인한다.
3. 상태 표에서 미선택 확인 차단, 선택 확정과 공개·채점의 원자적 전이, `unknown/ambiguous → ungradable`, 페이지 재방문 보존, 파일 교체·재편집 무효화를 확인한다.
4. ROADMAP 실행 순서가 `3.0 → 4.1 첫 MVP 범위 → 3.1`이고 Unit 3.1이 선행 차단 상태인지 확인한다.
5. Phase 4.1 선행 범위가 같은 페이지의 해설·정답 사각형 각 하나, 미리보기·확정·취소·재편집·좌표 왕복에 한정되고 다문제·자동 분리·저장을 포함하지 않는지 확인한다.
6. `git diff --name-only`에서 문서 다섯 개만 변경되고 앱 코드와 package 파일이 변경되지 않았는지 확인한다.

### Unit 3.0 — 5. 정상 동작 기준과 실제 검증 결과

| 검사 | 결과 | 확인 범위 |
| --- | --- | --- |
| 문서 간 상태·순서 대조 | 통과 | Unit 3.0 완료, Unit 4.1 선행, Unit 3.1 차단, 앱 0.2.7 유지 |
| 계약 용어 대조 | 통과 | 네 v1 레코드, CbtReadiness, revision·questionId 소유, 무효화·원자 전이 |
| `git diff --check` | 통과 | 공백 오류 없음 |
| `npm run format:check` | 통과 | 프로젝트 형식 검사 |
| 런타임·Electron·패키지 검사 | 해당 없음 | 앱 코드·의존성·빌드 산출물을 변경하지 않은 문서 전용 Unit |

### Unit 3.0 — 6. 예상되는 Edge Case

- 자동 후보와 사용자가 그린 영역이 달라도 사용자 확정 전에는 draft이며 Mask 입력이 아니다.
- 해설·정답 사각형이 겹치거나 페이지 밖·0 크기·유효하지 않은 좌표면 부분 확정하지 않는다.
- 영역을 확정한 뒤 파일이 교체되거나 documentRevision이 바뀌면 같은 파일명이어도 기존 상태를 재사용하지 않는다.
- 정답 추출이 불명확해도 안전하게 확정한 영역의 공개와 채점 결과는 분리하며, 후속 구현에서 `채점 불가`가 정상 상태가 된다.
- 확대·높이 맞춤·고유 회전에서는 PDF 좌표 자체를 바꾸지 않고 새 viewport용 Mask가 준비될 때까지 전체 덮개가 필요하다.

### Unit 3.0 — 7. 알려진 제한사항

이번 Unit은 계약과 일정만 확정했다. 수동 드래그 UI, 좌표 역변환, 미리보기 Mask, Text Layer 우회 차단, 객관식 선택·답 확인·정답 추출·채점은 구현하지 않았다. 실제 사용자 PDF와 Unit 1.0 대표 샘플 행렬도 검증하지 않았으며 OPEN-09는 그대로다.

### Unit 3.0 — 8. Technical Debt

- Unit 4.1에서 포인터·키보드 기반 영역 지정의 접근성, 최소 사각형 크기, 경계 손잡이와 취소/재편집 UX를 실제 UI로 검증해야 한다.
- 사용자 확정이 비텍스트 내용까지 충분히 덮는지는 미리보기와 실제 화면 검증이 필요하다. 수동 확인도 DRM이나 누출 0% 보장은 아니다.
- Unit 1.0에서 재배포 가능한 대표 샘플 행렬과 실제 문서 검증 범위를 계속 준비해야 한다.
- 다문제·복수 사각형·공유 해설·여러 페이지와 영구 보정 저장은 현 v1 계약의 지원 범위가 아니다.

### Unit 3.0 — 9. 다음 Unit 진행 전 수정이 필요한 사항

다음 계획 Unit은 선행 배치한 Unit 4.1의 첫 MVP 수동 영역 지정·미리보기·확정이다. 이 기능이 PDF user space 좌표 왕복, 확대·높이 맞춤·고유 회전, 취소·재편집, 범위 밖·겹침, 파일/revision 변경을 검증하기 전에는 Unit 3.1 Mask Layer를 진행하지 않는다. Unit 4.1 착수는 별도 사용자 요청이 필요하다.

### Unit 3.0 — 10. Git Commit Message

제안: `docs(cbt): define Unit 3.0 state and ownership contracts`

이번 작업에서 Git 커밋이나 push는 실행하지 않았다. 사용자가 현재 diff를 확인한 뒤 사용할 메시지다.

## Unit 2.7.2 안정화 작업 기록 — 2026-09-03

**사용자 후속 영상에서 확인한 페이지 이동·창 크기 변경의 PDF 영역 상하 이동을 수정했다. 로딩 안내가 Viewer 높이를 바꾸지 않게 하고, 높이 맞춤 자동 렌더가 안정 상태에서 반복되지 않게 했다. 앱 SemVer는 0.2.7을 유지하며 Phase 3 기능은 추가하지 않았다.**

작업 전에 현재 프로젝트 파일, PROJECT_BIBLE, ROADMAP, DECISIONS, Git 상태와 Unit 2.7.1 커밋 `09a8a89`을 확인했다. 시작 작업 트리는 `main...origin/main` 기준으로 깨끗했다. 후속 영상의 0.05초 간격 프레임에서 페이지 5·6 이동 때 약 40 CSS px의 상하 이동이 반복되고, 이 크기가 기존 로딩 상태 행의 padding·line-height·border와 일치함을 확인했다. 영상은 읽기 전용으로 분석했고 프로젝트·패키지에 포함하지 않았다.

### Unit 2.7.2 — 1. 구현한 내용

- `viewer-status`를 Viewer 내부의 겹침 알림으로 바꿔 표시·숨김이 PDF page stage의 flex 높이와 시작 위치를 바꾸지 않게 했다. 기존 한국어 로딩·오류 문구와 `role=status`는 유지했다.
- 마지막 완료 렌더의 `rendered.height / rendered.scale`을 현재 페이지의 scale 1 기준 높이로 보관한다. ResizeObserver는 현재 가용 높이의 목표 배율이 실제 현재 배율과 0.001보다 크게 다를 때만 렌더를 예약한다.
- 창 크기에 따른 자동 높이 맞춤은 기존 Canvas를 유지하면서 진행 알림 없이 수행한다. 직접 페이지 이동은 로딩 알림을 유지한다.
- 임시 Canvas에서 완성한 최신 결과만 화면 Canvas에 반영하는 Unit 2.7.1 계약, 120ms resize debounce, 50–200% 경계와 페이지별 고유 높이는 유지했다.
- 실제 Electron 회귀에 페이지 이동 중 page stage top·height 안정성, 높이 맞춤 활성화·resize 완료 뒤 450ms Canvas 무변경 검사를 추가했다.
- 오류 알림이 Canvas 위에 겹쳐도 잘못된 페이지 번호 입력 전후의 실제 Canvas bitmap이 같은지는 화면 합성 캡처가 아닌 Canvas 자체 PNG 데이터로 비교한다.
- footer에 `Unit 2.7.2 · Viewer 안정화`를 표시하고 새 개발·빌드·Windows x64/ASAR 패키지를 생성했다.

### Unit 2.7.2 — 2. 수정/생성된 파일

| 구분 | 파일·변경 |
| --- | --- |
| Viewer 렌더 상태 | `src/ui/pdf-viewer.js` — scale 1 기준 높이 보관, 같은 배율 자동 렌더 억제, resize 진행 알림 억제 |
| Viewer 스타일·표시 | `src/styles/shell.css`, `index.html` — 레이아웃 비참여 상태 알림, Unit 2.7.2 footer |
| 실제 앱 회귀 | `tests/helpers/pdf-selection-checks.js` — page stage 좌표 안정성, 450ms 렌더 정지, Canvas 자체 데이터 보존 |
| 사용·기준 문서 | `README.md`, `docs/PROJECT_BIBLE.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/CHANGELOG.md` |

`dist/`, `release/`, `work/`는 생성·검증 산출물이며 Git 대상이 아니다. 이전 2.7.1 패키지는 `work/unit-2.7.2-before-package/release/`에 보관한 뒤 새 패키지를 만들었다.

### Unit 2.7.2 — 3. 실행 방법

프로젝트 루트에서 `npm run dev`로 일반 앱을 실행한다. `npm run build` 후 `npm start`는 새 빌드 자산을 실행하며, `release/local-pdf-cbt-win32-x64/local-pdf-cbt.exe`는 새 Windows 패키지다. 이전 실행 창이 남아 있으면 완전히 닫고 새로 실행한다.

### Unit 2.7.2 — 4. 사용자가 직접 테스트할 방법

1. 앱을 열고 footer가 `Unit 2.7.2 · Viewer 안정화`인지 확인한 뒤 여러 페이지 PDF를 선택한다.
2. PDF가 보이면 `높이 맞춤`을 한 번 누르고 2초 이상 기다린다. PDF 크기와 위치가 스스로 반복해서 바뀌거나 로딩 안내가 반복되면 안 된다.
3. PDF 좌우의 이전·다음 버튼을 천천히 한 번씩 누른다. `n페이지를 불러오고 있습니다.` 알림은 PDF 위에 잠시 겹쳐 보일 수 있지만 PDF 작업 영역 전체가 아래로 밀렸다가 올라오면 안 된다.
4. 이전·다음을 빠르게 여러 번 누른다. 마지막으로 요청한 페이지만 표시되고, 이전 Canvas가 유지되다가 새 페이지가 한 번에 바뀌어야 한다. 검은색·빈 화면이나 반복 상하 이동이 없어야 한다.
5. `높이 맞춤` 상태에서 창의 오른쪽 또는 아래쪽 테두리를 잡고 천천히 늘였다 줄인 뒤 놓는다. 조절 중 기존 PDF가 유지되고, 놓은 뒤 새 높이에 한 번 맞춰진 다음 정지해야 한다.
6. 잘못된 페이지 번호 `0` 또는 전체 페이지보다 큰 수를 입력한다. 오류 알림이 겹쳐 표시되어도 현재 페이지 내용과 번호는 바뀌지 않아야 한다.
7. 같은 검사를 `npm run build` 후 `npm start`와 새 `release/local-pdf-cbt-win32-x64/local-pdf-cbt.exe`에서 반복한다.

### Unit 2.7.2 — 5. 정상 동작 기준과 실제 검증 결과

| 검사 | 결과 | 확인 범위 |
| --- | --- | --- |
| `npm run format:check` | 통과 | 전체 프로젝트 형식 |
| `npm test` | 103/103 통과 | 기존 보안·입력·PDF.js·분석 계약 회귀 |
| `npm run build` / `npm run package` | 통과 | Vite 22 modules, Electron 44.0.0 Windows x64/ASAR, 앱 0.2.7 |
| `npm run test:electron` | 4/4 통과 | 진단·개발·빌드·패키지, page stage top/height 1px 이하 변화, 높이 맞춤 안정 후 450ms Canvas write 0회, 기존 회귀 |
| `npm run test:native` | 1/1 통과 | 실제 Windows 선택 창, 한글 PDF·취소·원본 불변 |
| `npm run test:shutdown` | 개발 7/9·패키지 9/9 | 개발 즉시 종료 2회에서 기존 OPEN-09 재현; 모든 18회 창 종료·종료 코드 0·포트 해제 정상 |

첫 전체 Electron 실행에서 개발 모드는 새 소스를 사용해 geometry 검사를 통과했지만, 빌드·패키지는 이전 2.7.1 산출물이어서 새 검사가 의도대로 실패했다. 이전 산출물을 보관하고 다시 빌드·패키징한 뒤 최종 4/4를 확인했다. 오류 알림을 겹침 방식으로 바꿔 화면 캡처에 알림까지 포함되던 기존 Canvas 보존 검사는 Canvas 자체 데이터 비교로 고쳤다.

### Unit 2.7.2 — 6. 예상되는 Edge Case

- 로딩·오류 알림은 PDF 상단 일부를 잠시 가릴 수 있다. 알림이 사라지면 원문은 그대로 보이며 page stage 크기와 스크롤 위치는 바뀌지 않아야 한다.
- 높이 맞춤 목표 배율 차이가 0.001 이하면 미세한 CSS 반올림으로 보고 다시 렌더하지 않는다. 사용자가 체감할 수 있는 창 크기 변화는 이보다 큰 목표 차이를 만들어 정상 재렌더된다.
- 서로 높이가 다른 PDF 페이지로 이동할 때는 현재 페이지에 맞는 scale 1 높이를 새로 받아야 하므로 페이지 전환 렌더 자체는 생략하지 않는다.
- 창 크기를 계속 드래그하면 120ms debounce 이후 중간 렌더가 취소될 수 있다. 최신 요청만 화면에 반영하고 기존 Canvas는 완료까지 유지한다.

### Unit 2.7.2 — 7. 알려진 제한사항

상태 알림은 Viewer 안에서 겹쳐 표시되므로 짧은 시간 동안 원문 상단을 가릴 수 있다. 자동 회귀는 합성 PDF와 현재 Windows 11 환경에서 geometry·Canvas write를 확인하며, 모든 실제 PDF·GPU·디스플레이 배율·모니터 조합의 체감 움직임을 보장하지 않는다. 이번 변경은 페이지 렌더 안정화에 한정되며 분석 지원률과 `canStartCbt: false` 결과는 바꾸지 않는다.

### Unit 2.7.2 — 8. Technical Debt

- OPEN-09는 이번 종료 검사에서도 개발 즉시 종료 두 번에 재현됐다. Viewer 덜컥거림과 별도로 원인을 규명해야 하며 GPU·sandbox 설정 완화로 숨기지 않는다.
- 실제 사용자 PDF와 Windows 200% 표시 배율, 다중 모니터에서 페이지 전환·연속 resize 영상을 다시 확인할 필요가 있다.
- 임시 Canvas 이중 보유의 peak 메모리는 Unit 1.0/OPEN-04 대표 파일 행렬에서 측정해야 한다.

### Unit 2.7.2 — 9. 다음 Unit 진행 전 수정이 필요한 사항

영상에서 확인한 Viewer 상하 이동에 대한 코드·자동 검사 보완은 완료했다. 사용자가 실제 PDF로 같은 동작을 확인해 잔여 체감 움직임이 있는지 검토할 수 있다. 다음 계획 Unit은 3.0 구조 검토이며, Unit 2.6의 모든 `canStartCbt`가 false이므로 안전한 Mask·Question 소유 관계 결정을 먼저 해야 한다. OPEN-09와 Unit 1.0은 별도 미해결 상태로 유지한다.

### Unit 2.7.2 — 10. Git Commit Message

제안: `fix(viewer): stabilize fit-height page transitions`

이번 작업에서 Git 커밋이나 push는 실행하지 않았다. 사용자가 현재 diff와 검사 결과를 확인한 뒤 사용할 메시지다.

## 0.2.7 작업 기록 — 2026-09-03

**Unit 2.7 Phase 3 전 Viewer Shell 정리를 구현했다. 기본 창 바깥쪽 세로 스크롤을 없애고 문서 정보를 접을 수 있게 했으며, 현재 페이지 분석 상태는 항상 보이게 유지했다. 분석 규칙·Mask·CBT 기능은 변경하지 않았다.**

작업 전에 현재 프로젝트 파일, PROJECT_BIBLE, ROADMAP, DECISIONS와 Git 상태를 확인했다. 작업 트리에는 아직 커밋하지 않은 Unit 2.6 변경이 있었으므로 이를 보존한 채 Unit 2.7 범위만 추가했다. 검증 도중 main과 origin/main의 `4abc0e9` 커밋에 Unit 2.6과 당시의 0.2.7 Shell 코드·테스트가 함께 포함된 상태가 되었음을 확인했고, 이미 공유된 이력을 다시 쓰지 않았다. 이후 남은 문서와 문서 정보 제목 배치만 작업 트리에 추가했다. 사용자가 지정한 바깥쪽 스크롤·문서 정보 아코디언·상시 요약·header 축소와 반응형·접근성·높이 맞춤 회귀만 구현했으며 Phase 3 기능은 시작하지 않았다.

Unit 2.7 커밋 뒤 사용자가 제공한 화면 녹화 세 건을 프레임 단위로 확인했다. 이전/다음 페이지 이동과 높이 맞춤 상태의 창 크기 변경 때 PDF.js가 화면 Canvas의 backing store를 먼저 초기화해 약 한 프레임 동안 PDF 영역 전체가 검게 보였다. 새 페이지를 임시 Canvas에 완성한 뒤 최신 결과만 화면 Canvas로 복사하는 보완을 같은 Unit에 반영했다. 영상 파일은 읽기 전용으로 확인했으며 프로젝트나 패키지에 복사하지 않았다.

### Unit 2.7 — 1. 구현한 내용

- app shell을 창 높이에 고정해 기본 1120×760 창에서 document root의 세로 스크롤이 생기지 않게 했다. header·main·footer는 한 화면에 유지하고 PDF와 오른쪽 상태 영역이 각자 필요한 스크롤을 소유한다.
- 56rem 이하에서는 main 내부가 세로로 스크롤하는 한 열 배치로 전환한다. 640×480 최소 창에서도 가로 넘침 없이 페이지 도구·상태·footer에 접근할 수 있다.
- header의 세로 여백, 아이콘, 제목과 파일 선택 버튼을 줄여 실제 표시 높이를 61.78 CSS px로 낮췄다.
- 실행 환경·선택 파일·파일 크기·페이지를 native `details/summary` 문서 정보 아코디언에 묶고 기본 닫힘으로 시작한다. Enter 키로 열고 닫으며 포커스 표시를 유지한다.
- 텍스트 분석·키워드 후보·영역 후보·지원 프로파일은 아코디언 밖의 `현재 페이지 분석` 영역에서 항상 보이게 했다. 장문의 지원 단계 설명만 별도 접기 영역으로 바꿨다.
- 페이지 이동·50–200% 확대·축소·높이 맞춤·좌우 보조 버튼·footer 상태, 일반/진단 실행 분리, PDF 원본 불변과 기존 분석 결과는 유지했다.
- 높이 맞춤 화면 검사는 Canvas가 가용 높이를 넘지 않으면서 85% 이상을 사용하고 창 크기 변경 뒤 배율이 갱신되는지를 검증하도록 안정화했다. 어댑터의 정확한 목표 높이 계산 단위 검사는 그대로 유지한다.
- 페이지 이동·배율·높이 맞춤·resize는 PDF.js가 화면에 보이지 않는 임시 Canvas에 새 결과를 먼저 그린다. 완료된 최신 결과만 화면 Canvas의 크기와 픽셀로 한 번에 반영하고, 취소·오류·뒤처진 결과의 임시 Canvas는 즉시 1×1로 줄여 backing bitmap을 해제한다.
- 실제 Electron 검사는 페이지 이동과 높이 맞춤 resize 동안 화면 Canvas 크기가 바뀐 뒤 다음 animation frame까지 이전 page/scale 상태가 남는 공백 전환이 없는지 확인한다. 잘못된 페이지 번호의 화면 보존은 renderer 픽셀 반복 읽기 대신 Canvas 화면 캡처 비교로 유지했다.
- 앱과 Windows x64/ASAR 패키지 버전을 0.2.7로 올렸다.

### Unit 2.7 — 2. 수정/생성된 파일

| 구분 | 파일·변경 |
| --- | --- |
| Shell 구조 | `index.html` — 문서 정보 아코디언, 현재 페이지 분석, 접는 단계 안내, Unit 2.7 footer |
| Shell 스타일 | `src/styles/base.css`, `src/styles/shell.css` — 창 높이·내부 스크롤 소유권, compact header, details/summary, 반응형 배치 |
| 창 기준 | `electron/config.js` — 기본 창 Shell 높이 계약 주석 |
| 실제 앱 검사 | `tests/electron.test.js`, `tests/debug-overlay.test.js`, `tests/native-dialog.test.js`, `tests/helpers/pdf-selection-checks.js` — 숨은 상태 조회, root/내부 스크롤, header/footer, 아코디언 키보드, 분석 상시 노출, 높이 맞춤·기존 회귀 |
| Canvas 전환 보완 | `src/ui/pdf-viewer.js`, `tests/helpers/pdf-selection-checks.js` — 임시 Canvas 렌더·최신 결과 커밋·취소 해제, 페이지/resize 공백 프레임과 잘못된 번호 화면 보존 회귀 |
| 버전·실행 | `package.json`, `package-lock.json`, `README.md` — 0.2.7과 검사 절차 |
| 문서 | `docs/PROJECT_BIBLE.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/CHANGELOG.md`, `docs/IDEA_PARKING.md` |

`dist/`, `release/`, `work/`는 생성·검증 산출물이며 Git 대상이 아니다.

### Unit 2.7 — 3. 실행 방법

프로젝트 루트에서 `npm run dev`로 일반 앱을 실행한다. `npm run build` 후 `npm start`는 빌드 자산 모드이고 `release/local-pdf-cbt-win32-x64/local-pdf-cbt.exe`는 버전 0.2.7 패키지다. 이전 앱이 실행 중이면 완전히 닫고 다시 시작한다. 좌표 대조가 필요한 경우에만 `npm run dev:debug`를 사용한다.

### Unit 2.7 — 4. 사용자가 직접 테스트할 방법

1. `npm run dev`로 앱을 열고 footer의 `Unit 2.7 · Viewer Shell 정리`를 확인한다. 기본 창에서 앱 바깥쪽 오른쪽 세로 스크롤이 보이지 않고 header와 footer가 동시에 보여야 한다.
2. PDF를 열지 않은 상태와 연 상태 모두에서 오른쪽의 `문서 정보`가 기본으로 접혀 있는지 확인한다. 키보드 Tab으로 summary에 이동해 Enter로 열고 닫으며 실행 환경·파일명·크기·페이지가 나타나고 포커스 표시가 남는지 확인한다.
3. 문서 정보를 접어도 `현재 페이지 분석`의 텍스트 분석·키워드 후보·영역 후보·지원 프로파일 상태가 계속 보이는지 확인한다. `지원 프로파일 판정 단계`는 별도로 열고 닫을 수 있어야 한다.
4. PDF를 열고 페이지 이동, `+`/`-`, `높이 맞춤`, 좌우 보조 버튼을 확인한다. 이전/다음을 빠르게 반복하고 높이 맞춤 상태에서 창을 늘이거나 줄여도 PDF 영역 전체가 검은색 또는 빈 화면으로 반짝이지 않아야 한다. 높이 맞춤에서 PDF가 Viewer 높이를 넘어 잘리지 않고 창 크기를 바꾸면 다시 맞춰져야 한다.
5. 오른쪽 상태가 길면 사이드 영역 안에서, PDF가 길면 Viewer 안에서만 스크롤되는지 확인한다. 앱 전체 바깥쪽 scrollbar가 새로 생기면 안 된다.
6. 창을 640×480까지 줄인다. 한 열 배치와 main 내부 세로 스크롤로 PDF·페이지 도구·상태·footer에 접근할 수 있고 가로 넘침이나 겹침이 없어야 한다.
7. PDF 교체·드롭·취소, 개발자 진단 Overlay와 원본 불변 footer 안내가 기존과 같은지 확인한다. Mask·답 선택·답 확인·채점 기능은 나타나지 않아야 한다.

자동 검사는 `npm run format:check`, `npm test`, `npm run test:electron`, `npm run test:native`, `npm run test:shutdown` 순서로 실행한다. Electron·native·shutdown은 Windows 데스크톱 창 실행 권한이 필요하다.

### Unit 2.7 — 5. 정상 동작 기준과 실제 검증 결과

| 검사 | 결과 | 확인 범위 |
| --- | --- | --- |
| `npm run format:check` | 통과 | 전체 프로젝트 형식 |
| `npm test` | 103/103 통과 | 기존 보안·입력·PDF.js·텍스트·좌표·키워드·영역·프로파일 계약 회귀 |
| `npm run build` / `npm run package` | 통과 | Vite 22 modules, Electron 44.0.0 Windows x64/ASAR 버전 0.2.7 |
| `npm run test:electron` | 4/4 통과 | 진단·일반 개발·빌드·패키지, root 비스크롤, 내부 스크롤, header/footer, 아코디언·분석 상시 노출·높이 맞춤, 페이지/resize 중 화면 Canvas 비초기화와 기존 보안 회귀 |
| `npm run test:native` | 1/1 통과 | 실제 Windows 선택 창, 한글 파일 선택·취소·원본 해시와 숨은 문서 정보 상태 |
| 기본 창 Shell | 통과 | header 61.78 CSS px, footer 노출, document root scrollTop 0, 문서 정보 기본 닫힘 |
| 최소 창 Shell | 통과 | 640×480 한 열·main 내부 스크롤, 가로 넘침 없음, 좌우 보조 버튼 숨김 |
| 높이 맞춤 | 통과 | 세 실행 모드에서 가용 높이 이하·85% 이상 사용, resize 재계산; 정확한 adapter 계산 단위 검사 유지 |
| `npm run test:shutdown` | 18/18 | Canvas 보완 후 개발 9/9, 패키지 9/9. 앞선 Unit 2.7 실행의 OPEN-09 재현 이력 때문에 미해결 상태는 유지 |

Canvas 보완 후 종료 18회 모두 창이 닫히고 프로세스 종료 코드 0과 개발 포트 해제를 확인했다. GPU 오류를 숨기거나 그래픽·sandbox 설정을 낮추지 않았다. 앞선 Unit 2.7 종료 실행에서 개발 즉시 종료 GPU 진단이 한 번 재현됐으므로 이번 18/18만으로 간헐 원인이 해결됐다고 판정하지 않는다. 제한된 도구 환경에서 GUI를 처음 실행했을 때 Electron renderer가 로드되지 않아 진단 검사가 시간 초과했지만, Windows 데스크톱 창 실행 권한으로 다시 실행해 위 결과를 얻었다. 이를 제품 실패나 통과 횟수에 섞지 않았다.

### Unit 2.7 — 6. 예상되는 Edge Case

- 56rem 경계 부근에서 오른쪽 사이드가 아래로 이동하며 스크롤 소유자가 sidebar에서 main으로 바뀐다. 열려 있던 details 상태와 현재 페이지 분석 상태는 유지되어야 한다.
- 최소 창·큰 시스템 글꼴·긴 파일명에서는 한 화면에 모든 내용을 동시에 표시할 수 없다. 내용은 main/side 내부 스크롤로 접근하며 document root와 가로 넘침은 만들지 않는다.
- 매우 긴 페이지는 50% 최소 배율 때문에 높이 맞춤 후에도 PDF 내부 세로 스크롤이 남을 수 있다. 이는 50–200% 경계를 유지한 결과다.
- scrollbar의 유무와 CSS pixel 반올림 때문에 높이 맞춤 Canvas가 가용 높이와 몇 픽셀 또는 약간의 여백을 둘 수 있다. 넘치지 않고 충분히 활용하는지를 UI 계약으로 삼는다.
- native details는 운영체제·Electron 기본 접근성 의미를 사용한다. 실제 스크린 리더와 Windows 디스플레이 배율별 검증은 수행하지 않았다.
- 새 페이지 렌더 중에는 기존 화면 Canvas와 임시 Canvas가 함께 존재한다. 현재 페이지별 bitmap 상한은 그대로지만 완료 전까지 두 bitmap의 메모리를 일시적으로 사용할 수 있으며, 매우 큰 페이지나 빠른 연속 입력에서는 취소·메모리 해제 시점이 중요하다.

### Unit 2.7 — 7. 알려진 제한사항

이번 변경은 Viewer Shell 배치·Canvas 전환과 접근성 회귀에 한정된다. 분석 품질·지원률을 높이거나 안전한 가림을 추가하지 않았고, `canStartCbt`는 계속 false다. 자동 검사는 화면 Canvas가 렌더 시작 후 다음 animation frame까지 이전 상태로 남는지를 합성 fixture에서 확인하며 모든 GPU·디스플레이 조합의 시각 결과를 보장하지 않는다. 640×480에서는 내부 세로 스크롤이 필요하며 모든 상태를 동시에 볼 수 없다. 실제 200% Windows 디스플레이 배율, 다중 모니터, 스크린 리더 실사용은 검증하지 않았다. OPEN-09도 미해결이다.

### Unit 2.7 — 8. Technical Debt

- OPEN-09: 개발 모드 표시 직후 종료에서 간헐적인 Chromium GPU 오류 재현 이력이 있다. Canvas 보완 후 결과는 개발 9/9·패키지 9/9지만 앞선 Unit 2.7 실행의 개발 8/9·패키지 9/9 결과 때문에 해결로 닫지 않는다.
- Canvas 이중 보유의 실제 peak 메모리는 대표 대용량 PDF와 여러 Windows 배율에서 아직 측정하지 않았다. 현재 상한과 취소 해제를 유지하고 Unit 1.0/OPEN-04 성능 행렬에서 측정해야 한다.
- Unit 1.0 실제 대표 PDF 행렬과 Windows 디스플레이 배율·접근성 보조기기 검증이 남아 있다.
- 향후 Phase 3 패널이 추가되면 동일한 내부 스크롤 소유권과 공개 전 정보 노출을 구조 검토에서 다시 확인해야 한다.

### Unit 2.7 — 9. 다음 Unit 진행 전 수정이 필요한 사항

Unit 2.7 Shell과 Canvas 전환 기능의 확인된 선행 수정 사항은 없다. 다만 Unit 2.6의 모든 `canStartCbt`가 false이므로 Phase 3.1 기능으로 바로 넘어갈 수 없다. 다음 Unit 3.0을 사용자가 요청하면 지원 프로파일 축소·실제 대표 샘플 확보·Phase 4.1 수동 보정 선행 중 안전한 경로와 Question/Region 소유 관계를 먼저 결정해야 한다. 전체 무오류 완료에는 OPEN-09 해결과 Unit 1.0 샘플·메모리 행렬도 필요하다.

### Unit 2.7 — 10. Git Commit Message

Unit 2.7 커밋 뒤 현재 작업 트리에 남은 Canvas 보완의 제안 메시지: `fix(viewer): prevent PDF canvas flicker during rerender`

이번 작업에서 추가 Git 커밋이나 이력 수정은 만들지 않았다. 메시지는 사용자가 현재 diff와 검사 결과를 검토한 뒤 사용할 제안이다.

## 0.2.6 작업 기록 — 2026-09-02

**Unit 2.6 첫 MVP 분석 프로파일 판정과 고정 샘플 검증을 구현했다. 기존 텍스트·키워드·영역 근거의 일치·미지원·보류만 분류하며, 프로파일이 일치해도 안전한 Mask와 Question 소유 관계가 확인되지 않아 CBT 착수는 승인하지 않았다.**

작업 전에 현재 프로젝트 파일, PROJECT_BIBLE, ROADMAP, DECISIONS와 Git 상태를 확인했다. 작업 트리는 Unit 2.5 커밋 `1e1073b` 기준으로 깨끗했다. ROADMAP에 남아 있던 Unit 2.6 범위만 구현했으며 Phase 3의 Mask·선택·공개·정답 추출·채점은 시작하지 않았다.

### Unit 2.6 — 1. 구현한 내용

- 순수 `classifyPageSupportProfile()`과 `PageSupportProfile v1`을 추가했다. 같은 revision·pageNumber의 PageTextAssessment, PageKeywordCandidates, PageAnswerRegions 계약을 검증하며 잘못된 근거에는 부분 판정 없이 공개 오류 코드를 반환한다.
- 첫 프로파일 `single-page-single-column-two-headings-v1`은 usable 텍스트, 정확히 한 해설 제목과 한 정답 제목, 정확히 두 영역, A/B 제목 순서, 문제 선행 내용과 각 영역 본문 근거를 요구한다.
- 결과를 `profile-match`, `not-supported`, `hold`로 구분한다. 제목 없음·두 제목 미충족은 미지원, 텍스트 불충분·중복 제목·읽기 순서·다단·회전·세로쓰기 불확실성은 보류한다.
- 프로파일 일치와 CBT 착수 가능성을 분리했다. 일치 결과에도 이미지·수식 미확인, 열린 마지막 경계, 안전한 Mask 미검증, Question 소유 관계 미확정을 기록하고 `canStartCbt: false`를 유지한다.
- 일반 UI의 앱 상태에 `지원 프로파일` 요약을 추가했다. PDF 원문·좌표·정답 값은 DOM에 복사하지 않고 프로파일 일치 화면에도 Mask·답 확인·채점을 만들지 않았다.
- 고정 행렬 8개에서 A/B 후보 2/2 일치, 보호 대상 Text Item 누락 0/6, 문제 Text Item 침범 0/3, 미지원 6개 오일치 0/6을 확인했다. 전체 판정은 일치 2/8, 미지원 2/8, 보류 4/8(50%), CBT 착수 가능 0/8이다.
- 설치된 PDF.js 6.3.289로 `Solution→Answer`와 `Answer→Solution` 합성 PDF 두 개를 실제 추출해 두 순서를 확인했고 원본 SHA-256을 유지했다.
- 사용자 제공 Notion/Chromium PDF에서 실제 Text Item은 유효하지만 PDF.js font ascent/descent가 `NaN`, vertical이 생략되어 전체 분석이 보류되는 호환성 오류를 수정했다. 이 보조값만 0과 Text Item direction으로 정규화하며 잘못된 본문·좌표·페이지 값은 계속 거절한다.
- 보완 후 이 PDF는 111개 Text Item·비공백 186자·판독 비율 1의 `text-usable`로 분류된다. 다만 인쇄 footer `제목 없음1`이 `정답 ④`에 이어지는 PDF.js source 순서는 추정하지 않아 해설 제목 1개만 찾고 정답 제목 누락 미지원으로 남긴다.
- 앱과 Windows x64/ASAR 패키지 버전을 0.2.6으로 올렸다. 이전 0.2.5 패키지는 `work/unit-2.6-before-package/release/`에 보존했다.

### Unit 2.6 — 2. 수정/생성된 파일

| 구분 | 파일·변경 |
| --- | --- |
| 프로파일 판정 | `src/analysis/page-support-profile.js` — 입력 계약 검증, 세 판정, CBT 차단 사유와 원문 없는 근거 요약 |
| 일반 UI | `src/ui/pdf-viewer.js`, `index.html`, `src/styles/shell.css` — 지원 프로파일 상태·사유·범위 안내 |
| 단위 검사 | `tests/page-support-profile.test.js` — A/B, 미지원·보류, 고정 행렬 수치, 계약·개인정보 경계 |
| PDF.js 통합 | `tests/pdf-text-integration.test.js`, `tests/helpers/pdf-fixtures.js` — A/B 실제 TextContent 판정과 원본 해시 |
| PDF.js font 호환성 | `src/pdf/pdf-adapter-core.js`, `tests/pdf-adapter.test.js` — 생략·`NaN` font 보조값 정규화와 계약 회귀 검사 |
| 실제 앱 검사 | `tests/helpers/pdf-selection-checks.js`, `tests/native-dialog.test.js` — 세 일반 실행 모드·Windows 선택 창·원문 비노출·파일 불변 |
| 버전·실행 | `package.json`, `package-lock.json`, `README.md` — 0.2.6과 검사 절차 |
| 문서 | `docs/PROJECT_BIBLE.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/CHANGELOG.md` |

`dist/`, `release/`, `work/`는 생성·검증 산출물이며 Git 대상이 아니다.

### Unit 2.6 — 3. 실행 방법

프로젝트 루트에서 `npm run dev`로 일반 앱을 실행한다. `npm run build` 후 `npm start`는 빌드 자산 모드이고 `release/local-pdf-cbt-win32-x64/local-pdf-cbt.exe`는 버전 0.2.6 패키지다. 이전 앱이 실행 중이면 완전히 닫고 다시 시작한다. 개발자 좌표 대조가 필요한 경우에만 `npm run dev:debug`를 사용한다.

### Unit 2.6 — 4. 사용자가 직접 테스트할 방법

1. 앱 footer에서 `Unit 2.6 · 지원 프로파일 판정`을 확인한다.
2. 충분한 문제·보기 뒤 `해설:`과 `정답:`이 각각 한 번 있는 단일 열 PDF를 연다. `지원 프로파일`에 첫 MVP 분석 프로파일 후보와 맞지만 CBT 시작은 승인되지 않았다는 안내가 보여야 한다.
3. `정답:` 뒤 `해설:`이 오는 PDF도 같은 일치 안내를 표시해야 한다. 어느 순서에서도 Mask·답 선택·답 확인·채점 버튼은 나타나지 않아야 한다.
4. 제목이 없거나 한 종류만 있으면 `지원하지 않습니다`가 보여야 한다. 같은 제목이 반복되거나 다단처럼 보이는 페이지, 고유 회전 페이지, 텍스트가 너무 적거나 이미지·수식 위주인 페이지는 `판정할 수 없습니다`로 보류되어야 한다.
5. 페이지 이동·PDF 교체를 반복해 이전 프로파일 상태가 늦게 돌아오지 않는지 확인한다. 앱 상태에는 전체 문제·해설·정답 문장과 파일 경로·좌표가 추가로 노출되지 않아야 한다.
6. 원문 Viewer의 페이지 이동·50–200% 배율·높이 맞춤·좌우 이동과 footer의 원본 불변 안내가 그대로 동작하는지 확인한다.
7. Notion/브라우저 PDF는 인쇄 설정에서 머리글과 바닥글을 끄고 다시 연다. 켠 출력에서 `정답 ④` 뒤 문서 제목·페이지 번호가 붙으면 앱은 정답 제목을 추정하지 않고 미지원으로 남겨야 한다.

자동 검사는 `npm run format:check`, `npm test`, `npm run build`, `npm run package`, `npm run test:electron`, `npm run test:native`, `npm run test:shutdown -- -Repeats 3` 순서로 실행한다. Electron·native·shutdown은 Windows 데스크톱 창 실행 권한이 필요하다.

### Unit 2.6 — 5. 정상 동작 기준과 실제 검증 결과

| 검사 | 결과 | 확인 범위 |
| --- | --- | --- |
| `npm run format:check` | 통과 | 전체 프로젝트 형식 |
| `npm test` | 103/103 통과 | 기존 97개와 프로파일 계약·행렬 4개, 역순 PDF.js 통합 1개, 누락 font 보조값 정규화 1개 |
| 고정 프로파일 행렬 | 통과 | 일치 2/8, 미지원 2/8, 보류 4/8; 보호 Text Item 누락 0/6, 문제 침범 0/3, 미지원 오일치 0/6, CBT 착수 0/8 |
| 실제 PDF.js fixture | 통과 | A/B 두 순서, 두 영역, 원본 SHA-256 유지 |
| `npm run build` | 통과 | Vite 22 modules, 로컬 PDF.js·프로파일 판정 포함 |
| `npm run package` | 통과 | Electron 44.0.0 Windows x64/ASAR 버전 0.2.6 |
| `npm run test:electron` | 4/4 통과 | 진단 1경로와 일반 개발·빌드·패키지 3경로, 세 판정·원문 DOM 비노출·Viewer·오프라인·입력·보안 회귀 |
| `npm run test:native` | 1/1 통과 | 실제 Windows 선택 창, 미지원 판정·취소·원본 해시 |
| 패키지 화면 확인 | 통과 | 지원 프로파일 상태·범위 안내·footer·기존 Viewer 배치 |
| 사용자 Notion/Chromium PDF 읽기 전용 진단 | 부분 통과 | 실제 텍스트 111개·비공백 186자·판독 비율 1·이미지 paint 0개, 텍스트/좌표 분석 가능. footer source 순서 때문에 정답 제목 누락·미지원 |
| `npm run test:shutdown -- -Repeats 3` | 16/18 | 개발 7/9, 패키지 9/9. 개발 즉시 종료 2회에서 OPEN-09 GPU 진단 재현 |

종료 18회 모두 창이 닫히고 프로세스 종료 코드 0과 개발 포트 해제를 확인했다. GPU 오류를 숨기거나 그래픽·sandbox 설정을 낮추지 않았다.

### Unit 2.6 — 6. 예상되는 Edge Case

- 제목이 두 개여도 이미지·수식에만 해설이나 정답이 있으면 텍스트 영역은 이를 확인하지 못한다. 현재는 일치와 동시에 CBT 불가 사유를 유지한다.
- 마지막 제목 뒤에 다음 문제나 footer가 있으면 열린 마지막 영역에 함께 들어갈 수 있다. 닫힌 경계를 추측하지 않는다.
- 한 종류 제목만 있는 페이지는 영역 후보가 있더라도 두 제목 프로파일에는 미지원이다. 중복 제목·다단·회전은 명백한 미지원 대신 보류될 수 있다.
- PDF.js source 순서가 시각 순서와 다르거나 제목 글자가 이미지/윤곽선이면 일치하지 않거나 보류될 수 있다.
- Notion/Chromium 인쇄의 머리글·바닥글이 `hasEOL` 없이 답 값 뒤에 붙으면 정답 제목을 의도적으로 인식하지 않는다. 인쇄 설정에서 머리글과 바닥글을 끄는 것이 현재 안전한 우회 방법이다.
- 보류 50%는 작은 합성 행렬의 분포다. 실제 문서 전체의 보류율이나 인식률로 해석하지 않는다.

### Unit 2.6 — 7. 알려진 제한사항

고정 행렬은 합성 Text Item과 작은 PDF.js 합성 fixture 두 개에 한정된다. 사용자 제공 Notion/Chromium PDF 한 건은 호환성과 source 순서 제한을 확인한 진단 샘플로만 사용했고 프로젝트·패키지에 복사하지 않았다. 보호 Text Item 누락·문제 침범 수치는 픽셀·글리프·클리핑·이미지·수식 누출이나 과다 가림을 측정하지 않는다. 실제 대표 PDF 행렬과 Unit 1.0 전체 샘플 행렬은 없으며 `canStartCbt`는 모든 결과에서 false다. 현재 일반 UI 판정은 분석 진단이며 실제 CBT 지원 목록이 아니다.

### Unit 2.6 — 8. Technical Debt

- OPEN-03은 합성 프로파일 목록만 부분 해결됐다. 저작권과 개인정보를 지키는 실제 대표 PDF 행렬이 필요하다.
- OPEN-05는 Text Item 수준 수치만 확보했다. 안전한 Mask를 위해 글리프·클리핑·이미지·수식과 닫힌 경계를 화면 수준에서 검증해야 한다.
- Question과 Region 소유 관계가 없으며 한 페이지 한 문제 가정도 실제 문서로 확인하지 않았다.
- OPEN-09는 이번 보완 종료 반복에서도 개발 즉시 종료 두 번에 재현됐다.

### Unit 2.6 — 9. 다음 Unit 진행 전 수정이 필요한 사항

Unit 2.6 분석 판정 자체의 확인된 선행 수정 사항은 없다. 다만 결과가 `canStartCbt: false`이므로 Phase 3.1 기능에 바로 들어갈 수 없다. 다음 계획 Unit 3.0을 사용자가 요청하면 상태·소유 관계와 함께 지원 프로파일 축소, 실제 대표 샘플 확보, 또는 Phase 4.1 수동 영역 지정을 앞당기는 일정 변경 중 안전한 경로를 먼저 결정해야 한다. 프로젝트 전체 무오류 완료에는 OPEN-09 해결과 Unit 1.0 샘플 행렬도 계속 필요하다.

### Unit 2.6 — 10. Git Commit Message

제안 메시지: `feat(analysis): classify MVP profiles and normalize PDF font metadata`

실제 Git 커밋은 만들지 않았다. 메시지는 사용자가 전체 diff와 검사 결과를 검토한 뒤 사용할 제안이다.

## 0.2.5 작업 기록 — 2026-09-02

**Unit 2.5 분석 결과 Debug Overlay를 구현했다. 명시적 개발 진단 모드에서 기존 Text Item·키워드·영역 후보의 좌표 근거만 Canvas와 대조하며 새로운 분석 규칙·지원 판정·Mask·정답 추출·CBT는 구현하지 않았다.**

작업 전에 현재 프로젝트 파일, PROJECT_BIBLE, ROADMAP, DECISIONS와 Git 상태를 확인했다. 작업 트리는 Unit 2.4 커밋 `3e87256` 기준으로 깨끗했다. Unit 2.3·2.4를 먼저 진행한 순서 예외 뒤 ROADMAP에 남아 있던 Unit 2.5 범위만 구현했으며 다음 Unit 2.6은 시작하지 않았다.

### Unit 2.5 — 1. 구현한 내용

- 순수 `createPdfDebugOverlayModel()`을 추가했다. 같은 revision·pageNumber의 PageTextCoordinates v1과 선택적인 PageKeywordCandidates v1/PageAnswerRegions v1을 검증하고 기존 PDF user space 근거를 `viewport-css-px`로 투영한다.
- Text Item bbox와 `T{sourceIndex}`, 제목 키워드 근거와 `K{candidateIndex}`, 영역 후보의 text rect·전체 경계와 `R{regionIndex}`를 서로 다른 선으로 같은 PDF page surface에 표시한다.
- PDF.js와 같은 viewport 변환 후 실제 Canvas CSS width/height의 반올림 차이를 보정한다. device pixel ratio와 backing bitmap을 섞지 않고 확대·축소, 높이 맞춤, 창 크기와 고유 회전 변화 때 다시 투영한다.
- `--debug-overlay`를 main이 받은 경우에만 내부 진단 URL을 만들도록 했다. `npm run dev:debug` 실행 경로를 추가했으며 일반 개발·빌드·패키지 실행에는 panel·overlay DOM이 생성되지 않는다.
- 진단 panel은 페이지·배율·회전·Text Item/키워드/영역 개수와 공개 outcome만 표시한다. PDF 원문 문자열·정답 값·파일 경로·PDF.js 객체는 진단 모델이나 DOM에 복사하지 않는다.
- 페이지·파일 변경, 분석 불가와 dispose에서 Overlay 근거를 지우고 숨김/표시 버튼은 진단 사각형의 표시만 바꾼다. Overlay는 pointer event를 받지 않으며 기존 원문 Viewer·분석 상태·Mask에 연결하지 않는다.
- 설치된 PDF.js 합성 fixture로 Text Item 7개·키워드 2개·영역 2개를 실제 Canvas에서 대조했다. 100→125% 확대, 높이 맞춤·창 크기 변경과 0/90/180/270도 회전 페이지에서 재투영을 확인했다.
- 앱과 Windows x64/ASAR 패키지 버전을 0.2.5로 올렸다. 이전 0.2.4 패키지는 `work/unit-2.5-before-package/release/`에 보존했다.

### Unit 2.5 — 2. 수정/생성된 파일

| 구분 | 파일·변경 |
| --- | --- |
| 진단 좌표 모델 | `src/pdf/pdf-debug-overlay-model.js` — 입력 계약 검증, CSS viewport 투영, 원문 없는 레이어 모델 |
| 진단 UI | `src/ui/pdf-debug-overlay.js`, `src/ui/pdf-viewer.js`, `src/styles/shell.css`, `index.html` — opt-in panel·overlay, 수명·재투영, 범례·단계 안내 |
| 실행 경계 | `electron/main.js`, `scripts/dev.js`, `package.json` — `--debug-overlay`, `npm run dev:debug`, 일반 실행 분리 |
| 단위 검사 | `tests/pdf-debug-overlay.test.js` — Text Item·키워드·영역, 확대·회전·보류·계약 실패·원문 비복사 |
| 실제 앱 검사 | `tests/debug-overlay.test.js`, `tests/electron.test.js`, `tests/helpers/pdf-fixtures.js` — 실제 Canvas 후보/회전 대조, 일반 실행 DOM 비생성 |
| 버전·실행 | `package.json`, `package-lock.json`, `README.md` — 0.2.5와 일반/진단 실행·검사 절차 |
| 문서 | `docs/PROJECT_BIBLE.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/CHANGELOG.md` |

`dist/`, `release/`, `work/`는 생성·검증 산출물이며 Git 대상이 아니다.

### Unit 2.5 — 3. 실행 방법

일반 앱은 프로젝트 루트에서 `npm run dev`로 실행한다. 진단 Overlay는 `npm run dev:debug`로 실행한다. `npm run build` 후 `npm start`는 일반 빌드 자산 모드다. 패키지 일반 실행은 `release/local-pdf-cbt-win32-x64/local-pdf-cbt.exe`, 패키지 진단 실행은 PowerShell에서 `& '.\release\local-pdf-cbt-win32-x64\local-pdf-cbt.exe' --debug-overlay`다. 이전 앱이 실행 중이면 완전히 닫고 다시 시작한다.

### Unit 2.5 — 4. 사용자가 직접 테스트할 방법

1. `npm run dev`에서 PDF를 열고 footer의 `Unit 2.5 · 분석 결과 Debug Overlay`를 확인한다. 진단 panel·사각형이 나타나지 않아야 한다.
2. 앱을 닫고 `npm run dev:debug`로 다시 연다. `PDF 좌표 Debug Overlay` panel이 보이고 PDF를 열면 Canvas 위 좌표 레이어가 나타나야 한다.
3. `해설:`과 `정답:` 제목이 각각 한 번 있는 단일 열 PDF에서 파란 Text Item, 주황 키워드, 초록 영역 줄과 보라 전체 경계를 눈으로 대조한다. panel의 개수가 보이는 근거와 맞아야 한다.
4. `+`, `-`, `높이 맞춤`과 창 크기 변경 후에도 사각형이 같은 PDF 글자에 붙어 있는지 확인한다. 고유 회전 페이지가 있으면 90°·180°·270°에서도 방향과 위치를 확인한다.
5. 숨김/표시, 페이지 이동과 PDF 교체를 반복해 이전 사각형이 남지 않는지 확인한다. 진단 panel·라벨에는 전체 PDF 문장과 파일 경로가 없어야 한다.
6. 일반/진단 어느 경로에서도 후보가 Mask 승인·답 확인·채점으로 바뀌지 않고 원본 불변 footer 안내가 유지되는지 확인한다.

자동 검사는 `npm run format:check`, `npm test`, `npm run build`, `npm run package`, `npm run test:electron`, `npm run test:native`, `npm run test:shutdown -- -Repeats 3` 순서로 실행한다. Electron·native·shutdown은 Windows 데스크톱 창 실행 권한이 필요하다.

### Unit 2.5 — 5. 정상 동작 기준과 실제 검증 결과

| 검사 | 결과 | 확인 범위 |
| --- | --- | --- |
| `npm run format:check` | 통과 | 전체 프로젝트 형식 |
| `npm test` | 97/97 통과 | 기존 92개와 진단 모델의 레이어·확대·회전·보류·계약 실패·원문 비복사 5개 |
| 실제 PDF.js/화면 fixture | 통과 | Text Item 7개·키워드 2개·영역 2개, 100→125%·높이 맞춤·창 크기, 0/90/180/270도, Canvas CSS 크기 |
| `npm run build` | 통과 | Vite 21 modules, 로컬 PDF.js·진단 자산 포함 |
| `npm run package` | 통과 | Electron 44.0.0 Windows x64/ASAR 버전 0.2.5 |
| `npm run test:electron` | 4/4 통과 | 진단 화면 1경로와 일반 개발·빌드·패키지 3경로, DOM 분리와 Viewer·오프라인·입력·보안 회귀 |
| `npm run test:native` | 1/1 통과 | 실제 Windows 선택 창, 한글 PDF 분석·취소·원본 해시 |
| 진단 화면 확인 | 통과 | 후보/회전 캡처에서 레이어 정렬·범례·개수·원문 DOM 비복사 확인 |
| `npm run test:shutdown -- -Repeats 3` | 17/18 | 개발 8/9, 패키지 9/9. 개발 즉시 종료 1회에서 OPEN-09 GPU 진단 재현 |

종료 18회 모두 창이 닫히고 프로세스 종료 코드 0과 개발 포트 해제를 확인했다. GPU 오류를 숨기거나 그래픽·sandbox 설정을 낮추지 않았다.

### Unit 2.5 — 6. 예상되는 Edge Case

- 하나의 제목 후보가 여러 sourceIndex에 걸치면 같은 candidate 번호의 주황 근거가 여러 Text Item 위에 표시된다. 후보 개수와 표시 사각형 개수는 같지 않을 수 있다.
- Text Item bbox는 글리프의 잉크 모양보다 넓거나 좁을 수 있다. Overlay 일치는 좌표 변환 확인이며 글리프·클리핑 경계 보장이 아니다.
- Canvas CSS 크기는 렌더 viewport가 정수로 반올림되므로 Overlay 모델이 X/Y 축의 실제 비율을 따로 보정한다. DPR 변화는 CSS 좌표에 포함하지 않는다.
- 분석 보류 페이지는 Text Item 일부를 임의 표시하지 않고 진단 불가 이유만 보인다. 기존 원문 Canvas 열람은 유지한다.
- 영역 후보가 없거나 `uncertain`이면 Text Item·키워드 근거만 보일 수 있다. 이는 진단 결과이며 자동으로 새 영역을 만들지 않는다.
- Overlay는 답 위치를 드러낼 수 있어 일반 학습 화면에 켜 두지 않는다. 명시적 진단 실행도 원문 문자열을 별도 DOM에 복제하지 않는다.

### Unit 2.5 — 7. 알려진 제한사항

시각 대조는 합성 PDF와 현재 Windows/Electron 화면에서 수행했다. 실제 출판물의 글꼴·클리핑·이미지·수식·다단·다문제·페이지 연결 전체를 검증하지 않았고 누락·침범률도 측정하지 않았다. userUnit/viewBox 오프셋의 수학적 통합 검사는 유지하지만 이번 GUI 캡처는 대표 후보와 회전 fixture다. 진단 Overlay는 제품 기능·Text Layer·Mask가 아니며 일반 실행에서 사용할 수 없다. Unit 1.0 전체 샘플 행렬도 미착수다.

### Unit 2.5 — 8. Technical Debt

- OPEN-05의 합성 좌표 시각 정합은 확인했지만 실제 출판물 지원 임계값과 이미지·수식 포함 영역은 Unit 2.6에서 고정 샘플로 측정해야 한다.
- 대량 Text Item의 진단 DOM 성능 예산은 정하지 않았다. 일반 실행에는 진단 DOM이 없으므로 제품 경로 성능 보장으로 확대하지 않는다.
- 사용자 임의 회전과 Text Layer가 없으므로 고유 회전만 검증했다.
- OPEN-09는 이번 종료 반복에서도 개발 즉시 종료 한 번에 재현됐다.

### Unit 2.5 — 9. 다음 Unit 진행 전 수정이 필요한 사항

Unit 2.5 기능의 확인된 선행 수정 사항은 없다. 다음은 사용자 요청을 받은 뒤 Unit 2.6에서 고정 지원·미지원 샘플로 누출·과다 가림·보류와 CBT 착수 가능 여부를 판정해야 한다. 그 전에는 후보와 Overlay 정렬을 Mask나 지원 선언으로 사용하면 안 된다. 프로젝트 전체 무오류 완료에는 OPEN-09 해결과 Unit 1.0 샘플 행렬도 계속 필요하다.

### Unit 2.5 — 10. Git Commit Message

제안 메시지: `feat(debug): visualize PDF analysis coordinates`

실제 Git 커밋은 만들지 않았다. 메시지는 사용자가 전체 diff와 검사 결과를 검토한 뒤 사용할 제안이다.

## 0.2.4 작업 기록 — 2026-09-02

**Unit 2.4 해설·정답 영역 후보 추정을 구현했다. 제목·텍스트 bbox에서 보수적인 후보 경계와 보류 사유만 만들며 Debug Overlay·지원 판정·Mask·정답 추출·CBT는 구현하지 않았다.**

작업 전에 현재 프로젝트 파일, PROJECT_BIBLE, ROADMAP, DECISIONS와 Git 상태를 확인했다. 작업 트리는 Unit 2.3 커밋 `675ed47` 기준으로 깨끗했다. ROADMAP의 기본 순서는 Unit 2.5가 먼저지만 사용자가 Unit 2.4를 명시적으로 요청했으므로 두 번째 순서 예외로 기록했다. Unit 2.5를 완료하거나 생략하지 않았고 다음 구현 순서로 유지한다.

### Unit 2.4 — 1. 구현한 내용

- 순수 `inferPageAnswerRegions()`와 `PageAnswerRegions v1`을 추가했다. PageTextSource, `text-usable` assessment, TextItem 좌표, 제목 후보가 같은 revision·pageNumber·page geometry인지 확인한 뒤에만 후보를 계산한다.
- source item 순서와 `hasEOL`로 만든 논리 줄의 TextItemRecord bbox를 회전 전 PDF user space에서 합친다. 제목 줄을 시작 경계, 다음 제목 앞을 끝 경계로 사용해 문제·보기 줄이 첫 영역에 들어가지 않게 했다.
- `해설→정답`과 `정답→해설` 순서를 구별하고 한 종류 제목만 있는 경우 누락 사유를 남긴다. 같은 종류 제목이 여러 개면 다문제 가능성으로 영역을 만들지 않는다.
- source 순서와 Y 진행 충돌, 큰 수평 간격의 다단 가능성, 고유 회전, 세로쓰기는 읽기 순서를 입증할 수 없어 `uncertain`으로 보류한다.
- 마지막 영역은 Text Content 끝까지 후보로 만들되 열린 경계임을 기록한다. 모든 후보는 텍스트 bbox만 포함하고 이미지·수식은 확인하지 못했음을 명시하므로 안전한 Mask로 승인되지 않는다.
- 일반 UI에는 영역 후보 개수, 후보 없음, 분석 보류와 `안전한 가림은 아직 확인하지 않았습니다`만 표시한다. 전체 원문·좌표·정답 값은 DOM, Console, 자동 결과에 노출하거나 장기 보관하지 않는다.
- 실제 PDF.js 합성 fixture에서 문제·보기 뒤 `Solution→Answer` 두 영역을 찾고 문제·보기 제외, 텍스트 전용·열린 마지막 경계 사유와 원본 SHA-256 불변을 확인했다.
- 앱과 Windows x64/ASAR 패키지 버전을 0.2.4로 올렸다. 이전 0.2.3 패키지는 `work/unit-2.4-before-package/release/`에 보존했다.

### Unit 2.4 — 2. 수정/생성된 파일

| 구분 | 파일·변경 |
| --- | --- |
| 영역 분석 | `src/analysis/page-answer-regions.js` — 입력 검증, 줄 bbox, A/B 순서, 경계, 보류·제한 사유 |
| UI | `src/ui/pdf-viewer.js`, `index.html`, `src/styles/shell.css` — 영역 후보 개수·없음·보류 공개 상태 |
| 단위 검사 | `tests/page-answer-regions.test.js` — A/B, 문제/보기 제외, 단일·중복 제목, 읽기 순서·다단·회전·세로쓰기, 실패·개인정보 경계 |
| PDF.js 통합 | `tests/pdf-text-integration.test.js`, `tests/helpers/pdf-fixtures.js` — 실제 TextContent 두 영역과 원본 해시 |
| 실제 앱 검사 | `tests/helpers/pdf-selection-checks.js`, `tests/native-dialog.test.js` — 세 실행 모드·Windows 선택 창·원문 DOM 비노출·기존 회귀 |
| 버전·실행 | `package.json`, `package-lock.json`, `README.md` — 0.2.4와 검사 절차 |
| 문서 | `docs/PROJECT_BIBLE.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/CHANGELOG.md` |

`dist/`, `release/`, `work/`는 생성·검증 산출물이며 Git 대상이 아니다.

### Unit 2.4 — 3. 실행 방법

프로젝트 루트에서 `npm run dev`로 개발 앱을 실행한다. `npm run build` 후 `npm start`는 빌드 자산 모드이고 `release/local-pdf-cbt-win32-x64/local-pdf-cbt.exe`는 버전 0.2.4 패키지다. 이전 앱이 실행 중이면 완전히 닫고 다시 시작한다.

### Unit 2.4 — 4. 사용자가 직접 테스트할 방법

1. 앱 footer에서 `Unit 2.4 · 해설·정답 영역 후보`를 확인한다.
2. 충분한 문제·보기 뒤에 줄 시작 `해설:`과 `정답:`이 각각 한 번 있는 단일 열 PDF를 연다. 앱 상태의 `키워드 후보`와 `영역 후보`가 각각 2개를 표시하는지 확인한다.
3. `정답:`이 먼저 나오고 뒤에 `해설:`이 있는 PDF도 영역 후보 2개를 표시하는지 확인한다. 순서는 일반 UI에 원문으로 노출되지 않는다.
4. 제목이 하나만 있으면 영역 후보 1개와 안전한 가림 미확인 안내가 보여야 한다. 제목이 없으면 영역을 계산하지 않았다고 표시되어야 한다.
5. 같은 종류 제목이 두 번 있는 페이지, 두 열처럼 보이는 페이지, 고유 회전 페이지는 경계를 안전하게 계산하지 못했다고 보류되어야 한다. 원문 Viewer는 계속 동작해야 한다.
6. 후보가 있어도 원문 문장·좌표 사각형·Overlay가 별도 화면에 나타나지 않고 Mask·답 확인·채점이 활성화되지 않아야 한다.
7. 페이지를 빠르게 이동하거나 PDF를 교체했을 때 이전 후보 상태가 돌아오지 않는지 확인한다. 확대·축소·높이 맞춤과 원본 불변 footer 안내도 유지되어야 한다.

자동 검사는 `npm run format:check`, `npm test`, `npm run build`, `npm run package`, `npm run test:electron`, `npm run test:native`, `npm run test:shutdown -- -Repeats 3` 순서로 실행한다. Electron·native·shutdown은 Windows 데스크톱 창 실행 권한이 필요하다.

### Unit 2.4 — 5. 정상 동작 기준과 실제 검증 결과

| 검사 | 결과 | 확인 범위 |
| --- | --- | --- |
| `npm run format:check` | 통과 | 전체 프로젝트 형식 |
| `npm test` | 92/92 통과 | 기존 81개와 영역 계약·A/B·경계·보류·개인정보·실제 PDF.js 통합 11개 |
| 실제 PDF.js fixture | 통과 | `Solution→Answer` 두 영역, 문제·보기 제외, 텍스트 전용·열린 마지막 경계, SHA-256 유지 |
| `npm run build` | 통과 | Vite 18 modules, 로컬 PDF.js 자산 포함 |
| `npm run package` | 통과 | Electron 44.0.0 Windows x64/ASAR 버전 0.2.4 |
| `npm run test:electron` | 3/3 통과 | 개발·빌드·패키지 후보 없음·1개·2개·보류, 원문 DOM 비노출과 Viewer·오프라인·입력·보안 회귀 |
| `npm run test:native` | 1/1 통과 | 실제 Windows 선택 창, 한글 PDF 텍스트·좌표 분석·키워드/영역 후보 없음, 취소, 원본 해시 |
| 패키지 화면 확인 | 통과 | 1120×760 캡처에서 영역 후보 상태·footer·오른쪽 도구 배치 확인 |
| `npm run test:shutdown -- -Repeats 3` | 16/18 | 개발 7/9, 패키지 9/9. 개발 즉시 종료 2회에서 OPEN-09 GPU 진단 재현 |

종료 18회 모두 창이 닫히고 프로세스 종료 코드 0과 개발 포트 해제를 확인했다. GPU 오류를 숨기거나 그래픽·sandbox 설정을 낮추지 않았다.

### Unit 2.4 — 6. 예상되는 Edge Case

- `해설→정답`과 `정답→해설`은 지원 후보 순서로 구분하지만 제목이 반복되면 한 페이지 여러 문제일 수 있어 전체 페이지를 보류한다.
- 첫 제목이 첫 논리 줄이면 앞선 문제·보기 근거가 없다는 사유를 남긴다. 제목만 있고 본문 줄이 없으면 빈 본문 사유를 추가한다.
- PDF.js source item 순서가 실제 위에서 아래 읽기 순서와 다르거나 `hasEOL`이 시각적 줄과 다르면 영역을 보류하거나 경계를 놓칠 수 있다.
- 같은 높이의 멀리 떨어진 줄은 다단 가능성으로 보수적으로 보류하므로 단일 열의 특수 레이아웃도 과하게 보류할 수 있다.
- 고유 회전과 세로쓰기는 좌표 수학이 유효해도 영역 읽기 순서를 시각 검증하지 않았으므로 보류한다.
- 마지막 제목 뒤의 페이지 끝, 다음 문제 시작, 이미지·수식 범위는 Text Content만으로 입증하지 못한다.

### Unit 2.4 — 7. 알려진 제한사항

PageAnswerRegions는 텍스트 bbox 후보일 뿐 안전한 가림 영역이 아니다. 실제 화면과 sourceIndex별 대조, 이미지·수식·클리핑 포함 여부, 실제 출판물의 누락·침범률, 다문제·다단·페이지 연결은 검증하지 않았다. 현재 UI에는 Debug Overlay가 없고 후보 사각형을 표시하지 않는다. Unit 1.0 전체 샘플 행렬도 미착수다.

### Unit 2.4 — 8. Technical Debt

- OPEN-05는 초기 단일 열 영역 후보까지 부분 해결됐지만 bbox 시각 정합과 실제 샘플 정확도는 Unit 2.5·2.6에서 확인해야 한다.
- 마지막 영역의 닫힌 끝 경계와 이미지·수식 포함 영역은 현재 자동으로 증명할 수 없다.
- 다문제·다단·페이지 연결은 Phase 4까지 자동 연결하지 않는다.
- OPEN-09는 이번 종료 반복에서도 개발 즉시 종료 두 번에 재현됐다.

### Unit 2.4 — 9. 다음 Unit 진행 전 수정이 필요한 사항

Unit 2.4 기능의 확인된 선행 수정 사항은 없다. 다만 ROADMAP 기본 순서에서 빠진 Unit 2.5가 여전히 필수이므로 다음은 사용자 요청을 받은 뒤 Debug Overlay에서 TextItem bbox와 기존 키워드·영역 후보 근거의 시각 정합만 검증한다. 그 뒤 Unit 2.6에서 고정 지원·미지원 샘플을 분리해 누출·과다 가림·보류를 측정해야 하며, 그 전에는 후보를 Mask나 CBT 지원으로 사용하면 안 된다. 프로젝트 전체 무오류 완료에는 OPEN-09 해결과 Unit 1.0 샘플 행렬도 계속 필요하다.

### Unit 2.4 — 10. Git Commit Message

제안 메시지: `feat(analysis): infer solution and answer region candidates`

실제 Git 커밋은 만들지 않았다. 메시지는 사용자가 전체 diff와 검사 결과를 검토한 뒤 사용할 제안이다.

## 0.2.3 작업 기록 — 2026-09-02

**Unit 2.3 제목 키워드 탐색을 구현했다. 일곱 개 키워드의 제목 문맥 후보와 오탐 억제만 추가했으며 Debug Overlay·영역 추정·지원 판정·CBT는 구현하지 않았다.**

작업 전에 현재 프로젝트 파일·PROJECT_BIBLE·ROADMAP·DECISIONS와 Git 상태를 확인했다. 작업 트리는 Unit 2.2 커밋 `3145206` 기준으로 깨끗했다. ROADMAP의 기본 순서는 Unit 2.5가 먼저지만 사용자가 Unit 2.3을 명시적으로 요청했으므로 이를 순서 예외로 기록했고, Unit 2.5를 완료하거나 생략하지 않았다.

### Unit 2.3 — 1. 구현한 내용

- 순수 `findPageKeywordCandidates()`와 `PageKeywordCandidates v1` 결과를 추가했다. PageTextSource와 같은 revision·pageNumber의 `text-usable` assessment만 검색하며 나머지 품질은 reason code와 함께 보류한다.
- 제목 목록을 `해설`, `풀이`, `정답`, `답`, `Answer`, `Solution`, `Explanation` 일곱 개로 고정했다. 영문은 대소문자를 구분하지 않고 더 긴 키워드를 먼저 검사한다.
- 원래 source item 순서와 `hasEOL`로만 논리 줄을 만들고 같은 줄의 분리된 항목은 문자를 만들지 않고 연결한다. `정`+`답`, 분리된 영문 제목과 sourceIndex 근거를 유지한다.
- 공백·제한된 글머리표 뒤의 줄 시작, 단독 제목·구분 기호·해설 본문·허용 답 표기를 문맥으로 구분한다. `정답을 고르시오`, `답변`, `해설서`, `풀이과정`, 본문 속 `Answer`, `Answer choices`, `Solution manual`, `Explanation guide`를 고정 오탐 사례로 검증했다.
- 일반 UI에는 현재 페이지의 후보 개수·없음·보류 상태만 추가했다. 후보 키워드나 주변 원문, 좌표, 영역은 DOM·Console·자동 결과에 표시하거나 장기 보관하지 않는다. 같은 페이지 배율 재렌더에서는 기존 추출·분석 수명 계약을 유지한다.
- 실제 PDF.js 합성 fixture에서 본문 `Answer`와 `Answer choices`를 제외하고 `Explanation:` 한 개만 찾았으며 원본 SHA-256 불변을 확인했다.
- 앱과 Windows x64/ASAR 패키지 버전을 0.2.3으로 올렸다. 이전 0.2.2 패키지는 `work/unit-2.3-before-package/release/`에 보존했다.

### Unit 2.3 — 2. 수정/생성된 파일

| 구분 | 파일·변경 |
| --- | --- |
| 키워드 분석 | `src/analysis/page-keyword-candidates.js` — 목록·논리 줄·문맥·오탐·후보 계약 |
| UI | `src/ui/pdf-viewer.js`, `index.html`, `src/styles/shell.css` — 후보 수·없음·보류 공개 상태 |
| 단위 검사 | `tests/page-keyword-candidates.test.js` — 일곱 키워드·분절·문맥·오탐·실패·개인정보 경계 |
| PDF.js 통합 | `tests/pdf-text-integration.test.js`, `tests/helpers/pdf-fixtures.js` — 실제 TextContent 후보 1개와 원본 해시 |
| 실제 앱 검사 | `tests/helpers/pdf-selection-checks.js`, `tests/native-dialog.test.js` — 세 실행 모드·Windows 선택 창·DOM 비노출·기존 회귀 |
| 버전·실행 | `package.json`, `package-lock.json`, `README.md` — 0.2.3과 검사 절차 |
| 문서 | `docs/PROJECT_BIBLE.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/CHANGELOG.md` |

`dist/`, `release/`, `work/`는 생성·검증 산출물이며 Git 대상이 아니다.

### Unit 2.3 — 3. 실행 방법

프로젝트 루트에서 `npm run dev`로 개발 앱을 실행한다. `npm run build` 후 `npm start`는 빌드 자산 모드이고 `release/local-pdf-cbt-win32-x64/local-pdf-cbt.exe`는 버전 0.2.3 패키지다. 이전 앱이 실행 중이면 완전히 닫고 다시 시작한다.

### Unit 2.3 — 4. 사용자가 직접 테스트할 방법

1. 앱 footer에서 `Unit 2.3 · 제목 키워드 탐색`을 확인한다.
2. 본문 텍스트가 충분하고 줄 시작에 `해설:`, `풀이`, `정답: ③`, `Answer: B`, `Solution - ...`, `Explanation ...` 중 하나가 있는 PDF를 연다. 앱 상태의 `키워드 후보`가 찾은 개수를 표시하는지 확인한다.
3. `정답을 고르시오`, 문장 중간의 `Answer`, `Answer choices`만 있는 페이지에서는 후보가 없다고 표시되는지 확인한다.
4. 빈·이미지 전용·페이지 번호 수준의 짧은 페이지에서는 기존 텍스트 보류 안내와 함께 키워드 검색도 보류되는지 확인한다. 원문 Viewer는 계속 사용할 수 있어야 한다.
5. 후보가 있는 페이지에서도 원문 키워드·전체 문장·좌표 사각형·해설/정답 영역이 별도 텍스트나 Overlay로 나타나지 않는지 확인한다.
6. 페이지를 빠르게 이동하거나 PDF를 교체해 이전 페이지의 후보 수가 돌아오지 않는지, 같은 페이지에서 확대·축소·높이 맞춤을 사용해도 원문 Viewer가 유지되는지 확인한다.
7. 후보 수가 있어도 CBT·가림·채점이 활성화되지 않고 footer의 원본 불변 안내가 유지되는지 확인한다.

자동 검사는 `npm run format:check`, `npm test`, `npm run build`, `npm run package`, `npm run test:electron`, `npm run test:native`, `npm run test:shutdown` 순서로 실행한다. Electron·native·shutdown은 Windows 데스크톱 창 실행 권한이 필요하다.

### Unit 2.3 — 5. 정상 동작 기준과 실제 검증 결과

| 검사 | 결과 | 확인 범위 |
| --- | --- | --- |
| `npm run format:check` | 통과 | 전체 프로젝트 형식 |
| `npm test` | 81/81 통과 | 기존 70개와 키워드 계약·분절·문맥·오탐·실패·실제 PDF.js 통합 11개 |
| 실제 PDF.js fixture | 통과 | 본문 `Answer`·`Answer choices` 제외, `Explanation:` 후보 1개, SHA-256 유지 |
| `npm run build` | 통과 | Vite 17 modules, 로컬 PDF.js 자산 포함 |
| `npm run package` | 통과 | Electron 44.0.0 Windows x64/ASAR 버전 0.2.3 |
| `npm run test:electron` | 3/3 통과 | 개발·빌드·패키지 후보 1개/없음/보류·원문 DOM 비노출과 Viewer·오프라인·입력·보안 회귀 |
| `npm run test:native` | 1/1 통과 | 실제 Windows 선택 창, 한글 PDF 텍스트·위치·후보 없음 상태, 취소, 원본 해시 |
| `npm run test:shutdown` | 16/18 | 개발 7/9, 패키지 9/9. 개발 즉시 종료 2회에서 OPEN-09 GPU 진단 재현 |

종료 18회 모두 창이 닫히고 프로세스 종료 코드 0과 개발 포트 해제를 확인했다. GPU 오류를 숨기거나 그래픽·sandbox 설정을 낮추지 않았다.

### Unit 2.3 — 6. 예상되는 Edge Case

- `정`과 `답`, 또는 영문 키워드가 여러 Text Item으로 나뉘어도 같은 논리 줄이고 중간에 실제 문자가 없으면 sourceIndex 근거를 합쳐 찾는다.
- 항목 사이의 시각적 간격을 공백으로 추정하지 않으므로 PDF.js가 `hasEOL`을 주지 않거나 읽기 순서를 다르게 반환한 문서는 후보를 놓치거나 잘못 연결할 수 있다.
- `답`처럼 짧은 제목은 줄 시작과 제한된 문맥에서만 인정한다. 허용 답 표기는 ①~⑩, 1~10, A~G의 초기 범위다.
- 영문 대소문자는 무시하지만 언어별 철자 변형, 번역어, 사용자 지정 키워드는 아직 지원하지 않는다.
- 한 페이지에 후보가 여러 개면 개수를 그대로 알릴 뿐 서로의 순서나 같은 문제 소유 관계를 판단하지 않는다.

### Unit 2.3 — 7. 알려진 제한사항

키워드 후보는 제목처럼 보이는 문자열 근거일 뿐 해설·정답 영역이나 올바른 답을 뜻하지 않는다. 시각적 줄/블록, 글꼴 크기, bbox 관계, 열, 다음 제목과 끝 경계를 사용하지 않았고 실제 출판물 표본의 정밀도·재현율도 측정하지 않았다. Unit 1.0 전체 샘플 행렬과 Unit 2.5 bbox 시각 대조가 남아 있다. 이 결과로 CBT 지원이나 안전한 가림을 선언하지 않는다.

### Unit 2.3 — 8. Technical Debt

- OPEN-05의 초기 키워드·문맥 규칙은 부분 해결됐지만 실제 샘플에서 후보 누락·오탐과 `hasEOL`/읽기 순서를 측정해야 한다.
- bbox의 실제 화면 정합과 sourceIndex 시각 대조는 미완료 Unit 2.5에서 확인해야 한다.
- 좌표 기반 줄/블록, 해설·정답 영역과 끝 경계, 지원 판정은 Unit 2.4·2.6에 남아 있다.
- OPEN-09는 이번 종료 반복에서도 개발 즉시 종료 두 번에 재현됐다.

### Unit 2.3 — 9. 다음 Unit 진행 전 수정이 필요한 사항

Unit 2.3 기능의 확인된 선행 수정 사항은 없다. 다만 ROADMAP 기본 순서에서 빠진 Unit 2.5가 여전히 필수이므로 다음은 사용자 요청을 받은 뒤 Debug Overlay의 bbox 시각 대조만 진행한다. 그 검증 전에 Unit 2.4 영역 추정으로 넘어가면 안 된다. 프로젝트 전체 무오류 완료에는 OPEN-09 해결과 Unit 1.0 샘플 행렬도 계속 필요하다.

### Unit 2.3 — 10. Git Commit Message

제안 메시지: `feat(analysis): find contextual PDF heading keywords`

실제 Git 커밋은 만들지 않았다. 메시지는 사용자가 전체 diff와 검사 결과를 검토한 뒤 사용할 제안이다.

## 0.2.2 작업 기록 — 2026-09-02

**Unit 2.2 Text Item 좌표 분석을 구현했다. 회전 전 PDF user space bbox와 viewport 좌표 변환만 추가했으며 Debug Overlay·키워드·영역·CBT는 구현하지 않았다.**

작업 전에 현재 프로젝트 파일·PROJECT_BIBLE·ROADMAP·DECISIONS와 Git 상태를 확인했다. 작업 트리는 Unit 2.1 커밋 `c51fb3b` 기준으로 깨끗했다. 문서가 정한 실행 순서와 좌표 계약에 따라 PageTextSource v1은 유지하고 좌표 결과를 별도 순수 데이터로 만들었다.

### Unit 2.2 — 1. 구현한 내용

- 공통 PageTextSource v1 검증을 `src/shared/page-text-contract.js`로 모아 품질 분류와 좌표 분석이 동일한 엄격한 계약을 사용하게 했다.
- `createPageTextCoordinates()`가 raw transform·item width/height·font ascent/descent로 가로·세로·회전·반사 Text Item의 네 모서리를 구하고 회전 전 PDF user space의 축 정렬 근사 bbox를 만든다.
- `PageTextCoordinates v1`과 `TextItemRecord`는 documentRevision·page metadata·sourceIndex·text·x/y/width/height/page만 가진다. raw PDF.js 객체·transform·경로·파일 바이트는 결과에 넣지 않는다.
- 글꼴 metric이 모두 0일 때만 기본 ascent/descent 0.8/-0.2를 사용한다. 잘못된 source, page geometry, font metric, text geometry는 공개 코드로 페이지 전체를 보류하고 부분 좌표를 반환하지 않는다.
- PDF.js PageViewport와 같은 viewBox·`userUnit`·0/90/180/270도·scale의 순수 viewport geometry, PDF point 왕복, bbox CSS 투영을 추가했다. Canvas device pixel ratio는 좌표 API에서 분리했다.
- `text-usable` 페이지는 좌표 생성까지 성공해야 일반 UI에서 `현재 페이지의 텍스트와 위치를 분석할 수 있습니다.`로 표시한다. 원문과 bbox는 DOM·Console·자동 결과에 기록하거나 UI 상태로 보관하지 않는다.
- 앱과 Windows x64/ASAR 패키지 버전을 0.2.2로 올렸다. 이전 0.2.1 패키지는 `work/unit-2.2-before-package/release/`에 보존했다.

### Unit 2.2 — 2. 수정/생성된 파일

| 구분 | 파일·변경 |
| --- | --- |
| 계약 | `src/shared/page-text-contract.js` — PageTextSource v1 공통 검증 |
| 좌표 분석 | `src/analysis/page-text-coordinates.js` — PageTextCoordinates/TextItemRecord와 bbox 실패 정책 |
| 좌표 투영 | `src/pdf/pdf-coordinate-space.js` — PDF user space ↔ viewport CSS point/rect 변환 |
| 기존 분석·UI | `src/analysis/page-text-assessment.js`, `src/ui/pdf-viewer.js`, `index.html` — 공통 검증 재사용과 공개 좌표 상태 |
| 단위·통합 검사 | `tests/page-text-coordinates.test.js`, `tests/pdf-text-integration.test.js`, `tests/helpers/pdf-fixtures.js` |
| 실제 앱 검사 | `tests/helpers/pdf-selection-checks.js`, `tests/native-dialog.test.js` — 좌표 성공 문구와 기존 회귀 |
| 버전·실행 | `package.json`, `package-lock.json`, `README.md` — 0.2.2와 검사 절차 |
| 문서 | `docs/PROJECT_BIBLE.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/CHANGELOG.md` |

`dist/`, `release/`, `work/`는 생성·검증 산출물이며 Git 대상이 아니다.

### Unit 2.2 — 3. 실행 방법

프로젝트 루트에서 `npm run dev`로 개발 앱을 실행한다. `npm run build` 후 `npm start`는 빌드 자산 모드이고 `release/local-pdf-cbt-win32-x64/local-pdf-cbt.exe`는 버전 0.2.2 패키지다. 이전 앱이 실행 중이면 완전히 닫고 다시 시작한다.

### Unit 2.2 — 4. 사용자가 직접 테스트할 방법

1. 앱 footer에서 `Unit 2.2 · Text Item 좌표 분석`을 확인한다.
2. 한글 본문이 충분한 PDF를 열고 앱 상태가 `현재 페이지의 텍스트와 위치를 분석할 수 있습니다.`로 바뀌는지 확인한다.
3. 빈/도형 전용 페이지와 매우 짧은 페이지는 이전과 같이 분석 보류 안내가 나오면서 원문 Viewer는 유지되는지 확인한다.
4. 고유 회전 PDF를 열고 페이지를 이동하거나 50–200% 확대·높이 맞춤을 사용해도 원문과 분석 상태가 유지되는지 확인한다.
5. 일반 화면에는 Text Item 사각형·좌표 숫자·추출 원문이 표시되지 않는지 확인한다. 시각 Debug Overlay는 다음 Unit 2.5 범위다.
6. PDF를 교체하거나 빠르게 페이지를 이동했을 때 이전 페이지의 상태가 돌아오지 않고 원본 불변 footer 안내가 유지되는지 확인한다.

자동 검사는 `npm run format:check`, `npm test`, `npm run build`, `npm run package`, `npm run test:electron`, `npm run test:native`, `npm run test:shutdown` 순서로 실행한다. Electron·native·shutdown은 Windows 데스크톱 창 실행 권한이 필요하다.

### Unit 2.2 — 5. 정상 동작 기준과 실제 검증 결과

| 검사 | 결과 | 확인 범위 |
| --- | --- | --- |
| `npm run format:check` | 통과 | 전체 프로젝트 형식 |
| `npm test` | 70/70 통과 | 기존 60개와 bbox·실패·viewport·실제 PDF.js 좌표 10개 |
| 실제 PDF.js fixture | 통과 | 한글+이미지 6 bbox; offset viewBox·`UserUnit 2`·0/90/180/270도·50/100/200% 투영 일치; SHA-256 유지 |
| `npm run build` | 통과 | Vite 16 modules, 로컬 PDF.js 자산 포함 |
| `npm run package` | 통과 | Electron 44.0.0 Windows x64/ASAR 버전 0.2.2 |
| `npm run test:electron` | 3/3 통과 | 개발·빌드·패키지 좌표 상태와 Viewer·오프라인·입력·보안 회귀 |
| `npm run test:native` | 1/1 통과 | 실제 Windows 선택 창, 한글 PDF 텍스트·위치 분석 가능, 취소, 원본 해시 |
| `npm run test:shutdown` | 17/18 | 개발 8/9, 패키지 9/9. 개발 즉시 종료 1회에서 OPEN-09 GPU 진단 재현 |

종료 18회 모두 창이 닫히고 프로세스 종료 코드 0과 개발 포트 해제를 확인했다. GPU 오류를 숨기거나 그래픽·sandbox 설정을 낮추지 않았다.

### Unit 2.2 — 6. 예상되는 Edge Case

- viewBox 원점이 0이 아니거나 `userUnit`이 1이 아니어도 저장 bbox는 회전 전 PDF user space에 남고 화면 투영만 달라진다.
- 고유 회전 0/90/180/270도는 normalized bbox를 바꾸지 않고 viewport 방향만 바꾼다. 그 외 회전 metadata는 부분 해석하지 않고 보류한다.
- 회전·반사·비직교 text transform은 네 모서리의 축 정렬 bbox로 근사하므로 실제 잉크보다 넓을 수 있다.
- 세로쓰기는 진행축을 보수적으로 계산하며 실제 세로 조판·대체 글꼴별 시각 일치는 아직 보장하지 않는다.
- 빈 TextContent는 오류가 아니라 빈 좌표 배열이고, 퇴화 transform이나 역전 font metric은 부분 좌표 없이 보류한다.
- 화면 확대 배율과 `userUnit`은 viewport CSS 좌표에 반영하지만 device pixel ratio는 Canvas backing bitmap에만 적용된다.

### Unit 2.2 — 7. 알려진 제한사항

bbox는 글리프 윤곽, 실제 잉크 범위, PDF clipping path, 이미지·수식 영역을 나타내지 않는 근사값이다. 설치된 PDF.js와 수학적 좌표 변환은 대조했지만 sourceIndex별 bbox를 실제 Canvas 위에서 시각 비교하지 않았다. 세로쓰기 증거는 합성 레코드뿐이고 Unit 1.0 실제 샘플 행렬도 미착수다. 이 결과만으로 키워드·영역·CBT 지원을 선언하지 않는다.

### Unit 2.2 — 8. Technical Debt

- OPEN-05의 bbox 수학 계약은 부분 해결됐지만 글리프/클리핑 여백과 실화면 정합은 Unit 2.5에서 확인해야 한다.
- 줄/블록·키워드·영역·지원 판정은 Unit 2.3~2.6에 남아 있다.
- 세로쓰기와 복잡한 transform은 실제 재배포 가능한 PDF 샘플을 추가해 다시 검증해야 한다.
- OPEN-09는 이번 종료 반복에서도 개발 즉시 종료 한 번에 재현됐다.

### Unit 2.2 — 9. 다음 Unit 진행 전 수정이 필요한 사항

Unit 2.2 기능의 확인된 선행 수정 사항은 없다. ROADMAP 실행 순서상 다음은 Unit 2.5지만 사용자의 명시적 요청 전에는 착수하지 않는다. Unit 2.5에서는 sourceIndex와 bbox를 개발용 Debug Overlay로 시각 대조하는 기능만 추가하고 키워드·영역·CBT를 앞당기면 안 된다. 프로젝트 전체 무오류 완료에는 OPEN-09 해결과 Unit 1.0 샘플 행렬이 계속 필요하다.

### Unit 2.2 — 10. Git Commit Message

제안 메시지: `feat(analysis): derive PDF text item coordinates`

실제 Git 커밋은 만들지 않았다. 메시지는 사용자가 전체 diff와 검사 결과를 검토한 뒤 사용할 제안이다.

## 0.2.1 작업 기록 — 2026-09-02

**Unit 2.1 현재 페이지 Text Content 추출과 페이지별 품질 분류를 구현했다. 좌표·키워드·영역·CBT는 추가하지 않았으며 기존 원문 Viewer는 그대로 동작한다.**

작업 전에 현재 프로젝트 파일·PROJECT_BIBLE·ROADMAP·DECISIONS와 Git 상태를 확인했다. Unit 2.0의 미커밋 문서 변경을 보존하고 ADR-024의 어댑터/순수 데이터 경계를 구현했다. 기존 한글+이미지 합성 PDF와 고정 JS 샘플로 임계값을 정했으며 실제 사용자 PDF를 새로 수집하거나 외부로 전송하지 않았다.

### Unit 2.1 — 1. 구현한 내용

- PDF 어댑터에 현재 문서의 유효한 페이지 한 개만 처리하는 `extractPageText({ pageNumber })`를 추가했다. PDF.js TextContent를 PageTextSource v1의 새 객체·배열로 복사하며 원시 PDF.js 객체·경로·파일 바이트를 반환하지 않는다.
- open/dispose의 documentRevision과 별도 text request id로 빠른 요청·파일 교체·종료 뒤의 늦은 추출 결과를 `canceled`로 폐기한다. PDF.js 6.3.289의 실제 정리 API에 맞춰 loading task를 파기한다.
- 순수 `assessPageText()`가 `text-usable / text-insufficient / unknown`, 7개 reason code와 근거 metric, 원래 item 순서·hasEOL만 반영한 진단용 plainText를 만든다.
- 고정 샘플과 실제 fixture를 근거로 최소 비공백 12자·판독 가능 문자 비율 0.8을 초기 품질 기준으로 채택했다. 실제 한글+이미지 fixture는 6개 item·비공백 73자·판독 비율 1이었다.
- 앱 상태에 현재 페이지의 `텍스트 분석 가능 / 분석 보류 / 확인 불가`만 표시한다. 추출 원문은 DOM이나 Console에 표시하지 않고 같은 페이지의 배율·높이 맞춤 재렌더에서는 재추출하지 않는다.
- 앱과 Windows x64/ASAR 패키지 버전을 0.2.1로 올렸다. 기존 0.1.6 패키지는 `work/unit-2.1-before-package/release/`에 보존했다.

### Unit 2.1 — 2. 수정/생성된 파일

| 구분 | 파일·변경 |
| --- | --- |
| 계약 | `src/shared/page-text-contract.js` — PageText 계약 버전 |
| 추출 | `src/pdf/pdf-adapter-core.js` — TextContent 복사·실패·revision/request id·loading task 정리 |
| 분석 | `src/analysis/page-text-assessment.js` — 품질 metric·상태·reason code·임계값 |
| UI | `src/ui/pdf-viewer.js`, `index.html`, `src/styles/shell.css` — 현재 페이지 품질 요약과 상태 스타일 |
| 단위·통합 검사 | `tests/pdf-adapter.test.js`, `tests/page-text-assessment.test.js`, `tests/pdf-text-integration.test.js` |
| 실제 앱 검사 | `tests/helpers/pdf-selection-checks.js`, `tests/native-dialog.test.js` — 상태·원문 DOM 비노출·원본 해시 |
| 버전·실행 | `package.json`, `package-lock.json`, `README.md` — 0.2.1과 검사 절차 |
| 문서 | `docs/PROJECT_BIBLE.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/CHANGELOG.md` |

`dist/`, `release/`, `work/`는 생성·검증 산출물이며 Git 대상이 아니다.

### Unit 2.1 — 3. 실행 방법

프로젝트 루트에서 `npm run dev`로 개발 앱을 실행한다. `npm run build` 후 `npm start`는 빌드 자산 모드이고 `release/local-pdf-cbt-win32-x64/local-pdf-cbt.exe`는 버전 0.2.1 패키지다. 이전 앱이 실행 중이면 완전히 닫고 다시 시작한다.

### Unit 2.1 — 4. 사용자가 직접 테스트할 방법

1. 한글 본문이 충분한 PDF를 열고 앱 상태의 `텍스트 분석`이 `현재 페이지의 텍스트를 분석할 수 있습니다.`로 바뀌는지 확인한다.
2. 빈 페이지나 글자 없이 그림·도형만 있는 PDF를 열고 Viewer는 유지되면서 `분석할 텍스트를 찾지 못했습니다.`가 표시되는지 확인한다.
3. 페이지 번호 정도의 매우 짧은 텍스트 페이지에서는 `분석하기에 텍스트가 너무 적습니다.`가 표시되는지 확인한다.
4. 여러 페이지를 빠르게 이동하고 마지막에 표시된 페이지의 텍스트 상태만 남는지 확인한다. 확대·축소와 높이 맞춤은 같은 페이지의 상태를 바꾸지 않아야 한다.
5. 다른 PDF로 교체하거나 앱을 닫아도 이전 페이지의 늦은 분석 결과가 새 화면을 덮지 않는지 확인한다.
6. 원문 Viewer, 페이지 이동, 50–200% 배율, 높이 맞춤과 footer의 원본 불변 안내가 이전과 같이 동작하는지 확인한다.

자동 검사는 `npm run format:check`, `npm test`, `npm run build`, `npm run test:electron`, `npm run test:native`, `npm run test:shutdown` 순서로 실행한다. Electron·native·shutdown은 Windows 데스크톱 창 실행 권한이 필요하다.

### Unit 2.1 — 5. 정상 동작 기준과 실제 검증 결과

| 검사 | 결과 | 확인 범위 |
| --- | --- | --- |
| `npm run format:check` | 통과 | 전체 프로젝트 형식 |
| `npm test` | 60/60 통과 | 기존 경계 49개, 추출·품질·실제 PDF.js 11개 |
| 실제 PDF.js fixture | 통과 | 한글+이미지 6 item, 비공백 73자, 비율 1, 원본 SHA-256 유지 |
| `npm run build` | 통과 | Vite 15 modules, 로컬 PDF.js 자산 포함 |
| `npm run package` | 통과 | Electron 44.0.0 Windows x64/ASAR 버전 0.2.1 |
| `npm run test:electron` | 3/3 통과 | 개발·빌드·패키지 UI, usable/insufficient, 원문 DOM 비노출, Viewer·오프라인·보안 회귀 |
| `npm run test:native` | 1/1 통과 | 실제 Windows 선택 창, 한글 PDF usable, 취소, 원본 해시 |
| `npm run test:shutdown` | 17/18 | 개발 9/9, 패키지 8/9. 패키지 250ms 1회에서 OPEN-09 GPU 진단 재현 |

종료 18회 모두 창이 닫히고 프로세스 종료 코드 0과 개발 포트 해제를 확인했다. GPU 오류를 숨기거나 그래픽·sandbox 설정을 낮추지 않았다.

### Unit 2.1 — 6. 예상되는 Edge Case

- 빈 TextContent는 빈 페이지·이미지·윤곽선 글자·인코딩 문제일 수 있으므로 스캔 PDF라고 단정하지 않는다.
- 한글이 여러 item으로 분리돼도 sourceIndex와 sourceText를 유지하며 항목 사이에 공백을 추정하지 않는다.
- replacement character나 제어 문자가 많지만 판독 가능한 텍스트도 충분하면 상충 신호로 `unknown` 처리한다.
- 잘못된 transform·font style·page metadata는 부분 기본값으로 복구하지 않고 `INVALID_TEXT_SOURCE`로 보류한다.
- getTextContent가 파일 교체·dispose 뒤 완료되거나 빠른 페이지 요청 순서가 뒤집혀도 이전 revision/request 결과를 표시하지 않는다.
- 텍스트 추출 실패는 Canvas 원문 Viewer와 파일 선택 성공 상태를 실패로 바꾸지 않는다.

### Unit 2.1 — 7. 알려진 제한사항

12자·0.8 기준은 합성 샘플과 기존 한글+이미지 fixture의 초기 보류선이다. 실제 사용자 PDF 전체, OCR 텍스트, 복잡한 수식·희귀 문자·읽기 순서의 정확도를 보장하지 않는다. text-usable은 좌표·문제·해설·정답·CBT 지원을 뜻하지 않는다. Unit 1.0 전체 샘플 행렬은 미착수이고 OPEN-09도 미해결이다.

### Unit 2.1 — 8. Technical Debt

- OPEN-05의 텍스트 품질 부분은 초기 상수만 정했으며 실제 샘플 행렬에서 재검토해야 한다.
- PDF user space bbox와 회전·DPI 검증은 Unit 2.2, 시각 대조는 Unit 2.5에 남아 있다.
- 줄/블록·키워드·영역·지원 판정은 Unit 2.3~2.6에 남아 있다.
- OPEN-09는 이번 종료 반복에서도 한 번 재현됐다.

### Unit 2.1 — 9. 다음 Unit 진행 전 수정이 필요한 사항

Unit 2.1 기능의 확인된 선행 수정 사항은 없다. 다음 순서는 Unit 2.2지만 사용자의 명시적 요청 전에는 착수하지 않는다. Unit 2.2에서는 보존한 raw transform·style·page metadata를 사용한 bbox만 구현하고 Debug Overlay·키워드·영역을 앞당기면 안 된다. 프로젝트 전체 무오류 완료에는 OPEN-09 해결과 Unit 1.0 샘플 행렬이 계속 필요하다.

### Unit 2.1 — 10. Git Commit Message

제안 메시지: `feat(analysis): assess current page text quality`

실제 Git 커밋은 만들지 않았다. Unit 2.0 문서 변경도 현재 작업 트리에 함께 남아 있으므로 커밋 전 전체 diff를 함께 검토한다.

## Unit 2.0 구조 검토 기록 — 2026-09-01

**Phase 2의 PDF 어댑터·분석 데이터 경계, 페이지/문제 구분, 실패 상태와 Unit 2.1~2.6 검증 계획을 확정했다. 앱 기능과 패키지 버전 0.1.6은 변경하지 않았다.**

작업 전에 현재 프로젝트 파일·PROJECT_BIBLE·ROADMAP·DECISIONS와 Git 상태를 확인했다. 기존 PDF 어댑터가 PDF.js document/page/render 수명을 소유하고 분석 폴더·추출 API가 아직 없음을 확인했다. 사용자의 Unit 2.0 요청에 따라 문서 구조 검토만 수행했으며 Text Content 추출·품질 임계값·좌표·UI·키워드·영역·CBT 코드는 추가하지 않았다. Unit 1.0과 OPEN-09 상태도 유지했다.

### Unit 2.0 — 1. 구현한 내용

- PDF 어댑터가 PDF.js 객체와 추출 수명을 소유하고 분석 모듈에는 `PageTextSource v1` 순수 데이터만 전달하도록 경계를 정했다.
- `contractVersion`, 세션 `documentRevision`, page metadata, sourceIndex·sourceText·raw transform·font style을 근거로 보존하고 경로·파일 바이트·PDF.js 객체를 제외하도록 정했다.
- Unit 2.1의 `PageTextAssessment v1`과 `text-usable / text-insufficient / unknown`, 최소 reason code, 진단용 plainText 규칙을 정했다. 숫자 임계값은 샘플 측정 전 확정하지 않았다.
- 새 문서·dispose·빠른 요청에서 늦은 추출 결과를 revision/request id로 폐기하고, 텍스트 실패가 Canvas 원문 열람을 막지 않도록 정했다.
- PageTextSource/Assessment에 questionId·정답·해설·영역·지원 여부를 넣지 않고 페이지 번호를 문제 ID로 쓰지 않도록 확정했다.
- Unit 2.1 추출/품질, 2.2 좌표, 2.5 Debug Overlay, 2.3 키워드, 2.4 영역, 2.6 지원 판정의 검증 관문과 순서를 구체화했다.

### Unit 2.0 — 2. 수정/생성된 파일

| 구분 | 파일·변경 |
| --- | --- |
| 기준 | `docs/PROJECT_BIBLE.md` — Phase 2 분석 흐름, PageTextSource/Assessment, 품질·수명·검증 계약 |
| 일정 | `docs/ROADMAP.md` — Unit 2.0 완료와 Unit 2.1 착수 조건 |
| 결정 | `docs/DECISIONS.md` — ADR-024와 OPEN-05 진행 상태 |
| 기록 | `docs/CHANGELOG.md` — Unit 2.0의 10항목 완료 기록 |

소스 코드, 테스트 코드, package.json, package-lock.json, dist와 release는 변경하지 않았다. 문서 버전은 0.2.0이며 실행 앱은 계속 0.1.6이다.

### Unit 2.0 — 3. 실행 방법

문서 전용 Unit이므로 런타임 실행은 해당 없다. PROJECT_BIBLE 9.0, ROADMAP Phase 2, DECISIONS ADR-024를 함께 열어 같은 경계와 순서인지 검토한다.

### Unit 2.0 — 4. 사용자가 직접 테스트할 방법

1. PROJECT_BIBLE 9.0에서 `PDF adapter → PageTextSource v1 → Analysis → UI` 흐름과 두 레코드의 필드를 확인한다.
2. ROADMAP에서 Unit 2.0이 완료이고 Unit 2.1만 다음 착수 대상인지 확인한다.
3. DECISIONS ADR-024에서 실제 `getTextContent()` 옵션, documentRevision, 세 품질 상태, reason code와 제외 범위를 확인한다.
4. 세 문서 모두 좌표를 Unit 2.2, Debug Overlay를 2.5, 키워드를 2.3, 영역을 2.4, 지원 판정을 2.6으로 남겼는지 비교한다.
5. `git diff --name-only`에서 문서 네 개만 변경되고 앱 코드·package.json이 변경되지 않았는지 확인한다.

### Unit 2.0 — 5. 정상 동작 기준과 실제 검증 결과

| 검사 | 결과 | 확인 범위 |
| --- | --- | --- |
| 현재 파일·Git 상태 확인 | 통과 | Unit 1.6 커밋 기준의 깨끗한 작업 트리와 기존 어댑터/검사 구조 |
| 로컬 PDF.js 6.3.289 API 확인 | 통과 | 설치된 타입·빌드에서 getTextContent, TextContent, TextItem, TextStyle 계약 확인 |
| 문서 교차 검토 | 통과 | 경계·상태·실행 순서·제외 범위가 PROJECT_BIBLE/ROADMAP/DECISIONS에 일치 |
| `npm run format:check` | 통과 | 전체 문서 형식 |
| 런타임·Electron 검사 | 해당 없음 | 코드와 패키지를 변경하지 않은 구조 검토 Unit |

### Unit 2.0 — 6. 예상되는 Edge Case

- PDF.js 추출 성공과 유용한 텍스트는 다르며 빈 결과를 추출 오류나 스캔 확정으로 바꾸지 않는다.
- 한글이 여러 item으로 분리되거나 item 순서가 시각적 순서와 다를 수 있으므로 plainText를 문단·읽기 순서 증명으로 쓰지 않는다.
- `getTextContent()`의 늦은 Promise가 파일 교체 후 끝날 수 있으므로 물리적 중단 여부와 관계없이 revision/request id가 다른 결과를 폐기한다.
- 텍스트와 이미지가 함께 있거나 페이지 번호만 추출되는 페이지는 문자 존재만으로 `text-usable`을 선언하지 않는다.
- 언어·font style·transform 값이 없거나 비정상일 때 임의 기본값으로 정상화하지 않고 reason code와 `unknown` 후보로 남긴다.

### Unit 2.0 — 7. 알려진 제한사항

실제 Text Content와 품질 분류를 실행하지 않았으며 품질 숫자·한글 품질·혼합 페이지 판정은 검증되지 않았다. PageTextSource 필드는 Unit 2.1/2.2 실험에서 PDF.js 6.3.289의 실제 값과 맞지 않으면 버전 있는 결정으로 조정해야 한다. 실제 사용자 PDF와 Unit 1.0 전체 샘플 행렬은 없다.

### Unit 2.0 — 8. Technical Debt

- OPEN-05의 품질·bbox·줄/블록·인식 임계값은 의도적으로 미확정이다.
- `getTextContent()`의 논리 취소와 문서 destroy가 실제 개발·빌드·패키지에서 같은 결과를 내는지 Unit 2.1에서 검증해야 한다.
- 원문 텍스트가 자동 검사 결과·Console에 남지 않는지 구현 후 점검해야 한다.
- OPEN-09와 Unit 1.0 미착수는 이번 문서 Unit에서 해결하지 않았다.

### Unit 2.0 — 9. 다음 Unit 진행 전 수정이 필요한 사항

확인된 문서 충돌은 없다. Unit 2.1은 ADR-024의 범위에 맞춰 현재 페이지 Text Content 추출, 순수 데이터 복사, 세 품질 상태와 고정 샘플 검증까지만 구현할 수 있다. 좌표 bbox·Debug Overlay·키워드·영역·CBT를 함께 추가하면 안 된다.

### Unit 2.0 — 10. Git Commit Message

제안 메시지: `docs(analysis): define phase 2 boundaries for unit 2.0`

실제 Git 커밋은 만들지 않았다. 메시지는 사용자가 문서 변경을 검토한 뒤 사용할 제안이다.

## 0.1.6 작업 기록 — 2026-09-01

**Unit 1.6 Viewer 사이드 제어·높이 맞춤과 PDF 기초 통합 검증을 구현하고 기능·통합 검사를 통과했다. 최종 종료 반복에서 기존 OPEN-09가 1회 재현되어 전체 무오류 완료 판정은 보류한다.**

작업 전에 현재 프로젝트 파일·PROJECT_BIBLE·ROADMAP·DECISIONS와 Git 상태를 확인했다. 사용자가 앞서 검토한 페이지/배율 도구의 오른쪽 사이드 이동과 `너비 맞춤`의 `높이 맞춤` 교체를 신규 Unit 1.6으로 추가하도록 명시했다. 기존 Unit 1.6의 오프라인 패키지·자산·정리·원본 해시·기본 성능 확인을 함께 수행했다. Unit 1.0 미착수와 OPEN-09를 완료로 바꾸지 않았고, Text Layer·사용자 회전·분석·CBT·저장은 추가하지 않았다.

### Unit 1.6 — 1. 구현한 내용

- 기본 창에서 앱 상태 아래의 오른쪽 사이드 카드로 페이지 번호·처음·이전·다음·마지막·축소·배율·확대·높이 맞춤을 이동했다. PDF 좌우의 이전·다음 보조 버튼과 모든 경계 상태는 그대로 공유한다.
- 56rem 이하에서는 제어 카드를 PDF 아래이면서 앱 상태보다 앞에 두고, 40rem 이하에서는 좌우 보조 버튼을 숨긴다. 1120×760과 640×480에서 제어 카드와 문서 전체에 가로 넘침이 없도록 확인했다.
- `너비 맞춤`을 `높이 맞춤`으로 교체했다. scale 1 페이지 높이와 PDF 스크롤 영역의 실제 세로 가용 공간으로 배율을 계산하고 50–200% 안으로 제한한다. 창 크기 변화는 기존 `ResizeObserver`·최신 요청·cancel 경로로 다시 렌더한다.
- Windows x64/ASAR 버전 0.1.6 패키지에서 연결 불가 프록시 아래 오프라인 PDF 표시, 번들 PDF.js worker·CMap·ICC·표준 글꼴·WASM, 허용 외/누락 자산 거부, 문서 교체·새로고침 정리, 원본 해시와 권한 거부를 다시 검증했다.
- 작은 합성 PDF의 첫 페이지·높이 맞춤·마지막 페이지에 각각 10초의 보수적 회귀 안전 기준을 추가했다. 모든 실물 PDF의 성능 보장이나 캐시 기능은 추가하지 않았다.

### Unit 1.6 — 2. 수정/생성된 파일

| 구분 | 파일·변경 |
| --- | --- |
| Viewer UI | `index.html`, `src/styles/shell.css` — 오른쪽 제어 카드, 좁은 창 순서, 높이 맞춤 표시 |
| 렌더 계약 | `src/ui/pdf-viewer.js`, `src/pdf/pdf-adapter-core.js` — 세로 가용 공간 계산, fit height, 기존 취소·배율 경계 재사용 |
| 검사 | `tests/pdf-adapter.test.js`, `tests/helpers/pdf-selection-checks.js` — fit height, 기본/최소 창 배치, 기본 시간 안전 기준 |
| 버전 | `package.json`, `package-lock.json` — 0.1.6 |
| 문서 | `README.md`, `docs/PROJECT_BIBLE.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/CHANGELOG.md`, `docs/IDEA_PARKING.md` |

생성된 `dist/`, `release/`, `work/`는 Git 대상이 아니다. 기존 0.1.5 패키지는 자동 삭제하지 않고 `work/unit-1.6-before-package/release/`에 보존한 뒤 최종 0.1.6 패키지를 생성했다.

### Unit 1.6 — 3. 실행 방법

프로젝트 루트에서 `npm run dev`로 개발 앱을 실행한다. `npm run build` 후 `npm start`는 빌드 자산 모드이며, `release/local-pdf-cbt-win32-x64/local-pdf-cbt.exe`는 버전 0.1.6 패키지다. 실행 중인 이전 앱은 완전히 닫고 다시 시작한다.

### Unit 1.6 — 4. 사용자가 직접 테스트할 방법

1. 앱을 열어 footer의 `Unit 1.6 · Viewer 사이드 제어·높이 맞춤`과 앱 상태의 `연결 완료`를 확인한다.
2. 여러 페이지인 세로형 로컬 PDF를 연다. 기본 창에서 앱 상태 아래 오른쪽 카드에 페이지/배율 도구가 나타나고 PDF 좌우에는 이전·다음 버튼이 있어야 한다.
3. 오른쪽 카드와 좌우 버튼으로 처음·중간·마지막 페이지를 이동한다. 첫 페이지에서는 처음·이전·왼쪽 버튼, 마지막 페이지에서는 다음·마지막·오른쪽 버튼이 함께 비활성화되어야 한다.
4. `−`와 `+`로 50%와 200%까지 이동한 뒤 `높이 맞춤`을 누른다. 버튼이 선택 상태가 되고 PDF 높이가 표시 영역에 맞아야 한다. 창 높이를 바꾸면 현재 페이지가 새 높이에 다시 맞아야 한다.
5. 창을 640×480까지 줄인다. 제어 카드는 PDF 아래·앱 상태 위로 이동하고 PDF 좌우 버튼은 숨겨져야 한다. 제어 버튼과 화면 전체에 가로 잘림이 없어야 한다.
6. 완료 문구가 PDF 위에 반복되지 않고 footer에 `PDF를 열었습니다. 원본 파일은 변경하지 않았습니다.`가 표시되는지 확인한다. 테스트 전후 원본 파일 크기·수정 시간이 바뀌지 않아야 한다.
7. 인터넷을 끄거나 차단된 환경에서 패키지를 다시 열어 같은 PDF가 표시되는지 확인한다. 암호·손상·비PDF·다중 드롭·폴더·URL·취소의 기존 안내도 유지되어야 한다.

### Unit 1.6 — 5. 정상 동작 기준과 실제 검증 결과

| 검사 | 결과 | 확인 범위 |
| --- | --- | --- |
| `npm run format:check` | 통과 | 전체 형식 |
| `npm test` | 통과, 49/49 | 높이 맞춤·배율 경계·고유 회전·Canvas 상한·최신 렌더와 기존 회귀 |
| `npm run build` | 통과 | Vite 배포 자산 |
| 개발 Electron | 통과, 1/1 | 오른쪽/좁은 창 배치·높이 맞춤·페이지·오류·보안 |
| 빌드 Electron | 통과, 1/1 | 같은 기능과 로컬 PDF.js 자산 |
| `npm run package` | 통과 | Electron 44.0.0 Windows x64/ASAR 버전 0.1.6 생성 |
| 패키지 Electron | 통과, 1/1 | 오프라인 조건·자산 접근/거부·정리·원본 해시·권한 거부 |
| 기본 시간 안전 기준 | 통과 | 개발/빌드/패키지 순 첫 페이지 372/228/144ms, 높이 맞춤 27/28/24ms, 마지막 페이지 49/45/49ms; 각 10초 미만 |
| `npm run test:native` | 통과, 1/1 | 실제 Windows 선택 창의 한글 PDF 선택·렌더·취소 보존 |
| `npm run test:shutdown` | **실패, 17/18** | 개발 모드 즉시 종료 1회에서 기존 GPU 진단 재현. 패키지 9/9, 개발 250ms·1500ms 6/6, 모든 종료 코드·포트 정리는 정상 |

기능·통합 성공과 프로젝트 전체 무오류 완료를 구분한다. OPEN-09를 숨기거나 하드웨어 가속·sandbox·로그를 끄지 않았다.

### Unit 1.6 — 6. 예상되는 Edge Case

- 높이 맞춤 계산값이 50%보다 작거나 200%보다 크면 지원 경계로 제한된다. 최소 창이나 매우 긴 페이지에는 세로 스크롤이 남을 수 있다.
- 페이지마다 높이·고유 회전이 다르면 이동할 때 현재 페이지 viewport로 높이 맞춤 배율을 다시 계산한다.
- 창 크기와 페이지/배율 요청이 겹치면 이전 render task는 취소되고 최신 요청만 상태를 갱신한다.
- 좁은 창에서는 DOM 순서와 시각 순서가 달라지지만 키보드 포커스 순서는 문서의 페이지 도구보다 앱 상태가 먼저다. 실제 스크린 리더 사용성은 별도 검증이 필요하다.

### Unit 1.6 — 7. 알려진 제한사항

10초 기준은 현재 PC와 작은 합성 PDF의 회귀 안전 기준이다. 50 MiB 입력이나 복잡한 실물 PDF의 파서·렌더 시간, 모든 `userUnit`·글꼴·이미지 조합, 여러 Windows 디스플레이 배율을 보장하지 않는다. 키보드 배율 단축키·핀치·사용자 회전·썸네일·Text Layer·링크/양식 실행은 없다.

### Unit 1.6 — 8. Technical Debt

- OPEN-04: 입력/Canvas/기본 시간 상한은 정했지만 실물 샘플별 파서·렌더 시간과 캐시 예산은 남아 있다.
- OPEN-09: 최종 종료 반복 17/18이며 개발 모드 즉시 종료 1회에서 기존 GPU 오류가 재현됐다. 원인은 확정하지 못했다.
- Unit 1.0 전체 샘플 행렬, 실제 다중 모니터·여러 디스플레이 배율·스크린 리더 검증은 남아 있다.

### Unit 1.6 — 9. 다음 Unit 진행 전 수정이 필요한 사항

Unit 1.6 기능 자체의 확인된 선행 수정 사항은 없다. 프로젝트 전체 무오류 완료에는 OPEN-09 해결과 반복 재검증이 필요하며 Unit 1.0 전체 샘플 행렬도 미착수다. Phase 2에 들어가려면 ROADMAP의 Unit 2.0 분석 경계·좌표·지원 범위 구조 검토를 먼저 별도 요청해야 한다.

### Unit 1.6 — 10. Git Commit Message

제안 메시지: `feat(viewer): add side controls and height fit for unit 1.6`

실제 Git 커밋은 만들지 않았다. 메시지는 사용자가 현재 변경을 검토한 뒤 사용할 제안이다.

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
