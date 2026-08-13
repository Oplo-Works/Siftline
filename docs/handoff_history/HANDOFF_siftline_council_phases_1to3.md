# Siftline Council Chat — Phase 1~3 인수인계

> **작성:** Claude Opus 5 (Cowork, 감독·검증 역할), 2026-08-03
> **대상:** 다른 PC의 나 자신, 또는 다른 코딩 에이전트
> **레포:** `https://github.com/MinkyuTheBuilder/AI-Council-Chat` (Siftline, Electron 데스크톱 앱)
> **사용자:** Minkyu — 한국어 대화, 간결한 답변 선호

---

## 0. 30초 요약

7개 LLM 웹 세션을 한 화면에 띄우는 Electron 앱 `Siftline`의 Council Chat 기능에서
결함 감사를 수행하고 **Phase 1~3을 전부 구현·검증·종료했다.**

사용자가 처음 요구한 3가지는 **전부 충족됐다.**

| | 요구 | 결과 |
|---|---|---|
| ① | 각 AI의 역할이 무엇인지 파악 | 역할표 3벌 → 1벌 통합. 화면 표기 = 실제 주입 역할 |
| ② | 글을 올리면 AI들이 각자 답변 | 병렬 브로드캐스트 정상 (클립보드 경쟁 조건 제거) |
| ③ | 이후 라운드에서 서로의 대화를 파악하고 이어감 | 라운드 컨텍스트 유실 수정 + 최신 맥락 우선 보존 |

**Phase 4는 사용자가 "진행하지 않음"으로 결정했다.** 앱을 막는 결함이 없기 때문이다.

---

## 1. 작업 방식 — 이걸 먼저 이해할 것

이 프로젝트는 **역할이 분리된 2-에이전트 체제**로 진행됐다. 다음 에이전트도 이 구조를
유지하거나, 최소한 왜 이렇게 했는지는 알고 있어야 한다.

| 역할 | 담당 | 하는 일 |
|---|---|---|
| 구현자 | GPT 5.6 Sol (Codex) | SPEC/PLAN 작성 → 승인 대기 → BUILD → TEST → 검토 패킷 |
| 감독·검증자 | Claude Opus 5 (Cowork) | 제품 코드를 직접 수정하지 않음. 산출물을 코드와 대조 검증하고 승인/반려 |
| 승인자 | 사용자 | 두 에이전트 사이의 메시지 전달 및 최종 결정 |

워크플로는 `docs/AGENT_WORKFLOW_CORE.md`, `docs/PROJECT_SCOPE.md`, `CLAUDE.md`를 따른다.
`WF:SPEC_PLAN → 승인 → WF:BUILD → WF:TEST → WF:REVIEW → WF:CLOSE` 단계로 움직인다.

### 이 체제에서 실제로 효과가 있었던 규칙

**구현자의 자기 보고를 믿지 말고 검증 명령을 직접 재실행한다.**
이 규칙이 실제로 다음을 잡아냈다.

- Phase 1 revision 2에서 `git diff --check: PASS` 보고가 사실이 아니었음 (실제 14,848건 검출)
- Phase 1 초기 구현의 **Gemini 프롬프트 줄바꿈 전면 삭제** — SPEC에 없는 미승인 변경이었고,
  검증 로직이 공백을 전부 제거하고 비교했기 때문에 원리적으로 검출 불가능했다
- Phase 3에서 구조 검증을 6개 provider에 곧바로 강제하려던 설계 — 측정 없이 차단하면
  Phase 1이 고쳐놓은 주 경로가 깨질 수 있었다

**반대로, 감독자의 지시가 틀렸을 때 구현자가 실측으로 바로잡은 사례도 있다.**

- Phase 2에서 내가 "`isLoginComplete`의 kimi 술어를 넓게 완화하라"고 지시했는데 틀렸다.
  GPT가 추측으로 바꾸지 않고 AC-4를 먼저 실제로 돌려서 **Kimi가 이미 쿠키 인증을 쓰지
  않는다**는 진짜 원인을 찾아냈다. 실패를 `Do Not Reclassify as PASS`로 명시하고 재승인을
  받으러 돌아온 절차가 내 오지시를 막았다.
- 내가 "TS18048 20건의 원인은 AiName 불일치"라고 한 것도 틀렸다. 실제로는 Electron
  `Cookie.domain?: string`이 원인인 독립 항목이었고, GPT가 측정으로 정정했다.

→ **승인자의 지시라도 실측과 충돌하면 실측을 따르고 되돌아온다.** 이게 이 프로젝트에서
가장 값이 나갔던 규칙이다.

