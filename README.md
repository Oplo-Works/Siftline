# AI Council

> Manual cross-verification workflow **and** free-form group discussion among up to 6 major LLMs using Electron BrowserViews and UI automation.

---

## ✨ What's New in v1.0.8

| Feature | Description |
|---------|-------------|
| 📱 **Telegram Integration** | Control AI Council from your smartphone via a Telegram bot. Send messages, @mention specific AIs, and manage sessions — all from the Telegram app while the desktop app runs in the background. |
| 🔵 **DeepSeek Support** | DeepSeek (`chat.deepseek.com`) replaces Groq as the 6th AI panel. DeepSeek is a high-quality open-weight model strong on reasoning, coding, and concise synthesis. |
| 🤖 **Telegram Slash Commands** | Full session management via Telegram: `/new`, `/save`, `/save_and_new`, `/sessions`, `/load`, `/workflow`, `/status`, `/help`. |
| 🔒 **Secure Token Storage** | Telegram bot token and chat ID are stored in an encrypted `electron-store` file — they never leave your machine and never appear in logs. |
| ◉ **Telegram Status Indicator** | When the Telegram bot is active, a `◉ Telegram` indicator lights up in the status bar at the bottom of the app. |

---

## Previous Highlights (v1.0.7)

| Feature | Description |
|---------|-------------|
| 💬 **Council Chat Mode** | Brand-new group-chat panel alongside the existing Workflow mode. Send a message to one AI with `@Gemini` or broadcast to everyone with `@all`. Bubble-style UI with left/right alignment mirrors modern messaging apps. |
| 🔀 **Dual Interaction Mode** | Switch seamlessly between **Workflow** (structured 3-step review) and **Council Chat** (free-form discussion). The toolbar mode toggle carries context across both sides. |
| 💾 **Saved Sessions (Snapshots)** | Save any Council Chat session and reload it later. Full lifecycle management: favorites, labels, notes, archive, bulk-delete, export/import as JSON, and duplicate. |
| 🎯 **AI Moderator** | Real-time analysis of the conversation — surfaces a consensus summary, identifies who should speak next, and generates a suggested follow-up prompt you can apply or send immediately. |
| 📌 **Candidate Pinning & Comparison** | Pin strong AI replies as candidates. The Compare panel shows a side-by-side diff. Pin two or more to generate a **merged draft** that blends the best ideas before handing off to Workflow. |
| 🔗 **Workflow Handoff** | One click moves the entire Council Chat transcript (or a single pinned reply) into the Workflow query box as a structured seed prompt. |
| 🤖 **Response Language Detection** | The app automatically detects the language used in your message and instructs every AI to reply in the same language (Korean, Japanese, Chinese, Arabic, and more). |
| 💾 **Auto-Save** | The active Council session is auto-saved 3 seconds after any change so you never lose a conversation. |

---

## Supported AI Services

| Icon | AI | URL |
|------|-----|-----|
| ✦ | Gemini | gemini.google.com |
| ◎ | Claude | claude.ai |
| ⊕ | ChatGPT | chatgpt.com |
| 🔵 | DeepSeek | chat.deepseek.com |
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

## 📱 Telegram Integration

AI Council can be controlled from your smartphone via a Telegram bot. The bot connects directly to the running desktop app using Telegram's long-poll API — **no server, no ngrok, no open ports required**.

### How it works

The Electron main process runs a long-poll loop (`getUpdates`) that listens for incoming Telegram messages. When a message arrives, the app routes it to the active Council Chat session exactly as if you had typed it on the desktop. AI replies are sent back to your Telegram chat via `sendMessage`.

### Step 1 — Create a Telegram bot

1. Open Telegram and search for **@BotFather**.
2. Send `/newbot` and follow the prompts to choose a name and username for your bot.
3. BotFather will reply with a **bot token** that looks like `123456789:AAH...`. Copy it.

### Step 2 — Find your Chat ID

You need your personal Telegram Chat ID so the bot only accepts messages from you.

**Option A — @userinfobot:**  
Open Telegram, search for **@userinfobot**, start it, and it will immediately reply with your Chat ID (a number like `987654321`).

**Option B — From app logs:**  
Enable the bot with any Chat ID first, send a message from Telegram, then open the **📊 Logs** drawer in AI Council. You will see a line like `Telegram: message from chat_id 987654321` — use that number.

### Step 3 — Configure in AI Council

