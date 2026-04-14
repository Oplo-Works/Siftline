# AI Council

> Autonomous cross-verification workflow among 4 major LLMs using Electron BrowserViews and UI automation.

---

## Architecture

```text
ai-council/
├── electron/
│   ├── main.ts                  # Main process: BrowserViews, IPC, full workflow engine
│   ├── preload.ts               # Context-isolated API bridge (contextBridge)
│   ├── preload-chrome-spoof.js  # Chrome identity spoof for OAuth popups
│   └── selectors.json           # External DOM selector config (updatable without rebuild)
├── src/
│   ├── App.tsx                  # Root component: state, IPC subscriptions, orchestration
│   ├── types.ts                 # Shared types, constants, global window declarations
│   ├── index.css                # Dark glassmorphism design system
│   └── components/
│       ├── TitleBar.tsx         # Frameless window bar with drag region
│       ├── Toolbar.tsx          # Primary AI selector + query input + file attach + Start
│       ├── StatusBar.tsx        # Live status text with animated progress bar
│       ├── PanelGrid.tsx        # 4-panel headers (above embedded BrowserViews)
│       ├── FinalResultPanel.tsx # Collapsible final answer panel + per-file download
│       ├── LogDrawer.tsx        # Real-time execution logs side drawer
│       └── HistoryDrawer.tsx    # Persistent chat history side drawer
├── google-login.mjs             # Standalone Google account login helper
├── Google 로그인.bat             # Launcher for google-login.mjs
├── claude-login.mjs             # Standalone Claude (claude.ai) login helper
└── Claude 로그인.bat             # Launcher for claude-login.mjs
```

---

## Quick Start

### 1️⃣ 처음 설치 (새 PC로 옮겼을 때)

> **주의:** `node_modules`는 OS·CPU 환경에 종속된 바이너리를 포함합니다.  
> 다른 PC로 옮긴 경우 반드시 삭제 후 재설치하세요.

```bash
# node_modules 삭제 (PowerShell)
Remove-Item -Recurse -Force node_modules

# 의존성 재설치
npm install
```

같은 PC에서 소스 파일만 교체했다면 `npm install` 없이 바로 실행 가능합니다.  
단, `package.json`에 새 패키지가 추가되었다면 `npm install`을 한 번 실행하세요.

---

### 2️⃣ AI 서비스 로그인 (최초 1회)

앱 실행 전에 각 서비스에 미리 로그인해두면 세션이 유지됩니다.  
Google 계정으로 로그인하는 서비스(Gemini, Claude 등)는 아래 helper를 사용하세요.

```bash
# Google 계정 로그인 (Gemini 등 Google 계정 사용 서비스)
Google 로그인.bat

# Claude.ai 로그인 (Google OAuth 팝업 포함)
Claude 로그인.bat
```

로그인 완료 후 창을 닫으면 세션 쿠키가 `persist:` 파티션에 저장됩니다.

---

### 3️⃣ 개발 모드 실행 (코드 수정 + 핫리로드)

```bash
npm start
```

Electron 창이 자동으로 열립니다. 각 AI 서비스 패널에 로그인하세요.

---

### 4️⃣ 빌드 후 실행 (프로덕션 모드)

```bash
npm run build
npx electron .
```

`dist/` 및 `dist-electron/` 폴더가 생성된 뒤 앱이 실행됩니다.

---

### 5️⃣ 포터블 EXE 패키징 (배포용)

```bash
npm run package
```

빌드 완료 후 `release/AI-Council-Portable.exe`가 생성됩니다. 설치 없이 바로 실행 가능한 단일 실행 파일입니다.

---

### 6️⃣ 인스톨러 EXE 생성 (설치 프로그램)

```bash
npm run package:installer
```

`release/` 폴더에 NSIS 기반 설치 마법사 EXE가 생성됩니다.

---

> **필요 환경:** Node.js v18 이상, npm v9 이상

---

## 파일 첨부 (File Attachment)

질문과 함께 파일을 첨부하면 모든 AI가 파일 내용을 분석하고, 최종 수정본을 파일별로 분리해 다운로드할 수 있습니다.