---

## 2. 저장소 현재 상태

```
원격:      https://github.com/MinkyuTheBuilder/AI-Council-Chat.git
현재 브랜치: codex/council-chat-phase3-defect-fixes
HEAD:      6e6aa02  docs(council): close phase 3 defect fixes
```

### 브랜치 구조 — 선형이다

```
main (b753232)  ← Phase 1 착수 이전 상태. 아직 갱신 안 됨
  └─ codex/council-chat-phase1-defect-fixes  (eb6eac2)  Phase 1 CLOSE
       └─ codex/electron-typecheck-defect-fixes (394cee2)  Phase 2 CLOSE
            └─ codex/council-chat-phase3-defect-fixes (6e6aa02)  Phase 3 CLOSE  ← HEAD
```

세 브랜치가 한 줄로 이어져 있으므로 **phase3 브랜치 하나만 푸시해도 전부 보존된다.**

### 아직 푸시된 적이 없다

이 프로젝트는 전 기간 `push / PR / tag / release 금지` 원칙으로 진행됐다.
**모든 작업이 로컬 커밋 상태다.** 다른 PC로 옮기려면 푸시가 선행돼야 한다.

### 워킹트리

- **실제 내용 변경 0건.** `git diff --ignore-cr-at-eol` 이 빈 출력이다.
- 다만 `git status`에 추적 파일 약 75개가 `M`으로 뜬다. **전부 EOL(CRLF/LF) 차이뿐이다.**
  `.gitattributes`가 없고 시스템 git이 `core.autocrlf=true`라서 생긴 현상이다.
- untracked 4개:
  - `docs/handoff_history/COWORK_SESSION_HANDOFF_council_chat_review.md` (이전 세션 인수인계)
  - `docs/handoff_history/HANDOFF_PROMPT_council_chat_fixes.md` (최초 감사 결과 원본)
  - `_to_delete/index.lock.remove-me`, `_to_delete/tsconfig.probe.json.remove-me`
    → **이 폴더는 내가 만든 쓰레기다. 삭제해도 된다.**

---

## 3. 각 Phase에서 실제로 무엇이 고쳐졌나

### Phase 1 — `codex/council-chat-phase1-defect-fixes` (eb6eac2)

**P1 클립보드 경쟁 조건 (심각).**
`pasteText()`가 OS 전역 클립보드를 쓰는데 `runCouncilBroadcast()`가 최대 7턴을 병렬 실행했다.
AI-A가 AI-B의 페르소나 프롬프트를 받을 수 있었다. 검증 로직 `expected.slice(0, 32)`는
모든 프롬프트가 같은 문자열로 시작해 무용지물이었다.

→ 모듈 전역 FIFO mutex `withClipboardLock()` 도입. 프롬프트 텍스트 경로와 이미지 첨부
경로(`attachFilesViaClipboardPaste`) **양쪽**의 임계 구역 전체를 감싼다. `finally`에서 release.
기본 입력 경로를 `execCommand('insertText')`로 전환해 정상 경로에서는 클립보드를 아예
쓰지 않는다. 검증은 공백 제거 후 전체 문자 비교 + Council AI 신원 정확 일치로 교체.

**Gemini는 예외다.** contenteditable이 multi-line `insertText`의 첫 줄만 받는다.
실측: `expectedChars=10034 / observedChars=44` (= 프롬프트 첫 줄 길이와 정확히 일치).
→ Gemini만 직렬화된 `clipboard-primary` 경로를 정규 경로로 사용해 구조를 보존한다.
(Phase 3에서 구조 보존 직접 삽입으로 개선됨)

**P2-A 라운드 컨텍스트 유실.**
`extractPreviousRoundReplies()`가 "마지막 user ~ 직전 user" 인덱스만 봐서, 사이에 멘션 없는
메모가 하나라도 끼면 직전 라운드 답변이 통째로 사라졌다.
→ `findPreviousRoundBounds()` 신설. **유효 답변이 실제로 있는 마지막 구간**을 찾는다.
메모 구간은 건너뛰되 그 내용은 earlier-context 요약에 보존된다.

**P2-B 한국어 사회자 오작동.**
`councilModerator.ts`가 전부 영어 정규식이라 한국어 답변에서 모든 카운트가 0이었다.
→ 한국어 패턴을 `\b` 없이 별도로 OR 결합 (한국어에 `\b`는 동작 안 함). concise 판정은
한글 포함 시 문자 수 300 기준. kimi 분기를 `speakerOrder`와 `describeMissingAngle()` 양쪽에 추가.

