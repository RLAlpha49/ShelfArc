"use client"

import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { BulkScrapeMode } from "@/lib/hooks/use-bulk-scrape"
import { useLibraryStore } from "@/lib/store/library-store"
import type {
  CardSize,
  DefaultOwnershipStatus,
  NavigationMode,
  SearchSource
} from "@/lib/store/settings-store"
import { useSettingsStore } from "@/lib/store/settings-store"

const cardSizeOptions: Array<{ value: CardSize; label: string }> = [
  { value: "compact", label: "Compact" },
  { value: "default", label: "Default" },
  { value: "large", label: "Large" }
]

const ownershipStatusOptions: Array<{
  value: DefaultOwnershipStatus
  label: string
}> = [
  { value: "owned", label: "Owned" },
  { value: "wishlist", label: "Wishlist" }
]

const searchSourceOptions: Array<{ value: SearchSource; label: string }> = [
  { value: "google_books", label: "Google Books" },
  { value: "open_library", label: "Open Library" }
]

const scrapeModeOptions: Array<{ value: BulkScrapeMode; label: string }> = [
  { value: "both", label: "Price & Cover" },
  { value: "price", label: "Price only" },
  { value: "image", label: "Cover only" }
]

const navigationOptions: Array<{ value: NavigationMode; label: string }> = [
  { value: "sidebar", label: "Sidebar (default)" },
  { value: "header", label: "Header" }
]

const isValidOption = <T extends string>(
  value: string | null | undefined,
  options: Array<{ value: T }>
): value is T =>
  value !== null &&
  value !== undefined &&
  options.some((option) => option.value === value)

