import { describe, expect, it, mock } from "bun:test"

import { checkAchievements } from "@/lib/achievements/check-achievements"

// ── Supabase mock factory ─────────────────────────────────────────────────
//
// checkAchievements makes the following calls in order:
//   1. from("user_achievements").select("achievement_id").eq("user_id", userId)
//   2. Promise.all([
//        from("volumes").select("id",{count,head}).eq("user_id").eq("ownership_status","owned"),
//        from("volumes").select("id",{count,head}).eq("user_id").eq("reading_status","completed"),
//        from("series").select("id",{count,head}).eq("user_id"),
//      ])
//   3. (if series_complete not already earned)
//      from("volumes").select("series_id,reading_status").eq("user_id").eq("ownership_status","owned")
//   4. from("user_achievements").insert([...])
//   5. for each achievement: from("notifications").insert({...})

type Chain = Promise<unknown> & {
  select: (...args: unknown[]) => Chain
  eq: (...args: unknown[]) => Chain
}

/**
 * Returns a Supabase-style chainable query builder.
 * All chaining methods (.select, .eq, …) return another Chain so the call
 * can be arbitrarily deep. Awaiting the Chain resolves to `result`.
 * We extend a real Promise so we never add `then` to a plain object.
 */
function makeChain(result: unknown): Chain {
  const p = Promise.resolve(result)
  const extended = Object.assign(p, {
    select: (): Chain => makeChain(result),
    eq: (): Chain => makeChain(result)
  })
  return extended
}

interface SupabaseMockOptions {
  earnedAchievements?: { achievement_id: string }[]
  ownedCount?: number
  completedCount?: number
  seriesCount?: number
  /** Volumes returned for the per-series completion sub-query */
  seriesCheckVolumes?: { series_id: string | null; reading_status: string }[]
  insertError?: { message: string } | null
}

