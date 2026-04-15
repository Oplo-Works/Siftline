# AI Council

> Manual cross-verification workflow among up to 5 major LLMs using Electron BrowserViews and UI automation.

---

## Supported AI Services

| Icon | AI | URL |
|------|-----|-----|
| ✦ | Gemini | gemini.google.com |
| ◎ | Claude | claude.ai |
| ⊕ | ChatGPT | chatgpt.com |
| ◈ | Perplexity | perplexity.ai |
| ⚡ | Grok | grok.com |

---

## Architecture

```text
ai-council/
├── electron/
│   ├── main.ts                  # Main process: BrowserViews, IPC, full workflow engine
│   ├── preload.ts               # Context-isolated API bridge (contextBridge)
│   ├── preload-chrome-spoof.js  # Chrome identity spoof for OAuth popups
│   ├── preload-google-login.js  # Google login flow helper
│   └── selectors.json           # External DOM selector config (updatable without rebuild)
├── src/
│   ├── App.tsx                  # Root component: state, IPC subscriptions, orchestration
│   ├── types.ts                 # Shared types, constants, global window declarations
│   ├── index.css                # Dark glassmorphism design system
│   └── components/
│       ├── TitleBar.tsx         # Frameless window bar with 🔑 Accounts, 📋 History, 📊 Logs
│       ├── Toolbar.tsx          # Primary AI selector + Active panel toggles + query input + Start/Next/Continue
│       ├── StatusBar.tsx        # Live status text with animated progress bar
│       ├── PanelGrid.tsx        # Panel headers above embedded BrowserViews (only enabled AIs shown)
│       ├── AccountsPanel.tsx    # Per-AI login / logout panel (opened via 🔑 icon)
│       ├── FinalResultPanel.tsx # Collapsible final answer panel + per-file download
│       ├── LogDrawer.tsx        # Real-time execution logs side drawer
│       └── HistoryDrawer.tsx    # Persistent chat history side drawer
├── google-login.mjs             # Standalone Google account login helper
├── google-login.bat             # Launcher for google-login.mjs
├── claude-login.mjs             # Standalone Claude (claude.ai) login helper
├── claude-login.bat             # Launcher for claude-login.mjs
├── chatgpt-login.mjs            # Standalone ChatGPT login helper
├── chatgpt-login.bat            # Launcher for chatgpt-login.mjs
├── perplexity-login.mjs         # Standalone Perplexity login helper
├── perplexity-login.bat         # Launcher for perplexity-login.mjs
├── grok-login.mjs               # Standalone Grok (X/Twitter) login helper
└── grok-login.bat               # Launcher for grok-login.mjs
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

---

### 2️⃣ AI service login — via 🔑 Accounts panel (recommended)

Launch the app and click the **🔑 key icon** in the top-right corner of the title bar.  
The **Accounts** panel opens and shows login status for each of the 5 AIs:

- **Login** — opens a dedicated login window for that AI; session is saved automatically
- **Re-login** — re-authenticate an already-logged-in account
- **Logout** — clears the session for that AI
- **Logout All** — logs out all AIs at once

Sessions are persisted in the Electron `persist:` partition and survive app restarts.

#### Alternative — standalone login scripts

If you prefer to log in outside the app, use the batch launchers:

```bash
google-login.bat      # Gemini (Google account)
claude-login.bat      # Claude.ai (including Google OAuth popup)
chatgpt-login.bat     # ChatGPT
perplexity-login.bat  # Perplexity
grok-login.bat        # Grok (X / Twitter account)
```

---

### 3️⃣ Select which AIs are active

The **Toolbar** has two rows of AI chip buttons:

| Row | Label | Purpose |
|-----|-------|---------|
| Top | **Primary AI** | Choose which AI answers first (generates the draft) |
| Bottom | **Active** | Toggle which AI panels are visible and participate in the workflow |

- Click any chip in the **Active** row to show or hide that AI's panel.
- You can run the workflow with **2, 3, 4, or all 5** AIs simultaneously.
- The **Primary AI** is always active (locked) — it cannot be toggled off.

---

### 4️⃣ Run in dev mode (with hot reload)

```bash
npm start
```

---

### 5️⃣ Build and run (production mode)

```bash
npm run build
npx electron .
```

---

### 6️⃣ Package portable EXE (distribution)

```bash
npm run package
```

Creates `release/AI-Council-Portable.exe` — a single executable that runs without installation.

---

### 7️⃣ Create installer EXE (setup program)

```bash
npm run package:installer
```

An NSIS-based installer wizard EXE is created in `release/`.

---

> **Requirements:** Node.js v18+, npm v9+

---

## Workflow (Manual 3-Step Control)

The workflow is **manual** — you advance each stage by clicking the action button.

| Stage | Button label | What happens |
|-------|-------------|--------------|
| Idle | **▶ Start** | Sends the query to the Primary AI |
| After Primary answers | **▶▶ Next** | Sends the draft to all active Reviewer AIs simultaneously |
| After all Reviewers answer | **✓ Continue** | Sends all feedback back to Primary AI for final revision |

1. App loads all selected AI websites in BrowserViews
2. Log in via the **🔑 Accounts** panel (or standalone login scripts)
3. Select **Primary AI** and configure **Active** panels (2–5 AIs)
4. Type your question (and optionally attach files), click **▶ Start**
5. Wait for Primary AI's draft → click **▶▶ Next**
6. Wait for all Reviewers to finish → click **✓ Continue**
7. Final revised answer is extracted and displayed in the **Final Result Panel**

---

## Accounts Panel (🔑)

Click the **🔑 key icon** in the top-right of the title bar at any time.

- Shows real-time login status (● logged in / ○ not logged in) for each AI
- **Login** button opens a mini browser window for that AI's login page
- **Logout** clears only that AI's session cookie
- **Logout All** clears all sessions at once
- Status updates live via `onLoginStatusChanged` IPC event

---

## File Attachment

If you attach files with your question, all active AIs analyze the file contents and you can download the final revised version separated per file.

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

## Final Result Panel

A collapsible panel pinned to the bottom of the screen. Toggle it by clicking the header or the ▲/▼ button.

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
