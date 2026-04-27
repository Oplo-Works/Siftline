/**
 * Serial message queue for incoming Telegram messages.
 *
 * Why serial?  Two messages in flight against the same Council Chat session
 * would interleave AI responses unpredictably and confuse the conversation
 * state.  Mirroring the desktop UX where the user sends one message at a
 * time keeps behavior deterministic.
 *
 * The queue accepts handler functions (work units) and runs them one at a
 * time, FIFO.  If an item is enqueued while one is running, it waits.  If
 * the running item rejects, we still pull the next one — failures of one
 * message must not block the bot.
 */

type Job = () => Promise<void>

export class SerialQueue {
  private chain: Promise<void> = Promise.resolve()
  private pending = 0

  /** Enqueue a job.  Returns a promise that settles when *this* job finishes. */
  enqueue(job: Job): Promise<void> {
    this.pending++
    const next = this.chain.then(
      () => job().catch((err) => {
        // Swallow — caller is expected to log; we just keep the chain alive.
        // eslint-disable-next-line no-console
        console.error('[telegram-queue] job failed:', err)
      }).finally(() => {
        this.pending--
      })
    )
    this.chain = next
    return next
  }

  /** Number of jobs currently queued (running + waiting). */
  get size(): number {
    return this.pending
  }

  /** True if at least one job is in flight. */
  get busy(): boolean {
    return this.pending > 0
  }

  /** Wait until all currently-queued jobs finish (does not block new enqueues). */
  drain(): Promise<void> {
    return this.chain
  }
}
