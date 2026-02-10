import { create } from "zustand"
import { persist } from "zustand/middleware"

export type DisplayFont = "playfair" | "lora" | "crimson-text" | "source-serif"
export type BodyFont = "plus-jakarta" | "inter" | "dm-sans"
export type CardSize = "compact" | "default" | "large"
export type DateFormat = "relative" | "short" | "long" | "iso"
export type DefaultOwnershipStatus = "owned" | "wishlist"
export type SearchSource = "google_books" | "open_library"

interface SettingsState {
  // Library display
  showReadingProgress: boolean
  showSeriesProgressBar: boolean
  cardSize: CardSize

  // Workflow defaults
  confirmBeforeDelete: boolean
  defaultOwnershipStatus: DefaultOwnershipStatus
  defaultSearchSource: SearchSource
  autoPurchaseDate: boolean

  // Layout
  sidebarCollapsed: boolean

  // Appearance
  enableAnimations: boolean
  displayFont: DisplayFont
  bodyFont: BodyFont
  dateFormat: DateFormat

  // Actions
  setShowReadingProgress: (value: boolean) => void
  setShowSeriesProgressBar: (value: boolean) => void
  setCardSize: (value: CardSize) => void
  setConfirmBeforeDelete: (value: boolean) => void
  setDefaultOwnershipStatus: (value: DefaultOwnershipStatus) => void
  setDefaultSearchSource: (value: SearchSource) => void
  setAutoPurchaseDate: (value: boolean) => void
  setSidebarCollapsed: (value: boolean) => void
  setEnableAnimations: (value: boolean) => void
  setDisplayFont: (value: DisplayFont) => void
  setBodyFont: (value: BodyFont) => void
  setDateFormat: (value: DateFormat) => void
}

/** Maps font setting keys to the CSS variable references loaded by next/font */
export const DISPLAY_FONT_MAP: Record<DisplayFont, string> = {
  playfair: "var(--font-playfair)",
  lora: "var(--font-lora)",
  "crimson-text": "var(--font-crimson-text)",
  "source-serif": "var(--font-source-serif)"
}

export const BODY_FONT_MAP: Record<BodyFont, string> = {
  "plus-jakarta": "var(--font-plus-jakarta)",
  inter: "var(--font-inter)",
  "dm-sans": "var(--font-dm-sans)"
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Library display
      showReadingProgress: true,
      showSeriesProgressBar: true,
      cardSize: "default",

      // Workflow defaults
      confirmBeforeDelete: true,
      defaultOwnershipStatus: "owned",
      defaultSearchSource: "google_books",
      autoPurchaseDate: false,

      // Layout
      sidebarCollapsed: false,

      // Appearance
      enableAnimations: true,
      displayFont: "playfair",
      bodyFont: "plus-jakarta",
      dateFormat: "relative",

      // Actions
      setShowReadingProgress: (value) => set({ showReadingProgress: value }),
      setShowSeriesProgressBar: (value) =>
        set({ showSeriesProgressBar: value }),
      setCardSize: (value) => set({ cardSize: value }),
      setConfirmBeforeDelete: (value) => set({ confirmBeforeDelete: value }),
      setDefaultOwnershipStatus: (value) =>
        set({ defaultOwnershipStatus: value }),
      setDefaultSearchSource: (value) => set({ defaultSearchSource: value }),
      setAutoPurchaseDate: (value) => set({ autoPurchaseDate: value }),
      setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
      setEnableAnimations: (value) => set({ enableAnimations: value }),
      setDisplayFont: (value) => set({ displayFont: value }),
      setBodyFont: (value) => set({ bodyFont: value }),
      setDateFormat: (value) => set({ dateFormat: value })
    }),
    {
      name: "shelfarc-settings",
      partialize: (state) => ({
        showReadingProgress: state.showReadingProgress,
        showSeriesProgressBar: state.showSeriesProgressBar,
        cardSize: state.cardSize,
        confirmBeforeDelete: state.confirmBeforeDelete,
        defaultOwnershipStatus: state.defaultOwnershipStatus,
        defaultSearchSource: state.defaultSearchSource,
        autoPurchaseDate: state.autoPurchaseDate,
        sidebarCollapsed: state.sidebarCollapsed,
        enableAnimations: state.enableAnimations,
        displayFont: state.displayFont,
        bodyFont: state.bodyFont,
        dateFormat: state.dateFormat
      })
    }
  )
)
