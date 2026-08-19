# 작업 착수 프롬프트 — Council Chat 결함 수정

> **대상 Runtime:** `codex-sol-deep` (GPT 5.6 Sol)
> **작성자:** Claude (Cowork) — read-only 감사 세션, 파일 변경 없음
> **작성일:** 2026-08-03
> **레포:** `C:\Users\parkm\Documents\AI-Council-Chat\` (Siftline v1.0.9)
> **감사 시점 커밋 기준 line number** — 편집 전 반드시 grep으로 현재 위치를 재확인할 것.

아래 전체를 그대로 Sol에게 전달하면 된다.

---

## 0. 너의 역할과 권한 경계

너는 이 Electron 데스크톱 앱(Siftline)의 **Council Chat 기능 결함을 수정**한다.

**세션 시작 시 반드시 이 순서로 읽어라 (`CLAUDE.md` 규정):**

1. `docs/AGENT_WORKFLOW_CORE.md`
2. `docs/MODEL_RUNTIME_PIN.md` — 너의 Runtime ID는 `codex-sol-deep`. 권한·billing 프로필 확인.
3. `docs/PROJECT_SCOPE.md` — **HUMAN-OWNED 정책**과 §4 Validation Commands 표
4. `docs/HANDOFF.md` — 맥락 전용, 권한 부여 아님
5. `docs/workflow/SPEC.md` + `docs/workflow/PLAN.md` (stage: `WF:SPEC_PLAN`), 승인 후 `docs/workflow/BUILD.md`
6. 파일 변경·commit·push가 있으므로 `docs/workflow/GIT_SAFETY.md`

**절대 넘지 말 것:**

- 이 프롬프트는 **일반 작업 요청**이다. Git push, provider 변경, 유료 API 호출, 배포, 외부 발신 권한을 넓히지 않는다. 그런 권한이 필요하면 멈추고 사용자에게 명시적으로 요청하라.
- `docs/PROJECT_SCOPE.md`의 **Must-preserve flows**를 깨지 마라. 특히 Workflow 3단계 모드, Saved Sessions, Telegram 연동, 파일 첨부 CDP 업로드, Hybrid Focus Layout.
- **Out of Scope**(자동 무인 워크플로, 8번째 provider, 클라우드 동기화, 자동 채점, 모바일)는 손대지 마라.
- API 키·Telegram 토큰을 코드·로그·git에 노출하지 마라.
- **100줄 이상 교체가 필요한 파일 편집은 부분 치환(Edit) 대신 전체 재작성(Write) 또는 스크립트로 하라.** 대형 치환 시 파일 끝이 truncate된 사고 기록이 있다 (Field Test #1). `electron/main.ts`는 약 310KB / 7,700줄이므로 특히 주의.
- 미완성 기능을 "완료"라고 주장하지 마라.

---

## 1. 배경 — 무엇을 점검했고 무엇이 문제인가

Siftline의 Council Chat은 3가지를 하기로 되어 있다.

1. 7개 AI 각각에 고유 역할(persona)을 주입한다.
2. 사용자가 글을 올리면 활성 AI들이 **병렬로, 서로를 보지 않고** 각자 답한다.
3. 다음 라운드부터는 **직전 라운드의 동료 답변 전문**을 보고 대화를 이어간다.

설계 의도는 코드에 정확히 반영되어 있다. 그러나 아래 결함들이 이 의도를 무너뜨린다.
**전부 코드 정적 분석으로 확인했고, P1/P2-A는 실행 재현까지 마쳤다.**

---

## 2. 수정 대상 — Phase 1 (필수, 먼저 착수)

### 🔴 P1 — 클립보드 경쟁 조건으로 AI가 다른 AI의 프롬프트를 받는다

**위치:** `electron/main.ts` — `pasteText()` 약 1847~1953행, 특히 1917~1927행

**현재 코드:**

```ts
// Use Electron clipboard + Ctrl+A/Ctrl+V via sendInputEvent.
const { clipboard } = require('electron')
clipboard.writeText(text)

