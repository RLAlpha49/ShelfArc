"use client"

import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useCallback, useEffect, useMemo, useState } from "react"

import { CommandPalette } from "@/components/command-palette"
import { Header } from "@/components/header"
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog"
import { LiveAnnouncer } from "@/components/live-announcer"
import { OnboardingDialog } from "@/components/onboarding-dialog"
import { SidebarNav } from "@/components/sidebar-nav"
import { useGlobalShortcuts } from "@/lib/hooks/use-global-shortcuts"
import { useLibraryStore } from "@/lib/store/library-store"
import { useNotificationStore } from "@/lib/store/notification-store"
import { useSettingsStore } from "@/lib/store/settings-store"
import { cn } from "@/lib/utils"

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
  const router = useRouter()
  const { setTheme, resolvedTheme } = useTheme()
  const navigationMode = useSettingsStore((s) => s.navigationMode)
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useSettingsStore((s) => s.setSidebarCollapsed)
  const _hydrated = useSettingsStore((s) => s._hydrated)
  const hasCompletedOnboarding = useSettingsStore(
    (s) => s.hasCompletedOnboarding
  )
  const setHasCompletedOnboarding = useSettingsStore(
    (s) => s.setHasCompletedOnboarding
  )
  const hasExistingLibrary = useLibraryStore(
    (s) => Object.keys(s.seriesById).length > 0
  )

  // Safety net: ensure _hydrated is set even if onRehydrateStorage callback
  // did not fire (e.g. storage unavailable during SSR).
  useEffect(() => {
    if (
      useSettingsStore.persist.hasHydrated() &&
      !useSettingsStore.getState()._hydrated
    ) {
      useSettingsStore.setState({ _hydrated: true })
    }
    const unsub = useSettingsStore.persist.onFinishHydration(() => {
      if (!useSettingsStore.getState()._hydrated) {
        useSettingsStore.setState({ _hydrated: true })
      }
    })
    return unsub
  }, [])

  // Load settings from server on mount (non-blocking), skipping if data is fresh
  useEffect(() => {
    const STALE_MS = 5 * 60 * 1000
    const settingsLastSynced = useSettingsStore.getState().lastSyncedAt
    if (!settingsLastSynced || Date.now() - settingsLastSynced > STALE_MS) {
      useSettingsStore.getState().loadFromServer()
    }
    const notifLastSynced = useNotificationStore.getState().lastSyncedAt
    if (!notifLastSynced || Date.now() - notifLastSynced > STALE_MS) {
      useNotificationStore.getState().loadFromServer()
    }
  }, [])

  const handleOnboardingOpenChange = useCallback(
    (open: boolean) => {
      if (!open) setHasCompletedOnboarding(true)
    },
    [setHasCompletedOnboarding]
  )

  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  useGlobalShortcuts({ router, setTheme, resolvedTheme, setShortcutsOpen })

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

    const main = document.getElementById("main-content")
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
        <CommandPalette />
        <LiveAnnouncer />
        <KeyboardShortcutsDialog
          open={shortcutsOpen}
          onOpenChange={setShortcutsOpen}
        />
        <OnboardingDialog
          open={_hydrated && !hasCompletedOnboarding}
          onOpenChange={handleOnboardingOpenChange}
          hasExistingLibrary={hasExistingLibrary}
        />
        <Header user={user} />
        <main id="main-content" tabIndex={-1} className={mainClassName}>
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
      <CommandPalette />
      <LiveAnnouncer />
      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
      <OnboardingDialog
        open={_hydrated && !hasCompletedOnboarding}
        onOpenChange={handleOnboardingOpenChange}
        hasExistingLibrary={hasExistingLibrary}
      />
      <SidebarNav
        user={user}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      <main id="main-content" tabIndex={-1} className={mainClassName}>
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
