import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/types/database"

import type { AchievementId } from "./definitions"
import { ACHIEVEMENTS } from "./definitions"

/** Checks whether the user has completed all owned volumes in any one series. @source */
async function checkSeriesComplete(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  const { data: ownedVolumes } = await supabase
    .from("volumes")
    .select("series_id, reading_status")
    .eq("user_id", userId)
    .eq("ownership_status", "owned")

  if (!ownedVolumes?.length) return false

  const bySeriesId = new Map<string, { total: number; completed: number }>()
  for (const v of ownedVolumes) {
    if (!v.series_id) continue
    const entry = bySeriesId.get(v.series_id) ?? { total: 0, completed: 0 }
    entry.total++
    if (v.reading_status === "completed") entry.completed++
    bySeriesId.set(v.series_id, entry)
  }

  for (const entry of bySeriesId.values()) {
    if (entry.total > 0 && entry.completed === entry.total) return true
  }
  return false
}

/** Determines which achievements are newly earned based on current stats. @source */
function computeNewAchievements(
  earnedSet: Set<string>,
  ownedCount: number,
  completedCount: number,
  seriesCount: number,
  hasCompletedSeries: boolean
): AchievementId[] {
  const earned: AchievementId[] = []
  if (!earnedSet.has("first_series") && seriesCount >= 1)
    earned.push("first_series")
  if (!earnedSet.has("first_volume") && ownedCount >= 1)
    earned.push("first_volume")
  if (!earnedSet.has("bookworm") && ownedCount >= 10) earned.push("bookworm")
  if (!earnedSet.has("collector") && ownedCount >= 50) earned.push("collector")
  if (!earnedSet.has("centurion") && ownedCount >= 100) earned.push("centurion")
  if (!earnedSet.has("avid_reader") && completedCount >= 10)
    earned.push("avid_reader")
  if (!earnedSet.has("series_complete") && hasCompletedSeries)
    earned.push("series_complete")
  return earned
}

/**
 * Checks which achievements the user has newly earned and records them.
 * Also inserts an "info" notification for each newly unlocked achievement.
 * Best-effort: never throws.
 *
 * Call this after any mutation that could trigger a milestone (series/volume added,
 * reading status changed).
 *
 * @param supabase - Authenticated Supabase client scoped to the acting user.
 * @param userId   - The user's UUID.
 * @source
 */
export async function checkAchievements(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  try {
    const { data: earned } = await supabase
      .from("user_achievements")
      .select("achievement_id")
      .eq("user_id", userId)

    const earnedSet = new Set((earned ?? []).map((r) => r.achievement_id))

    const [ownedResult, completedResult, seriesResult] = await Promise.all([
      supabase
        .from("volumes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("ownership_status", "owned"),
      supabase
        .from("volumes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("reading_status", "completed"),
      supabase
        .from("series")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
    ])

    const hasCompletedSeries = earnedSet.has("series_complete")
      ? false
      : await checkSeriesComplete(supabase, userId)

    const newAchievements = computeNewAchievements(
      earnedSet,
      ownedResult.count ?? 0,
      completedResult.count ?? 0,
      seriesResult.count ?? 0,
      hasCompletedSeries
    )

    if (newAchievements.length === 0) return

    const { error: insertError } = await supabase
      .from("user_achievements")
      .insert(
        newAchievements.map((achievement_id) => ({
          user_id: userId,
          achievement_id
        }))
      )

    if (insertError) return

    await Promise.all(
      newAchievements.map((achievementId) => {
        const def = ACHIEVEMENTS[achievementId]
        return supabase.from("notifications").insert({
          user_id: userId,
          type: "info" as const,
          title: `${def.emoji} Achievement Unlocked: ${def.title}`,
          message: def.description
        })
      })
    )
  } catch {
    // Best-effort — never throw from achievement checks
  }
}
