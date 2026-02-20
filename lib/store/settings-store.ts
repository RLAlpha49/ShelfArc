import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { BulkScrapeMode } from "@/lib/hooks/use-bulk-scrape"

/** Navigation layout mode. @source */
export type NavigationMode = "sidebar" | "header"

/** Available display (heading) font families. @source */
export type DisplayFont = "playfair" | "lora" | "crimson-text" | "source-serif"
/** Available body text font families. @source */
export type BodyFont = "plus-jakarta" | "inter" | "dm-sans"
/** Library card size preset. @source */
export type CardSize = "compact" | "default" | "large"
/** Date formatting mode. @source */
export type DateFormat = "relative" | "short" | "long" | "iso"
/** Default ownership status for new volumes. @source */
export type DefaultOwnershipStatus = "owned" | "wishlist"
/** Supported book search providers. @source */
export type SearchSource = "google_books" | "open_library"
/** Font size scaling mode for accessibility. @source */
export type FontSizeScale = "default" | "large" | "x-large"
/** Focus indicator visibility mode. @source */
export type FocusIndicators = "default" | "enhanced"
/** Release reminder lead time in days. @source */
export type ReleaseReminderDays = 3 | 7 | 14 | 30
/** Settings server-sync status for the status badge. @source */
export type SyncStatus = "idle" | "saved" | "failed"
/** Dashboard widget identifier. @source */
export type DashboardWidgetId =
  | "stats"
  | "currently-reading"
  | "recently-added"
  | "recommendations"
  | "breakdown"
  | "health"
  | "activity"
  | "progress"
  | "price-tracking"
  | "wishlist"
  | "releases"
  | "price-alerts"
  | "spending-chart"
  | "tag-analytics"
  | "reading-velocity"
  | "backlog"
  | "reading-goal"

/** Column assignment for a dashboard widget. @source */
export type DashboardWidgetColumn = "full" | "left" | "right"

/** Dashboard widget metadata. @source */
export interface DashboardWidgetMeta {
  readonly id: DashboardWidgetId
  readonly label: string
  readonly column: DashboardWidgetColumn
}

/** Dashboard layout preferences. @source */
export interface DashboardLayout {
  readonly order: DashboardWidgetId[]
  readonly hidden: DashboardWidgetId[]
}

/** All dashboard widgets with their column assignments. @source */
export const DASHBOARD_WIDGETS: readonly DashboardWidgetMeta[] = [
  { id: "stats", label: "Stats", column: "full" },
  { id: "currently-reading", label: "Currently Reading", column: "left" },
  { id: "recently-added", label: "Recently Added", column: "left" },
  { id: "recommendations", label: "What to Buy Next", column: "left" },
  { id: "breakdown", label: "Breakdown", column: "right" },
  { id: "health", label: "Collection Health", column: "right" },
  { id: "activity", label: "Recent Activity", column: "right" },
  { id: "progress", label: "Progress", column: "right" },
  { id: "price-tracking", label: "Price Tracking", column: "right" },
  { id: "wishlist", label: "Wishlist", column: "right" },
  { id: "releases", label: "Upcoming Releases", column: "right" },
  { id: "price-alerts", label: "Price Alerts", column: "right" },
  { id: "spending-chart", label: "Spending Over Time", column: "left" },
  { id: "reading-velocity", label: "Reading Velocity", column: "left" },
  { id: "tag-analytics", label: "Tag Breakdown", column: "left" },
  { id: "backlog", label: "Reading Backlog", column: "right" },
  { id: "reading-goal", label: "Reading Goal", column: "right" }
]

/** Default dashboard layout with all widgets visible in the default order. @source */
export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  order: DASHBOARD_WIDGETS.map((w) => w.id),
  hidden: ["reading-goal"]
}

/** Combined settings state and actions for the settings Zustand store. @source */
interface SettingsState {
  // Hydration
  _hydrated: boolean
  // Library display
  showReadingProgress: boolean
  showSeriesProgressBar: boolean
  cardSize: CardSize

  // Workflow defaults
  confirmBeforeDelete: boolean
  defaultOwnershipStatus: DefaultOwnershipStatus
  defaultSearchSource: SearchSource
  defaultScrapeMode: BulkScrapeMode
  autoPurchaseDate: boolean

  // Layout
  sidebarCollapsed: boolean