view.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: ['ctrl'] })
view.webContents.sendInputEvent({ type: 'keyUp',   keyCode: 'A', modifiers: ['ctrl'] })
await sleep(50)
view.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'V', modifiers: ['ctrl'] })
view.webContents.sendInputEvent({ type: 'keyUp',   keyCode: 'V', modifiers: ['ctrl'] })
await sleep(150)
```

**근본 원인:**

`runCouncilBroadcast()` (약 1687행)는 `Promise.allSettled(targets.map(...))`로 최대 7개 턴을 **동시에** 실행한다. 각 턴이 `pasteText()`를 호출하고, `pasteText()`는 **OS 전역 클립보드**라는 공유 자원에 쓴다. `clipboard.writeText()`와 Ctrl+V 사이에 `await sleep(50)`을 포함한 다수의 await가 있어 이벤트 루프가 양보된다. 따라서 AI-A가 붙여넣기 전에 AI-B가 클립보드를 덮어쓴다.

프롬프트는 AI마다 다르다 (`You are participating in Siftline as ${displayNames[aiName]}` + 각자의 `brief.role` / `brief.focus`). 즉 **Claude 패널에 Gemini용 페르소나 프롬프트가 주입될 수 있다.** 역할 분화라는 제품의 핵심 가치가 조용히 무너진다.

**검증 로직도 이 오류를 못 잡는다.** 폴백 체크(약 1936행)가 이렇게 되어 있다:

```ts
if (currentValue && currentValue.includes(expected.slice(0, 32))) return 'paste-ok';
```

모든 Council 프롬프트가 `"You are participating in Siftline as "`(37자)로 시작하므로 **앞 32자가 전 AI 동일**이다. 잘못된 프롬프트도 `paste-ok`로 통과한다. 게다가 contenteditable(Gemini/Claude/ChatGPT)은 폴백 주입 자체를 `fallback-skipped-contenteditable`로 스킵한다.

참고로 **Kimi만 이 버그에서 자유롭다.** 약 1887~1915행에서 `document.execCommand('insertText', ...)` 경로를 타기 때문이다 (Kimi의 4000바이트 초과 붙여넣기 → 파일 첨부 변환 문제 회피용으로 추가된 코드).

**요구 수정 (권장안 A — 근본 해결):**

Kimi 전용이던 `execCommand('insertText')` 경로를 **전 AI 기본 경로로 승격**한다. 클립보드를 아예 쓰지 않으므로 경쟁 조건이 원천 소멸한다.

- `pasteText()`를 재구성: `execCommand('selectAll')` → `execCommand('delete')` → `execCommand('insertText', false, text)` 시도
- 실패 시에만 기존 클립보드 경로로 폴백
- 클립보드 폴백은 **반드시 뮤텍스로 직렬화** (아래 권장안 B의 뮤텍스를 폴백 경로에 적용)

**요구 수정 (권장안 B — 최소 침습, A가 특정 사이트에서 깨질 때):**

모듈 스코프에 클립보드 전용 뮤텍스를 도입한다.

```ts
let clipboardLock: Promise<void> = Promise.resolve()
async function withClipboard<T>(fn: () => Promise<T>): Promise<T> {
  const prev = clipboardLock
  let release!: () => void
  clipboardLock = new Promise<void>((r) => { release = r })
  await prev.catch(() => undefined)
  try { return await fn() } finally { release() }
}
```

`clipboard.writeText()`부터 Ctrl+V 완료 + `await sleep(150)`까지 전 구간을 `withClipboard()`로 감싼다.

> ⚠️ B만 적용하면 브로드캐스트의 병렬성이 붙여넣기 구간에서 직렬화된다. 붙여넣기 자체는 200ms 수준이라 7개여도 ~1.4초이므로 수용 가능하지만, A가 가능하면 A를 우선하라.

**반드시 함께 고칠 것 — 검증 로직 무력화:**

`expected.slice(0, 32)` 비교를 의미 있는 값으로 바꿔라. 예:

- 프롬프트에 AI별 고유 nonce/마커를 삽입하고 그 마커의 존재를 검증하거나
- 앞 32자 대신 **길이 + AI 표시명이 포함된 구간**을 검증 (예: `expected` 안의 `displayNames[aiName]` 첫 등장 위치 주변 슬라이스)
- contenteditable도 검증은 하되, 주입 폴백만 스킵하도록 분리하고 **불일치 시 명확히 `sendLog('error', ...)`를 남기고 throw**하라. 지금처럼 조용히 성공 처리하면 안 된다.

**수용 기준:**

- [ ] 7개 AI 전원 활성 상태에서 `@all` 브로드캐스트 시, 각 패널의 입력창에 주입된 프롬프트의 `You are participating in Siftline as X` 의 X가 해당 패널의 AI와 100% 일치
- [ ] 프롬프트 불일치가 발생하면 `paste-ok`가 아니라 에러 로그 + 턴 실패로 이어짐
- [ ] Kimi의 4000바이트 초과 붙여넣기 → TXT 첨부 변환 회피 동작이 유지됨 (회귀 금지)
- [ ] DeepSeek의 anti-bot focus 우회(native mouseDown/mouseUp)와 Perplexity의 React textarea 네이티브 setter 경로가 유지됨 (회귀 금지)

---

### 🟠 P2-A — 멘션 없는 메시지 하나가 동료 컨텍스트를 통째로 날린다

**위치:** `electron/councilPrompt.ts` — `extractPreviousRoundReplies()` 255~274행
**연관:** 같은 파일 `summarizeContextBeforePreviousRound()` 380~394행

**현재 로직:**

"마지막 user 메시지" 와 "그 직전 user 메시지" 사이 구간의 assistant 답변만 직전 라운드로 취급한다.

**문제:**

`send-council-message` 핸들러(`electron/main.ts` 약 4193행)는 멘션이 없는 메시지도 `kind: 'user'`로 트랜스크립트에 push한 뒤 `intent.kind === 'none'`으로 아무도 호출하지 않고 리턴한다. 그 결과 트랜스크립트에 **assistant 답변이 하나도 없는 user-user 구간**이 생긴다.

**재현 완료 (실행 확인):**

```
[Q1, Claude답, Gemini답, Q2]              → ['claude','gemini']   ✅
[Q1, Claude답, Gemini답, "메모", Q2]      → []                     ❌
```

즉 사용자가 멘션 없는 메모를 한 줄 남기는 순간, 다음 라운드 프롬프트에서 `[Previous round — what every active AI just answered]` 블록이 통째로 사라지고 `peerAwareness` 문구도 "1라운드용"으로 바뀐다. **기능 3번이 조용히 무력화된다.**

`summarizeContextBeforePreviousRound()`도 같은 인덱스 규칙(`userIndices[len-2]`)을 쓰므로, 진짜 직전 라운드 답변이 220자/메시지로 잘린 요약으로 강등된다.

**요구 수정:**

"직전 라운드"의 정의를 **인덱스 기반이 아니라 내용 기반**으로 바꿔라.

- 마지막 user 메시지에서 뒤로 스캔하며, **assistant 답변이 1개 이상 존재하는 가장 최근의 user 구간**을 직전 라운드로 삼는다.
- 답변이 없는 user 메시지(멘션 없는 메모)는 라운드 경계로 취급하지 않고 **건너뛴다.**
- `summarizeContextBeforePreviousRound()`의 cutoff도 동일한 규칙으로 계산하도록 헬퍼를 공유하라 (예: `findPreviousRoundBounds(messages): { start: number; end: number } | null` 하나를 두고 두 함수가 함께 쓰도록).
- 건너뛴 메모 자체는 버리지 말고 earlier-context 요약에는 남겨라 (사용자 의도가 담긴 텍스트다).

**수용 기준:**

- [ ] 위 재현 케이스 B가 `['claude','gemini']`를 반환
- [ ] 메모가 연속 2개 이상 있어도 동작
- [ ] 라운드가 실제로 없는 진짜 1라운드에서는 여전히 `[]` 반환 (회귀 금지)
- [ ] `pending: true` / `error: true` 메시지는 여전히 제외됨 (회귀 금지)
- [ ] AI당 최신 1건만 유지하는 기존 dedupe 동작 유지

---

### 🟠 P2-B — 사회자(Moderator)가 한국어 대화에서 항상 오작동한다

**위치:** `src/councilModerator.ts` 전체 (163행)

**문제 1 — 언어 불일치:**

`hasEvidenceSignals` / `hasRiskSignals` / `hasActionSignals` / `hasSynthesisSignals` / `hasNuanceSignals` / `hasReasoningSignals` 가 전부 **영어 정규식 키워드 매칭**이다.

```ts
return /\b(source|sources|according|reported|data|study|studies|today|latest|current|evidence)\b/i.test(text)
```

그런데 `electron/councilPrompt.ts`의 `FINAL LANGUAGE RULE`(201~206행, 346~351행)은 사용자가 한국어로 쓰면 **AI 답변 전체를 한국어로 강제**한다. 따라서 한국어 대화에서는 모든 카운트가 0이 되고:

- `consensus`는 항상 `'The discussion is still exploratory...'`
- `disagreement`는 항상 `'No major tension stands out yet...'`
- `speakerOrder`에 조건을 만족하는 모든 AI가 무조건 push되어 다음 발언자 추천이 사실상 무작위

**문제 2 — Kimi 누락:**

- `speakerOrder` 구성(약 137~142행)에 `kimi` 분기가 **없다.**
- `describeMissingAngle()`(약 52~89행)에 `case 'kimi'`가 **없다.** default로 떨어진다.

즉 Kimi는 사회자가 절대 지목하지 않고, 지목되더라도 역할에 맞는 후속 프롬프트를 받지 못한다.

**문제 3 — 미사용 import:**

1~6행에서 `AI_ROLE_PRESETS`를 import하지만 파일 내 어디서도 쓰지 않는다.

**요구 수정:**

1. 각 signal 함수의 정규식에 **한국어 키워드를 추가**하라. 한국어는 `\b` 단어 경계가 동작하지 않으므로 `\b` 없는 별도 패턴으로 OR 결합해야 한다. 예시(그대로 쓰지 말고 검토 후 확정):
   - evidence: `출처|근거|자료|보고|통계|데이터|최신|현재|연구|인용`
   - risk: `리스크|위험|주의|트레이드오프|단점|한계|다만|그러나|엣지 케이스|반론|실패`
   - action: `해야|권장|추천|다음 단계|시도|계획|실행|방안`
   - synthesis: `전반적|요약하면|큰 그림|종합|통합|맥락|패턴|구조|대상 독자`
   - nuance: `뉘앙스|미묘|윤리|안전|정확성|모호|인적 영향|평판`
   - reasoning: `제일원리|원리|추론|도출|논리|알고리즘|수학|코드|제약|최소|최적화`
2. `hasConciseSignals()`의 단어 수 계산이 공백 split이라 한국어에서 부정확하다. **문자 수 기준 병용**을 검토하라 (예: 한글 포함 시 300자 이하를 concise로).
3. `speakerOrder`에 `kimi` 분기를 추가하라. 판단 신호는 Kimi 역할(Long-Context Deep Research Analyst)에 맞게 "장문/다중 문서 심층 분석" 계열로 새 signal 함수를 만들어라.
4. `describeMissingAngle()`에 `case 'kimi'`를 추가하라. 문구는 `src/types.ts:239 AI_ROLE_PRESETS.kimi` 및 `electron/main.ts:4879 AI_REVIEWER_BRIEFS.kimi`와 일관되게.
5. 미사용 `AI_ROLE_PRESETS` import를 제거하거나, 3·4번에서 실제로 활용하라 (역할 문구 단일 출처화 관점에서 **활용 쪽을 권장**).

**수용 기준:**

- [ ] 한국어 assistant 답변 2건 이상으로 `buildCouncilModeratorSnapshot()` 호출 시, consensus/disagreement가 기본 문구가 아닌 실제 분류 결과로 나옴
- [ ] 영어 대화에서의 기존 분류 결과가 회귀하지 않음
- [ ] Kimi가 활성일 때 `nextSpeaker`로 선택될 수 있고, 선택 시 Kimi 역할에 맞는 `nextPrompt`가 나옴
- [ ] `npx tsc --noEmit` 통과 (이 파일은 `src/` 아래라 현재 typecheck 대상임)

---

## 3. 수정 대상 — Phase 2 (Phase 1 승인·검증 후 착수)

### 🟡 P3-A — `electron/` 전체가 타입체크 사각지대

**위치:** `tsconfig.json` — `"include": ["src"]`

`electron/main.ts`(310KB)와 `electron/councilPrompt.ts`, `electron/preload.ts`, `electron/telegram/*.ts`가 **어떤 tsconfig에도 포함되지 않는다.** `docs/PROJECT_SCOPE.md` §4가 필수로 지정한 `npx tsc --noEmit`이 이들을 전혀 검사하지 않는다.

**이미 실재하는 에러 (확인됨):**

```
electron/councilPrompt.ts(42,5): error TS2322: Type '"kimi"' is not assignable to type 'AiName'.
```

`electron/councilPrompt.ts:10`의 로컬 `AiName` 유니온에 `'kimi'`가 빠져 있는데, 같은 파일 42행 `COUNCIL_MENTION_ALIASES`는 `{ ai: 'kimi', aliases: ['kimi'] }`를 넣는다. 런타임은 우연히 동작하지만(`AI_DISPLAY_NAMES`에 kimi가 있으므로) 타입 안전망이 없다.

**요구 수정:**

1. `electron/councilPrompt.ts:10`의 로컬 `AiName` 정의를 삭제하고 `src/types.ts`의 `AiName`을 import해서 쓰도록 통일하라. 유니온 정의가 두 벌 있는 것 자체가 원인이다.
2. `tsconfig.electron.json`을 신설하고 `electron/**/*`를 포함시켜라. 루트 `tsconfig.json`의 `references`에 추가.
3. `package.json`에 `"typecheck": "tsc --noEmit && tsc --noEmit -p tsconfig.electron.json"` 스크립트를 추가하라.
4. 새로 드러나는 에러를 전부 수정하라. **양이 많을 수 있으므로, 에러 목록을 먼저 사용자에게 보고하고 승인받은 뒤 수정에 착수하라.** `strict` 전면 적용이 과하면 electron용 tsconfig만 단계적으로 완화하되 그 사실을 문서화하라.
5. 수정 완료 후 `docs/PROJECT_SCOPE.md` §4 Validation Commands 표의 Typecheck 명령을 갱신해야 한다. **§4~§5는 HUMAN-OWNED 섹션 인접 영역이므로, 직접 수정하지 말고 변경안을 제시하고 사용자 승인을 받아라.**

---

### 🟡 P3-B — 역할 정의가 3벌로 분산, 1벌은 죽은 코드

| 위치 | 이름 | 상태 |
|---|---|---|
| `electron/main.ts:4832` | `AI_REVIEWER_BRIEFS` | **실사용** — Council Chat + Workflow 프롬프트에 주입 |
| `src/types.ts:214` | `AI_ROLE_PRESETS` | **실사용** — UI 표시 |
| `electron/main.ts:5000` | `AI_REVIEWER_PERSONAS` | **죽은 코드** |

`AI_REVIEWER_PERSONAS`를 쓰는 유일한 함수 `buildReviewerPrompt()`(약 5059행)가 **어디서도 호출되지 않는다.** 실제로는 전부 `buildReviewerPromptV2()`(4891행, 호출부 4619행·6840행)를 쓴다. grep으로 재확인할 것.

내용도 어긋난다. 특히 Kimi:

- `AI_REVIEWER_BRIEFS.kimi` → "Long-Context Deep Research Analyst"
- `AI_ROLE_PRESETS.kimi` → "Long-Context Deep Analyst"
- `AI_REVIEWER_PERSONAS.kimi` → **"Agentic Execution Architect"** (완전히 다른 역할)

Grok도 세 곳 문구가 다르다.

**요구 수정:**

1. `AI_REVIEWER_PERSONAS`와 `buildReviewerPrompt()`를 **삭제**하라. 삭제 전 grep으로 참조 0건임을 반드시 재확인하고, 그 근거를 커밋 메시지/DEV_LOG에 남겨라.
2. `AI_REVIEWER_BRIEFS`와 `AI_ROLE_PRESETS`의 역할 문구를 **단일 출처에서 파생**되도록 정리하라. UI용 짧은 문구와 프롬프트용 상세 문구가 둘 다 필요하므로, `src/types.ts`에 `{ title, detail, focus, outputGuide }`를 가진 하나의 테이블을 두고 양쪽이 필요한 필드만 뽑아 쓰는 구조를 권장한다.
3. **주의:** `outputGuide`는 Workflow 리뷰 단계에서만 쓰이고 Council Chat에서는 의도적으로 제외된다 (`electron/councilPrompt.ts:189~196`의 주석 참조 — 강제하면 Perplexity/DeepSeek이 영어 헤더를 그대로 복사하는 문제가 있었다). 이 동작을 회귀시키지 마라.

---

### 🟡 P3-C — 재시도(retry)가 원본과 다르게 동작한다

**위치:** `electron/main.ts` — `retry-council-turn` 핸들러 약 4158행, `enqueueCouncilTurn()` 1660행, `CouncilFailedTurn` 타입 `src/types.ts:97`

문제 3가지:

1. **프롬프트 구조 불일치.** 재시도는 `enqueueCouncilTurn()` → `buildCouncilPrompt()`(구버전 delta 방식)를 탄다. 원래 턴은 `buildCouncilBroadcastPrompt()`(previous-round 블록 방식)였다. 재시도된 AI만 다른 형태의 컨텍스트를 받는다.
2. **첨부 파일 유실.** `CouncilFailedTurn`이 `{ ai, promptText, errorMessage }`만 저장한다. 파일 첨부가 있던 턴을 재시도하면 파일이 사라진다.
3. **`deliveredCount` 오염.** `processCouncilTurn()` 1633행이 `councilRoom.deliveredCount[aiName] = councilRoom.messages.length`를 기록한다. 병렬 브로드캐스트에서는 이 시점에 동료들의 pending placeholder가 배열에 포함돼 있다. 이후 동료 턴이 실패하면 catch 블록(약 1650행)이 placeholder를 `splice`로 제거해 `messages.length`가 줄어든다. 그러면 `deliveredCount > messages.length`가 되고, `buildCouncilPrompt()`의 `messages.slice(deliveredCount)`가 빈 배열이 되어 `[Most recent shared transcript]`가 `'No recent transcript.'`로 나간다.

**요구 수정:**

1. `CouncilFailedTurn`에 `attachedFiles`(및 `filePaths`)와 `prebuiltPrompt`(또는 재구성에 필요한 라운드 스냅샷)를 보존하라.
2. 재시도가 원래와 **동일한 프롬프트 빌더**를 쓰도록 하라. 가장 단순한 방법은 실패한 턴의 `prebuiltPrompt`를 그대로 저장했다가 재사용하는 것이다.
3. `deliveredCount` 기록 위치를 pending placeholder에 오염되지 않는 값으로 바꾸거나, 읽는 쪽에서 `Math.min(deliveredCount, messages.length)`로 방어하라. 후자는 증상만 가리므로 전자를 권장.

---

### 🟡 P3-D — 요약 함수가 최신 컨텍스트를 먼저 버린다

**위치:** `electron/councilPrompt.ts` — `summarizeCouncilMessages()` 137~154행

```ts
for (const message of messages) {
  ...
  if (total + line.length > maxChars) break   // ← 앞에서부터 채우고 끊는다
  lines.push(line)
}
```

배열 앞(= 가장 오래된 턴)부터 채우다 예산 초과 시 `break`한다. 결과적으로 **가장 오래된 턴을 남기고 가장 최근 턴을 버린다.** "earlier context summary"의 목적상 정반대다. 대화가 길어질수록 정작 관련 있는 최근 맥락이 먼저 사라진다.

**요구 수정:**

뒤에서부터 채우고 마지막에 시계열 순서로 뒤집어라. 잘림이 발생했으면 `- …(earlier turns omitted)` 같은 마커를 앞에 붙여 AI가 컨텍스트 누락을 인지하게 하라.

**주의:** 이 함수는 `buildCouncilPrompt()`의 `olderSummary`·`deltaSummary`, `summarizeContextBeforePreviousRound()` 등 여러 곳에서 쓰인다. 호출부 전부를 grep해서 영향을 확인하라.

---

## 4. 수정 대상 — Phase 3 (저위험 정리, 여유 있을 때)

- **단일 멘션에 거짓 문구 주입.** `@claude` 같은 단일 멘션도 `runCouncilBroadcast()`를 타서 `buildCouncilBroadcastPrompt()`를 쓴다. `peerAwareness`(`electron/councilPrompt.ts:353~356`)가 "다른 AI들이 지금 동시에 같은 프롬프트를 받고 있다"고 말하는데 **단일 타깃일 때는 거짓**이다. `targets.length === 1`을 컨텍스트로 전달해 문구를 분기하라.
- **UI 안내문이 구현과 불일치.** `src/components/CouncilChatPanel.tsx:1099`의 "collect **sequential** replies", `:1446` placeholder의 "give me each of your takes **in order**" — 실제 구현은 병렬 브로드캐스트다. 문구를 병렬 기준으로 갱신하라. 한국어 UI 여부는 사용자에게 확인.
- **`pendingAi`가 단일 값.** `runCouncilBroadcast()` 1702행 `councilRoom.pendingAi = targets[0] ?? null`. N개가 동시 대기 중인데 하나만 표시된다. placeholder의 `pending` 플래그로 UI가 커버되는지 확인하고, 안 되면 `pendingAis: AiName[]`로 확장하라. **`CouncilRoomState` 타입 변경은 Saved Sessions 직렬화/역직렬화와 Telegram bridge에 영향을 줄 수 있으니 반드시 영향 범위를 먼저 조사하라.**
- **90줄 규모 복붙 중복.** `send-council-message` IPC 핸들러(약 4193~4280행)와 Telegram용 API 함수(약 7150~7251행)의 로직이 사실상 동일하다. 한쪽만 고치면 어긋난다. 공통 함수로 추출하라. **Telegram 경로의 Chat ID whitelist / silently reject 동작은 절대 회귀시키지 마라** (PROJECT_SCOPE Must-preserve).
- **첫 라운드 진입 장벽 (제품 결정 필요, 코드 수정 전 사용자 확인 필수).** 현재 `@all`이나 `@AI`를 명시적으로 타이핑해야만 AI가 답한다. 멘션 없는 메시지는 트랜스크립트에만 저장된다(`electron/main.ts:4211`). 사용자는 "글을 올리면 AI들이 각자 답하는" 동작을 기대하고 있다. **이건 버그가 아니라 설계 선택이므로 임의로 바꾸지 말고, 아래 선택지를 사용자에게 제시하고 승인받아라:**
  - (a) 현행 유지 — 명시적 라우팅
  - (b) 멘션 없으면 `@all`로 기본 동작
  - (c) 툴바에 "기본 라우팅" 토글 추가 (기본값은 현행 유지)

---

## 5. 진행 방식

1. **먼저 SPEC/PLAN을 작성해 사용자 승인을 받아라** (`WF:SPEC_PLAN`). 코드부터 건드리지 마라.
   - Phase 1(P1, P2-A, P2-B)만으로 첫 번들을 구성할 것을 권장한다. Phase 2는 별도 번들.
   - P1은 권장안 A와 B 중 어느 쪽을 택할지 근거와 함께 제시하라.
2. 승인 후 `WF:BUILD` → `WF:TEST` → `WF:REVIEW` → `WF:CLOSE`.
3. **작업 단위를 작게 쪼개라.** `electron/main.ts`는 단일 파일 7,700줄이다. 한 번에 여러 결함을 동시에 손대면 회귀 원인 추적이 불가능해진다.

### 검증 (`docs/PROJECT_SCOPE.md` §4가 유일한 원본)

| 목적 | 명령 | 필수 |
|---|---|---|
| Typecheck | `npx tsc --noEmit` (P3-A 완료 후에는 electron 포함 명령) | Yes |
| Build | `npm run build` | Yes |
| 수동 실행 확인 | `build-and-run.bat` → 수동 체크리스트 | Yes (동작 변경 시) |
| Secret Scan | staged diff 수동 점검 + `git diff --check` | Yes |

자동 테스트 스위트가 **없다.** 따라서:

- 순수 함수(`electron/councilPrompt.ts`, `src/councilModerator.ts`)는 **일회성 검증 스크립트를 작성해 실행 결과를 로그로 남겨라.** 특히 P2-A의 재현 케이스 2종은 반드시 before/after를 기록하라.
- P1은 순수 함수로 검증 불가하다. 7개 AI 전원 활성 상태로 실제 앱을 띄우고 `@all`을 보낸 뒤, 각 패널에 실제 주입된 프롬프트를 로그(`sendLog`) 또는 DevTools로 캡처해 AI-프롬프트 대응을 확인하라. **이 수동 검증 없이 P1을 "완료"라고 하지 마라.**

### 수동 회귀 체크리스트 (최소)

- [ ] Workflow 모드 3단계 (▶ Start → ▶▶ Next → ✓ Continue) 정상
- [ ] Council Chat `@AI` 단일 멘션 / `@all` 브로드캐스트 정상
- [ ] 파일 첨부 (Workflow / Council Chat / Telegram 3개 진입점) 정상
- [ ] Saved Sessions 저장·복원 정상
- [ ] Telegram 메시지 송수신 및 미허용 Chat ID silently reject 정상
- [ ] 한국어 입력 시 전 AI가 한국어로 답변 (FINAL LANGUAGE RULE 유지)
- [ ] Kimi 장문 프롬프트가 TXT 첨부로 변환되지 않음

### 마무리

- `docs/DEV_LOG.md`에 작업 기록을 남겨라.
- `docs/HANDOFF.md`를 갱신하라.
- **push는 하지 마라.** `docs/workflow/GIT_SAFETY.md`와 `docs/PROJECT_SCOPE.md`의 HUMAN-OWNED 정책을 따르고, 권한이 명시되어 있지 않으면 사용자에게 확인하라.

---

## 6. 참고 — 감사에서 확인된 사실 (근거 자료)

- 감사는 **read-only**였다. 코드는 한 줄도 변경되지 않았다.
- `npx tsc --noEmit` 는 현재 **통과**하지만, 이는 `electron/`이 include에서 빠져 있기 때문이다 (P3-A).
- `electron/councilPrompt.ts`를 단독 컴파일하면 TS2322 (kimi) 에러가 실제로 발생한다.
- P2-A의 재현 결과는 `extractPreviousRoundReplies` 로직을 Node로 그대로 옮겨 실행해 확인했다.
- `AI_NAMES` = `['chatgpt','claude','deepseek','gemini','grok','kimi','perplexity']` (`electron/main.ts:378`)
- `DEFAULT_ENABLED_AI_NAMES` = `['chatgpt','claude','gemini']` (`electron/main.ts:379`) — 기본 3개만 활성이므로 **P1 재현 시 7개를 수동으로 활성화해야 한다.**
