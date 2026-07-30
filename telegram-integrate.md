# Telegram Integration Plan — Siftline

목적: 사용자가 외부에서 (smartphone) Telegram을 통해 Siftline 데스크톱 앱과 채팅하고 세션을 관리한다.

---

## 1. 아키텍처 결정

### 채택: Telegram Bot API + Long Polling (서버리스)

- 사용자가 `@BotFather`에서 봇 생성 → bot token 발급
- Electron 메인 프로세스가 `getUpdates`를 long-poll → 인바운드 포트 불필요
- 응답은 `sendMessage` HTTP 요청으로 전송

### 거부한 대안

| 방식 | 거부 이유 |
|---|---|
| Webhook | 공인 IP/HTTPS 필요, ngrok 같은 터널링 의존 → 사용자 진입 장벽 ↑ |
| 자체 릴레이 서버 | 인프라 운영 부담, 보안 책임 ↑ |
| 외부 라이브러리(`node-telegram-bot-api`) | 의존성 + 보안 audit 부담. Telegram Bot API는 단순 JSON HTTP라 `fetch`로 충분 |

---

## 2. 사용자 시나리오 (실제 패턴 기반)

스크린샷의 Council Chat 사용 패턴을 그대로 휴대폰으로 옮긴다:

- `@Gemini` 같이 특정 AI 멘션
- 한 토픽으로 여러 메시지를 주고받음 (대화형)
- 토픽 바뀌면 "New Session" → 깨끗한 상태로 새 대화 시작
- 가치 있는 대화는 "Save Session"으로 보관
- 결과물이 정리됐다 싶으면 "Send To Workflow"로 정밀 검증

→ 기본 모드는 **Council Chat**. 세션 관리 명령은 Phase 1부터 포함.

---

## 3. Phase 0 — 사전 준비

| 단계 | 내용 | 누가 |
|---|---|---|
| 0-1 | `@BotFather`에서 봇 생성 → `/newbot` → token 확보 | 사용자 |
| 0-2 | 봇과 1회 메시지 → `getUpdates`로 본인 `chat_id` 확인 (또는 `@userinfobot` 사용) | 사용자 |
| 0-3 | 두 값을 안전하게 보관 (electron-store 암호화) | 코드 |

**오류 방지 포인트**: token 노출 금지 — README, 스크린샷, 코드, 로그 어디에도 평문 저장/출력 X

---

## 4. Phase 1 MVP — Council Chat 기본 + 세션 관리 (1~1.5주)

### 4.1 기본 동작

- 텔레그램에서 일반 메시지 → 현재 활성 Council Chat 세션에 추가 → 활성 AI들이 응답 → 텔레그램으로 전송
- `@Gemini ...` 처럼 멘션 포함 시 데스크톱 UI와 동일하게 해당 AI만 응답
- 멘션 없으면 현재 Primary AI 1명만 응답 (대화형 흐름 유지)

### 4.2 슬래시 커맨드

| 커맨드 | 동작 | 데스크톱 대응 |
|---|---|---|
| `/new` | 현재 세션 폐기, 새 Council Chat 시작 | "New Session" 버튼 |
| `/save [제목]` | 현재 세션을 스냅샷으로 저장 | "Save Session" 버튼 |
| `/save_and_new [제목]` | 저장 후 즉시 새 세션 시작 | 가장 흔한 토픽 전환 패턴 |
| `/sessions` | 저장된 세션 목록 (최근 10개, 제목+날짜) | "Saved Sessions" 패널 |
| `/load <id>` | 특정 세션을 active로 로드 | 저장된 세션 클릭 |
| `/workflow` | 현재 세션을 Workflow 모드로 전송 | "Send To Workflow" 버튼 |
| `/status` | 현재 모드, Primary AI, 활성 AI, 세션 제목 표시 | 우측 패널 정보 |
| `/help` | 사용 가능한 커맨드 안내 | — |

### 4.3 명령 디자인 원칙

- **암묵적 저장 권장**: `/save_and_new` 한 번에 끝내는 패턴이 휴대폰에서 가장 편함
- **확인 응답 즉시**: `/save` → 즉시 `✅ Saved as "..."` 응답 (AI 응답 대기 X)
- **에러 격리**: `/load 999` 같은 잘못된 ID → `❌ Session not found` 응답, 세션 상태 변경 X

### 4.4 상태 일관성 (가장 중요한 함정)

데스크톱 UI와 텔레그램이 같은 세션 상태를 공유한다.

- 휴대폰에서 `/new` 하면 데스크톱 UI에서도 새 세션으로 보여야 함
- 데스크톱에서 "Save Session" 누르면 텔레그램의 다음 `/sessions`에 그 세션 보여야 함
- 핵심: 둘 다 기존 IPC handler들(`save-council-snapshot`, `reset-council-room` 등)을 호출하면 자동 동기화됨