  // Appearance
  enableAnimations: boolean
  displayFont: DisplayFont
  bodyFont: BodyFont
  dateFormat: DateFormat

  // Accessibility
  highContrastMode: boolean
  fontSizeScale: FontSizeScale
  focusIndicators: FocusIndicators

  // Automation
  automatedPriceChecks: boolean

  // Notifications
  releaseReminders: boolean
  releaseReminderDays: ReleaseReminderDays
  notifyOnImportComplete: boolean
  notifyOnScrapeComplete: boolean
  notifyOnPriceAlert: boolean
  emailNotifications: boolean

  // Dashboard layout
  dashboardLayout: DashboardLayout

  // Reading goal
  readingGoal: number | undefined

  // Onboarding
  hasCompletedOnboarding: boolean

  // Navigation
  navigationMode: NavigationMode

  // Actions
  setShowReadingProgress: (value: boolean) => void
  setShowSeriesProgressBar: (value: boolean) => void
  setCardSize: (value: CardSize) => void
  setConfirmBeforeDelete: (value: boolean) => void
  setDefaultOwnershipStatus: (value: DefaultOwnershipStatus) => void
  setDefaultSearchSource: (value: SearchSource) => void
  setDefaultScrapeMode: (value: BulkScrapeMode) => void
  setAutoPurchaseDate: (value: boolean) => void
  setSidebarCollapsed: (value: boolean) => void
  setEnableAnimations: (value: boolean) => void
  setDisplayFont: (value: DisplayFont) => void
  setBodyFont: (value: BodyFont) => void
  setDateFormat: (value: DateFormat) => void
  setHighContrastMode: (value: boolean) => void
  setFontSizeScale: (value: FontSizeScale) => void
  setFocusIndicators: (value: FocusIndicators) => void
  setAutomatedPriceChecks: (value: boolean) => void
  setReleaseReminders: (value: boolean) => void
  setReleaseReminderDays: (value: ReleaseReminderDays) => void
  setNotifyOnImportComplete: (value: boolean) => void
  setNotifyOnScrapeComplete: (value: boolean) => void
  setNotifyOnPriceAlert: (value: boolean) => void
  setEmailNotifications: (value: boolean) => void
  setHasCompletedOnboarding: (value: boolean) => void
  setNavigationMode: (value: NavigationMode) => void
  setDashboardLayout: (layout: DashboardLayout) => void
  resetDashboardLayout: () => void
  setReadingGoal: (goal: number | undefined) => void

  // Server sync
  lastSyncedAt: number | null
  syncStatus: SyncStatus
  syncToServer: () => void
  loadFromServer: () => Promise<void>
}

/** Maps display font keys to their CSS variable references loaded by next/font. @source */
export const DISPLAY_FONT_MAP: Record<DisplayFont, string> = {
  playfair: "var(--font-playfair)",
  lora: "var(--font-lora)",
  "crimson-text": "var(--font-crimson-text)",
  "source-serif": "var(--font-source-serif)"
}

/** Maps body font keys to their CSS variable references loaded by next/font. @source */
export const BODY_FONT_MAP: Record<BodyFont, string> = {
  "plus-jakarta": "var(--font-plus-jakarta)",
  inter: "var(--font-inter)",
  "dm-sans": "var(--font-dm-sans)"
}

/**
 * Determine the initial animation preference.
 *
 * - Defaults to "enabled" on the server.
 * - On first client load (no persisted settings yet), respects OS reduce-motion.
 *
 * Persisted settings from zustand/persist will override this default.
 */
