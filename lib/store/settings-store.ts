import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { BulkScrapeMode } from "@/lib/hooks/use-bulk-scrape"

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

  // Onboarding
  hasCompletedOnboarding: boolean

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
  setHasCompletedOnboarding: (value: boolean) => void
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
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
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

      // Onboarding
      hasCompletedOnboarding: false,

      // Actions
      setShowReadingProgress: (value) => set({ showReadingProgress: value }),
      setShowSeriesProgressBar: (value) =>
        set({ showSeriesProgressBar: value }),
      setCardSize: (value) => set({ cardSize: value }),
      setConfirmBeforeDelete: (value) => set({ confirmBeforeDelete: value }),
      setDefaultOwnershipStatus: (value) =>
        set({ defaultOwnershipStatus: value }),
      setDefaultSearchSource: (value) => set({ defaultSearchSource: value }),
      setDefaultScrapeMode: (value) => set({ defaultScrapeMode: value }),
      setAutoPurchaseDate: (value) => set({ autoPurchaseDate: value }),
      setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
      setEnableAnimations: (value) => set({ enableAnimations: value }),
      setDisplayFont: (value) => set({ displayFont: value }),
      setBodyFont: (value) => set({ bodyFont: value }),
      setDateFormat: (value) => set({ dateFormat: value }),
      setHighContrastMode: (value) => set({ highContrastMode: value }),
      setFontSizeScale: (value) => set({ fontSizeScale: value }),
      setFocusIndicators: (value) => set({ focusIndicators: value }),
      setHasCompletedOnboarding: (value) =>
        set({ hasCompletedOnboarding: value })
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
        hasCompletedOnboarding: state.hasCompletedOnboarding
      })
    }
  )
)
