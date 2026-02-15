"use client"

import { useEffect } from "react"
import {
  useSettingsStore,
  DISPLAY_FONT_MAP,
  BODY_FONT_MAP
} from "@/lib/store/settings-store"
import type { FontSizeScale } from "@/lib/store/settings-store"

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