코드 측면에서: telegramBridge가 IPC handler가 호출하는 **내부 함수**를 직접 호출. mainWindow가 닫혀있어도 동작해야 하므로 IPC 우회.

---

## 5. 구체 작업 항목 (Phase 1)

| # | 작업 | 변경 파일 | 비고 |
|---|---|---|---|
| 1 | Council 워크플로우 핵심 함수 export 가능하게 분리 | `electron/main.ts` | IPC handler에서 logic 빼서 `runCouncilTurn(...)`, `resetCouncilRoom()`, `saveCouncilSnapshot()` 등 순수 함수화 |
| 2 | Telegram Bot API 래퍼 | `electron/telegram/api.ts` (신규) | fetch 기반, 의존성 0. `getUpdates`, `sendMessage`, `setMyCommands`, `sendChatAction` |
| 3 | 메시지 큐 + 직렬 처리 | `electron/telegram/queue.ts` (신규) | 동시성 1, FIFO. 처리 중에 받은 메시지는 대기 |
| 4 | 명령 파서 + 디스패처 | `electron/telegram/commands.ts` (신규) | `/new`, `/save`, `/save_and_new`, `/sessions`, `/load`, `/workflow`, `/status`, `/help` |
| 5 | 응답 청크 분할 (4096 byte) | `electron/telegram/formatter.ts` (신규) | plain text, 코드블록 보존 |
| 6 | 브릿지 main module | `electron/telegram/bridge.ts` (신규) | start/stop, polling loop, 백오프 재연결, last update_id 영구 저장 |
| 7 | Settings UI | `src/components/TelegramSettings.tsx` (신규) | token/chat_id 입력, enable 토글, 연결 상태, "How to set up" 링크 |
| 8 | Settings 저장 | `electron-store` 스키마에 `telegram` 추가 | `{ enabled, botToken, chatId, lastUpdateId }` |
| 9 | App startup hook | `electron/main.ts` | 설정이 enabled면 startup 시 자동 start |
| 10 | Status bar 표시 | `src/App.tsx` 또는 status bar | `◉ Telegram` 점등 |

---

## 6. 보안 / 안정성 체크리스트

- [ ] Bot token은 electron-store의 `encryptionKey` 옵션 활성화 후 저장
- [ ] Chat ID 화이트리스트 외 메시지는 silent reject + 로그에 마스킹된 chat_id만 기록
- [ ] `getUpdates`의 `last_update_id` 영구 저장 → 재시작 시 옛 메시지 폭주 방지
- [ ] Polling loop는 한 번에 하나만 (인스턴스 락)
- [ ] 409 Conflict 감지 시 자동 stop + 사용자에 알림
- [ ] 워크플로우 timeout 5분, 초과 시 텔레그램에 `⚠️ AI 응답 지연으로 중단됨` 전송
- [ ] `/save`, `/load`, `/new` 같은 상태 변경 명령은 즉시 확인 메시지 응답 (사용자 혼란 방지)
- [ ] App 종료 시 polling loop graceful shutdown

---

## 7. 검증 시나리오

1. 토큰 입력 후 토글 ON → 데스크톱 status bar `◉ Telegram` 점등
2. 휴대폰에서 일반 메시지 → 데스크톱 Council Chat에 메시지 추가 + 활성 AI 응답이 휴대폰으로 옴
3. 휴대폰 `/save 투자질문` → ✅ 응답 + 데스크톱 "Saved Sessions" 목록에 즉시 표시
4. 휴대폰 `/save_and_new` → 저장 후 데스크톱 채팅 영역도 비워짐
5. 휴대폰 `/sessions` → 저장된 세션 리스트 (제목, 날짜, ID)
6. 휴대폰 `/load 1762345` → 데스크톱이 그 세션을 활성으로 전환
7. 휴대폰 `/workflow` → 데스크톱이 Workflow 모드로 전환되며 현재 대화를 seed로 사용
8. 휴대폰 `@Gemini ...` 멘션 → Gemini만 응답
9. 미인증 chat_id → silent reject (로그만)
10. App 1시간 sleep → 휴대폰에서 메시지 → 깨어나서 정상 응답 (폭주 X)

---

## 8. 알려진 위험 + 완화

