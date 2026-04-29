# I Gave 6 AIs a Group Chat. They Started Arguing With Each Other.

*AI Council v1.0.7 is out. Here's what's new — and why it changes everything about how I use multiple AIs.*

**MINKYU THE BUILDER**
APR 25, 2026

---

If you read the last post, you know the premise: AI Council puts 5 AI models in the same session and makes them review each other's work. One AI answers first. The others fact-check it. The first one rewrites with all that feedback incorporated.

That workflow still exists. And it still works exactly as described.

But something kept bothering me.

The structured review — Primary AI drafts, Reviewers critique, Primary revises — is great when you know what you're asking. But what about when you *don't* know exactly what you want? What about when you need to think out loud? What about when the question itself needs to evolve through the conversation?

There was no good answer for that. Until now.

**v1.0.7 adds Council Chat Mode — a free-form group chat with all your AIs at once.**

This one changes how the whole thing feels.

---

## What's New in v1.0.7

Here's everything that landed in this release.

### 💬 Council Chat Mode

The headline feature. Instead of the structured 3-step review workflow, you now have a second mode: a real-time group chat with all your active AIs simultaneously.

Think of it like a WhatsApp group — except every participant is a different AI model.

You type a message. You can send it to one specific AI with `@Claude` or `@Gemini` — or you can broadcast to all of them at once with `@all`. Each response appears as a chat bubble, left-right aligned like a modern messaging app. You can follow up. Ask for clarification. Watch them disagree with each other. Push back on one while leaving the others to continue.

This is not the structured review flow. This is genuinely open-ended conversation — with 6 AIs at the same time.

### 🔀 Dual Interaction Mode

The app now has two distinct modes, and you can switch between them at any point:

- **Workflow** — the structured 3-step cross-review (Primary drafts → Reviewers critique → Primary revises). Exactly as before.
- **Council Chat** — the new free-form group discussion mode.

The toolbar toggle switches between them. And crucially: context carries across both sides. You can start a Council Chat to brainstorm and then hand the whole thing off to a Workflow session for a formal structured review.

### 💾 Saved Sessions (Snapshots)

Council Chat sessions can now be saved and reloaded later. Full lifecycle management: favorites, labels, notes, archive, bulk-delete. You can also export sessions as JSON and import them back — or duplicate a session to run variants of the same conversation.

If you've ever lost a good AI conversation because you closed a tab, this is for you.

### 🎯 AI Moderator

This is the one I didn't know I needed.

While a Council Chat is running, the AI Moderator watches the conversation in real time. It surfaces three things:

1. A **consensus summary** — what all the AIs seem to agree on so far
2. A **next speaker suggestion** — which AI should probably respond next based on the flow of the conversation
3. A **suggested follow-up prompt** — a question you can fire immediately or edit and send

When five AIs are talking at once and you're trying to track where they agree and where they diverge, having a sixth voice synthesizing the thread in real time is genuinely useful.

### 🔗 Workflow Handoff

One click moves your entire Council Chat transcript — or a single pinned reply — into the Workflow query box as a structured seed prompt.

The practical use case: start in Chat mode to get a rough answer or explore a question with the group, then hand the most useful response off to Workflow for a formal structured review with revision cycles. The two modes now connect to each other.

### 🧭 Reviewer Role Preview

Small but useful. In Workflow mode, before you click "Next" to send the draft to reviewers, the toolbar now shows a short "Reviewer focus" summary for each active AI — so you can see what angle each one will take before the review starts.

---

## Why Council Chat Changes How I Use This

The original workflow is designed for when you have a clear question and want a rigorously verified answer.

Council Chat is designed for everything before that.

- Brainstorming where the question isn't formed yet
- Sense-checking an idea without committing to a full review cycle
- Exploring a decision space where you want multiple perspectives to push back on each other freely
- Working through a problem out loud with AIs that have different priors

In practice, I've been starting most sessions in Chat mode now — getting a feel for what different models emphasize — and then either staying there if the conversation is enough, or handing off to Workflow when I want the structured, verified final answer.

The two modes aren't alternatives. They're a pipeline.

---

## What's Still the Same

Everything from v1.0.6 is still here:

- 🖥 **5–6 AI models in one session** — Gemini, Claude, ChatGPT, Perplexity, Grok, and Groq (with API key)
- 🧠 **AI Recommendation Engine** — suggests which AI should be Primary as you type, with reasoning
- 🔑 **API Keys (optional)** — store keys for all 6 providers; drag to set priority; unlocks Groq and deeper analysis
- 🔀 **Mid-Workflow AI Switching** — switch the Primary at any pause point without starting over
- 📎 **File Attachment** — upload documents for all AIs to analyze together
- 💰 **Free accounts still work** — uses your existing browser sessions, no API keys required
- 🖥 **Windows & macOS** — native desktop app, data stays on your machine
- 🔓 **Open source** — full code on GitHub

---

## Setup Guide — Download v1.0.7

Go to the GitHub repository: [https://github.com/MinkyuTheBuilder/ai-council](https://github.com/MinkyuTheBuilder/ai-council)

Click **Releases** on the right side of the page. Download the latest version for your operating system.

- **Windows:** download the `.exe` file
- **macOS:** download the `.dmg` file

### 🖥 Windows

When you run the `.exe` file, Windows will show a blue "Windows protected your PC" warning.

1. Click **"More info"**
2. Click **"Run anyway"**

### 🍎 macOS (Fixing the "Damaged" Error)

If you see an error saying "*AI Council* is damaged and can't be opened," follow these steps to bypass Apple's Gatekeeper:

1. **Install First:** Open the `.dmg` file and drag the *AI Council* icon into your Applications folder.
2. **Open Terminal:** Press Command (⌘) + Space, type Terminal, and hit Enter.
3. **Run Command:** Copy and paste the line below into Terminal and hit Enter:
   ```bash
   xattr -cr "/Applications/AI Council.app"
   ```
4. **Enter Password:** If prompted, type your Mac login password and hit Enter. *(You won't see any characters as you type — this is normal.)*
5. **Launch:** Go to your Applications folder and double-click *AI Council*. It will now open perfectly. ✅

*(If it still hesitates, right-click the app icon and select "Open.")*

> **Why this is safe:** The full source code is public on GitHub. Every single line is open-sourced so you can verify exactly what the app does. The warning exists because I'm an independent builder, not a multi-billion dollar corporation with a paid Apple/Microsoft certificate.

---

## How to Use Council Chat

Once you're in the app:

1. Click the **Workflow / Council Chat** toggle in the toolbar to switch to Chat mode.
2. Select which AIs you want in the conversation using the Active chips.
3. Type your message. Use `@all` to message everyone at once, or `@Claude`, `@Gemini`, etc. to address a specific AI.
4. Watch the responses come in as chat bubbles.
5. Follow up, push back, or ask a specific AI to respond to another one's answer.
6. When you're ready, either continue in Chat or hit **Workflow Handoff** to move the conversation into a structured review cycle.

That's it.

---

## What's Coming Next

A full video walkthrough of the Council Chat mode — live session with a real question, showing how the AIs interact when they can respond to each other freely, and where the AI Moderator makes the biggest difference.

Subscribers get early access.

---

## One Ask

If you try Council Chat and something surprises you — a disagreement between AIs, an angle you didn't expect, a useful thing the Moderator surfaced — reply to this email and tell me what happened.

I read every reply. What you send me is literally what gets built next.

See you in the next one.

— Minkyu
