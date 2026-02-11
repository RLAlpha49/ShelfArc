import { AppShell } from "@/components/app-shell"
import { createUserClient } from "@/lib/supabase/server"

/**
 * Authenticated app layout that wraps pages with the main application shell.
 * @param children - Nested route content.
 * @source
 */
export default async function LibraryLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createUserClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  return <AppShell user={user}>{children}</AppShell>
}
