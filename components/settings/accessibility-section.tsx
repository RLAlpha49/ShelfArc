"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { FocusIndicators, FontSizeScale } from "@/lib/store/settings-store"
import { useSettingsStore } from "@/lib/store/settings-store"

const fontSizeScaleOptions: Array<{ value: FontSizeScale; label: string }> = [
  { value: "default", label: "Default (100%)" },
  { value: "large", label: "Large (112%)" },
  { value: "x-large", label: "Extra Large (125%)" }
]

const focusIndicatorOptions: Array<{ value: FocusIndicators; label: string }> =
  [
    { value: "default", label: "Default" },
    { value: "enhanced", label: "Enhanced" }
  ]

const isValidOption = <T extends string>(
  value: string | null | undefined,
  options: Array<{ value: T }>
): value is T =>
  value !== null &&
  value !== undefined &&
  options.some((option) => option.value === value)

export function AccessibilitySection() {
  const {
    highContrastMode,
    setHighContrastMode,
    fontSizeScale,
    setFontSizeScale,
    focusIndicators,
    setFocusIndicators,
    enableAnimations,
    setEnableAnimations
  } = useSettingsStore()

  return (
    <section
      id="accessibility"
      className="animate-fade-in-up scroll-mt-24 py-8"
      style={{ animationDelay: "187ms", animationFillMode: "both" }}
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="bg-primary/8 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4.5 w-4.5"
          >
            <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Accessibility
          </h2>
          <p className="text-muted-foreground text-sm">
            Visual adjustments and assistive preferences
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {/* Visual */}
        <div className="bg-muted/30 rounded-2xl border p-5">
          <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-wider uppercase">
            Visual
          </p>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="high-contrast" className="font-medium">
                  High contrast
                </Label>
                <p className="text-muted-foreground text-sm">
                  Increase contrast for borders, text, and interactive elements.
                </p>
              </div>
              <Switch
                id="high-contrast"
                checked={highContrastMode}
                onCheckedChange={setHighContrastMode}
              />
            </div>
            <div className="border-border/40 border-t" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="font-size-scale" className="font-medium">
                  Font size
                </Label>
                <p className="text-muted-foreground text-sm">
                  Scale text size across the entire application.
                </p>
              </div>
              <Select
                value={fontSizeScale}
                onValueChange={(value) => {
                  if (isValidOption(value, fontSizeScaleOptions)) {
                    setFontSizeScale(value)
                  }
                }}
              >
                <SelectTrigger id="font-size-scale" className="sm:w-52">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {fontSizeScaleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Interaction */}
        <div className="bg-muted/30 rounded-2xl border p-5">
          <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-wider uppercase">
            Interaction
          </p>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="focus-indicators" className="font-medium">
                  Focus indicators
                </Label>
                <p className="text-muted-foreground text-sm">
                  Enhanced mode adds larger, more visible outlines on focused
                  elements.
                </p>
              </div>
              <Select
                value={focusIndicators}
                onValueChange={(value) => {
                  if (isValidOption(value, focusIndicatorOptions)) {
                    setFocusIndicators(value)
                  }
                }}
              >
                <SelectTrigger id="focus-indicators" className="sm:w-52">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  {focusIndicatorOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border-border/40 border-t" />
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="reduce-motion" className="font-medium">
                  Reduce motion
                </Label>
                <p className="text-muted-foreground text-sm">
                  Disable transitions and animations throughout the app.
                </p>
              </div>
              <Switch
                id="reduce-motion"
                checked={!enableAnimations}
                onCheckedChange={(checked) => setEnableAnimations(!checked)}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
