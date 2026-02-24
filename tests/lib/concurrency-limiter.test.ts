import { describe, expect, it } from "bun:test"

import {
  batchedAllSettled,
  ConcurrencyLimiter,
  ConcurrencyLimitError
} from "@/lib/concurrency/limiter"

// ─── ConcurrencyLimitError ─────────────────────────────────────────────────

describe("ConcurrencyLimitError", () => {
  it("exposes name, message and retryAfterMs", () => {
    const err = new ConcurrencyLimitError("busy", 1000)
    expect(err.name).toBe("ConcurrencyLimitError")
    expect(err.message).toBe("busy")
    expect(err.retryAfterMs).toBe(1000)
    expect(err).toBeInstanceOf(Error)
  })
})

// ─── ConcurrencyLimiter constructor ────────────────────────────────────────

describe("ConcurrencyLimiter – constructor", () => {
  it("throws when concurrency is 0", () => {
    expect(() => new ConcurrencyLimiter({ concurrency: 0 })).toThrow()
  })

  it("throws when concurrency is negative", () => {
    expect(() => new ConcurrencyLimiter({ concurrency: -1 })).toThrow()
  })

  it("throws when concurrency is not finite", () => {
    expect(() => new ConcurrencyLimiter({ concurrency: Infinity })).toThrow()
  })

  it("accepts valid concurrency and optional parameters", () => {
    expect(
      () =>
        new ConcurrencyLimiter({
          concurrency: 2,
          maxQueue: 10,
          retryAfterMs: 2000
        })
    ).not.toThrow()
  })
})

// ─── ConcurrencyLimiter.run ────────────────────────────────────────────────

describe("ConcurrencyLimiter – run", () => {
  it("runs a task and returns its result", async () => {
    const limiter = new ConcurrencyLimiter({ concurrency: 1 })
    const result = await limiter.run(async () => 42)
    expect(result).toBe(42)
  })

  it("propagates task errors", async () => {
    const limiter = new ConcurrencyLimiter({ concurrency: 1 })
    await expect(
      limiter.run(async () => {
        throw new Error("task failed")
      })
    ).rejects.toThrow("task failed")
  })

  it("releases the slot after a successful task so subsequent tasks can run", async () => {
    const limiter = new ConcurrencyLimiter({ concurrency: 1 })
    await limiter.run(async () => "first")
    // If the slot were not released, this would hang forever
    const result = await limiter.run(async () => "second")
    expect(result).toBe("second")
  })

  it("releases the slot even when the task throws", async () => {
    const limiter = new ConcurrencyLimiter({ concurrency: 1 })
    await expect(
      limiter.run(async () => {
        throw new Error("oops")
      })
    ).rejects.toThrow()

    // Slot must be free — calling run again should not hang
    const result = await limiter.run(async () => "after error")
    expect(result).toBe("after error")
  })

  it("enforces the concurrency limit", async () => {
    const limiter = new ConcurrencyLimiter({ concurrency: 2 })
    let active = 0
    let maxConcurrent = 0

    const task = async () => {
      active++
      maxConcurrent = Math.max(maxConcurrent, active)
      await new Promise<void>((r) => setTimeout(r, 10))
      active--
    }

    await Promise.all(Array.from({ length: 6 }, () => limiter.run(task)))
    expect(maxConcurrent).toBeLessThanOrEqual(2)
  })

  it("queues tasks beyond the concurrency limit and runs them in order", async () => {
    const limiter = new ConcurrencyLimiter({ concurrency: 1 })
    const order: number[] = []

    const makeTask = (n: number) => async () => {
      await new Promise<void>((r) => setTimeout(r, 5))
      order.push(n)
    }

    await Promise.all([1, 2, 3].map((n) => limiter.run(makeTask(n))))
    expect(order).toEqual([1, 2, 3])
  })
})

// ─── ConcurrencyLimiter – queue overflow ──────────────────────────────────
// Use pre-created Promises so resolvers are available immediately (before
// the limiter actually starts executing the task function).