1. Open AI Council on your desktop.
2. Click the **📱 Telegram** button in the title bar.
3. Paste your **Bot Token** into the Bot Token field.
4. Paste your **Chat ID** into the Allowed Chat ID field. Only messages from this ID will be accepted; all others are silently rejected.
5. Toggle **Enable Telegram Bot** ON.
6. Click **Save & Apply**.

The status bar at the bottom of the app will show **◉ Telegram** in green when the bot is active.

### Telegram slash commands

Once connected, send these commands from your Telegram chat:

| Command | Description |
|---------|-------------|
| `/new` | Discard the current session and start a fresh Council Chat |
| `/save [title]` | Save the current session with an optional title |
| `/save_and_new [title]` | Save the current session and immediately start a new one |
| `/sessions` | List your 10 most recent saved sessions (title, date, ID) |
| `/load <id>` | Reload a saved session by its ID |
| `/workflow` | Switch to Workflow mode using the current conversation as context |
| `/status` | Show the current mode, Primary AI, participant count, and message count |
| `/help` | List all available commands |

### Sending messages and @mentions

Any plain-text message you send to the bot is routed to the active Council Chat session:

| Telegram message | Effect |
|-----------------|--------|
| `What are the risks of this approach?` | Sent to the current session; the Primary AI responds |
| `@Gemini explain this in simple terms` | Only Gemini responds |
| `@Claude review my logic` | Only Claude responds |
| `@all summarize what we've decided` | All active AIs respond simultaneously |

### Security notes

- The bot token is stored in an **encrypted** `electron-store` file on your computer — it never appears in logs and is never committed to git.
- Messages from any Chat ID other than the one you configured are **silently rejected** — the bot does not reply and does not log the content.
- The polling loop stores the `lastUpdateId` so that if the app restarts, old messages are not replayed.

### Troubleshooting

| Problem | Fix |
|---------|-----|
| Bot doesn't respond | Check that the app is running and that `◉ Telegram` is lit in the status bar |
| "Unknown command" error | Type the command with a `/` prefix exactly as shown above |
| Bot responds to wrong person | Verify the Chat ID in Settings matches your own ID from @userinfobot |
| Messages replay on restart | Prevented automatically by `lastUpdateId` persistence |
| Multiple app instances open | Only one polling loop can run per bot token — close extra instances |

---

## Architecture

