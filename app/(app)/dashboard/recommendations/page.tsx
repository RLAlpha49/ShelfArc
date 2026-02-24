import { redirect } from "next/navigation"

import { computeSuggestedBuys } from "@/lib/library/analytics"
import { createUserClient } from "@/lib/supabase/server"
import type { SeriesWithVolumes, Volume } from "@/lib/types/database"

import { RecommendationsClient } from "./recommendations-client"

export default async function RecommendationsPage() {
  const supabase = await createUserClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const [seriesResult, volumesResult] = await Promise.all([
    supabase
      .from("series")
      .select(
        "id, user_id, title, type, total_volumes, status, tags, cover_image_url, created_at, updated_at"
      )
      .eq("user_id", user.id),
    supabase
      .from("volumes")
      .select(
        "id, series_id, user_id, volume_number, ownership_status, reading_status, cover_image_url, purchase_price, created_at, updated_at"
      )
      .eq("user_id", user.id)
      .order("volume_number", { ascending: true })
  ])

  const seriesRows = seriesResult.data ?? []
  const volumeRows = (volumesResult.data ?? []) as Volume[]

  const volumesBySeries = new Map<string, Volume[]>()
  for (const v of volumeRows) {
    if (!v.series_id) continue
    const existing = volumesBySeries.get(v.series_id)
    if (existing) existing.push(v)
    else volumesBySeries.set(v.series_id, [v])
  }

  const series: SeriesWithVolumes[] = seriesRows.map((s) => ({
    ...s,
    volumes: volumesBySeries.get(s.id) ?? []
  })) as SeriesWithVolumes[]

  const initialSuggestions = computeSuggestedBuys(series)

  return <RecommendationsClient initialSuggestions={initialSuggestions} />
}
