import { Header } from "@/components/header"
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

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header user={user} />
      <main className="flex-1">
        <div className="bg-warm-gradient noise-overlay relative min-h-[calc(100vh-4rem)]">
          <div className="relative z-10">{children}</div>
        </div>
      </main>
    </div>
  )
}
