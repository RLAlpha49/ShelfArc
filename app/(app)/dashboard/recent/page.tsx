import { redirect } from "next/navigation"

import { createUserClient } from "@/lib/supabase/server"
import type { SeriesWithVolumes } from "@/lib/types/database"

import { RecentClient } from "./recent-client"

export default async function RecentPage() {
  const supabase = await createUserClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data } = await supabase
    .from("series")
    .select("*, volumes(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  return <RecentClient initialSeries={(data as SeriesWithVolumes[]) ?? []} />
}