| 위험 | 완화 |
|---|---|
| 세션 저장이 데스크톱 UI 컴포넌트 mount에 의존 | UI 의존성 제거 — 세션 저장 로직을 main 프로세스의 store-only 함수로 옮김 |
| 데스크톱 UI에서 "응답 대기 중"인데 텔레그램에서 새 메시지 | 큐가 직렬화 — `⏳ 이전 작업 진행 중...` 응답 후 큐에 추가 |
| 휴대폰 사용자가 `/new`를 실수 | "이전 세션이 저장되지 않았습니다. 정말 새로 시작? `/new --force`" — Phase 2에서 (MVP는 그냥 새로 시작) |
| 데스크톱에서 mode 변경했는데 텔레그램은 모름 | telegramBridge가 같은 store/state를 읽음 — 자동 동기화 |
| `@Gemini` 멘션 파싱이 데스크톱과 다름 | `src/councilMentions.ts`의 `getMentionSuggestions` / `parseCouncilIntent` 재사용 (이미 main process에 import 가능) |
| Bot token 유출 | `electron-store`의 encrypted option 사용 + .gitignore + 로그에 마스킹 출력 |
| 누군가 bot 발견 후 스팸 | chat_id 화이트리스트 강제, 미인증 chat에는 응답 없음 (silent reject) |
| Long-poll 연결 끊김 | exponential backoff (1s → 2s → 4s → 30s max), `Cannot connect` 로그 |
| Markdown 깨짐 | MVP는 plain text, parse_mode 지정 안 함 |
| 여러 인스턴스 동시 polling | 한 token으로 동시 polling 시 Telegram이 409 Conflict 반환 → 감지하고 stop + 사용자에게 알림 |
| 휴대폰에서 답을 기다리는데 PC가 sleep | OS level Power Management API로 polling 중 sleep 방지 (Phase 2+) |

---

## 9. Phase 2 — 모드 전환 + UX 개선 (1주)

### 기능

1. **추가 슬래시 커맨드**:
   - `/workflow_run <질문>` → 즉석 워크플로우 실행 (대화 모드 우회)
   - `/ai chatgpt` → Primary AI 변경
   - `/active +grok -gemini` → 활성 AI 토글

2. **Inline keyboard** (선택적, 더 직관적):
   - 응답에 "다른 Primary AI로 다시" / "더 깊이 분석" 버튼

3. **진행 상태 reaction**:
   - 메시지 받자마자 ⏳ 이모지 reaction
   - 처리 중 → 💭
   - 완료 → ✅
   - 실패 → ❌

4. **응답 청크 분할 강화**:
   - 4096자 초과 시 `[1/3]`, `[2/3]` 헤더 붙여 분할 전송
   - 코드 블록 잘림 방지 — 줄 단위로 자르고 코드 블록 재오픈

5. **MarkdownV2 점진 도입**:
   - AI 응답의 마크다운 → Telegram MarkdownV2 안전 변환기
   - special chars 이스케이프, `*bold*`, `_italic_`, 코드 블록 매핑

---

## 10. Phase 3 — 고급 기능 (선택)

| 기능 | 비고 |
|---|---|
| 음성 메시지 | OpenAI Whisper API로 STT → 텍스트 처리 |
| 첨부 파일 | Telegram document → temp 디렉터리 → 기존 첨부 파일 워크플로우 활용 |
| 여러 사용자 지원 | chat_id 화이트리스트 다수, 사용자별 세션 분리 |
| 세션 동기화 | 데스크톱 카운슬 채팅과 텔레그램이 같은 세션 공유 |
| 푸시 알림 | 워크플로우가 사용자 입력 대기 중일 때 텔레그램으로 안내 |

---

## 11. 디렉터리/파일 구조

```
electron/
  main.ts                    # workflow를 호출 가능한 export 함수로 리팩터링
  telegram/
    api.ts                   # Telegram Bot API 래퍼 (fetch 기반, 의존성 0)
    queue.ts                 # 메시지 직렬 처리 큐
    formatter.ts             # AI 응답 → Telegram 메시지 청크 분할
    state.ts                 # last update_id, chat_id, mode 영구 저장
    commands.ts              # /save, /new, /load, /sessions, /workflow 디스패처
    bridge.ts                # polling loop, start/stop, 메인 진입점
src/
  components/
    TelegramSettings.tsx     # 설정 UI
```

---

## 12. 진행 순서 결정

### 선택지

- **A.** 사용자가 봇 만들고 token/chat_id 알려주면 → 그걸로 직접 테스트하면서 코드 작성
- **B.** Settings UI부터 만들어서 사용자가 직접 입력하게 하고, 그 다음 백엔드 구현

**채택: B**

이유: token은 사용자 PC를 절대 떠나지 않음 → 보안. UI 먼저 만들어두면 token 입력 후 즉시 활성화 가능.

### 실행 순서

1. electron-store 스키마에 `telegram` 추가
2. `electron/telegram/api.ts` (Bot API 래퍼)
3. `electron/telegram/formatter.ts`
4. `electron/telegram/queue.ts`
5. `electron/telegram/commands.ts`
6. `electron/telegram/bridge.ts`
7. `electron/main.ts` 리팩터링 (council 함수 분리)
8. App startup hook
9. IPC handlers for settings get/set/test-connection
10. `src/components/TelegramSettings.tsx`
11. Status bar indicator
12. 빌드 + smoke test
