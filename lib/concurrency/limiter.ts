/** Error thrown when a concurrency limiter queue is full. @source */
export class ConcurrencyLimitError extends Error {
  retryAfterMs: number

  constructor(message: string, retryAfterMs: number) {
    super(message)
    this.name = "ConcurrencyLimitError"
    this.retryAfterMs = retryAfterMs
  }
}

/** Options for creating an in-process concurrency limiter. @source */
export type ConcurrencyLimiterOptions = {
  /** Maximum number of concurrent tasks. @source */
  concurrency: number
  /** Maximum number of queued tasks before rejecting. @source */
  maxQueue?: number
  /** Suggested retry-after delay when rejecting (ms). @source */
  retryAfterMs?: number
}

/**
 * Simple in-process FIFO concurrency limiter with bounded queueing.
 * Useful for protecting CPU-heavy work (e.g., sharp) in a single instance.
 * @source
 */
export class ConcurrencyLimiter {
  private readonly concurrency: number
  private readonly maxQueue: number
  private readonly retryAfterMs: number
  private activeCount = 0
  private readonly queue: Array<() => void> = []

  constructor(options: ConcurrencyLimiterOptions) {
    const concurrency = Math.floor(options.concurrency)
    if (!Number.isFinite(concurrency) || concurrency <= 0) {
      throw new Error("ConcurrencyLimiter requires concurrency > 0")
    }

    this.concurrency = concurrency
    this.maxQueue = Math.max(0, Math.floor(options.maxQueue ?? 0))
    this.retryAfterMs = Math.max(0, Math.floor(options.retryAfterMs ?? 1000))
  }

  private release() {
    this.activeCount = Math.max(0, this.activeCount - 1)
    const next = this.queue.shift()
    if (next) {
      next()
    }
  }

  private async acquire() {
    if (this.activeCount < this.concurrency) {
      this.activeCount += 1
      return
    }

    if (this.maxQueue > 0 && this.queue.length >= this.maxQueue) {
      throw new ConcurrencyLimitError(
        "Server is busy, please retry",
        this.retryAfterMs
      )
    }

    await new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.activeCount += 1
        resolve()
      })
    })
  }

  /**
   * Runs a task under the limiter.
   * @param task - Async task to execute.
   * @returns The task result.
   * @throws ConcurrencyLimitError when queue is full.
   * @source
   */
  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await task()
    } finally {
      this.release()
    }
  }
}

/**
 * Client-safe drop-in replacement for `Promise.allSettled` that limits the
 * number of concurrent in-flight promises to `concurrency` (default 5).
 *
 * Unlike `ConcurrencyLimiter` (which is stateful and server-side), this is a
 * stateless utility safe to call from React hooks or client-side code.
 *
 * @param tasks - Array of zero-arg async factories to execute.
 * @param concurrency - Maximum simultaneous in-flight tasks (default 5).
 * @returns Settled results in input order, matching `Promise.allSettled` shape.
 * @source
 */
export async function batchedAllSettled<T>(
  tasks: ReadonlyArray<() => Promise<T>>,
  concurrency = 5
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length)
  let nextIndex = 0

  const worker = async () => {
    while (nextIndex < tasks.length) {
      const index = nextIndex++
      const task = tasks[index]
      if (!task) continue
      try {
        const value = await task()
        results[index] = { status: "fulfilled", value }
      } catch (error_) {
        results[index] = { status: "rejected", reason: error_ }
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    worker
  )
  await Promise.all(workers)
  return results
}
