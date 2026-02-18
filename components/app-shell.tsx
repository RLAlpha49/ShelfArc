"use client"

import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { CommandPalette } from "@/components/command-palette"
import { Header } from "@/components/header"
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog"
import { LiveAnnouncer } from "@/components/live-announcer"
import { OnboardingDialog } from "@/components/onboarding-dialog"
import { SidebarNav } from "@/components/sidebar-nav"
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

const PREFIX_HINTS: Record<string, string> = {
  g: "g + … → d=Dashboard, l=Library, s=Settings, a=Activity",
  a: "a + … → b=Add Book, s=Add Series",
  v: "v + … → g=Grid, l=List, s=Series, v=Volumes"
}

function clearPendingPrefix(
  prefixRef: React.RefObject<string | null>,
  timerRef: React.RefObject<ReturnType<typeof setTimeout> | null>,
  toastIdRef: React.RefObject<string | number | null>
): void {
  prefixRef.current = null
  if (timerRef.current) {
    clearTimeout(timerRef.current)
    timerRef.current = null
  }
  if (toastIdRef.current !== null) {
    toast.dismiss(toastIdRef.current)
    toastIdRef.current = null
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if (target.isContentEditable) return true
  return Boolean(target.closest("[contenteditable='true']"))
}

function executePrefixShortcut(
  prefix: string,
  key: string,
  router: ReturnType<typeof useRouter>
): void {
  if (prefix === "g") {
    const routes: Record<string, string> = {
      d: "/dashboard",
      l: "/library",
      s: "/settings",
      a: "/activity"
    }
    if (routes[key]) router.push(routes[key])
  } else if (prefix === "a") {
    const actions: Record<string, string> = {
      b: "/library?add=book",
      s: "/library?add=series"
    }
    if (actions[key]) router.push(actions[key])
  } else if (prefix === "v") {
    const store = useLibraryStore.getState()
    if (key === "g") store.setViewMode("grid")
    else if (key === "l") store.setViewMode("list")
    else if (key === "s") store.setCollectionView("series")
    else if (key === "v") store.setCollectionView("volumes")
  }
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
  const navigationMode = useLibraryStore((state) => state.navigationMode)
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useSettingsStore((s) => s.setSidebarCollapsed)
  const _hydrated = useSettingsStore((s) => s._hydrated)
  const hasCompletedOnboarding = useSettingsStore(
    (s) => s.hasCompletedOnboarding
  )
  const setHasCompletedOnboarding = useSettingsStore(
    (s) => s.setHasCompletedOnboarding
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

  // Load settings from server on mount (non-blocking)
  useEffect(() => {
    useSettingsStore.getState().loadFromServer()
    useNotificationStore.getState().loadFromServer()
  }, [])

  const handleOnboardingOpenChange = useCallback(
    (open: boolean) => {
      if (!open) setHasCompletedOnboarding(true)
    },
    [setHasCompletedOnboarding]
  )

  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const pendingPrefix = useRef<string | null>(null)
  const prefixTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prefixToastId = useRef<string | number | null>(null)

  const handleGlobalShortcut = useCallback(
    (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isEditableTarget(event.target)) return

      const key = event.key.toLowerCase()

      if (key === "escape" && pendingPrefix.current) {
        clearPendingPrefix(pendingPrefix, prefixTimer, prefixToastId)
        return // consume Escape
      }

      // Handle pending two-key sequences
      if (pendingPrefix.current) {
        const prefix = pendingPrefix.current
        clearPendingPrefix(pendingPrefix, prefixTimer, prefixToastId)
        event.preventDefault()
        executePrefixShortcut(prefix, key, router)
        return
      }

      // Start two-key sequence
      if (key === "g" || key === "a" || key === "v") {
        pendingPrefix.current = key
        prefixToastId.current = toast(PREFIX_HINTS[key], { duration: 1500 })
        prefixTimer.current = setTimeout(() => {
          clearPendingPrefix(pendingPrefix, prefixTimer, prefixToastId)
        }, 1500)
        return
      }

      // Single-key shortcuts
      if (key === "?") {
        event.preventDefault()
        setShortcutsOpen(true)
      } else if (key === "t") {
        event.preventDefault()
        setTheme(resolvedTheme === "dark" ? "light" : "dark")
      }
    },
    [router, setTheme, resolvedTheme]
  )

  useEffect(() => {
    const target = globalThis as unknown as Window
    target.addEventListener("keydown", handleGlobalShortcut)
    return () => target.removeEventListener("keydown", handleGlobalShortcut)
  }, [handleGlobalShortcut])

  // Listen for custom events from command palette
  useEffect(() => {
    const handleOpenShortcuts = () => setShortcutsOpen(true)
    const handleToggleTheme = () =>
      setTheme(resolvedTheme === "dark" ? "light" : "dark")

    globalThis.addEventListener("open-shortcuts-dialog", handleOpenShortcuts)
    globalThis.addEventListener("toggle-theme", handleToggleTheme)
    return () => {
      globalThis.removeEventListener(
        "open-shortcuts-dialog",
        handleOpenShortcuts
      )
      globalThis.removeEventListener("toggle-theme", handleToggleTheme)
    }
  }, [setTheme, resolvedTheme])

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
        <LiveAnnouncer />
        <KeyboardShortcutsDialog
          open={shortcutsOpen}
          onOpenChange={setShortcutsOpen}
        />
        <OnboardingDialog
          open={_hydrated && !hasCompletedOnboarding}
          onOpenChange={handleOnboardingOpenChange}
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
      <LiveAnnouncer />
      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
      <OnboardingDialog
        open={_hydrated && !hasCompletedOnboarding}
        onOpenChange={handleOnboardingOpenChange}
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
