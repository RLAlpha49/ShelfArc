"use client"

import { SidebarNav } from "@/components/sidebar-nav"
import { Header } from "@/components/header"
import { cn } from "@/lib/utils"
import { useLibraryStore } from "@/lib/store/library-store"
import { useSettingsStore } from "@/lib/store/settings-store"

/** Props for the {@link AppShell} layout wrapper. @source */
interface AppShellProps {
  readonly children: React.ReactNode
  readonly user?: {
    email?: string
    user_metadata?: {
      username?: string
      avatar_url?: string
    }
  } | null
}

/**
 * Top-level layout shell that switches between sidebar and header navigation.
 * @param props - {@link AppShellProps}
 * @source
 */
export function AppShell({ children, user }: AppShellProps) {
  const navigationMode = useLibraryStore((state) => state.navigationMode)
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useSettingsStore((s) => s.setSidebarCollapsed)

  let sidebarOffsetClass: string | null = null
  if (navigationMode === "sidebar") {
    sidebarOffsetClass = sidebarCollapsed ? "md:ml-17" : "md:ml-60"
  }

  const mainClassName = cn(
    "flex-1 transition-[margin] duration-300 ease-in-out",
    sidebarOffsetClass
  )

  const contentClassName = cn(
    "relative z-10",
    navigationMode === "sidebar" ? "pt-14 md:pt-0" : "pt-0"
  )

  if (navigationMode === "header") {
    return (
      <div className="relative min-h-screen">
        <Header user={user} />
        <main className={mainClassName}>
          <div className="noise-overlay relative min-h-screen">
            <div className={contentClassName}>{children}</div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen">
      <SidebarNav
        user={user}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      <main className={mainClassName}>
        <div className="noise-overlay relative min-h-screen">
          <div className={contentClassName}>{children}</div>
        </div>
      </main>
    </div>
  )
}