### Phase 2 — `codex/electron-typecheck-defect-fixes` (394cee2)

**`electron/` 전체가 타입체크 사각지대였다.** `tsconfig.json`의 `include`가 `["src"]`뿐이었다.
→ `["src", "electron"]`로 확대. 켜자마자 33건이 나왔고 그중 실제 결함이 있었다.

**근본 원인:** `AiName` 유니온이 4곳에 중복 선언돼 있었고 `councilPrompt.ts`·`preload.ts`가
`kimi`를 빠뜨렸다. → 전부 `src/types.ts`의 정본을 import하도록 통일. `AI_NAMES`,
`DEFAULT_ENABLED_AIS`도 정본 사용. (제거 전 두 배열이 순서까지 동일함을 검증하고 fixture로 고정)

**실버그: Kimi 로그인 상태 누락.** `getLoginStatus()`가 6개만 채워 kimi가 런타임 `undefined`였다.
Accounts 화면에서 로그인돼 있어도 "Not logged in"으로 표시됐다.
→ `AI_NAMES`를 순회해 전 provider의 boolean을 채우는 구조로 변경.

**그리고 여기서 진짜 발견이 나왔다.** AC-4(로그아웃→재로그인) 실측 결과, **Kimi는 이미 쿠키
인증을 쓰지 않는다.** fresh login은 `access_token` / `refresh_token` / `msh_user_id`를
**localStorage**에 넣는다. 기존 세션에 있던 `kimi-auth` 쿠키는 옛날 방식의 유물이었다.
→ 쿠키 판정 실패 시에만 Kimi BrowserView의 localStorage를 읽는 폴백을 추가
(`getKimiRendererLoginStatus`). 값은 읽지 않고 존재 여부만 본다. URL은 `https:` + `kimi.com`
정확 suffix로 검사하고 2초 timeout race를 건다.

### Phase 3 — `codex/council-chat-phase3-defect-fixes` (6e6aa02)

**P3-B 역할 정의 통합.** 역할 문구가 3벌이었다 — `AI_ROLE_PRESETS`(UI 표시),
`AI_REVIEWER_BRIEFS`(실제 주입), `AI_REVIEWER_PERSONAS`(죽은 코드). Kimi 역할이 서로 달랐다.
→ `src/types.ts`의 `AiRolePreset { title, role, focus, outputGuide }` 단일 테이블로 통합.
**`title`(짧은 UI용)과 `role`(장문 프롬프트용)을 한 객체 안에서 분리**해 툴바 표시가 깨지지
않게 했다. 죽은 `AI_REVIEWER_PERSONAS`와 `buildReviewerPrompt()` 삭제.

**P3-C 정확한 재시도.** 기존 Retry는 `{ai, promptText, errorMessage}`만 저장하고 legacy delta
프롬프트를 새로 만들어서 **첨부 파일과 원본 브로드캐스트 프롬프트를 유실**했다.
→ 런타임 전용 `CouncilRetryEnvelope`에 정확한 프롬프트·파일 경로·첨부 메타데이터를 복제 보관.
**절대 영속화하지 않는다.** 앱 재시작 후 봉투가 없거나 첨부 파일이 사라졌으면 조용히
텍스트만 재전송하지 않고 재첨부를 요구한다.

**P3-D 최신 컨텍스트 우선 보존.** `summarizeCouncilMessages()`가 앞에서부터 채우고 `break`해서
**최근 대화를 먼저 버렸다.** → 뒤에서부터 예산에 맞게 선택한 뒤 시간순으로 뒤집어 출력.

**Kimi 로그인 경로 수정.** Accounts의 "Kimi Login" 버튼이 `kimi-login.mjs`를 띄웠는데,
그 전송 경로는 **쿠키만 복사한다** (`copyCookiesToMainSession`). Kimi 인증은 localStorage에
있으므로 구조적으로 전달 불가였다.
→ `Open panel`로 교체. Accounts를 닫고 Kimi를 활성화해 기존 `persist:kimi` 패널로 이동한다.
인증 데이터는 옮기지 않는다. **Council primary는 바뀌지 않는다.**

**Gemini 구조 보존 직접 삽입 + 구조 검증.**
줄 단위 `insertText` + 문단/줄바꿈 명령으로 구조를 유지한 채 직접 삽입한다. 성공하면
클립보드 lock을 아예 안 잡는다. 실패하면 기존 직렬 클립보드로 되돌아간다.
검증에 줄 구조 지표가 추가됐다.

```js
// 서명 = 비어 있지 않은 trim된 줄의 시퀀스
.split('\n').map(l => l.trim()).filter(l => l.length > 0)
```

