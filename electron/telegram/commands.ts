import {
  apiResetCouncilRoom,
  apiSaveCouncilSnapshot,
  apiGetCouncilSnapshots,
  apiLoadCouncilSnapshot,
  apiSendCouncilMessage,
  apiSwitchInteractionModeToWorkflow,
  apiGetCouncilRoom,
  apiCheckAiSessions,
  AI_DISPLAY_NAMES,
} from '../main.js'
import { parseCouncilIntent, getSequentialCouncilTargets } from '../councilPrompt.js'
import type { AiName } from '../councilPrompt.js'
import { beginCouncilSession, endCouncilSession } from './bridge.js'

interface TelegramAttachedFile {
  name: string
  path: string
  ext: string
}

export async function handleTelegramCommand(
  text: string,
  sendMessage: (text: string) => Promise<void>,
  attachedFiles: TelegramAttachedFile[] = [],
  chatId: string = '',
) {
  const normalizedText = text.trim()
  const [command, ...args] = normalizedText.length > 0 ? normalizedText.split(/\s+/) : ['']
  const lowerCmd = command.toLowerCase()
  const attachmentSummary = attachedFiles.length > 0
    ? `${attachedFiles.length} attachment${attachedFiles.length === 1 ? '' : 's'}`
    : ''

  try {
    if (lowerCmd === '/new') {
      apiResetCouncilRoom()
      await sendMessage('Started a new Council Chat session.')
    } else if (lowerCmd === '/save') {
      const title = args.join(' ')
      apiSaveCouncilSnapshot(title)
      await sendMessage(`Saved session${title ? ` as "${title}"` : ''}.`)
    } else if (lowerCmd === '/save_and_new') {
      const title = args.join(' ')
      apiSaveCouncilSnapshot(title)
      apiResetCouncilRoom()
      await sendMessage(`Saved session${title ? ` as "${title}"` : ''} and started a new one.`)
    } else if (lowerCmd === '/sessions') {
      const snapshots = apiGetCouncilSnapshots()
      if (snapshots.length === 0) {
        await sendMessage('No saved sessions.')
        return
      }
      const list = snapshots.slice(0, 10).map((s, i) => `${i + 1}. ${s.title} (ID: ${s.id})`).join('\n')
      await sendMessage(`Saved Sessions:\n${list}\n\nUse /load <id> to load a session.`)
    } else if (lowerCmd === '/load') {
      const id = args[0]
      if (!id) {
        await sendMessage('Please provide a session ID.')
        return
      }
      const result = apiLoadCouncilSnapshot(id)
      if (result) {
        await sendMessage(`Session "${result.room.messages.length > 0 ? 'Loaded' : 'Empty'}" loaded successfully.`)
      } else {
        await sendMessage('Session not found.')
      }
    } else if (lowerCmd === '/workflow') {
      apiSwitchInteractionModeToWorkflow()
      await sendMessage('Switched to Workflow mode using the current session context.')
    } else if (lowerCmd === '/status') {
      const room = apiGetCouncilRoom()
      await sendMessage(`Status:\nPrimary AI: ${room.primaryAi}\nMessages: ${room.messages.length}\nParticipants: ${room.participants.join(', ')}`)
    } else if (lowerCmd === '/help') {
      await sendMessage(
        'Available commands:\n'
        + '/new - Start a new session\n'
        + '/save [title] - Save current session\n'
        + '/save_and_new [title] - Save and start new\n'
        + '/sessions - List saved sessions\n'
        + '/load <id> - Load a session\n'
        + '/workflow - Send to Workflow\n'
        + '/status - Show current status'
      )
    } else if (lowerCmd.startsWith('/')) {
      await sendMessage('Unknown command. Use /help to see available commands.')
    } else {
      const room = apiGetCouncilRoom()
      const intent = parseCouncilIntent(normalizedText)
      const allAiNames = Object.keys(AI_DISPLAY_NAMES) as readonly AiName[]

      let ack: string
      let willRunTurns = false
      let liveTargets: AiName[] = []

      if (!intent || intent.kind === 'none') {
        ack = attachmentSummary
          ? `Added ${attachmentSummary} to the shared transcript. Mention one active AI like @Gemini, or use @all for sequential council replies.`
          : 'Message added to the shared transcript. Mention one active AI like @Gemini, or use @all for sequential council replies.'
      } else if (intent.kind === 'unsupported') {
        ack = intent.note
      } else {
        const targets: AiName[] = intent.kind === 'all'
          ? (intent.targetAis && intent.targetAis.length > 0
              ? intent.targetAis
              : getSequentialCouncilTargets(room.participants as AiName[], room.primaryAi as AiName, allAiNames))
          : intent.targetAi
            ? [intent.targetAi]
            : []

        if (targets.length === 0) {
          ack = 'No valid active AI target was found for this message.'
        } else {
          const inactive = targets.find((ai) => !room.participants.includes(ai))
          if (inactive) {
            ack = `${AI_DISPLAY_NAMES[inactive]} is not active right now. Activate that AI first, then try again.`
          } else {
            // Pre-flight session health check.  Probes each target AI's
            // BrowserView for a usable composer before kicking off the
            // broadcast.  Logged-out / captcha-stuck AIs are skipped with a
            // notice instead of stalling the whole turn at the broadcast
            // timeout.
            const health = await apiCheckAiSessions(targets)
            const okTargets = targets.filter((ai) => health[ai] === 'ok')
            const blockedTargets = targets.filter((ai) => health[ai] !== 'ok')

            if (blockedTargets.length > 0) {
              const blockedSummary = blockedTargets
                .map((ai) => {
                  const reason = health[ai] === 'no-view' ? 'panel inactive' : 'login/captcha needed'
                  return `${AI_DISPLAY_NAMES[ai]} (${reason})`
                })
                .join(', ')
              await sendMessage(`Pre-flight check skipped: ${blockedSummary}`)
            }

            if (okTargets.length === 0) {
              ack = 'No AI session is currently usable. Please log in to at least one AI in the desktop app, then retry.'
            } else {
              const names = okTargets.map((ai) => AI_DISPLAY_NAMES[ai]).join(', ')
              ack = attachmentSummary
                ? `Adding to Council Chat with ${attachmentSummary} - waiting for ${names}...`
                : `Adding to Council Chat - waiting for ${names}...`
              willRunTurns = true
              liveTargets = okTargets
            }
          }
        }
      }

      await sendMessage(ack)

      if (willRunTurns && liveTargets.length > 0 && chatId) {
        // Begin the streaming session BEFORE the council call so the status
        // checklist message exists by the time per-AI replies start arriving.
        await beginCouncilSession({
          chatId,
          targets: liveTargets,
          displayNames: AI_DISPLAY_NAMES as Record<string, string>,
        })

        apiSendCouncilMessage(normalizedText, attachedFiles)
          .catch((err) => {
            console.error('[Telegram] Error during council turn:', err)
          })
          .finally(() => {
            endCouncilSession().catch((err) =>
              console.error('[Telegram] Failed to finalize council session:', err)
            )
          })
      } else {
        apiSendCouncilMessage(normalizedText, attachedFiles).catch((err) => {
          console.error('[Telegram] Error recording council message:', err)
        })
      }
    }
  } catch (err) {
    await sendMessage(`Error: ${err instanceof Error ? err.message : String(err)}`)
  }
}