| 지원 형식 | 추출 방식 | 수정본 저장 |
|-----------|-----------|-------------|
| `.pdf` | pdf-parse (텍스트 추출) | `.txt` |
| `.docx` | mammoth (본문 추출) | `.docx` (재생성) |
| `.xlsx` | xlsx (시트 → CSV) | `.xlsx` (재생성) |
| `.txt` / `.md` / `.csv` | UTF-8 직접 읽기 | 원본 확장자 유지 |

> **동작 방식:** Primary AI에는 파일 내용이 프롬프트에 텍스트로 포함됩니다. Reviewer AI들도 동일한 파일 컨텍스트를 수신합니다. 최종 답변은 `<<<FILE:파일명>>> … <<<END_FILE>>>` 구분자로 파일별 수정 내용을 출력하며, 패널에서 파일별 저장 버튼이 표시됩니다.

- 📎 다중 파일 동시 첨부
- ⬇ 파일별 개별 다운로드
- 80,000자 컨텍스트 제한

---

## Workflow

1. App loads all 4 AI websites in BrowserViews — user logs in manually once per session (or via login helper scripts)
2. User selects Primary AI, types query, optionally attaches files (PDF / DOCX / XLSX / TXT / MD / CSV), clicks **Start**
3. File content extracted on main process; combined prompt (query + file context) pasted into Primary AI with human-like typing
4. MutationObserver-based stability detection waits for Primary AI's draft response
5. Review prompt (draft + file context) injected simultaneously into all 3 Reviewer AIs
6. Wait for all reviewer feedback responses (parallel, with per-AI stability detection)
7. Combined feedback + final revision prompt injected back into Primary AI; instructs per-file structured output when files are attached
8. Final revised answer extracted, parsed into per-file blocks, displayed in collapsible Final Result Panel with individual download buttons

---

## 최종 결과 패널

화면 하단에 고정된 접이식 패널입니다. 헤더 클릭 또는 ▲/▼ 버튼으로 토글합니다.

| 상태 | 높이 | 표시 내용 |
|------|------|-----------|
| 접힘 (collapsed) | 36 px | 제목 · Primary AI 이름 · 완료/생성 중 뱃지 |
| 펼침 (expanded) | 260 px | 미리보기(Markdown 렌더링) / Raw 탭 · 복사 버튼 · 파일별 저장 버튼 |

> **미리보기 / Markdown 탭:** 렌더링된 HTML과 원본 Markdown 텍스트를 전환해서 볼 수 있습니다.  
> **파일별 저장:** 첨부 파일이 있을 경우 AI가 수정한 각 파일을 개별 버튼으로 저장합니다.

---

## Selector Maintenance

> DOM selectors are defined in `electron/selectors.json` and inlined at build time.  
> To override without rebuilding, place a custom `selectors.json` in the app's userData directory:
> 
> **Windows:** `%APPDATA%\ai-council\selectors.json`

---

## Prompt Templates

**Primary Prompt (파일 첨부 시):**
```text
다음 질문에 답변해주세요.
질문: {query}

[첨부 파일 내용]
--- {파일명} ---
{파일 내용}
---
```

**Reviewer Prompt:**
```text
아래는 [{Primary AI}]가 다음 질문에 대해 답변한 내용입니다.
질문: {query}
[첨부 파일 내용]: {fileContext}   ← 파일 첨부 시에만 포함
[{Primary AI}]의 답변: {draft}
위 답변을 리뷰해주세요: 1. 정확성 2. 완전성 3. 명확성 4. 개선 제안
```

**Final Revision Prompt (파일 첨부 시):**
```text
당신이 이전에 준 답변에 대해 다른 AI들이 피드백을 주었습니다.
[각 AI의 피드백] ...
피드백을 반영하여 각 파일의 수정본을 아래 형식으로 출력하세요:

<<<FILE:파일명.확장자>>>
(수정된 전체 내용)
<<<END_FILE>>>
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Shell | Electron 41 |
| UI | React 18 + TypeScript |
| Build | Vite 5 + vite-plugin-electron |
| Markdown | marked 18 (GFM + breaks) |
| Storage | electron-store |
| Styling | Vanilla CSS (dark glassmorphism) |
| Browser embeds | `BrowserView` (not headless, persistent sessions) |
| DOM automation | `executeJavaScript` + CDP `DOM.setFileInputFiles` |
| File parsing | pdf-parse · mammoth · xlsx |
| File generation | docx · xlsx |
| OAuth compatibility | preload-chrome-spoof.js (Chrome identity masking) |
