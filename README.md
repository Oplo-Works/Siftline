# AI Council

> Manual cross-verification workflow among up to 5 major LLMs using Electron BrowserViews and UI automation.

---

## ✨ What's New

| Feature | Description |
|---------|-------------|
| ⚡ **API Keys Tab** | New tab in the Accounts panel — store API keys for all 5 AI providers + Groq (ultra-fast Llama inference). Drag-and-drop rows to set analysis priority. Keys are saved in `electron-store` and never leave your machine. |
| 🤖 **AI Recommendation Engine** | As you type a query, the app calls your configured API provider to recommend the best Primary AI with a reason. Falls back to rule-based logic when no key is configured. A recommendation banner with an **Apply** button appears below the query box. |
| 🔄 **Mid-Workflow Primary AI Reassignment** | At both pause points (▶▶ Next and ✓ Continue) you can click a different AI chip to switch the Primary AI mid-run. The workflow engine picks up with the new selection for all remaining steps. |

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

## 📥 Download & Install

No build required. Download the latest installer from [GitHub Releases](https://github.com/MinkyuTheBuilder/ai-council/releases/latest).

| Platform | File | Target |
|----------|------|--------|
| 🍎 macOS (Intel) | `AI-Council-*-x64.dmg` | Intel Mac (pre-2020 models) |
| 🍎 macOS (Apple Silicon) | `AI-Council-*-arm64.dmg` | M1 / M2 / M3 / M4 Mac |
| 🪟 Windows | `AI-Council-Setup.exe` | Windows 10 / 11 (x64) |

### 🍎 macOS — Install from DMG

```text
1. Check your Mac chip:  Apple menu → About This Mac → Chip
     "Apple M..."      → download the arm64 build
     "Intel Core..."   → download the x64 build

2. Double-click the downloaded .dmg file to mount it.

3. Drag the AI Council icon into the Applications folder.

4. Launch AI Council from Launchpad or Finder → Applications.
```

> **⚠️ macOS Gatekeeper warning ("cannot verify the developer")**  
> The app is not code-signed, so macOS may block it on first launch. Use either method below:
>
> **Method 1 (GUI):** System Settings → Privacy & Security → scroll down → click *"Open Anyway"*  
> **Method 2 (Terminal):**
> ```bash
> xattr -cr "/Applications/AI Council.app"
> ```

### 🪟 Windows — Install from EXE

```text
1. Download AI-Council-Setup.exe.
2. Double-click to run the setup wizard.
3. Launch AI Council from the desktop shortcut or Start Menu.
```

> If Windows Defender SmartScreen appears, click *"More info"* → *"Run anyway"*.

---

## Architecture

```text
ai-council/
├── electron/
│   ├── main.ts                  # Main process: BrowserViews, IPC, workflow engine, recommendation engine
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
│       ├── Toolbar.tsx          # Primary AI selector + Active panel toggles + query input + recommendation banner
│       ├── StatusBar.tsx        # Live status text with animated progress bar
│       ├── PanelGrid.tsx        # Panel headers above embedded BrowserViews (only enabled AIs shown)
│       ├── AccountsPanel.tsx    # Two-tab panel: Accounts (login/logout) + API Keys (key storage & ordering)
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
The panel has **two tabs**:

#### 🔑 Accounts tab — session login / logout per AI

- **Login** — opens a dedicated login window for that AI; session is saved automatically
- **Re-login** — re-authenticate an already-logged-in account
- **Logout** — clears the session for that AI
- **Logout All** — logs out all AIs at once

Sessions are persisted in the Electron `persist:` partition and survive app restarts.

#### ⚡ API Keys tab — store API keys for the recommendation engine

| Provider | Key prefix | Get a key |
|----------|-----------|-----------|
| Gemini | `AIza...` | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |
| Claude | `sk-ant-...` | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) |
| ChatGPT (OpenAI) | `sk-...` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Perplexity | `pplx-...` | [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api) |
| Grok (xAI) | `xai-...` | [console.x.ai](https://console.x.ai/) |
| ⚡ Groq (Llama · Ultra-fast) | `gsk_...` | [console.groq.com/keys](https://console.groq.com/keys) |

Drag-and-drop the rows to control which provider is tried **first** when analyzing a query.  
API keys are stored in `electron-store` and never sent anywhere except the provider's own API.

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

### 7️⃣ Create installer EXE — 🪟 Windows (setup program)

```bash
npm run package:installer
```

An NSIS-based installer wizard EXE is created in `release/`.

---

### 8️⃣ Build DMG — 🍎 macOS (distribution)

```bash
# Builds both Intel (x64) and Apple Silicon (arm64) at once
npx electron-builder --mac dmg --x64 --arm64
```

Two files are created in `release/`: `*-x64.dmg` for Intel Macs and `*-arm64.dmg` for Apple Silicon Macs.

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

### 🔄 Reassigning Primary AI at Pause Points

At both pause points (**▶▶ Next** and **✓ Continue**) the Primary AI chips become interactive.  
Click any chip to switch the Primary AI mid-workflow — the app continues with the newly assigned AI:

- Reassigning at **▶▶ Next** — reviewer step and final revision both use the new Primary AI
- Reassigning at **✓ Continue** — final revision step uses the new Primary AI

---

## Accounts Panel (🔑)

Click the **🔑 key icon** in the top-right of the title bar at any time.

### 🔑 Accounts tab

- Shows real-time login status (● logged in / ○ not logged in) for each AI
- **Login** button opens a mini browser window for that AI's login page
- **Re-login** re-authenticates an already-logged-in session
- **Logout** clears only that AI's session cookie
- **Logout All** clears all sessions at once
- Status updates live via `onLoginStatusChanged` IPC event

### ⚡ API Keys tab

- Enter API keys for Gemini, Claude, ChatGPT (OpenAI), Perplexity, Grok, and Groq
- Toggle show / hide masking per key
- Drag-and-drop rows to set provider priority for the recommendation engine
- Click **Save** to persist — order is auto-saved immediately on drop

---

## AI Recommendation Engine

When you type a query (≥ 8 characters) the app debounces for 800 ms and then calls the first available API provider in your configured key order.  
A banner appears below the query input:

- **Loading state** — spinner + "Analyzing query…"
- **Result state** — recommended AI badge, reason, and an **Apply** button

Click **Apply** (or the chip directly) to set the recommended AI as Primary before starting the workflow.

**Fallback logic (no API key configured):** The engine uses keyword rules to pick the most suitable AI — e.g. analysis / documents → Gemini, creative writing → Claude, real-time news → Perplexity, code → ChatGPT.

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
> **🪟 Windows:** `%APPDATA%\ai-council\selectors.json`  
> **🍎 macOS:** `~/Library/Application Support/ai-council/selectors.json`

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
| AI inference (recommendation) | Gemini · Claude · OpenAI · Perplexity · Grok · Groq APIs |