function getDefaultEnableAnimations() {
  const win = globalThis.window
  if (!win) return true
  return !win.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/** Zustand store managing user preferences with localStorage persistence. @source */

const SYNCABLE_KEYS = [
  "showReadingProgress",
  "showSeriesProgressBar",
  "cardSize",
  "confirmBeforeDelete",
  "defaultOwnershipStatus",
  "defaultSearchSource",
  "defaultScrapeMode",
  "autoPurchaseDate",
  "sidebarCollapsed",
  "enableAnimations",
  "displayFont",
  "bodyFont",
  "dateFormat",
  "highContrastMode",
  "fontSizeScale",
  "focusIndicators",
  "automatedPriceChecks",
  "releaseReminders",
  "releaseReminderDays",
  "notifyOnImportComplete",
  "notifyOnScrapeComplete",
  "notifyOnPriceAlert",
  "emailNotifications",
  "hasCompletedOnboarding",
  "navigationMode",
  "dashboardLayout",
  "readingGoal"
] as const

let syncTimer: ReturnType<typeof setTimeout> | null = null

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Hydration
      _hydrated: false,

      // Library display
      showReadingProgress: true,
      showSeriesProgressBar: true,
      cardSize: "default",

      // Workflow defaults
      confirmBeforeDelete: true,
      defaultOwnershipStatus: "owned",
      defaultSearchSource: "google_books",
      defaultScrapeMode: "both",
      autoPurchaseDate: false,

      // Layout
      sidebarCollapsed: false,

      // Appearance
      enableAnimations: getDefaultEnableAnimations(),
      displayFont: "playfair",
      bodyFont: "plus-jakarta",
      dateFormat: "relative",

      // Accessibility
      highContrastMode: false,
      fontSizeScale: "default",
      focusIndicators: "default",

      // Automation
      automatedPriceChecks: true,

      // Notifications
      releaseReminders: true,
      releaseReminderDays: 7 as ReleaseReminderDays,
      notifyOnImportComplete: true,
      notifyOnScrapeComplete: true,
      notifyOnPriceAlert: true,
      emailNotifications: false,

      // Dashboard layout
      dashboardLayout: DEFAULT_DASHBOARD_LAYOUT,

      // Reading goal
      readingGoal: undefined,

      // Onboarding
      hasCompletedOnboarding: false,

      // Navigation
      navigationMode: "sidebar" as NavigationMode,

      // Actions — every setter that maps to a SYNCABLE_KEY also calls
      // syncToServer() directly. This is the most reliable trigger: setters are
      // only invoked from user interactions, never during localStorage hydration
      // or loadFromServer() (which calls set() directly, bypassing setters).
      setShowReadingProgress: (value) => {
        set({ showReadingProgress: value })
        get().syncToServer()
      },
      setShowSeriesProgressBar: (value) => {
        set({ showSeriesProgressBar: value })
        get().syncToServer()
      },
      setCardSize: (value) => {
        set({ cardSize: value })
        get().syncToServer()
      },
      setConfirmBeforeDelete: (value) => {
        set({ confirmBeforeDelete: value })
        get().syncToServer()
      },
      setDefaultOwnershipStatus: (value) => {
        set({ defaultOwnershipStatus: value })
        get().syncToServer()
      },
      setDefaultSearchSource: (value) => {
        set({ defaultSearchSource: value })
        get().syncToServer()
      },
      setDefaultScrapeMode: (value) => {
        set({ defaultScrapeMode: value })
        get().syncToServer()
      },
      setAutoPurchaseDate: (value) => {
        set({ autoPurchaseDate: value })
        get().syncToServer()
      },
      setSidebarCollapsed: (value) => {
        set({ sidebarCollapsed: value })
        get().syncToServer()
      },
      setEnableAnimations: (value) => {
        set({ enableAnimations: value })
        get().syncToServer()
      },
      setDisplayFont: (value) => {
        set({ displayFont: value })
        get().syncToServer()
      },
      setBodyFont: (value) => {
        set({ bodyFont: value })
        get().syncToServer()
      },
      setDateFormat: (value) => {
        set({ dateFormat: value })
        get().syncToServer()
      },
      setHighContrastMode: (value) => {
        set({ highContrastMode: value })
        get().syncToServer()
      },
      setFontSizeScale: (value) => {
        set({ fontSizeScale: value })
        get().syncToServer()
      },
      setFocusIndicators: (value) => {
        set({ focusIndicators: value })
        get().syncToServer()
      },
      setAutomatedPriceChecks: (value) => {
        set({ automatedPriceChecks: value })
        get().syncToServer()
      },
      setReleaseReminders: (value) => {
        set({ releaseReminders: value })
        get().syncToServer()
      },
      setReleaseReminderDays: (value) => {
        set({ releaseReminderDays: value })
        get().syncToServer()
      },
      setNotifyOnImportComplete: (value) => {
        set({ notifyOnImportComplete: value })
        get().syncToServer()
      },
      setNotifyOnScrapeComplete: (value) => {
        set({ notifyOnScrapeComplete: value })
        get().syncToServer()
      },
      setNotifyOnPriceAlert: (value) => {
        set({ notifyOnPriceAlert: value })
        get().syncToServer()
      },
      setEmailNotifications: (value) => {
        set({ emailNotifications: value })
        get().syncToServer()
      },
      setHasCompletedOnboarding: (value) => {
        set({ hasCompletedOnboarding: value })
        get().syncToServer()
      },
      setNavigationMode: (value) => {
        set({ navigationMode: value })
        get().syncToServer()
      },
      setDashboardLayout: (layout) => {
        set({ dashboardLayout: layout })
        get().syncToServer()
      },
      resetDashboardLayout: () => {
        set({ dashboardLayout: DEFAULT_DASHBOARD_LAYOUT })
        get().syncToServer()
      },
      setReadingGoal: (goal) => {
        set({ readingGoal: goal })
        get().syncToServer()
      },

      // Server sync
      lastSyncedAt: null,
      syncStatus: "idle" as SyncStatus,

      syncToServer: () => {
        if (syncTimer) clearTimeout(syncTimer)
        syncTimer = setTimeout(() => {
          const state = get()
          const syncable: Record<string, unknown> = {}
          for (const key of SYNCABLE_KEYS) {
            syncable[key] = state[key]
          }
          const syncTime = Date.now()
          syncable.lastSyncedAt = syncTime
          fetch("/api/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ settings: syncable })
          })
            .then((res) => {
              if (res.ok) {
                useSettingsStore.setState({
                  lastSyncedAt: syncTime,
                  syncStatus: "saved"
                })
              } else {
                useSettingsStore.setState({ syncStatus: "failed" })
              }
            })
            .catch(() => {
              useSettingsStore.setState({ syncStatus: "failed" })
            })
        }, 2_000)
      },

      loadFromServer: async () => {
        const localSyncedAt = get().lastSyncedAt
        try {
          const res = await fetch("/api/settings")
          if (!res.ok) return
          const json = await res.json()
          const server = json?.data?.settings
          if (!server || typeof server !== "object") return

          // Only apply server settings if they are newer than local.
          // This prevents overwriting local changes that haven't synced yet
          // (e.g. user changed a setting within the 2-second debounce window
          // and reloaded before syncToServer fired).
          const serverSyncedAt =
            typeof server.lastSyncedAt === "number" ? server.lastSyncedAt : null
          if (
            localSyncedAt !== null &&
            (serverSyncedAt === null || serverSyncedAt <= localSyncedAt)
          ) {
            return
          }

          const patch: Record<string, unknown> = {}
          for (const key of SYNCABLE_KEYS) {
            if (key in server) {
              patch[key] = server[key]
            }
          }
          if (Object.keys(patch).length > 0) {
            set({
              ...patch,
              lastSyncedAt: serverSyncedAt ?? Date.now()
            } as Partial<SettingsState>)
          }
        } catch {
          // Gracefully ignore — don't block UI
        }
      }
    }),
    {
      name: "shelfarc-settings",
      onRehydrateStorage: () => () => {
        useSettingsStore.setState({ _hydrated: true })
      },
      partialize: (state) => ({
        showReadingProgress: state.showReadingProgress,
        showSeriesProgressBar: state.showSeriesProgressBar,
        cardSize: state.cardSize,
        confirmBeforeDelete: state.confirmBeforeDelete,
        defaultOwnershipStatus: state.defaultOwnershipStatus,
        defaultSearchSource: state.defaultSearchSource,
        defaultScrapeMode: state.defaultScrapeMode,
        autoPurchaseDate: state.autoPurchaseDate,
        sidebarCollapsed: state.sidebarCollapsed,
        enableAnimations: state.enableAnimations,
        displayFont: state.displayFont,
        bodyFont: state.bodyFont,
        dateFormat: state.dateFormat,
        highContrastMode: state.highContrastMode,
        fontSizeScale: state.fontSizeScale,
        focusIndicators: state.focusIndicators,
        automatedPriceChecks: state.automatedPriceChecks,
        releaseReminders: state.releaseReminders,
        releaseReminderDays: state.releaseReminderDays,
        notifyOnImportComplete: state.notifyOnImportComplete,
        notifyOnScrapeComplete: state.notifyOnScrapeComplete,
        notifyOnPriceAlert: state.notifyOnPriceAlert,
        emailNotifications: state.emailNotifications,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        navigationMode: state.navigationMode,
        dashboardLayout: state.dashboardLayout,
        readingGoal: state.readingGoal,
        lastSyncedAt: state.lastSyncedAt
      })
    }
  )
)
