"use client"

import { ThemeToggle } from "@/components/theme-toggle"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import type {
  BodyFont,
  DateFormat,
  DisplayFont
} from "@/lib/store/settings-store"
import { useSettingsStore } from "@/lib/store/settings-store"

const displayFontOptions: Array<{ value: DisplayFont; label: string }> = [
  { value: "playfair", label: "Playfair Display" },
  { value: "lora", label: "Lora" },
  { value: "crimson-text", label: "Crimson Text" },
  { value: "source-serif", label: "Source Serif" }
]

const bodyFontOptions: Array<{ value: BodyFont; label: string }> = [
  { value: "plus-jakarta", label: "Plus Jakarta Sans" },
  { value: "inter", label: "Inter" },
  { value: "dm-sans", label: "DM Sans" }
]

const dateFormatOptions: Array<{
  value: DateFormat
  label: string
  example: string
}> = [
  { value: "relative", label: "Relative", example: "2d ago" },
  { value: "short", label: "Short", example: "Jan 5, 2026" },
  { value: "long", label: "Long", example: "January 5, 2026" },
  { value: "iso", label: "ISO", example: "2026-01-05" }
]

const isValidOption = <T extends string>(
  value: string | null | undefined,
  options: Array<{ value: T }>
): value is T =>
  value !== null &&
  value !== undefined &&
  options.some((option) => option.value === value)

export function AppearanceSection() {
  const {
    displayFont,
    setDisplayFont,
    bodyFont,
    setBodyFont,
    dateFormat,
    setDateFormat
  } = useSettingsStore()

  return (
    <section
      id="appearance"
      className="animate-fade-in-up scroll-mt-24 py-8"
      style={{ animationDelay: "150ms", animationFillMode: "both" }}
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
            <circle
              cx="13.5"
              cy="6.5"
              r="1.5"
              fill="currentColor"
              stroke="none"
            />
            <circle
              cx="17.5"
              cy="10.5"
              r="1.5"
              fill="currentColor"
              stroke="none"
            />
            <circle
              cx="8.5"
              cy="7.5"
              r="1.5"
              fill="currentColor"
              stroke="none"
            />
            <circle
              cx="6.5"
              cy="12.5"
              r="1.5"
              fill="currentColor"
              stroke="none"
            />
            <path d="M12 2a10 10 0 0 0 0 20 1.7 1.7 0 0 0 1.7-1.7c0-.5-.2-.8-.4-1.1a1.7 1.7 0 0 1 1.3-2.8H16a5.5 5.5 0 0 0 5.5-5.5C21.5 6 17.2 2 12 2z" />
          </svg>
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Appearance
          </h2>
          <p className="text-muted-foreground text-sm">
            Theme, fonts, and visual preferences
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {/* Theme & Motion */}
        <div className="bg-muted/30 rounded-2xl border p-5">
          <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-wider uppercase">
            Theme & Motion
          </p>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="font-medium">Color theme</Label>
                <p className="text-muted-foreground text-sm">
                  Choose your preferred color scheme
                </p>
              </div>
              <ThemeToggle />
            </div>
            <div className="border-border/40 border-t" />
            <div className="bg-muted/40 flex items-start gap-3 rounded-xl px-4 py-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <p className="text-muted-foreground text-sm">
                Animation preferences have moved.{" "}
                <a
                  href="#accessibility"
                  className="text-primary font-medium underline-offset-4 hover:underline"
                >
                  Accessibility → Reduce Motion
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Typography */}
        <div className="bg-muted/30 rounded-2xl border p-5">
          <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-wider uppercase">
            Typography
          </p>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="display-font" className="font-medium">
                  Heading font
                </Label>
                <p className="text-muted-foreground text-sm">
                  The serif font used for titles and headings.
                </p>
              </div>
              <Select
                value={displayFont}
                onValueChange={(value) => {
                  if (isValidOption(value, displayFontOptions)) {
                    setDisplayFont(value)
                  }
                }}
              >
                <SelectTrigger id="display-font" className="sm:w-52">
                  <SelectValue placeholder="Select font" />
                </SelectTrigger>
                <SelectContent>
                  {displayFontOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span
                        style={{
                          fontFamily: `var(--font-${option.value}), serif`
                        }}
                      >
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border-border/40 border-t" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="body-font" className="font-medium">
                  Body font
                </Label>
                <p className="text-muted-foreground text-sm">
                  The sans-serif font used for body text and UI elements.
                </p>
              </div>
              <Select
                value={bodyFont}
                onValueChange={(value) => {
                  if (isValidOption(value, bodyFontOptions)) {
                    setBodyFont(value)
                  }
                }}
              >
                <SelectTrigger id="body-font" className="sm:w-52">
                  <SelectValue placeholder="Select font" />
                </SelectTrigger>
                <SelectContent>
                  {bodyFontOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span
                        style={{
                          fontFamily: `var(--font-${option.value}), sans-serif`
                        }}
                      >
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Live font preview */}
        <div className="bg-card rounded-2xl border p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Live Preview
            </p>
            <div className="flex gap-2">
              <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-[11px] font-medium">
                {displayFontOptions.find((o) => o.value === displayFont)?.label}
              </span>
              <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-[11px] font-medium">
                {bodyFontOptions.find((o) => o.value === bodyFont)?.label}
              </span>
            </div>
          </div>
          <h3 className="font-display text-2xl leading-snug font-semibold">
            The quick brown fox jumps over the lazy dog
          </h3>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            ShelfArc helps you track, organize, and celebrate your collection
            with a beautifully crafted personal library manager.
          </p>
        </div>

        {/* Formatting */}
        <div className="bg-muted/30 rounded-2xl border p-5">
          <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-wider uppercase">
            Formatting
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="date-format" className="font-medium">
                Date format
              </Label>
              <p className="text-muted-foreground text-sm">
                How dates are displayed throughout the app.
              </p>
            </div>
            <Select
              value={dateFormat}
              onValueChange={(value) => {
                if (isValidOption(value, dateFormatOptions)) {
                  setDateFormat(value)
                }
              }}
            >
              <SelectTrigger id="date-format" className="sm:w-52">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                {dateFormatOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}{" "}
                    <span className="text-muted-foreground">
                      ({option.example})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </section>
  )
}