```text
ai-council/
├── electron/
│   ├── main.ts                  # Main process: BrowserViews, IPC, workflow engine, council engine, recommendation engine
│   ├── preload.ts               # Context-isolated API bridge (contextBridge)
│   ├── councilPrompt.ts         # Council Chat prompt builder (system prompts, role injection)
│   ├── preload-chrome-spoof.js  # Chrome identity spoof for OAuth popups
│   ├── preload-en-locale.js     # Locale spoof to ensure AI UIs load in English
│   ├── preload-google-login.js  # Google login flow helper
│   ├── preload-oauth-google-spoof.js  # Google OAuth identity masking
│   ├── selectors.json           # External DOM selector config (updatable without rebuild)
│   └── telegram/
│       ├── api.ts               # Telegram Bot API wrapper (fetch-based, zero extra dependencies)
│       ├── bridge.ts            # Long-poll loop, start/stop, exponential backoff reconnect
│       ├── commands.ts          # Slash-command dispatcher (/new /save /load /sessions /workflow /status /help)
│       ├── formatter.ts         # AI reply → Telegram message chunk splitter (4096-byte limit)
│       └── queue.ts             # Serial message queue (one message processed at a time, FIFO)
├── src/
│   ├── App.tsx                  # Root component: state, IPC subscriptions, dual-mode orchestration
│   ├── types.ts                 # Shared types, constants, global window declarations
│   ├── index.css                # Dark glassmorphism design system
│   ├── responseLanguage.ts      # User language detection → per-prompt language directive
│   ├── councilCandidateCompare.ts  # Candidate pinning, comparison, and merge logic
│   ├── councilModerator.ts      # AI Moderator: consensus + next-speaker + follow-up prompt
│   ├── councilMentions.ts       # @mention parsing and autocomplete logic
│   ├── councilWorkflowHandoff.ts # Council → Workflow transcript bridging
│   └── components/
│       ├── TitleBar.tsx         # Frameless window bar with 🔑 Accounts, 📋 History, 📊 Logs
│       ├── Toolbar.tsx          # Mode toggle + Primary AI selector + query input + recommendation banner
│       ├── StatusBar.tsx        # Live status text with animated progress bar + Telegram indicator
│       ├── PanelGrid.tsx        # Panel headers above embedded BrowserViews (only enabled AIs shown)
│       ├── AccountsPanel.tsx    # Two-tab panel: Accounts (login/logout) + API Keys (key storage & ordering)
│       ├── CouncilChatPanel.tsx # Group-chat panel: messages, sessions, moderator, candidates, snapshot list
│       ├── CouncilMessageBubble.tsx # Bubble-style message component with preview + expand + pin + workflow actions
│       ├── FinalResultPanel.tsx # Collapsible final answer panel + per-file download
│       ├── TelegramSettings.tsx # Telegram bot configuration panel (token, chat ID, enable toggle)
│       ├── LogDrawer.tsx        # Real-time execution logs side drawer
│       ├── HistoryDrawer.tsx    # Persistent chat history side drawer
│       └── UiErrorBoundary.tsx  # React error boundary for graceful UI error isolation
├── google-login.mjs             # Standalone Google account login helper
├── google-login.bat             # Launcher for google-login.mjs
├── claude-login.mjs             # Standalone Claude (claude.ai) login helper
├── claude-login.bat             # Launcher for claude-login.mjs
├── chatgpt-login.mjs            # Standalone ChatGPT login helper
├── chatgpt-login.bat            # Launcher for chatgpt-login.mjs
├── deepseek-login.mjs           # Standalone DeepSeek login helper
├── deepseek-login.bat           # Launcher for deepseek-login.mjs
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
| DeepSeek | `sk-...` | [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) |
| Perplexity | `pplx-...` | [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api) |
| Grok (xAI) | `xai-...` | [console.x.ai](https://console.x.ai/) |

Drag-and-drop the rows to control which provider is tried **first** when analyzing a query.  
API keys are stored in `electron-store` and never sent anywhere except the provider's own API.

#### Alternative — standalone login scripts

If you prefer to log in outside the app, use the batch launchers:

```bash
google-login.bat      # Gemini (Google account)
claude-login.bat      # Claude.ai (including Google OAuth popup)
chatgpt-login.bat     # ChatGPT
deepseek-login.bat    # DeepSeek
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
- You can run the workflow with **2, 3, 4, 5, or 6** AIs simultaneously.
- The **Primary AI** is always active (locked) — it cannot be toggled off.
- On first launch, Gemini, Claude, and ChatGPT open by default; DeepSeek, Perplexity, and Grok start inactive until you enable them.

---

### 4️⃣ Choose your interaction mode

Click the **Workflow / Council Chat** toggle in the toolbar to switch modes:

| Mode | Description |
|------|-------------|
| **Workflow** | Structured 3-step cross-review: Primary draft → Reviewer feedback → Final revision |
| **Council Chat** | Free-form group discussion — send messages to one AI or `@all` simultaneously |

Both modes share the same set of active AIs and can hand context off to each other.

---

### 5️⃣ Run in dev mode (with hot reload)

```bash
npm start
```

---

### 6️⃣ Build and run (production mode)

```bash
npm run build
npx electron .
```

---

### 7️⃣ Package portable EXE (distribution)

```bash
npm run package
```

Creates `release/AI-Council-Portable.exe` — a single executable that runs without installation.

---

### 8️⃣ Create installer EXE — 🪟 Windows (setup program)

```bash
npm run package:installer
```

An NSIS-based installer wizard EXE is created in `release/`.

---

### 9️⃣ Build DMG — 🍎 macOS (distribution)

```bash
# Builds both Intel (x64) and Apple Silicon (arm64) at once
npm run package:mac
```

Two files are created in `release/`: `*-x64.dmg` for Intel Macs and `*-arm64.dmg` for Apple Silicon Macs.

> **On macOS**, run the helper script instead for a guided build:
> ```bash
> bash build-installer.sh
> ```
> The script auto-generates the required `.icns` icon from `.ico` and handles code-signing bypass.

---

> **Requirements:** Node.js v18+, npm v9+

---

## Workflow Mode (Manual 3-Step Control)

The workflow is **manual** — you advance each stage by clicking the action button.

| Stage | Button label | What happens |
|-------|-------------|--------------|
| Idle | **▶ Start** | Sends the query to the Primary AI |
| After Primary answers | **▶▶ Next** | Sends the draft to all active Reviewer AIs simultaneously |
| After all Reviewers answer | **✓ Continue** | Sends all feedback back to Primary AI for final revision |

