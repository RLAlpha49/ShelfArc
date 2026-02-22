import type { StateCreator } from "zustand"

import type { AmazonDomain, CurrencyCode, PriceSource } from "../library-store"

/** User preference state slice for the library store. @source */
export interface PreferencesSlice {
  deleteSeriesVolumes: boolean
  priceSource: PriceSource
  amazonDomain: AmazonDomain
  amazonPreferKindle: boolean
  amazonFallbackToKindle: boolean
  priceDisplayCurrency: CurrencyCode
  showAmazonDisclaimer: boolean
  dismissedSuggestions: string[]

  setDeleteSeriesVolumes: (value: boolean) => void
  setPriceSource: (value: PriceSource) => void
  setAmazonDomain: (value: AmazonDomain) => void
  setAmazonPreferKindle: (value: boolean) => void
  setAmazonFallbackToKindle: (value: boolean) => void
  setPriceDisplayCurrency: (value: CurrencyCode) => void
  setShowAmazonDisclaimer: (value: boolean) => void
  dismissSuggestion: (seriesId: string) => void
}

export const createPreferencesSlice: StateCreator<
  PreferencesSlice,
  [],
  [],
  PreferencesSlice
> = (set) => ({
  deleteSeriesVolumes: false,
  priceSource: "amazon",
  amazonDomain: "amazon.com",
  amazonPreferKindle: false,
  amazonFallbackToKindle: false,
  priceDisplayCurrency: "USD",
  showAmazonDisclaimer: true,
  dismissedSuggestions: [],

  setDeleteSeriesVolumes: (value) => set({ deleteSeriesVolumes: value }),
  setPriceSource: (value) => set({ priceSource: value }),
  setAmazonDomain: (value) => set({ amazonDomain: value }),
  setAmazonPreferKindle: (value) => set({ amazonPreferKindle: value }),
  setAmazonFallbackToKindle: (value) => set({ amazonFallbackToKindle: value }),
  setPriceDisplayCurrency: (value) => set({ priceDisplayCurrency: value }),
  setShowAmazonDisclaimer: (value) => set({ showAmazonDisclaimer: value }),
  dismissSuggestion: (seriesId) =>
    set((state) => ({
      dismissedSuggestions: state.dismissedSuggestions.includes(seriesId)
        ? state.dismissedSuggestions
        : [...state.dismissedSuggestions, seriesId]
    }))
})