describe("ConcurrencyLimiter – queue overflow", () => {
  it("throws ConcurrencyLimitError when maxQueue is exceeded", async () => {
    const limiter = new ConcurrencyLimiter({
      concurrency: 1,
      maxQueue: 1,
      retryAfterMs: 500
    })

    let resolve1!: () => void
    let resolve2!: () => void
    const blocked1 = new Promise<void>((r) => {
      resolve1 = r
    })
    const blocked2 = new Promise<void>((r) => {
      resolve2 = r
    })

    // Slot 1 running, slot 2 queued (maxQueue: 1)
    const p1 = limiter.run(() => blocked1)
    const p2 = limiter.run(() => blocked2)

    // Third call must overflow the queue
    await expect(limiter.run(async () => {})).rejects.toBeInstanceOf(
      ConcurrencyLimitError
    )

    // Unblock both tasks so the test doesn't hang
    resolve1()
    resolve2()
    await Promise.all([p1, p2])
  })

  it("ConcurrencyLimitError carries the retryAfterMs from options", async () => {
    const limiter = new ConcurrencyLimiter({
      concurrency: 1,
      maxQueue: 1,
      retryAfterMs: 1234
    })

    let resolve1!: () => void
    let resolve2!: () => void
    const blocked1 = new Promise<void>((r) => {
      resolve1 = r
    })
    const blocked2 = new Promise<void>((r) => {
      resolve2 = r
    })

    const p1 = limiter.run(() => blocked1)
    const p2 = limiter.run(() => blocked2)

    try {
      await limiter.run(async () => {})
    } catch (e) {
      expect(e).toBeInstanceOf(ConcurrencyLimitError)
      expect((e as ConcurrencyLimitError).retryAfterMs).toBe(1234)
    }

    resolve1()
    resolve2()
    await Promise.all([p1, p2])
  })
})

// ─── batchedAllSettled ─────────────────────────────────────────────────────

describe("batchedAllSettled", () => {
  it("fulfils all tasks", async () => {
    const tasks = [async () => 1, async () => 2, async () => 3]
    const results = await batchedAllSettled(tasks)
    expect(results).toHaveLength(3)
    expect(results[0]).toEqual({ status: "fulfilled", value: 1 })
    expect(results[1]).toEqual({ status: "fulfilled", value: 2 })
    expect(results[2]).toEqual({ status: "fulfilled", value: 3 })
  })

  it("captures rejected tasks without throwing", async () => {
    const tasks = [
      async () => "ok",
      async (): Promise<string> => {
        throw new Error("fail")
      }
    ]
    const results = await batchedAllSettled(tasks)
    expect(results[0]).toEqual({ status: "fulfilled", value: "ok" })
    expect(results[1]?.status).toBe("rejected")
    expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(Error)
  })

  it("preserves result order regardless of completion order", async () => {
    const tasks = [
      async () => {
        await new Promise((r) => setTimeout(r, 20))
        return "slow"
      },
      async () => {
        await new Promise((r) => setTimeout(r, 5))
        return "fast"
      }
    ]
    const results = await batchedAllSettled(tasks)
    expect((results[0] as PromiseFulfilledResult<string>).value).toBe("slow")
    expect((results[1] as PromiseFulfilledResult<string>).value).toBe("fast")
  })

  it("handles an empty task array", async () => {
    const results = await batchedAllSettled([])
    expect(results).toEqual([])
  })

  it("limits concurrency to the given value", async () => {
    let active = 0
    let maxActive = 0

    const tasks = Array.from({ length: 8 }, () => async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise<void>((r) => setTimeout(r, 10))
      active--
      return true
    })

    await batchedAllSettled(tasks, 3)
    expect(maxActive).toBeLessThanOrEqual(3)
  })

  it("defaults to concurrency of 5", async () => {
    let active = 0
    let maxActive = 0

    const tasks = Array.from({ length: 10 }, () => async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise<void>((r) => setTimeout(r, 10))
      active--
      return true
    })

    await batchedAllSettled(tasks)
    expect(maxActive).toBeLessThanOrEqual(5)
  })

  it("handles mixed fulfilled and rejected results correctly", async () => {
    const tasks = [
      async () => "a",
      async (): Promise<string> => {
        throw new Error("err-b")
      },
      async () => "c",
      async (): Promise<string> => {
        throw new Error("err-d")
      },
      async () => "e"
    ]

    const results = await batchedAllSettled(tasks)
    expect(results[0]).toEqual({ status: "fulfilled", value: "a" })
    expect(results[1]?.status).toBe("rejected")
    expect(results[2]).toEqual({ status: "fulfilled", value: "c" })
    expect(results[3]?.status).toBe("rejected")
    expect(results[4]).toEqual({ status: "fulfilled", value: "e" })
  })
})
