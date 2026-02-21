import { redirect } from "next/navigation"

import { createUserClient } from "@/lib/supabase/server"
import type { SeriesWithVolumes, Volume } from "@/lib/types/database"

import LibraryClient from "./library-client"

export default async function LibraryPage() {
  const supabase = await createUserClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const [seriesResult, volumesResult] = await Promise.all([
    supabase.from("series").select("*").eq("user_id", user.id),
    supabase
      .from("volumes")
      .select("*")
      .eq("user_id", user.id)
      .order("volume_number", { ascending: true })
  ])

  const seriesRows = seriesResult.data ?? []
  const volumeRows = (volumesResult.data ?? []) as Volume[]

  const volumesBySeries = new Map<string, Volume[]>()
  const unassignedVolumes: Volume[] = []

  for (const v of volumeRows) {
    if (!v.series_id) {
      unassignedVolumes.push(v)
      continue
    }
    const existing = volumesBySeries.get(v.series_id)
    if (existing) existing.push(v)
    else volumesBySeries.set(v.series_id, [v])
  }

  const series: SeriesWithVolumes[] = seriesRows.map((s) => ({
    ...s,
    volumes: volumesBySeries.get(s.id) ?? []
  })) as SeriesWithVolumes[]

  return (
    <LibraryClient
      initialData={{
        series,
        unassignedVolumes
      }}
    />
  )
}