1. App loads all selected AI websites in BrowserViews
2. Log in via the **🔑 Accounts** panel (or standalone login scripts)
3. Select **Primary AI** and configure **Active** panels (2–6 AIs)
4. Type your question (and optionally attach files), click **▶ Start**
5. Wait for Primary AI's draft → click **▶▶ Next**
6. Wait for all Reviewers to finish → click **✓ Continue**
7. Final revised answer is extracted and displayed in the **Final Result Panel**
8. If you click **Next** again after a final answer, the app can send that answer through another reviewer round
9. If you type a follow-up question in the prompt box, the app keeps the same session when the new question is related
10. If the new question is unrelated, the app automatically resets to a fresh session

### 🔄 Reassigning Primary AI at Pause Points

At both pause points (**▶▶ Next** and **✓ Continue**) the Primary AI chips become interactive.  
Click any chip to switch the Primary AI mid-workflow — the app continues with the newly assigned AI:

- Reassigning at **▶▶ Next** — reviewer step and final revision both use the new Primary AI
- Reassigning at **✓ Continue** — final revision step uses the new Primary AI

### Reviewer Roles

Each AI reviews from a different angle instead of using one generic checklist.

| AI | Reviewer role | Focus |
|----|--------------|-------|
| Claude | Logic and Precision Auditor | Stress-tests reasoning, contradictions, and unsupported leaps |
| Perplexity | Fact Checker and Freshness Monitor | Accuracy, recency-sensitive claims, unsupported statements |
| Grok | Adversarial Critic | Hidden risks, edge cases, counterarguments |
| ChatGPT | Practical UX and Communication Coach | Clarity, tone, and real-world usefulness |
| Gemini | Systems Synthesizer | Big-picture gaps, framing, and audience fit |
| DeepSeek | Concise Alternative Solver | Cleaner routes, sharper summaries, more efficient answers |

When a draft is sent to reviewers, the app briefly shows these roles so it is clear why each AI is being asked to respond.

---

## Council Chat Mode

Council Chat is a free-form group messaging interface — think WhatsApp for AI models.

### Sending messages

| Syntax | Effect |
|--------|--------|
| `@Gemini your question` | Ask only Gemini |
| `@Claude your question` | Ask only Claude |
| `@all your question` | Broadcast to all active AIs simultaneously |
| Plain text (no mention) | The app routes to the most relevant AI based on context |

Each AI reply shows as a chat bubble on the left, user messages on the right. Long responses show a **2-sentence preview** with a **▼ Read More** toggle to expand the full text.

### Saved Sessions

Every conversation can be saved as a **Session Snapshot** and restored at any time.

| Action | Description |
|--------|-------------|
| **Save Session** | Save the current conversation (auto-saves every 3 seconds if changes exist) |
| **Favorites** | Star important sessions for quick access at the top of the list |
| **Labels & Notes** | Tag sessions (e.g. "Research", "Product") and add a short note |
| **Lifecycle** | Mark sessions as *In Progress* or *Completed* |
| **Archive** | Hide sessions from the main list without deleting them |
| **Export / Import** | Share sessions as JSON files between machines |
| **Duplicate** | Clone a session to branch the conversation in a new direction |
| **Bulk Delete** | Delete all sessions matching the current filter at once |

### AI Moderator

The Moderator panel analyzes the conversation in real time and suggests:

- **Consensus** — what the group seems to agree on
- **Next speaker** — which AI should weigh in next and why
- **Follow-up prompt** — a ready-to-send question for the suggested AI

Click **Apply** to paste the prompt into the input box, or **Send Now** to dispatch it immediately.

### Candidate Pinning & Comparison

- **📌 Pin** any AI reply as a candidate answer
- Open the **Candidates** panel to see a side-by-side comparison of all pinned replies
- Select one and click **Use in Workflow** to move it as a seed draft
- Pin two or more replies to generate a **Merged Draft** that synthesizes the best points from each

### Workflow Handoff

| Action | Result |
|--------|--------|
| **Send to Workflow** (header) | Converts the full Council Chat transcript into a Workflow seed prompt |
| **→ Workflow** (per bubble) | Moves a single AI reply as the Workflow starting draft |
| **Use Selected / Use Merged** | Pins a candidate or merged draft and sends it to Workflow |

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

- Enter API keys for Gemini, Claude, ChatGPT (OpenAI), DeepSeek, Per