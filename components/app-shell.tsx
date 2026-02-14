"use client"

import { useEffect, useMemo } from "react"
import { SidebarNav } from "@/components/sidebar-nav"
import { Header } from "@/components/header"
import { CommandPalette } from "@/components/command-palette"
import { OnboardingDialog } from "@/components/onboarding-dialog"
import { cn } from "@/lib/utils"
import { useLibraryStore } from "@/lib/store/library-store"
import { useSettingsStore } from "@/lib/store/settings-store"
import { usePathname } from "next/navigation"

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
  const pathname = usePathname()
  const navigationMode = useLibraryStore((state) => state.navigationMode)
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useSettingsStore((s) => s.setSidebarCollapsed)
  const _hydrated = useSettingsStore((s) => s._hydrated)
  const hasCompletedOnboarding = useSettingsStore(
    (s) => s.hasCompletedOnboarding
  )

  const routeAnnouncement = useMemo(() => {
    const label = pathname
      .split("?")[0]
      .split("#")[0]
      .split("/")
      .filter(Boolean)
      .map((segment) => segment.replaceAll("-", " "))
      .join(" ")

    return label ? `Navigated to ${label}.` : "Navigated home."
  }, [pathname])

  // If the App Router navigation leaves focus on <body>/<html>, move it to <main>
  // so keyboard and screen reader users land in the new page content.
  useEffect(() => {
    const active = document.activeElement
    if (
      active &&
      active !== document.body &&
      active !== document.documentElement
    ) {
      return
    }

    const main = document.getElementById("main")
    if (main instanceof HTMLElement) {
      main.focus({ preventScroll: true })
    }
  }, [pathname])

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
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <CommandPalette />
        <OnboardingDialog
          open={_hydrated && !hasCompletedOnboarding}
          onOpenChange={() => {}}
        />
        <Header user={user} />
        <main id="main" tabIndex={-1} className={mainClassName}>
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {routeAnnouncement}
          </div>
          <div className="noise-overlay relative min-h-screen">
            <div className={contentClassName}>{children}</div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <CommandPalette />
      <OnboardingDialog
        open={_hydrated && !hasCompletedOnboarding}
        onOpenChange={() => {}}
      />
      <SidebarNav
        user={user}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      <main id="main" tabIndex={-1} className={mainClassName}>
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {routeAnnouncement}
        </div>
        <div className="noise-overlay relative min-h-screen">
          <div className={contentClassName}>{children}</div>
        </div>
      </main>
    </div>
  )
}
