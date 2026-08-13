# Cowork 세션 인수인계 — Council Chat 결함 수정 감독

> **작성:** Claude (Cowork), 2026-08-03 — 사용량 한도로 세션 종료
> **인수:** 다음 Claude Cowork 세션
> **레포:** `C:\Users\Sales01\Documents\AI-Council-Chat` (Siftline v1.0.9, Electron 데스크톱 앱)
> **사용자:** Minkyu (한국어로 대화, 간결한 답변 선호)

아래 "다음 세션 시작 프롬프트" 섹션을 그대로 새 Cowork 세션에 붙여넣으면 이어서 작업할 수 있다.

---

## 1. 지금까지 무슨 일이 있었나

### 1-1. 사용자의 원래 요청

Siftline(7개 LLM 웹 세션을 한 화면에 띄우는 Electron 앱)의 Council Chat 기능 3가지를 점검해달라고 했다.

1. 각 AI 모델의 역할이 무엇인지 파악
2. 사용자가 글을 올리면 AI들이 먼저 각자 답변
3. 이후 라운드에서 활성 AI들이 서로의 대화 내용을 파악하고 대화를 이어감

### 1-2. 내가 한 일 (전부 read-only, 제품 코드 미수정)

1. **코드 감사 수행** → 결함 P1~P4 발견 (아래 §3)
2. **GPT 5.6 Sol용 착수 프롬프트 작성** → `docs/handoff_history/HANDOFF_PROMPT_council_chat_fixes.md`
   - 사용자의 Claude 사용량 한도 때문에 실제 구현은 GPT Sol에게 위임하기로 결정됨
3. **GPT가 제출한 SPEC/PLAN revision 1 검토** → 4건 보완 요구 후 반려
4. **revision 2 검토** → A~D 반영 확인, 그러나 검증 명령 관련 2건 추가 발견
5. **조건부 승인 문구 전달** → 사용자가 GPT에게 전달할 차례 (또는 이미 전달했을 수 있음)

### 1-3. 역할 분담 (중요)

- **GPT 5.6 Sol** = 구현자. 브랜치 `codex/council-chat-phase1-defect-fixes`에서 작업.
- **Claude Cowork (너)** = **감독·검증자**. 제품 코드를 직접 수정하지 않는다. GPT의 산출물을 코드와 대조해 검증하고, 사용자에게 "GPT에게 이렇게 말하라"는 문구를 만들어 준다.
- **사용자** = 승인자이자 GPT↔Claude 사이의 메시지 전달자.

> ⚠️ 사용자가 명시적으로 "네가 고쳐라"라고 하지 않는 한 제품 코드를 수정하지 마라. 사용자의 Claude 사용량이 빠듯한 것이 이 분담의 이유다.

---

## 2. 현재 상태 — 정확히 어디까지 왔나

| 항목 | 상태 |
|---|---|
| 코드 감사 | 완료 |
| GPT용 착수 프롬프트 | 전달 완료 |
| SPEC/PLAN revision 1 | **반려** (보완 4건 A~D) |
| SPEC/PLAN revision 2 | **조건부 승인** — 검증 방법 2건 수정 조건 |
| revision 3 | GPT가 작업 중이거나 미착수. **아직 확인하지 않음** |
| 제품 코드 구현 (BUILD) | **미착수** |

**조건부 승인의 조건 2건** (GPT가 revision 3에 반영해야 함):

1. `git diff --ignore-cr-at-eol --check`를 PASS로 보고했으나 **사실이 아님.** 실제 14,848건 trailing whitespace 검출. `--ignore-cr-at-eol`은 diff 매칭에만 적용되고 `--check`의 공백 검사에는 적용되지 않아, CRLF의 CR이 전부 잡힌다. AC-12의 해당 명령을 task-owned 경로로 스코프하고 CR-only 검출을 배제하도록 재정의할 것.
2. S3 대상 `src/councilModerator.ts`가 `i/mixed w/mixed` (163줄 중 87줄만 CRLF)인데 EOL 보존 규칙에서 누락됨. SPEC Edge Cases / PLAN Technical Decisions·Validation Detail에 명시 추가할 것.

승인 문구에서 "revision 3 반영 후 **재승인 요청 없이 BUILD 착수**"라고 허용했다. 따라서 다음에 GPT가 가져올 산출물은 **revision 3 + 구현 결과**일 가능성이 높다.

### 관련 파일

