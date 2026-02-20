import { redirect } from "next/navigation"

import { SettingsPageClient } from "@/components/settings/settings-page-client"
import { createUserClient } from "@/lib/supabase/server"
import type { Profile } from "@/lib/types/database"

export default async function SettingsPage() {
  const supabase = await createUserClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const profile = (data as unknown as Profile) ?? null

  return <SettingsPageClient profile={profile} />
}