export function PreferencesSection() {
  const { deleteSeriesVolumes, setDeleteSeriesVolumes } = useLibraryStore()
  const {
    showReadingProgress,
    setShowReadingProgress,
    showSeriesProgressBar,
    setShowSeriesProgressBar,
    cardSize,
    setCardSize,
    confirmBeforeDelete,
    setConfirmBeforeDelete,
    defaultOwnershipStatus,
    setDefaultOwnershipStatus,
    defaultSearchSource,
    setDefaultSearchSource,
    defaultScrapeMode,
    setDefaultScrapeMode,
    sidebarCollapsed,
    setSidebarCollapsed,
    autoPurchaseDate,
    setAutoPurchaseDate,
    navigationMode,
    setNavigationMode,
    setHasCompletedOnboarding
  } = useSettingsStore()

  return (
    <section
      id="preferences"
      className="animate-fade-in-up scroll-mt-24 py-8"
      style={{ animationDelay: "75ms", animationFillMode: "both" }}
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
            <path d="M20 7h-9" />
            <path d="M14 17H5" />
            <circle cx="14" cy="7" r="3" />
            <circle cx="8" cy="17" r="3" />
          </svg>
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Preferences
          </h2>
          <p className="text-muted-foreground text-sm">
            Customize your experience
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {/* Library Display */}
        <div className="bg-muted/30 rounded-2xl border p-5">
          <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-wider uppercase">
            Library Display
          </p>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="show-reading-progress" className="font-medium">
                  Show reading progress
                </Label>
                <p className="text-muted-foreground text-sm">
                  Display reading progress bars on volume cards in the library.
                </p>
              </div>
              <Switch
                id="show-reading-progress"
                checked={showReadingProgress}
                onCheckedChange={setShowReadingProgress}
              />
            </div>
            <div className="border-border/40 border-t" />
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="show-series-progress" className="font-medium">
                  Show collection progress
                </Label>
                <p className="text-muted-foreground text-sm">
                  Display the ownership progress bar on series cards in the
                  library.
                </p>
              </div>
              <Switch
                id="show-series-progress"
                checked={showSeriesProgressBar}
                onCheckedChange={setShowSeriesProgressBar}
              />
            </div>
            <div className="border-border/40 border-t" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="card-size" className="font-medium">
                  Card size
                </Label>
                <p className="text-muted-foreground text-sm">
                  Adjust the size of series and volume cards in grid view.
                </p>
              </div>
              <Select
                value={cardSize}
                onValueChange={(value) => {
                  if (isValidOption(value, cardSizeOptions)) {
                    setCardSize(value)
                  }
                }}
              >
                <SelectTrigger id="card-size" className="sm:w-48">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {cardSizeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Behavior */}
        <div className="bg-muted/30 rounded-2xl border p-5">
          <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-wider uppercase">
            Behavior
          </p>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="delete-series-volumes" className="font-medium">
                  Delete volumes with series
                </Label>
                <p className="text-muted-foreground text-sm">
                  When enabled, deleting a series also deletes its volumes.
                </p>
              </div>
              <Switch
                id="delete-series-volumes"
                checked={deleteSeriesVolumes}
                onCheckedChange={setDeleteSeriesVolumes}
              />
            </div>
            <div className="border-border/40 border-t" />
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="confirm-before-delete" className="font-medium">
                  Confirm before deleting
                </Label>
                <p className="text-muted-foreground text-sm">
                  Show a confirmation dialog before deleting series or volumes.
                </p>
              </div>
              <Switch
                id="confirm-before-delete"
                checked={confirmBeforeDelete}
                onCheckedChange={setConfirmBeforeDelete}
              />
            </div>
            <div className="border-border/40 border-t" />
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="auto-purchase-date" className="font-medium">
                  Auto-set purchase date
                </Label>
                <p className="text-muted-foreground text-sm">
                  Automatically set the purchase date to today when ownership
                  changes to &quot;Owned&quot;.
                </p>
              </div>
              <Switch
                id="auto-purchase-date"
                checked={autoPurchaseDate}
                onCheckedChange={setAutoPurchaseDate}
              />
            </div>
            <div className="border-border/40 border-t" />
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="font-medium">Onboarding tour</Label>
                <p className="text-muted-foreground text-sm">
                  Replay the guided walkthrough of ShelfArc&apos;s key features.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setHasCompletedOnboarding(false)
                  toast.success(
                    "Onboarding tour will show on your next page load"
                  )
                }}
              >
                Restart onboarding tour
              </Button>
            </div>
          </div>
        </div>

        {/* Defaults */}
        <div className="bg-muted/30 rounded-2xl border p-5">
          <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-wider uppercase">
            Defaults
          </p>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="default-ownership" className="font-medium">
                  Default ownership status
                </Label>
                <p className="text-muted-foreground text-sm">
                  The default ownership status when adding books via search.
                </p>
              </div>
              <Select
                value={defaultOwnershipStatus}
                onValueChange={(value) => {
                  if (isValidOption(value, ownershipStatusOptions)) {
                    setDefaultOwnershipStatus(value)
                  }
                }}
              >
                <SelectTrigger id="default-ownership" className="sm:w-48">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {ownershipStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border-border/40 border-t" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="default-search-source" className="font-medium">
                  Default search source
                </Label>
                <p className="text-muted-foreground text-sm">
                  The search provider used by default when adding books.
                </p>
              </div>
              <Select
                value={defaultSearchSource}
                onValueChange={(value) => {
                  if (isValidOption(value, searchSourceOptions)) {
                    setDefaultSearchSource(value)
                  }
                }}
              >
                <SelectTrigger id="default-search-source" className="sm:w-48">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {searchSourceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border-border/40 border-t" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="default-scrape-mode" className="font-medium">
                  Default scrape mode
                </Label>
                <p className="text-muted-foreground text-sm">
                  What to fetch when bulk scraping from Amazon.
                </p>
              </div>
              <Select
                value={defaultScrapeMode}
                onValueChange={(value) => {
                  if (isValidOption(value, scrapeModeOptions)) {
                    setDefaultScrapeMode(value)
                  }
                }}
              >
                <SelectTrigger id="default-scrape-mode" className="sm:w-48">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  {scrapeModeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Layout */}
        <div className="bg-muted/30 rounded-2xl border p-5">
          <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-wider uppercase">
            Layout
          </p>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="navigation-mode" className="font-medium">
                  Navigation
                </Label>
                <p className="text-muted-foreground text-sm">
                  Choose whether navigation lives in the sidebar or top header.
                </p>
              </div>
              <Select
                value={navigationMode}
                onValueChange={(value) => {
                  if (isValidOption(value, navigationOptions)) {
                    setNavigationMode(value)
                  }
                }}
              >
                <SelectTrigger id="navigation-mode" className="sm:w-48">
                  <SelectValue placeholder="Select navigation" />
                </SelectTrigger>
                <SelectContent>
                  {navigationOptions.map((option) => (
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
                <Label htmlFor="sidebar-collapsed" className="font-medium">
                  Start sidebar collapsed
                </Label>
                <p className="text-muted-foreground text-sm">
                  Open the sidebar in its collapsed state by default. Only
                  applies in &quot;Sidebar&quot; mode.
                </p>
              </div>
              <Switch
                id="sidebar-collapsed"
                checked={sidebarCollapsed}
                onCheckedChange={setSidebarCollapsed}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