- `docs/features/council-chat-phase1-defect-fixes/SPEC.md` — 현재 revision 2
- `docs/features/council-chat-phase1-defect-fixes/PLAN.md` — 현재 revision 2
- `docs/handoff_history/HANDOFF_PROMPT_council_chat_fixes.md` — GPT용 원본 착수 프롬프트 (P1~P4 전체 상세)
- `docs/features/council-chat-phase1-defect-fixes/TEST_EVIDENCE.md` — 아직 없음. BUILD/TEST 단계에서 GPT가 생성 예정

---

## 3. 감사 결과 요약 — 검증할 때 이 기준을 쓴다

전체 상세는 `HANDOFF_PROMPT_council_chat_fixes.md`에 있다. 아래는 압축본이다.

### Phase 1 (승인된 범위 — GPT가 지금 작업 중)

**🔴 P1 — 클립보드 경쟁 조건.** `electron/main.ts:1917-1927`의 `pasteText()`가 OS 전역 클립보드(`clipboard.writeText` → await → Ctrl+V)를 쓴다. `runCouncilBroadcast()`(약 1687행)가 `Promise.allSettled`로 최대 7턴을 병렬 실행하므로 AI-A가 AI-B의 페르소나 프롬프트를 받을 수 있다. 검증 로직 `expected.slice(0, 32)`는 모든 프롬프트가 `"You are participating in Siftlin"`으로 시작해 무용지물. Kimi만 `execCommand('insertText')` 경로라 안전.

**🔴 P1 확장 — 두 번째 클립보드 사용처.** `attachFilesViaClipboardPaste()` `main.ts:6300-6314`. 실측 코드:
```
clipboard.writeImage(image) → await sleep(200) → view.webContents.paste() → await sleep(2000)
```
도달 경로: `processCouncilTurn(1559)` → `attachFilesViaCDP(5631)` → `6275`. 이미지 1장당 약 2.2초 클립보드 점유. 내가 revision 1 검토에서 발견해 추가시킨 항목이다.

**🟠 P2-A — 멘션 없는 메시지가 라운드 컨텍스트를 날림.** `electron/councilPrompt.ts:255` `extractPreviousRoundReplies()`가 "마지막 user ~ 직전 user" 인덱스만 본다. Node로 재현 완료:
```
[Q1, Claude답, Gemini답, Q2]           → ['claude','gemini']  ✅
[Q1, Claude답, Gemini답, "메모", Q2]   → []                    ❌
```

**🟠 P2-B — 사회자가 한국어에서 오작동.** `src/councilModerator.ts` 전체가 영어 정규식 키워드 매칭인데, `councilPrompt.ts`의 FINAL LANGUAGE RULE이 한국어 답변을 강제한다. 모든 카운트 0 → consensus/disagreement 항상 기본 문구. 추가로 `speakerOrder`와 `describeMissingAngle()`에 **kimi 분기 없음**.

### Phase 2 / 3 (아직 미승인 — 별도 번들)

- **P3-A** `tsconfig.json`의 `include`가 `["src"]`뿐. `electron/` 전체가 타입체크 사각지대. 실재 에러: `electron/councilPrompt.ts(42,5) TS2322: Type '"kimi"' is not assignable to type 'AiName'` (로컬 `AiName` 유니온에 kimi 누락).
- **P3-B** 역할 테이블 3벌. `AI_REVIEWER_BRIEFS`(main.ts:4832, 실사용) / `AI_ROLE_PRESETS`(types.ts:214, UI) / `AI_REVIEWER_PERSONAS`(main.ts:5000, **죽은 코드** — `buildReviewerPrompt()`가 호출되지 않음). Kimi 역할이 서로 다름.
- **P3-C** retry가 다른 프롬프트 빌더를 쓰고 첨부 파일을 유실. `deliveredCount`가 `messages.length`를 초과할 수 있음.
- **P3-D** `summarizeCouncilMessages()`가 앞에서부터 채우고 `break` → 최신 컨텍스트를 먼저 버림.
- **P4** 단일 멘션에 "다른 AI들이 병렬로 답하는 중" 거짓 문구 주입 / UI 문구가 "sequential"로 낡음 / `pendingAi` 단일 값 / IPC·Telegram 90줄 복붙 중복 / 멘션 없는 메시지 기본 라우팅 (제품 결정 필요).

---

## 4. 내가 직접 실행해 확인한 사실 (재검증 불필요, 그러나 변경됐을 수 있음)

