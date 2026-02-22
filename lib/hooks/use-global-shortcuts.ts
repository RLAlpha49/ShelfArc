import { useRouter } from "next/navigation"
import { type RefObject, useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"

import { useLibraryStore } from "@/lib/store/library-store"
import { useSettingsStore } from "@/lib/store/settings-store"

const PREFIX_HINTS: Record<string, string> = {
  g: "g + … → d=Dashboard, l=Library, s=Settings, a=Activity",
  a: "a + … → b=Add Book, s=Add Series",
  v: "v + … → g=Grid, l=List, s=Series, v=Volumes"
}

function clearPendingPrefix(
  prefixRef: RefObject<string | null>,
  timerRef: RefObject<ReturnType<typeof setTimeout> | null>,
  toastIdRef: RefObject<string | number | null>
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
 * Registers global keyboard shortcuts for navigation, theme toggling, and UI actions.
 * Handles both single-key and two-key prefix sequences (e.g. `g` + `d` → /dashboard).
 */
export function useGlobalShortcuts(options: {
  router: ReturnType<typeof useRouter>
  setTheme: (theme: string) => void
  resolvedTheme: string | undefined
  setShortcutsOpen: (open: boolean) => void
}): void {
  const { router, setTheme, resolvedTheme, setShortcutsOpen } = options

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
      } else if (key === "[" || key === "\\") {
        event.preventDefault()
        const s = useSettingsStore.getState()
        s.setSidebarCollapsed(!s.sidebarCollapsed)
      } else if (key === "r") {
        event.preventDefault()
        useLibraryStore.getState().setLastFetchedAt(null)
        globalThis.dispatchEvent(new Event("reload-library"))
      } else if (key === "n") {
        event.preventDefault()
        globalThis.dispatchEvent(new Event("open-notification-center"))
      }
    },
    [router, setTheme, resolvedTheme, setShortcutsOpen]
  )

  useEffect(() => {
    const target = globalThis as unknown as Window
    target.addEventListener("keydown", handleGlobalShortcut)
    return () => target.removeEventListener("keydown", handleGlobalShortcut)
  }, [handleGlobalShortcut])

  // Listen for custom events dispatched by the command palette
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
  }, [setTheme, resolvedTheme, setShortcutsOpen])
}
