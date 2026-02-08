import { AppShell } from "@/components/app-shell"
import { createClient } from "@/lib/supabase/server"

export default async function LibraryLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  return <AppShell user={user}>{children}</AppShell>
}
