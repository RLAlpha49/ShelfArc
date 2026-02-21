"use client"

import { useEffect } from "react"

import type { FontSizeScale } from "@/lib/store/settings-store"
import {
  BODY_FONT_MAP,
  DISPLAY_FONT_MAP,
  useSettingsStore
} from "@/lib/store/settings-store"

/**
 * Client component that applies global settings (fonts, animations) to the
 * document element. Renders nothing — pure side-effect bridge between
 * Zustand state and the DOM.
 * @source
 */
export function SettingsApplier() {
  const displayFont = useSettingsStore((s) => s.displayFont)
  const bodyFont = useSettingsStore((s) => s.bodyFont)
  const enableAnimations = useSettingsStore((s) => s.enableAnimations)

  // Apply display font
  useEffect(() => {
    const value = DISPLAY_FONT_MAP[displayFont]
    document.documentElement.style.setProperty("--font-display", value)

    if (displayFont === "playfair")
      loadGoogleFont("Playfair+Display:ital,wght@0,400..900;1,400..900")
    else if (displayFont === "crimson-text")
      loadGoogleFont(
        "Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700"
      )
    else if (displayFont === "source-serif")
      loadGoogleFont(
        "Source+Serif+4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900"
      )

    return () => {
      document.documentElement.style.removeProperty("--font-display")
    }
  }, [displayFont])

  // Apply body font
  useEffect(() => {
    const value = BODY_FONT_MAP[bodyFont]
    document.documentElement.style.setProperty("--font-sans", value)

    if (bodyFont === "plus-jakarta")
      loadGoogleFont("Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800")
    else if (bodyFont === "dm-sans")
      loadGoogleFont(
        "DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000"
      )

    return () => {
      document.documentElement.style.removeProperty("--font-sans")
    }
  }, [bodyFont])

  // Toggle animations
  useEffect(() => {
    document.documentElement.dataset.animations = enableAnimations
      ? "enabled"
      : "disabled"
    document.documentElement.classList.toggle(
      "no-animations",
      !enableAnimations
    )
    return () => {
      document.documentElement.classList.remove("no-animations")
    }
  }, [enableAnimations])

  const highContrastMode = useSettingsStore((s) => s.highContrastMode)
  const fontSizeScale = useSettingsStore((s) => s.fontSizeScale)
  const focusIndicators = useSettingsStore((s) => s.focusIndicators)

  // Apply high contrast mode
  useEffect(() => {
    document.documentElement.dataset.contrast = highContrastMode
      ? "high"
      : "default"
    return () => {
      delete document.documentElement.dataset.contrast
    }
  }, [highContrastMode])

  // Apply font size scale
  useEffect(() => {
    const scaleMap: Record<FontSizeScale, string> = {
      default: "1",
      large: "1.125",
      "x-large": "1.25"
    }
    document.documentElement.style.setProperty(
      "--font-size-scale",
      scaleMap[fontSizeScale]
    )
    return () => {
      document.documentElement.style.removeProperty("--font-size-scale")
    }
  }, [fontSizeScale])

  // Apply focus indicators
  useEffect(() => {
    document.documentElement.dataset.focus = focusIndicators
    return () => {
      delete document.documentElement.dataset.focus
    }
  }, [focusIndicators])

  return null
}

function loadGoogleFont(family: string) {
  const id = `font-${family.split(":")[0]}`
  if (document.getElementById(id)) return
  const link = document.createElement("link")
  link.id = id
  link.rel = "stylesheet"
  link.href = `https://fonts.googleapis.com/css2?family=${family}&display=swap`
  document.head.appendChild(link)
}
