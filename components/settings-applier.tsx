"use client"

import { useEffect } from "react"
import {
  useSettingsStore,
  DISPLAY_FONT_MAP,
  BODY_FONT_MAP
} from "@/lib/store/settings-store"

/**
 * Client component that applies global settings (fonts, animations) to the
 * document element. Renders nothing — pure side-effect bridge between
 * Zustand state and the DOM.
 */
export function SettingsApplier() {
  const displayFont = useSettingsStore((s) => s.displayFont)
  const bodyFont = useSettingsStore((s) => s.bodyFont)
  const enableAnimations = useSettingsStore((s) => s.enableAnimations)

  // Apply display font
  useEffect(() => {
    const value = DISPLAY_FONT_MAP[displayFont]
    document.documentElement.style.setProperty("--font-display", value)
    return () => {
      document.documentElement.style.removeProperty("--font-display")
    }
  }, [displayFont])

  // Apply body font
  useEffect(() => {
    const value = BODY_FONT_MAP[bodyFont]
    document.documentElement.style.setProperty("--font-sans", value)
    return () => {
      document.documentElement.style.removeProperty("--font-sans")
    }
  }, [bodyFont])

  // Toggle animations
  useEffect(() => {
    document.documentElement.classList.toggle(
      "no-animations",
      !enableAnimations
    )
    return () => {
      document.documentElement.classList.remove("no-animations")
    }
  }, [enableAnimations])

  return null
}