function makeSupabase({
  earnedAchievements = [] as { achievement_id: string }[],
  ownedCount = 0,
  completedCount = 0,
  seriesCount = 0,
  seriesCheckVolumes = [] as {
    series_id: string | null
    reading_status: string
  }[],
  insertError = null
}: SupabaseMockOptions = {}) {
  // Count calls to from("volumes") so we can serve the right result each time.
  let volumeCall = 0
  const insertCalls: string[] = []

  function fromTable(table: string) {
    if (table === "user_achievements") {
      return {
        select: () =>
          makeChain({ data: earnedAchievements, error: null, count: null }),
        insert: () => {
          insertCalls.push("user_achievements")
          return Promise.resolve({ error: insertError })
        }
      }
    }
    if (table === "volumes") {
      const idx = volumeCall++
      if (idx === 0) {
        return {
          select: () =>
            makeChain({ data: null, error: null, count: ownedCount })
        }
      }
      if (idx === 1) {
        return {
          select: () =>
            makeChain({ data: null, error: null, count: completedCount })
        }
      }
      // 3rd call is the series-complete check
      return {
        select: () =>
          makeChain({ data: seriesCheckVolumes, error: null, count: null })
      }
    }
    if (table === "series") {
      return {
        select: () => makeChain({ data: null, error: null, count: seriesCount })
      }
    }
    if (table === "notifications") {
      return {
        insert: () => {
          insertCalls.push("notifications")
          return Promise.resolve({ error: null })
        }
      }
    }
    return {
      select: () => makeChain({ data: [], error: null, count: null }),
      insert: () => Promise.resolve({ error: null })
    }
  }

  const fromMock = mock(fromTable)
  return { client: { from: fromMock }, insertCalls }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("checkAchievements", () => {
  it("resolves without error when no thresholds are met", async () => {
    const { client } = makeSupabase({
      ownedCount: 0,
      completedCount: 0,
      seriesCount: 0
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await checkAchievements(client as any, "user-1")
  })

  it("never throws when supabase.from() throws synchronously", async () => {
    const broken = {
      from: mock(() => {
        throw new Error("boom")
      })
    }
    // checkAchievements is best-effort — must NOT propagate errors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await checkAchievements(broken as any, "user-1")
  })

  it("never throws when supabase queries reject", async () => {
    // select() returns an object with eq() that rejects — the rejection is
    // awaited inside checkAchievements and caught by its try/catch block.
    const broken = {
      from: mock(() => ({
        select: () => ({
          eq: () => Promise.reject(new Error("network error"))
        }),
        insert: () => Promise.reject(new Error("network error"))
      }))
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await checkAchievements(broken as any, "user-1")
  })

  it("does not insert when no new achievements qualify", async () => {
    const { client, insertCalls } = makeSupabase({
      ownedCount: 0,
      completedCount: 0,
      seriesCount: 0
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await checkAchievements(client as any, "user-1")
    expect(insertCalls).toHaveLength(0)
  })

  it("awards first_series when seriesCount >= 1", async () => {
    const { client, insertCalls } = makeSupabase({
      earnedAchievements: [],
      seriesCount: 1
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await checkAchievements(client as any, "user-1")
    expect(insertCalls).toContain("user_achievements")
    expect(insertCalls).toContain("notifications")
  })

  it("awards first_volume when ownedCount >= 1", async () => {
    const { client, insertCalls } = makeSupabase({
      earnedAchievements: [],
      ownedCount: 1
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await checkAchievements(client as any, "user-1")
    expect(insertCalls).toContain("user_achievements")
  })

  it("awards bookworm when ownedCount >= 10", async () => {
    const { client, insertCalls } = makeSupabase({
      earnedAchievements: [],
      ownedCount: 10
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await checkAchievements(client as any, "user-1")
    expect(insertCalls).toContain("user_achievements")
  })

  it("awards collector when ownedCount >= 50", async () => {
    const { client, insertCalls } = makeSupabase({
      earnedAchievements: [],
      ownedCount: 50
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await checkAchievements(client as any, "user-1")
    expect(insertCalls).toContain("user_achievements")
  })

  it("awards centurion when ownedCount >= 100", async () => {
    const { client, insertCalls } = makeSupabase({
      earnedAchievements: [],
      ownedCount: 100
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await checkAchievements(client as any, "user-1")
    expect(insertCalls).toContain("user_achievements")
  })

  it("awards avid_reader when completedCount >= 10", async () => {
    const { client, insertCalls } = makeSupabase({
      earnedAchievements: [],
      completedCount: 10
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await checkAchievements(client as any, "user-1")
    expect(insertCalls).toContain("user_achievements")
  })

  it("does not re-award already-earned achievements", async () => {
    const { client, insertCalls } = makeSupabase({
      earnedAchievements: [
        { achievement_id: "first_series" },
        { achievement_id: "first_volume" }
      ],
      ownedCount: 1,
      seriesCount: 1
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await checkAchievements(client as any, "user-1")
    expect(insertCalls).toHaveLength(0)
  })

  it("skips the series-complete sub-query when series_complete already earned", async () => {
    const { client } = makeSupabase({
      earnedAchievements: [{ achievement_id: "series_complete" }],
      ownedCount: 1,
      seriesCount: 1
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await checkAchievements(client as any, "user-1")
    // Expect exactly 2 volumes calls (owned-count + completed-count),
    // NOT a 3rd call for the series-complete check.
    const volumeCalls = client.from.mock.calls.filter(
      (c: unknown[]) => c[0] === "volumes"
    )
    expect(volumeCalls).toHaveLength(2)
  })

  it("awards series_complete when all owned volumes in a series are completed", async () => {
    const { client, insertCalls } = makeSupabase({
      earnedAchievements: [],
      ownedCount: 2,
      completedCount: 2,
      seriesCount: 1,
      seriesCheckVolumes: [
        { series_id: "s-1", reading_status: "completed" },
        { series_id: "s-1", reading_status: "completed" }
      ]
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await checkAchievements(client as any, "user-1")
    expect(insertCalls).toContain("user_achievements")
  })

  it("does not award series_complete when a series has incomplete volumes", async () => {
    const { client, insertCalls } = makeSupabase({
      earnedAchievements: [],
      ownedCount: 2,
      completedCount: 1,
      seriesCount: 1,
      seriesCheckVolumes: [
        { series_id: "s-1", reading_status: "completed" },
        { series_id: "s-1", reading_status: "unread" }
      ]
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await checkAchievements(client as any, "user-1")
    // first_series and first_volume DO qualify, but series_complete does not
    expect(insertCalls).toContain("user_achievements")
    // Notifications issued only for the achieved ones, not series_complete
    const notifCount = insertCalls.filter((c) => c === "notifications").length
    expect(notifCount).toBe(2) // first_series + first_volume
  })

  it("aborts after achievement insert error and skips notifications", async () => {
    const { client, insertCalls } = makeSupabase({
      earnedAchievements: [],
      ownedCount: 1,
      seriesCount: 1,
      insertError: { message: "DB error" }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await checkAchievements(client as any, "user-1")
    expect(insertCalls).toContain("user_achievements")
    expect(insertCalls).not.toContain("notifications")
  })
})
