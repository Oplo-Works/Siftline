import {
  apiResetCouncilRoom,
  apiSaveCouncilSnapshot,
  apiGetCouncilSnapshots,
  apiLoadCouncilSnapshot,
  apiSendCouncilMessage,
  apiSwitchInteractionModeToWorkflow,
  apiGetCouncilRoom,
  AI_DISPLAY_NAMES,
} from '../main.js'
import { parseCouncilIntent, getSequentialCouncilTargets } from '../councilPrompt.js'
import type { AiName } from '../councilPrompt.js'

export type TelegramAttachedFile = {
  name: string
  path: string
  /** Lowercase extension without dot, e.g. 'pdf', 'jpg'. Empty when unknown. */
  ext: string
}

export async function handleTelegramCommand(
  text: string,
  sendMessage: (text: string) => Promise<void>,
  attachedFiles: TelegramAttachedFile[] = []
): Promise<void> {
  const [command, ...args] = text.trim().split(/\s+/)
  const lowerCmd = command.toLowerCase()

  try {
    if (lowerCmd === '/new') {
      apiResetCouncilRoom()
      await sendMessage('✅ Started a new Council Chat session.')
    } else if (lowerCmd === '/save') {
      const title = args.join(' ')
      apiSaveCouncilSnapshot(title)
      await sendMessage(`✅ Saved session${title ? ` as "${title}"` : ''}.`)
    } else if (lowerCmd === '/save_and_new') {
      const title = args.join(' ')
      apiSaveCouncilSnapshot(title)
      apiResetCouncilRoom()
      await sendMessage(`✅ Saved session${title ? ` as "${title}"` : ''} and started a new one.`)
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
        await sendMessage('❌ Please provide a session ID.')
        return
      }
      const result = apiLoadCouncilSnapshot(id)
      if (result) {
        await sendMessage(`✅ Session "${result.room.messages.length > 0 ? 'Loaded' : 'Empty'}" loaded successfully.`)
      } else {
        await sendMessage('❌ Session not found.')
      }
    } else if (lowerCmd === '/workflow') {
      apiSwitchInteractionModeToWorkflow()
      await sendMessage('✅ Switched to Workflow mode using the current session context.')
    } else if (lowerCmd === '/status') {
      const room = apiGetCouncilRoom()
      await sendMessage(`Status:\nPrimary AI: ${room.primaryAi}\nMessages: ${room.messages.length}\nParticipants: ${room.participants.join(', ')}`)
    } else if (lowerCmd === '/help') {
      await sendMessage(
        'Available commands:\n' +
        '/new - Start a new session\n' +
        '/save [title] - Save current session\n' +
        '/save_and_new [title] - Save and start new\n' +
        '/sessions - List saved sessions\n' +
        '/load <id> - Load a session\n' +
        '/workflow - Send to Workflow\n' +
        '/status - Show current status'
      )
    } else {
      if (lowerCmd.startsWith('/')) {
        await sendMessage('❌ Unknown command. Use /help to see available commands.')
      } else {
        // Decide ack message DETERMINISTICALLY by parsing the intent ourselves
        // and checking the room state directly — no 50ms race against
        // apiSendCouncilMessage's internal state mutations.
        const room = apiGetCouncilRoom()
        const intent = parseCouncilIntent(text)
        const allAiNames = Object.keys(AI_DISPLAY_NAMES) as readonly AiName[]

        let ack: string
        let willRunTurns = false

        if (!intent || intent.kind === 'none') {
          ack = '✅ Message added to the shared transcript. Mention one active AI like @Gemini, or use @all for sequential council replies.'
        } else if (intent.kind === 'unsupported') {
          ack = `❌ ${intent.note}`
        } else {
          const targets: AiName[] = intent.kind === 'all'
            ? getSequentialCouncilTargets(room.participants as AiName[], room.primaryAi as AiName, allAiNames)
            : intent.targetAi
              ? [intent.targetAi]
              : []

          if (targets.length === 0) {
            ack = '❌ No valid active AI target was found for this message.'
          } else {
            const inactive = targets.find((ai) => !room.participants.includes(ai))
            if (inactive) {
              ack = `❌ ${AI_DISPLAY_NAMES[inactive]} is not active right now. Activate that AI first, then try again.`
            } else {
              const names = targets.map((ai) => AI_DISPLAY_NAMES[ai]).join(', ')
              ack = `⏳ Adding to Council Chat — waiting for ${names}...`
              willRunTurns = true
            }
          }
        }

        await sendMessage(ack)

        if (willRunTurns) {
          // When files are attached the caller (bridge) needs to know when the
          // turn has fully consumed them so it can clean up temp files, so we
          // await in that case; otherwise keep the original fire-and-forget
          // behaviour so the ack doesn't block.
          if (attachedFiles.length > 0) {
            try {
              await apiSendCouncilMessage(text, attachedFiles)
            } catch (err) {
              console.error('[Telegram] Error during council turn:', err)
            }
          } else {
            apiSendCouncilMessage(text).catch((err) => {
              console.error('[Telegram] Error during council turn:', err)
            })
          }
        } else {
          // Still record the user message in the transcript so the desktop UI
          // and saved sessions stay in sync, even when no AI was triggered.
          apiSendCouncilMessage(text, attachedFiles).catch((err) => {
            console.error('[Telegram] Error recording council message:', err)
          })
        }
      }
    }
  } catch (err) {
    await sendMessage(`❌ Error: ${err instanceof Error ? err.message : String(err)}`)
  }
}