이러면 평탄화(`A\n\nB` → `A B`)는 검출되고, 무해한 빈 줄 접힘(`A\n\nB` → `A\nB`)은 통과한다.

**⚠️ 구조 강제는 Gemini 한정이다.**
```js
const STRUCTURE_ENFORCED_AI_NAMES = new Set<AiName>(['gemini'])
```
나머지 6개는 `structureMode=observe`로 지표만 로그에 남긴다. 이건 의도적이다 — 그 6개의
구조 충실도가 아직 실측되지 않았고, 측정 없이 차단하면 Phase 1이 고친 경로가 깨질 수 있다.

> **확대 조건:** Gemini 외 provider로 구조 강제를 넓히려면, 대상 provider 전원의 실측
> expected/observed line count와 digest를 먼저 수집·기록해야 한다. 구두 확인만으로는 안 된다.

---

## 4. 검증 자산 — 다음 작업 전에 이걸 먼저 돌려라

```bash
npx tsc --noEmit                      # electron/ 포함, exit 0 이어야 함
npm run build                         # 산출물 6개, transforms 50/9/1/1

# 회귀 스크립트 3종 (esbuild로 번들 후 실행)
scripts/verify-council-phase1.ts      # 17 assertions
scripts/verify-electron-phase2.ts     # 60 assertions
scripts/verify-council-phase3.ts      # 80 assertions
```

**Linux/WSL에서 돌릴 때 주의:** `node_modules/.bin/esbuild`가 win32 바이너리라 실행되지 않는다.
대신 `node_modules/.bin/tsc`로 트랜스파일해서 돌리면 된다.

```bash
node_modules/.bin/tsc scripts/verify-council-phase3.ts \
  --module commonjs --target es2020 --outDir /tmp/js \
  --skipLibCheck --moduleResolution node --esModuleInterop
node /tmp/js/scripts/verify-council-phase3.js
```

### 빌드 산출물 기준 해시 (Phase 3 종료 시점)

```
dist/index.html                    988  A1D68199EE76F526
dist/assets/index-C03ZazMl.js   292052  69A0B89AEE8EB44A
dist/assets/index-tgr4Ry0z.css   71575  A5971E3096B59406
dist-electron/preload.js           4763  874B05A15CBE0024
dist-electron/preload-chrome-spoof.js 6190  1BAEE87F587D9838
dist-electron/main.js            173249  0ADA031E9B212ECD
```

`preload.js`와 `preload-chrome-spoof.js`는 Phase 1 착수 시점부터 **한 번도 바뀌지 않았다.**
이 둘이 바뀌면 preload에 런타임 import가 섞여 들어간 것이니 먼저 의심하라.

---

## 5. 남은 작업 — 전부 선택 사항

사용자가 **Phase 4를 진행하지 않기로 결정했다.** 앱 핵심 동작을 막는 결함이 없기 때문이다.
아래는 언젠가 필요해지면 볼 목록이다.

### 🟡 다른 PC로 옮기기 전에 검토할 것 — EOL

`.gitattributes`가 없고 시스템 git이 `core.autocrlf=true`다. 추적 파일 약 75개가 EOL만
다른 상태로 계속 `M`으로 뜬다. **git 설정이 다른 PC에서 클론하면 이 차이가 훨씬 크게
번질 수 있다.** 지금은 무해하지만, 여러 머신에서 작업할 계획이라면 `.gitattributes` 추가와
1회 정규화를 별도 번들로 처리하는 것이 좋다.

파일별 현재 상태:
```
electron/main.ts          i/crlf  w/crlf
electron/councilPrompt.ts i/lf    w/crlf   ← 인덱스와 워킹트리가 다름
src/councilModerator.ts   i/mixed w/mixed  ← 163줄 중 87줄만 CRLF
```

### 🟡 npm 취약점 25건

`critical 2, high 18, moderate 3, low 2`. 전 기간 스코프 밖으로 뒀다. 로컬 데스크톱 앱이라
웹 서비스보다 위험도는 낮지만 언젠가 한 번은 봐야 한다.

### ⚪ Phase 4 후보 (사용자가 불필요 판단)

