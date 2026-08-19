# Project Scope & Human-Owned Policy (v8.1.1-solo)

- Status: `READY_FOR_APPROVAL` — §7의 미확정 항목을 사용자가 확인하면 `APPROVED`로 변경
- Owner / Human Approver: Minkyu (연락처는 비공개 — 공개 레포 노출 방지를 위해
  이메일 미기재; 리뷰 P3 follow-up 반영)
- Last Updated: 2026-07-11
- 이전 버전(v5 Lean 시기 원본):
  `docs/archive/workflow/pre-v8.1.1-20260711T124715Z/docs/PROJECT_SCOPE.md`

## 1. Current Scope

- Goal: Siftline — 7개 주요 LLM(Gemini, Claude, ChatGPT, DeepSeek, Perplexity,
  Grok, Kimi)을 **웹 세션 기반(API 키 불필요)** 으로 한 화면에 띄워 교차검증
  워크플로와 자유 토론을 제공하는 Electron 데스크톱 앱. 현재 v1.0.9 출시 상태이며,
  신규 작업은 기존 동작을 보존하는 전제 하에서만 진행한다.
- Included: 아래 Must-preserve flows 전체(v1.0.9 기능 셋)의 유지·보수·점진적 개선
- Explicitly Out of Scope (명시 요청 없이는 구현하지 않음):
  - 자동(무인) 워크플로 진행
  - 8번째 이후 AI provider 추가
  - 클라우드 동기화 / 다중 기기 세션 공유
  - 답변 자동 채점·랭킹
  - 모바일 네이티브 앱
  - API 전용 모드 전환 (웹 세션 기반이 핵심 가치)
- Future candidates (미승인 — 명시 요청 시에만 착수; 구 SCOPE "Future Expansion" 승계):
  - 자동 워크플로 모드 (옵션 토글로)
  - provider 추가를 위한 selector/패널 일반화
- Must-preserve flows — 절대 깨지면 안 되는 동작:
  - 7개 AI BrowserView 패널 임베드 및 세션 영속화
  - TitleBar(🔑 Accounts / 📋 History / 📊 Logs), Toolbar(모드 토글·Primary 선택·쿼리
    입력), StatusBar(진행 표시 + Telegram 인디케이터), PanelGrid, FinalResultPanel
  - AccountsPanel: Accounts 탭(로그인/로그아웃) + API Keys 탭(키 저장·우선순위 정렬)
  - Workflow 모드 수동 3단계: ▶ Start → ▶▶ Next → ✓ Continue, Pause 지점 Primary 재지정,
    AI별 Reviewer 역할 주입
  - Council Chat 모드: `@AI` / `@all` 라우팅, 버블 UI, 미리보기/펼치기,
    Hybrid Focus Layout(좌측 Focus pane + 중앙 Compare grid + 우측 Council Chat)
  - Saved Sessions 전체 라이프사이클 (저장·자동저장·즐겨찾기·라벨·노트·아카이브·
    export/import·복제·bulk delete)
  - AI Moderator (합의/다음발언자/후속프롬프트)
  - Candidate Pinning & Compare, Merged Draft
  - Workflow ↔ Council Chat 핸드오프
  - 파일 첨부 + CDP 업로드 (Workflow / Council Chat / Telegram 3개 진입점)
  - AI Recommendation Engine (API + 키워드 fallback)
  - 응답 언어 자동 감지
  - Telegram 연동 전체 (메시지·@mention·파일·슬래시커맨드·암호화 토큰 저장,
    설정된 Chat ID 외 silently reject)
  - Windows portable/installer, macOS dmg 빌드 파이프라인

## 2. Roles and Data Visibility

| Product role | Allowed data/actions | Prohibited data/actions |
|---|---|---|
| Desktop user (단일 개인 사용자) | 로컬 앱 전체 기능, 본인 AI 계정 세션, 본인 API 키·Telegram 토큰 관리 | — |
| Telegram remote user (동일인) | 설정된 Chat ID로만 메시지·파일·슬래시커맨드 | 미설정 Chat ID의 접근 (silently reject) |

멀티유저·서버 백엔드·고객 데이터 없음. 개인용 로컬 데스크톱 앱이다.

## 3. Data and Provider Policy

- Repository classification: Public 추정 — GitHub(`Oplo-Works/Siftline`)에
  릴리스 설치 파일을 공개 배포 중. **사용자 최종 확인 필요 (§7)**
- Approved providers/runners (intended families): Anthropic/Claude Code,
  OpenAI/Codex, z.ai 공식/승인 runner. 실제 Runtime 승인은
  `docs/MODEL_RUNTIME_PIN.md`의 `APPROVED` 항목만 유효하다.
- Prohibited to every model: secrets, tokens, real customer PII, production payload,
  payment data
- Runtime-specific restrictions: Fable 계열은 Covered Model retention 제약
  (PIN 참조). PIN의 Data/Retention 열을 따른다.
- Production data in development: Never — 별도 production 서버/DB 없음
  (개인 로컬 앱). 사용자 실데이터(세션·키·토큰)는 로컬 electron-store /
  Electron `persist:` 파티션에만 존재하며 레포에 넣지 않는다.
- Training/retention requirements: 미확정 — **사용자 확인 필요 (§7)**
- 앱 데이터 보안 규칙 (기존 정책 보존):
  - API 키·Telegram 토큰은 `electron-store`에 저장하며 코드/로그/git에 노출 금지
  - Telegram은 설정된 Chat ID 외 메시지는 silently reject
  - demo/기본값에 실제 사용자 데이터·민감정보를 넣지 않음
  - 세션 쿠키는 Electron `persist:` 파티션에만 저장