```
브랜치: codex/council-chat-phase1-defect-fixes
HEAD:   b753232 chore(rebrand): rename user-facing product name AI Council -> Siftline

npx tsc --noEmit                        → exit 0, 에러 0건 (단 electron/ 미포함)
git diff --ignore-cr-at-eol --stat      → 빈 출력 (추적 파일 75개 변경분은 전부 EOL만)
git diff --ignore-cr-at-eol --check     → 29,696줄 / trailing whitespace 14,848건  ← PASS 아님
.gitattributes                          → 없음

git ls-files --eol:
  i/lf     w/crlf   electron/councilPrompt.ts     (S2 대상)
  i/crlf   w/crlf   electron/main.ts              (S1 대상, 일관)
  i/mixed  w/mixed  src/councilModerator.ts       (S3 대상, 163줄 중 87줄 CRLF)

untracked (사용자 소유, GPT가 건드리면 안 됨):
  docs/handoff_history/HANDOFF_PROMPT_council_chat_fixes.md
  docs/features/council-chat-phase1-defect-fixes/
```

### 문서상 경로 불일치 (기록만, 수정 안 함)

`CLAUDE.md`는 메인 레포를 `C:\Users\parkm\...`로, `PROJECT_SCOPE.md`는 `C:\Users\Sales01\...`를 구버전이라 기술한다. 실제 작업 루트와 최신 커밋은 `C:\Users\Sales01\Documents\AI-Council-Chat`에 있다. **문서가 낡은 것**으로 판단했고, 이번 번들에서는 수정하지 않기로 했다.

---

## 5. 다음에 할 일

### 5-1. GPT가 revision 3 + 구현을 가져오면

**절대 GPT의 자기 보고를 그대로 믿지 마라.** revision 2에서 `git diff --ignore-cr-at-eol --check: PASS`를 보고했으나 실제로는 14,848건이 검출됐다. **보고된 모든 검증 결과를 직접 실행해 확인하라.**

체크 순서:

1. **revision 3에 조건 2건이 반영됐는지** (§2의 1·2번)
2. **제품 코드 diff를 직접 읽어라.** `git diff --ignore-cr-at-eol -- electron/main.ts electron/councilPrompt.ts src/councilModerator.ts`
   - S1: 공용 mutex가 `pasteText()`와 `attachFilesViaClipboardPaste()` **양쪽**을 감쌌는가? `finally`에서 release 하는가? (데드락 방지)
   - S1: `expected.slice(0, 32)` 검증이 제거되고 AI 신원 검증으로 대체됐는가?
   - S1 회귀: DeepSeek 네이티브 mouseDown/mouseUp, Perplexity 네이티브 setter, Kimi 4000바이트 execCommand 경로가 살아있는가?
   - S2: `findPreviousRoundBounds()`가 `extractPreviousRoundReplies()`와 `summarizeContextBeforePreviousRound()` **양쪽**에서 쓰이는가?
   - S3: 한국어 정규식이 `\b` 없이 별도 패턴으로 OR 결합됐는가? (한국어에 `\b`는 동작 안 함) kimi 분기가 `speakerOrder`와 `describeMissingAngle()` 양쪽에 추가됐는가?
3. **EOL 사고 확인.** 세 파일 중 하나라도 diff가 전체 파일 재작성(예: 394/394, 163/163)으로 나오면 EOL 정규화 사고다. 즉시 지적하라.
4. **`npx tsc --noEmit`을 직접 실행하라.**
5. **P2-A 재현 케이스를 직접 돌려라.** 아래 §6 스크립트 참고.
6. **TEST_EVIDENCE.md의 PASS/BLOCKED 표기가 정직한지** 확인. 특히 AC-5(7 provider 인증)와 AC-13(이미지 폴백 동시성)은 환경 의존이라 BLOCKED가 정상일 수 있다.

### 5-2. 사용자에게 미리 알려둔 실무 사항 2가지

- **AC-5·AC-13 때문에 7개 AI 계정 전부 로그인이 선행 조건이다.** `DEFAULT_ENABLED_AI_NAMES`는 3개(chatgpt, claude, gemini)뿐이라 수동 활성화도 필요하다. 하나라도 미로그인이면 GPT는 P1을 완료로 표시할 수 없다.
- **AC-13은 막힐 수 있다.** 이미지 클립보드 경로는 CDP 첨부 실패 시에만 타는 폴백이라 실제 앱에서 강제하기 어렵다. GPT가 BLOCKED로 멈추면, 임시 디버그 플래그로 폴백을 강제하는 코드 레벨 검증을 허용해주라고 사용자에게 제안하라.

