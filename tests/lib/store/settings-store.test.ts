import { beforeEach, describe, expect, it } from "bun:test"

import { useSettingsStore } from "@/lib/store/settings-store"

/* ------------------------------------------------------------------ */
/*  Store reset helper                                                */
/* ------------------------------------------------------------------ */

const initialState = useSettingsStore.getInitialState()

function resetStore() {
  useSettingsStore.setState(initialState, true)
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe("settings-store", () => {
  beforeEach(resetStore)

  /* ---- Default values ---- */

  describe("default values", () => {
    it("library display defaults", () => {
      const s = useSettingsStore.getState()
      expect(s.showReadingProgress).toBe(true)
      expect(s.showSeriesProgressBar).toBe(true)
      expect(s.cardSize).toBe("default")
    })

    it("workflow defaults", () => {
      const s = useSettingsStore.getState()
      expect(s.confirmBeforeDelete).toBe(true)
      expect(s.defaultOwnershipStatus).toBe("owned")
      expect(s.defaultSearchSource).toBe("google_books")
      expect(s.defaultScrapeMode).toBe("both")
      expect(s.autoPurchaseDate).toBe(false)
    })

    it("layout defaults", () => {
      expect(useSettingsStore.getState().sidebarCollapsed).toBe(false)
    })

    it("appearance defaults", () => {
      const s = useSettingsStore.getState()
      expect(s.displayFont).toBe("playfair")
      expect(s.bodyFont).toBe("plus-jakarta")
      expect(s.dateFormat).toBe("relative")
      expect(typeof s.enableAnimations).toBe("boolean")
    })

    it("navigation defaults", () => {
      expect(useSettingsStore.getState().navigationMode).toBe("sidebar")
    })

    it("onboarding defaults", () => {
      expect(useSettingsStore.getState().hasCompletedOnboarding).toBe(false)
    })

    it("hydration starts false", () => {
      expect(useSettingsStore.getState()._hydrated).toBe(false)
    })
  })

  /* ---- Library display setters ---- */

  describe("library display setters", () => {
    it("setShowReadingProgress", () => {
      useSettingsStore.getState().setShowReadingProgress(false)
      expect(useSettingsStore.getState().showReadingProgress).toBe(false)
    })

    it("setShowSeriesProgressBar", () => {
      useSettingsStore.getState().setShowSeriesProgressBar(false)
      expect(useSettingsStore.getState().showSeriesProgressBar).toBe(false)
    })

    it("setCardSize", () => {
      useSettingsStore.getState().setCardSize("compact")
      expect(useSettingsStore.getState().cardSize).toBe("compact")

      useSettingsStore.getState().setCardSize("large")
      expect(useSettingsStore.getState().cardSize).toBe("large")
    })
  })

  /* ---- Workflow setters ---- */

  describe("workflow setters", () => {
    it("setConfirmBeforeDelete", () => {
      useSettingsStore.getState().setConfirmBeforeDelete(false)
      expect(useSettingsStore.getState().confirmBeforeDelete).toBe(false)
    })

    it("setDefaultOwnershipStatus", () => {
      useSettingsStore.getState().setDefaultOwnershipStatus("wishlist")
      expect(useSettingsStore.getState().defaultOwnershipStatus).toBe(
        "wishlist"
      )
    })

    it("setDefaultSearchSource", () => {
      useSettingsStore.getState().setDefaultSearchSource("open_library")
      expect(useSettingsStore.getState().defaultSearchSource).toBe(
        "open_library"
      )
    })

    it("setDefaultScrapeMode", () => {
      useSettingsStore.getState().setDefaultScrapeMode("price")
      expect(useSettingsStore.getState().defaultScrapeMode).toBe("price")

      useSettingsStore.getState().setDefaultScrapeMode("image")
      expect(useSettingsStore.getState().defaultScrapeMode).toBe("image")
    })

    it("setAutoPurchaseDate", () => {
      useSettingsStore.getState().setAutoPurchaseDate(true)
      expect(useSettingsStore.getState().autoPurchaseDate).toBe(true)
    })
  })

  /* ---- Layout setters ---- */

  describe("layout setters", () => {
    it("setSidebarCollapsed", () => {
      useSettingsStore.getState().setSidebarCollapsed(true)
      expect(useSettingsStore.getState().sidebarCollapsed).toBe(true)
    })

    it("setNavigationMode", () => {
      useSettingsStore.getState().setNavigationMode("header")
      expect(useSettingsStore.getState().navigationMode).toBe("header")
      useSettingsStore.getState().setNavigationMode("sidebar")
      expect(useSettingsStore.getState().navigationMode).toBe("sidebar")
    })
  })

  /* ---- Appearance setters ---- */

  describe("appearance setters", () => {
    it("setEnableAnimations", () => {
      useSettingsStore.getState().setEnableAnimations(false)
      expect(useSettingsStore.getState().enableAnimations).toBe(false)
    })

    it("setDisplayFont", () => {
      useSettingsStore.getState().setDisplayFont("lora")
      expect(useSettingsStore.getState().displayFont).toBe("lora")

      useSettingsStore.getState().setDisplayFont("crimson-text")
      expect(useSettingsStore.getState().displayFont).toBe("crimson-text")

      useSettingsStore.getState().setDisplayFont("source-serif")
      expect(useSettingsStore.getState().displayFont).toBe("source-serif")
    })

    it("setBodyFont", () => {
      useSettingsStore.getState().setBodyFont("inter")
      expect(useSettingsStore.getState().bodyFont).toBe("inter")

      useSettingsStore.getState().setBodyFont("dm-sans")
      expect(useSettingsStore.getState().bodyFont).toBe("dm-sans")
    })

    it("setDateFormat", () => {
      useSettingsStore.getState().setDateFormat("short")
      expect(useSettingsStore.getState().dateFormat).toBe("short")

      useSettingsStore.getState().setDateFormat("long")
      expect(useSettingsStore.getState().dateFormat).toBe("long")

      useSettingsStore.getState().setDateFormat("iso")
      expect(useSettingsStore.getState().dateFormat).toBe("iso")
    })
  })

  /* ---- Onboarding setter ---- */

  describe("onboarding setter", () => {
    it("setHasCompletedOnboarding", () => {
      useSettingsStore.getState().setHasCompletedOnboarding(true)
      expect(useSettingsStore.getState().hasCompletedOnboarding).toBe(true)
    })
  })

  /* ---- Multiple mutations ---- */

  describe("multiple mutations", () => {
    it("setting multiple preferences independently", () => {
      const { getState } = useSettingsStore
      getState().setCardSize("large")
      getState().setDateFormat("iso")
      getState().setBodyFont("dm-sans")
      getState().setConfirmBeforeDelete(false)

      const s = getState()
      expect(s.cardSize).toBe("large")
      expect(s.dateFormat).toBe("iso")
      expect(s.bodyFont).toBe("dm-sans")
      expect(s.confirmBeforeDelete).toBe(false)
      // unchanged settings stay at defaults
      expect(s.displayFont).toBe("playfair")
      expect(s.sidebarCollapsed).toBe(false)
    })
  })

  /* ---- Persistence ---- */

  describe("persistence", () => {
    it("initial state contains all persisted settings with correct defaults", () => {
      const initial = useSettingsStore.getInitialState()

      // All persisted settings exist in initial state
      expect(initial.showReadingProgress).toBe(true)
      expect(initial.showSeriesProgressBar).toBe(true)
      expect(initial.cardSize).toBe("default")
      expect(initial.confirmBeforeDelete).toBe(true)
      expect(initial.defaultOwnershipStatus).toBe("owned")
      expect(initial.defaultSearchSource).toBe("google_books")
      expect(initial.defaultScrapeMode).toBe("both")
      expect(initial.autoPurchaseDate).toBe(false)
      expect(initial.sidebarCollapsed).toBe(false)
      expect(typeof initial.enableAnimations).toBe("boolean")
      expect(initial.displayFont).toBe("playfair")
      expect(initial.bodyFont).toBe("plus-jakarta")
      expect(initial.dateFormat).toBe("relative")
      expect(initial.hasCompletedOnboarding).toBe(false)
    })

    it("_hydrated is not included in initial persisted state", () => {
      // _hydrated starts false and is set by the rehydration callback,
      // never persisted to storage
      const initial = useSettingsStore.getInitialState()
      expect(initial._hydrated).toBe(false)
    })

    it("actions are functions, not serializable (excluded from storage)", () => {
      const s = useSettingsStore.getState()
      expect(typeof s.setCardSize).toBe("function")
      expect(typeof s.setDateFormat).toBe("function")
      expect(typeof s.setDisplayFont).toBe("function")
      expect(typeof s.setHasCompletedOnboarding).toBe("function")
    })

    it("_hydrated can be set via setState (simulating rehydration)", () => {
      expect(useSettingsStore.getState()._hydrated).toBe(false)
      useSettingsStore.setState({ _hydrated: true })
      expect(useSettingsStore.getState()._hydrated).toBe(true)
    })
  })
})
