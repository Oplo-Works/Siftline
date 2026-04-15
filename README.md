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
├── Google Login.bat             # Launcher for google-login.mjs
├── claude-login.mjs             # Standalone Claude (claude.ai) login helper
└── Claude Login.bat             # Launcher for claude-login.mjs
```

---

## Quick Start

### 1️⃣ First-time install (when moving to a new PC)

> **Note:** `node_modules` includes binaries that depend on your OS/CPU environment.  
> If you moved the project to a different PC, delete it and reinstall.

```bash
# Delete node_modules (PowerShell)
Remove-Item -Recurse -Force node_modules

# Reinstall dependencies
npm install
```

If you only replaced source files on the same PC, you can run it right away without `npm install`.  
However, if new packages were added to `package.json`, run `npm install` once.

---

### 2️⃣ AI service login (first time only)

If you log in to each service once before running the app, your session will persist.  
For services that use Google account login (Gemini, Claude, etc.), use the helpers below.

```bash
# Google account login (services that use Google accounts, e.g. Gemini)
Google Login.bat

# Claude.ai login (includes Google OAuth popup)
Claude Login.bat
```

After logging in, close the window and the session cookies will be saved to the `persist:` partition.

---

### 3️⃣ Run in dev mode (code changes + hot reload)

```bash
npm start
```

The Electron window opens automatically. Log in to each AI service panel.

---

### 4️⃣ Build and run (production mode)

```bash
npm run build
npx electron .
```

The app runs after `dist/` and `dist-electron/` are created.

---

### 5️⃣ Package portable EXE (distribution)

```bash
npm run package
```

After the build, `release/AI-Council-Portable.exe` is created. It’s a single executable that runs without installation.

---

### 6️⃣ Create installer EXE (setup program)

```bash
npm run package:installer
```

An NSIS-based installer wizard EXE is created in `release/`.

---

> **Requirements:** Node.js v18+, npm v9+

---

## File Attachment

If you attach files with your question, all AIs analyze the file contents and you can download the final revised version separated per file.

| Supported formats | Extraction method | Saved as |
|-----------|-----------|-------------|
| `.pdf` | pdf-parse (text extraction) | `.txt` |
| `.docx` | mammoth (body extraction) | `.docx` (regenerated) |
| `.xlsx` | xlsx (sheets → CSV) | `.xlsx` (regenerated) |
| `.txt` / `.md` / `.csv` | Read UTF-8 directly | Keep original extension |

> **How it works:** File content is included as text in the Primary AI prompt. Reviewer AIs receive the same file context. The final answer outputs per-file revisions using `<<<FILE:filename>>> … <<<END_FILE>>>` delimiters, and the panel shows a per-file save button.

- 📎 Attach multiple files at once
- ⬇ Download each file separately
- 80,000-character context limit

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

## Final Result Panel

This is a collapsible panel pinned to the bottom of the screen. Toggle it by clicking the header or the ▲/▼ button.

| State | Height | Displayed |
|------|------|-----------|
| Collapsed | 36 px | Title · Primary AI name · complete/in-progress badge |
| Expanded | 260 px | Preview (Markdown render) / Raw tab · Copy button · Per-file save buttons |

> **Preview / Markdown tab:** Toggle between rendered HTML and the raw Markdown text.  
> **Per-file save:** When attachments exist, each revised file can be saved via an individual button.

---

## Selector Maintenance

> DOM selectors are defined in `electron/selectors.json` and inlined at build time.  
> To override without rebuilding, place a custom `selectors.json` in the app's userData directory:
> 
> **Windows:** `%APPDATA%\ai-council\selectors.json`

---

## Prompt Templates

**Primary Prompt (when files are attached):**
```text
Please answer the following question.
Question: {query}

[Attached file content]
--- {filename} ---
{file content}
---
```

**Reviewer Prompt:**
```text
Below is what [{Primary AI}] answered to the following question.
Question: {query}
[Attached file content]: {fileContext}   ← include only when files are attached
[{Primary AI}]'s answer: {draft}
Review the answer above: 1) accuracy 2) completeness 3) clarity 4) improvement suggestions
```

**Final Revision Prompt (when files are attached):**
```text
Other AIs provided feedback on your previous answer.
[Feedback from each AI] ...
Incorporate the feedback and output the revised version of each file in the following format:

<<<FILE:filename.ext>>>
(full revised content)
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