### 5-3. Phase 1이 닫히면

Phase 2 번들(P3-A~D)과 `.gitattributes` EOL 정규화 번들이 후속 후보다. 사용자에게 우선순위를 물어라. 특히 **P4의 "멘션 없는 메시지 기본 라우팅"은 사용자의 원래 기대(기능 #2)와 직결된 제품 결정**이라 별도로 물어봐야 한다. 선택지 3개를 이미 정리해뒀다: (a) 현행 유지 (b) 멘션 없으면 `@all` 기본 (c) 툴바 토글 추가.

---

## 6. 검증에 쓸 수 있는 재현 스크립트

```bash
# 샌드박스 bash 경로: /sessions/<session>/mnt/AI-Council-Chat/
# P2-A 수정 전/후 비교 — 수정 후에는 두 케이스 모두 ['claude','gemini']가 나와야 한다
cat > /tmp/t.mjs <<'EOF'
// 여기에 수정된 extractPreviousRoundReplies / findPreviousRoundBounds 로직을 옮기거나,
// 가능하면 esbuild로 electron/councilPrompt.ts를 트랜스파일해 실제 export를 import 할 것
const u=t=>({kind:'user',text:t}); const a=(ai,t)=>({kind:'assistant',ai,text:t});
const A=[u('@all Q1'),a('claude','C1'),a('gemini','G1'),u('@all Q2')];
const B=[u('@all Q1'),a('claude','C1'),a('gemini','G1'),u('메모'),u('@all Q2')];
const C=[u('@all Q1'),a('claude','C1'),a('gemini','G1'),u('메모1'),u('메모2'),u('@all Q2')];
const D=[u('@all Q1')];  // 진짜 1라운드 → [] 이어야 함
EOF
```

> ⚠️ 사본 재구현이 아니라 **실제 export된 함수를 실행**하는 편이 낫다. PLAN도 그렇게 요구하고 있다 (`Validation Detail` > `Exercise the actual exported helper code`).

---

## 7. 다음 세션 시작 프롬프트

새 Cowork 세션에 아래를 붙여넣어라.

```
Siftline(C:\Users\Sales01\Documents\AI-Council-Chat) 프로젝트의 Council Chat 결함
수정 작업을 감독 중이던 Claude 세션을 인수한다.

먼저 이 두 문서를 읽어라. 전체 맥락이 들어 있다.
1. docs/handoff_history/COWORK_SESSION_HANDOFF_council_chat_review.md  ← 인수인계 문서
2. docs/handoff_history/HANDOFF_PROMPT_council_chat_fixes.md           ← 감사 결과 원본

요약하면 이렇다.
- 내가 Council Chat 코드를 감사해 결함 P1~P4를 찾았다.
- 사용자의 Claude 사용량 한도 때문에 실제 구현은 GPT 5.6 Sol이 브랜치
  codex/council-chat-phase1-defect-fixes 에서 진행한다.
- 내 역할은 감독·검증이다. 사용자가 명시적으로 지시하지 않는 한 제품 코드를
  직접 수정하지 않는다. GPT 산출물을 코드와 대조 검증하고, 사용자가 GPT에게
  전달할 문구를 만들어 준다.
- SPEC/PLAN revision 1은 반려했고, revision 2는 검증 방법 2건 수정을 조건으로
  조건부 승인했다. revision 3 반영 후 재승인 없이 BUILD 착수를 허용한 상태다.

작업 원칙:
- GPT의 자기 보고를 믿지 말고 모든 검증 명령을 직접 실행해 확인하라.
  실제로 revision 2에서 `git diff --ignore-cr-at-eol --check: PASS` 라는
  잘못된 보고가 있었다 (실제 14,848건 검출).
- 프로젝트 규칙은 CLAUDE.md와 docs/AGENT_WORKFLOW_CORE.md, docs/PROJECT_SCOPE.md를
  따른다. push 권한은 없다.
- 사용자는 한국어로 대화하며 간결한 답변을 선호한다.

우선 인수인계 문서의 §2(현재 상태)와 §5(다음에 할 일)를 확인하고,
지금 레포 상태가 문서에 기록된 것과 달라졌는지 점검한 뒤 보고하라.
```