## 4. Validation Commands — 유일한 원본

| Purpose | Command | CWD | Required |
|---|---|---|---|
| Typecheck | `npx tsc --noEmit` | repo root | Yes |
| Build | `npm run build` | repo root | Yes |
| Run check (수동) | `build-and-run.bat` → 수동 체크리스트 | repo root | Yes (동작 변경 시) |
| Production run check | `npx electron .` | repo root | 권장 |
| Dev mode (hot reload) | `npm start` | repo root | No (개발 편의) |
| Unit / Integration Test | 없음 (test 스크립트 부재) | — | No |
| Lint | 없음 (lint 스크립트 부재) | — | No |
| Secret Scan | staged diff 수동 점검 (키·토큰·PII) + `git diff --check` | repo root | Yes |
| Security Scan | 없음 (수동 검토) | — | No |

- sandbox/CI 환경에서는 rollup native 모듈 문제로 `npm run build`가 실패할 수 있다.
  이 경우 `npx tsc --noEmit` 통과를 기록하고 Windows에서 최종 확인한다.
- 수동 동작 체크리스트 상세: `docs/VERIFICATION.md` (레거시 참조 문서 — 문서 내
  레포 경로 `C:\Users\Sales01\...`는 구버전이므로 무시하고 현재 repo root 기준으로 실행)
- 릴리스 패키징: `npm run package` / `package:installer` / `package:mac`

<!-- HUMAN-OWNED POLICY — agent는 이 섹션을 생성·완화·확장할 수 없다. -->
## 5. Repository and External-Action Policy (HUMAN-OWNED)

> 2026-07-11 workflow-adoption-v8.1.1 프롬프트(사용자 제공)로 명시 승인된 값.

### Local Commit

- Commit Policy: `AUTO_LOCAL_AFTER_TEST`
- Scope: task-owned changes only, required checks PASS(또는 정직한 기록),
  기존 사용자 변경 보존
- Review-Hold exception: 사용자가 "review 후 commit/push"라고 지정하면 `HOLD_FOR_REVIEW`

### Push

- Push Policy: `AUTO_AT_CLOSE`
- Allowed Push Targets: `origin/<current non-protected task branch>`
- Default Target: current upstream on `origin` only when it matches the current
  non-protected task branch
- Protected Branches: `main`, `master`, `production`, `release`, `release/*`
- Direct auto-push to protected branch: `NEVER`
- Push that triggers deploy/release/external notification/paid workflow:
  `ASK_SEPARATELY` — 특히 `v*` 태그 push는 GitHub Actions 릴리스 빌드를 유발하므로
  별도 승인 없이 태그를 push하지 않는다 (`.github/workflows/build.yml`)
- Push failure when required: `BLOCKED / PUBLISH_FAILED`

### Git Operations

- Branch/Worktree creation: `ALLOWED` for task isolation
- Merge/Rebase: `ASK_ALWAYS`
- Force-push/History rewrite/Reset/Stash/Restore/Clean of user changes:
  `PROHIBITED_WITHOUT_EXACT_APPROVAL`

### Production / External / Paid Actions

- Deploy/Release/Production access: `ASK_ALWAYS`
- Production DB/data mutation: `ASK_ALWAYS` + rollback plan (현재 해당 시스템 없음)
- External email/message/ticket/PR creation or update: `ASK_ALWAYS`
- New dependency/major upgrade: `ASK_ALWAYS` unless approved PLAN says otherwise
- PIN Runtime with Billing Meter `usage credits`: `ASK_EACH_TIME` (cap 미설정)
- OpenAI extra credits/auto-reload: `ASK_EACH_TIME` (cap 미설정)
- z.ai plan upgrade: `ASK_ALWAYS`

### Paths and Runtimes

- Forbidden paths: `.env`, `.env.*`(로컬 실값), `*.pem`, `*.key`, `secrets/`,
  `sessions/`(런타임 세션 덤프), `outputs/`(런타임 출력), production exports
- Approved Runtime IDs: (없음 — `MODEL_RUNTIME_PIN.md`의 전 항목이 `CANDIDATE`.
  사용자가 PIN을 승인하면 해당 ID를 여기에 복사)
- Parallel writers: `SEPARATE_WORKTREE_ONLY`
- Safe default when blank or ambiguous: `ASK`
<!-- END HUMAN-OWNED POLICY -->

## 6. Standing Authority Interpretation

- 사용자가 직접 승인한 HUMAN-OWNED 섹션은 지속되는 standing authority다.
- ordinary task request는 이 범위를 넓히지 않는다.
- 현재 채팅의 명시적 예외 승인은 domain, action, target, constraints, expiry를 기록한다.
- agent가 정책 파일을 편집해 얻은 권한은 무효다.

## 7. APPROVED 전환에 필요한 미확정 항목

1. Repository classification 확정 (Public 추정 — 맞는지 확인)
2. Training/retention 요구사항 확정
3. `docs/MODEL_RUNTIME_PIN.md`의 관찰값 확인 후 최소 1개 Runtime을 `APPROVED`로
   전환하고, 그 ID를 §5 Approved Runtime IDs에 복사
4. 유료 credit 정책 확정 (`ASK_EACH_TIME` 기본값 유지 여부 / monthly cap 설정)
5. (선택) 레거시 "항상 main에서 커밋" 습관을 유지하려면 §5 Push 정책을 직접 수정
   — 현재 정책은 task branch + WF:CLOSE 단일 push이며 main 직접 auto-push는 NEVER
