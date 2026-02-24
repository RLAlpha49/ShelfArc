import { redirect } from "next/navigation"

import type { Automation } from "@/components/settings/automations-section"
import { AutomationsSection } from "@/components/settings/automations-section"
import { createUserClient } from "@/lib/supabase/server"

export default async function AutomationsSettingsPage() {
  const supabase = await createUserClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: automations } = await supabase
    .from("automations")
    .select(
      "id, name, trigger_type, conditions, actions, enabled, last_triggered_at, created_at, updated_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  return (
    <AutomationsSection
      initialAutomations={(automations as unknown as Automation[]) ?? []}
    />
  )
}
