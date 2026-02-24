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

  /* ---- Accessibility setters ---- */

  describe("accessibility setters", () => {
    it("setHighContrastMode", () => {
      useSettingsStore.getState().setHighContrastMode(true)
      expect(useSettingsStore.getState().highContrastMode).toBe(true)

      useSettingsStore.getState().setHighContrastMode(false)
      expect(useSettingsStore.getState().highContrastMode).toBe(false)
    })

    it("setFontSizeScale", () => {
      useSettingsStore.getState().setFontSizeScale("large")
      expect(useSettingsStore.getState().fontSizeScale).toBe("large")

      useSettingsStore.getState().setFontSizeScale("x-large")
      expect(useSettingsStore.getState().fontSizeScale).toBe("x-large")

      useSettingsStore.getState().setFontSizeScale("default")
      expect(useSettingsStore.getState().fontSizeScale).toBe("default")
    })

    it("setFocusIndicators", () => {
      useSettingsStore.getState().setFocusIndicators("enhanced")
      expect(useSettingsStore.getState().focusIndicators).toBe("enhanced")

      useSettingsStore.getState().setFocusIndicators("default")
      expect(useSettingsStore.getState().focusIndicators).toBe("default")
    })
  })

  /* ---- Automation setter ---- */

  describe("automation setter", () => {
    it("setAutomatedPriceChecks", () => {
      useSettingsStore.getState().setAutomatedPriceChecks(false)
      expect(useSettingsStore.getState().automatedPriceChecks).toBe(false)

      useSettingsStore.getState().setAutomatedPriceChecks(true)
      expect(useSettingsStore.getState().automatedPriceChecks).toBe(true)
    })
  })

  /* ---- Notification setters ---- */

  describe("notification setters", () => {
    it("setReleaseReminders", () => {
      useSettingsStore.getState().setReleaseReminders(false)
      expect(useSettingsStore.getState().releaseReminders).toBe(false)
    })

    it("setReleaseReminderDays", () => {
      useSettingsStore.getState().setReleaseReminderDays(14)
      expect(useSettingsStore.getState().releaseReminderDays).toBe(14)

      useSettingsStore.getState().setReleaseReminderDays(30)
      expect(useSettingsStore.getState().releaseReminderDays).toBe(30)
    })

    it("setNotifyOnImportComplete", () => {
      useSettingsStore.getState().setNotifyOnImportComplete(false)
      expect(useSettingsStore.getState().notifyOnImportComplete).toBe(false)
    })

    it("setNotifyOnScrapeComplete", () => {
      useSettingsStore.getState().setNotifyOnScrapeComplete(false)
      expect(useSettingsStore.getState().notifyOnScrapeComplete).toBe(false)
    })

    it("setNotifyOnPriceAlert", () => {
      useSettingsStore.getState().setNotifyOnPriceAlert(false)
      expect(useSettingsStore.getState().notifyOnPriceAlert).toBe(false)
    })

    it("setEmailNotifications", () => {
      useSettingsStore.getState().setEmailNotifications(true)
      expect(useSettingsStore.getState().emailNotifications).toBe(true)
    })
  })

  /* ---- Library sort setters ---- */

  describe("library sort setters", () => {
    it("setDefaultSortBy", () => {
      useSettingsStore.getState().setDefaultSortBy("author")
      expect(useSettingsStore.getState().defaultSortBy).toBe("author")

      useSettingsStore.getState().setDefaultSortBy("rating")
      expect(useSettingsStore.getState().defaultSortBy).toBe("rating")

      useSettingsStore.getState().setDefaultSortBy("created_at")
      expect(useSettingsStore.getState().defaultSortBy).toBe("created_at")
    })

    it("setDefaultSortDir", () => {
      useSettingsStore.getState().setDefaultSortDir("desc")
      expect(useSettingsStore.getState().defaultSortDir).toBe("desc")

      useSettingsStore.getState().setDefaultSortDir("asc")
      expect(useSettingsStore.getState().defaultSortDir).toBe("asc")
    })
  })

  /* ---- Dashboard layout setters ---- */

  describe("dashboard layout setters", () => {
    it("setDashboardLayout replaces the layout", () => {
      const newLayout = {
        order: ["stats"] as const,
        hidden: ["activity"] as const
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useSettingsStore.getState().setDashboardLayout(newLayout as any)
      expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (useSettingsStore.getState().dashboardLayout as any).order
      ).toEqual(["stats"])
    })

    it("resetDashboardLayout restores default layout", () => {
      const newLayout = { order: ["stats"] as const, hidden: [] as const }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useSettingsStore.getState().setDashboardLayout(newLayout as any)
      useSettingsStore.getState().resetDashboardLayout()
      const { dashboardLayout } = useSettingsStore.getState()
      // Default layout has all widgets
      expect(dashboardLayout.order.length).toBeGreaterThan(5)
      expect(dashboardLayout.hidden).toHaveLength(0)
    })
  })

  /* ---- Reading goal setter ---- */

  describe("reading goal setter", () => {
    it("setReadingGoal sets a numeric goal", () => {
      useSettingsStore.getState().setReadingGoal(52)
      expect(useSettingsStore.getState().readingGoal).toBe(52)
    })

    it("setReadingGoal accepts undefined to clear the goal", () => {
      useSettingsStore.getState().setReadingGoal(12)
      useSettingsStore.getState().setReadingGoal(undefined)
      expect(useSettingsStore.getState().readingGoal).toBeUndefined()
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

  /* ---- loadFromServer ---- */

  describe("loadFromServer", () => {
    it("applies server settings when server data is newer than local", async () => {
      // Simulate a local state with a known lastSyncedAt
      useSettingsStore.setState({ lastSyncedAt: 1000 })

      const serverSettings = {
        showReadingProgress: false,
        cardSize: "large",
        lastSyncedAt: 2000 // newer than local 1000
      }

      const originalFetch = globalThis.fetch
      globalThis.fetch = (async () =>
        ({
          ok: true,
          json: async () => ({ data: { settings: serverSettings } })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as Response) as any

      await useSettingsStore.getState().loadFromServer()

      const s = useSettingsStore.getState()
      expect(s.showReadingProgress).toBe(false)
      expect(s.cardSize).toBe("large")
      expect(s.lastSyncedAt).toBe(2000)

      globalThis.fetch = originalFetch
    })

    it("skips applying server settings when server data is older than local", async () => {
      useSettingsStore.setState({ lastSyncedAt: 5000, cardSize: "compact" })

      const serverSettings = {
        cardSize: "large",
        lastSyncedAt: 1000 // older than local 5000
      }

      const originalFetch = globalThis.fetch
      globalThis.fetch = (async () =>
        ({
          ok: true,
          json: async () => ({ data: { settings: serverSettings } })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as Response) as any

      await useSettingsStore.getState().loadFromServer()

      // Should not have overwritten the local value
      expect(useSettingsStore.getState().cardSize).toBe("compact")

      globalThis.fetch = originalFetch
    })

    it("does nothing when fetch returns a non-ok response", async () => {
      useSettingsStore.setState({ cardSize: "default" })

      const originalFetch = globalThis.fetch
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      globalThis.fetch = (async () => ({ ok: false }) as Response) as any

      await useSettingsStore.getState().loadFromServer()

      expect(useSettingsStore.getState().cardSize).toBe("default")
      globalThis.fetch = originalFetch
    })

    it("does not throw when fetch rejects", async () => {
      const originalFetch = globalThis.fetch
      globalThis.fetch = (async () => {
        throw new Error("Network failure")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any

      // Must not propagate
      await useSettingsStore.getState().loadFromServer()

      globalThis.fetch = originalFetch
    })

    it("does nothing when server data is missing from response", async () => {
      useSettingsStore.setState({ cardSize: "compact" })

      const originalFetch = globalThis.fetch
      globalThis.fetch = (async () =>
        ({
          ok: true,
          json: async () => ({ data: null })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as Response) as any

      await useSettingsStore.getState().loadFromServer()

      expect(useSettingsStore.getState().cardSize).toBe("compact")
      globalThis.fetch = originalFetch
    })
  })
})