| 항목 | 실제 영향 |
|---|---|
| 단일 멘션에 "다른 AI들도 병렬로 답하는 중" 거짓 문구 주입 | 프롬프트 설명만 부정확. 라우팅 무영향 |
| `pendingAi`가 단일값인데 최대 7개 동시 진행 | 상태 칩 표시만 부정확. placeholder는 정상 |
| UI의 `sequential` / `in order` 낡은 문구 | 실제는 병렬. 문구 수정만 |
| IPC / Telegram 핸들러 90줄 중복 | 유지보수 부채. 동작 결함 아님 |
| Kimi 상태의 BrowserView 의존 | 네트워크 장애 시 일시적 false 표시 가능 |
| `cookieDomainIncludes`의 부분 문자열 매칭 | 이론적 false positive. 인증 하드닝 번들로 분리 |

### ⚪ 멘션 없는 메시지 동작 — 현행 유지로 결정됨

멘션 없는 글은 **기록 전용 메모**다 (`kind: 'none'`). 전체 답변이 필요하면 입력창 위의
`@all` 버튼을 쓰면 된다 (`CouncilChatPanel.tsx:1424`). 타이핑할 필요 없다.

> Phase 1의 P2-A 수정이 바로 이 메모 기능을 위한 것이었다. 라운드 사이의 메모가 다음
> 라운드 컨텍스트를 망가뜨리지 않도록 고쳤다. 기본 `@all`로 바꾸면 메모 개념 자체가
> 사라지므로 이 작업이 의미를 잃는다. 현행 유지에는 그런 배경이 있다.

---

## 6. 함정 모음

- **Kimi 로그인은 패널 안에서 직접 하라.** Accounts의 버튼은 이제 `Open panel`로 패널로
  보내준다. 예전의 독립 로그인 창은 쿠키만 복사해서 localStorage 인증을 전달하지 못한다.
- **`main` 브랜치가 Phase 1 이전 상태다.** 새로 클론하면 아무 작업도 안 된 코드를 받는다.
- **`docs/CLAUDE.md`의 경로 기술이 낡았다.** 메인 레포를 `C:\Users\parkm\...`로 적어놨지만
  실제 작업 루트와 최신 커밋은 `C:\Users\Sales01\Documents\AI-Council-Chat`에 있다.
- **`pasteText()`는 이제 검증 실패 시 throw한다.** 예전엔 best-effort로 넘어갔다.
  Council 실경로(`processCouncilTurn`)는 try/catch 안이라 안전하다.
- **`collectReviewerFeedbacksForAnswer` / `requestFinalRevisionFromPrimary`는 죽은 코드다.**
  호출처가 없다. Phase 3에서 제거 대상이 아니었을 뿐이다.
- **Cowork 원격 세션의 마운트에서는 `git status`가 `.git/index.lock`을 남긴다.** 삭제 권한이
  없어 자동 제거가 안 되고, 그대로 두면 Windows 쪽 git 쓰기가 막힌다. 그 환경에서는
  `git status` 사용을 피하고, 락이 생기면 `.git/` 밖으로 `mv` 해야 한다.

---

## 7. 다음 세션 시작 프롬프트

```
Siftline (Electron 데스크톱 앱, 7개 LLM 웹 세션을 한 화면에 띄움) 작업을 인수한다.
레포: https://github.com/MinkyuTheBuilder/AI-Council-Chat

먼저 docs/handoff_history/HANDOFF_siftline_council_phases_1to3.md 를 읽어라.
Phase 1~3의 전체 맥락, 저장소 상태, 검증 자산, 함정이 정리돼 있다.

요약하면 이렇다.
- Council Chat 결함 감사 후 Phase 1~3을 구현·검증·종료했다.
- 사용자가 처음 요구한 3가지(역할 파악 / 각자 답변 / 서로의 대화 파악)는 전부 충족됐다.
- Phase 4는 사용자가 진행하지 않기로 결정했다. 앱을 막는 결함이 없다.
- 브랜치 codex/council-chat-phase3-defect-fixes 가 최신이며 main 은 아직 갱신 전이다.

작업 원칙:
- 프로젝트 규칙은 CLAUDE.md, docs/AGENT_WORKFLOW_CORE.md, docs/PROJECT_SCOPE.md 를 따른다.
- 코드를 고치기 전에 반드시 회귀 스크립트 3종(17/60/80 assertions)과
  npx tsc --noEmit 을 먼저 돌려 기준선을 확인하라.
- 검증 결과를 PASS 로 적기 전에 실제 출력을 눈으로 확인하라.
  자기 보고를 신뢰하지 않는 것이 이 프로젝트에서 가장 값이 나갔던 규칙이다.
- 사용자는 한국어로 대화하며 간결한 답변을 선호한다.

지금 무엇을 할지는 사용자에게 물어라. 남은 후보는 .gitattributes EOL 정규화,
npm 취약점 25건, Phase 4 문구/중복 정리이며 전부 선택 사항이다.
```
