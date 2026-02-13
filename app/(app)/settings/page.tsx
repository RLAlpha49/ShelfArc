"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useLibraryStore } from "@/lib/store/library-store"
import { useSettingsStore } from "@/lib/store/settings-store"
import type {
  DisplayFont,
  BodyFont,
  CardSize,
  DateFormat,
  DefaultOwnershipStatus,
  SearchSource
} from "@/lib/store/settings-store"
import type { BulkScrapeMode } from "@/lib/hooks/use-bulk-scrape"
import { cn } from "@/lib/utils"
import { sanitizePlainText } from "@/lib/sanitize-html"
import { USERNAME_PATTERN } from "@/lib/validation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { ThemeToggle } from "@/components/theme-toggle"
import { toast } from "sonner"
import { uploadImage } from "@/lib/uploads/upload-image"
import {
  extractStoragePath,
  resolveImageUrl
} from "@/lib/uploads/resolve-image-url"
import type { Profile } from "@/lib/types/database"
import type {
  AmazonDomain,
  CurrencyCode,
  NavigationMode,
  PriceSource
} from "@/lib/store/library-store"

/** Maximum avatar file size in bytes (2 MB). @source */
const MAX_AVATAR_BYTES = 2 * 1024 * 1024

/** Maximum avatar image dimension in pixels. @source */
const MAX_AVATAR_DIMENSION = 1024

/** Selectable Amazon marketplace domains. @source */
const amazonDomainOptions: Array<{ value: AmazonDomain; label: string }> = [
  { value: "amazon.com", label: "amazon.com (US)" },
  { value: "amazon.co.uk", label: "amazon.co.uk (UK)" },
  { value: "amazon.ca", label: "amazon.ca (Canada)" },
  { value: "amazon.de", label: "amazon.de (Germany)" },
  { value: "amazon.co.jp", label: "amazon.co.jp (Japan)" }
]

/** Selectable display currencies. @source */
const currencyOptions: Array<{ value: CurrencyCode; label: string }> = [
  { value: "USD", label: "USD ($)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "CAD", label: "CAD ($)" },
  { value: "JPY", label: "JPY (¥)" }
]

/** Selectable price data sources. @source */
const priceSourceOptions: Array<{ value: PriceSource; label: string }> = [
  { value: "amazon", label: "Amazon" }
]

/** Selectable navigation layout modes. @source */
const navigationOptions: Array<{ value: NavigationMode; label: string }> = [
  { value: "sidebar", label: "Sidebar (default)" },
  { value: "header", label: "Header" }
]

/** Selectable display/heading fonts. @source */
const displayFontOptions: Array<{ value: DisplayFont; label: string }> = [
  { value: "playfair", label: "Playfair Display" },
  { value: "lora", label: "Lora" },
  { value: "crimson-text", label: "Crimson Text" },
  { value: "source-serif", label: "Source Serif" }
]

/** Selectable body/UI fonts. @source */
const bodyFontOptions: Array<{ value: BodyFont; label: string }> = [
  { value: "plus-jakarta", label: "Plus Jakarta Sans" },
  { value: "inter", label: "Inter" },
  { value: "dm-sans", label: "DM Sans" }
]

/** Selectable library card sizes for grid view. @source */
const cardSizeOptions: Array<{ value: CardSize; label: string }> = [
  { value: "compact", label: "Compact" },
  { value: "default", label: "Default" },
  { value: "large", label: "Large" }
]

/** Selectable default ownership statuses for new volumes. @source */
const ownershipStatusOptions: Array<{
  value: DefaultOwnershipStatus
  label: string
}> = [
  { value: "owned", label: "Owned" },
  { value: "wishlist", label: "Wishlist" }
]

/** Selectable book search providers. @source */
const searchSourceOptions: Array<{ value: SearchSource; label: string }> = [
  { value: "google_books", label: "Google Books" },
  { value: "open_library", label: "Open Library" }
]

const scrapeModeOptions: Array<{ value: BulkScrapeMode; label: string }> = [
  { value: "both", label: "Price & Cover" },
  { value: "price", label: "Price only" },
  { value: "image", label: "Cover only" }
]

/** Selectable date display formats with live examples. @source */
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

/** Navigation anchors for the settings page sections. @source */
const settingsNav = [
  { id: "profile", label: "Profile" },
  { id: "preferences", label: "Preferences" },
  { id: "appearance", label: "Appearance" },
  { id: "pricing", label: "Pricing" },
  { id: "data", label: "Data" }
] as const

/**
 * Type-guard returning true when the value matches one of the given option values.
 * @param value - The value to validate.
 * @param options - Available options to match against.
 * @returns Whether the value is a valid option.
 * @source
 */
const isValidOption = <T extends string>(
  value: string | null | undefined,
  options: Array<{ value: T }>
): value is T =>
  value !== null &&
  value !== undefined &&
  options.some((option) => option.value === value)

/**
 * Loads an image file and resolves with its object URL and natural dimensions.
 * @param file - The image file to read.
 * @returns Object URL, width, and height.
 * @source
 */
const loadImageDimensions = (file: File) =>
  new Promise<{ url: string; width: number; height: number }>(
    (resolve, reject) => {
      const objectUrl = URL.createObjectURL(file)
      const image = new Image()
      image.onload = () =>
        resolve({
          url: objectUrl,
          width: image.naturalWidth,
          height: image.naturalHeight
        })
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error("Unable to read image"))
      }
      image.src = objectUrl
    }
  )

/**
 * Preloads an image URL into the browser cache.
 * @param src - The image URL to preload.
 * @source
 */
const preloadImage = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => reject(new Error("Image failed to load"))
    image.src = src
  })

/**
 * Settings page with profile, preferences, appearance, pricing, and data management sections.
 * @source
 */
export default function SettingsPage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [username, setUsername] = useState("")
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null
  )
  const [usernameChecking, setUsernameChecking] = useState(false)
  const usernameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [avatarUrl, setAvatarUrl] = useState("")
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("")
  const [avatarPreviewError, setAvatarPreviewError] = useState(false)
  const previewUrlRef = useRef<string | null>(null)
  const {
    deleteSeriesVolumes,
    setDeleteSeriesVolumes,
    priceSource,
    amazonDomain,
    amazonPreferKindle,
    amazonFallbackToKindle,
    priceDisplayCurrency,
    showAmazonDisclaimer,
    setPriceSource,
    setAmazonDomain,
    setAmazonPreferKindle,
    setAmazonFallbackToKindle,
    setPriceDisplayCurrency,
    setShowAmazonDisclaimer,
    navigationMode,
    setNavigationMode
  } = useLibraryStore()
  const {
    showReadingProgress,
    setShowReadingProgress,
    showSeriesProgressBar,
    setShowSeriesProgressBar,
    cardSize,
    setCardSize,
    enableAnimations,
    setEnableAnimations,
    displayFont,
    setDisplayFont,
    bodyFont,
    setBodyFont,
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
    dateFormat,
    setDateFormat,
    autoPurchaseDate,
    setAutoPurchaseDate
  } = useSettingsStore()
  const [activeSection, setActiveSection] = useState("profile")

  const usernameFormatValid = USERNAME_PATTERN.test(username)

  const hasProfileChanges =
    username !== (profile?.username || "") ||
    avatarUrl !== (profile?.avatar_url || "")

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user }
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (data) {
        const profileData = data as unknown as Profile
        setProfile(profileData)
        setUsername(profileData.username || "")
        setAvatarUrl(profileData.avatar_url || "")
      }
      setIsLoading(false)
    }

    loadProfile()
  }, [supabase])

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  const setPreviewUrl = (url: string | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
    previewUrlRef.current = url
    setAvatarPreviewUrl(url ?? "")
  }

  const handleUsernameChange = (value: string) => {
    setUsername(value)
    setUsernameAvailable(null)

    if (usernameCheckTimer.current) {
      clearTimeout(usernameCheckTimer.current)
    }

    if (!USERNAME_PATTERN.test(value) || value === (profile?.username || "")) {
      setUsernameChecking(false)
      return
    }

    setUsernameChecking(true)
    usernameCheckTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/username/check?username=${encodeURIComponent(value)}`
        )
        if (res.ok) {
          const json = (await res.json()) as { available: boolean }
          setUsernameAvailable(json.available)
        }
      } catch {
        // Silently ignore network errors for availability check
      } finally {
        setUsernameChecking(false)
      }
    }, 300)
  }

  const handleSaveProfile = async () => {
    if (!profile) return

    setIsSaving(true)
    try {
      const sanitizedUsername = sanitizePlainText(username, 20)
      setUsername(sanitizedUsername)

      const profilesTable = supabase.from("profiles") as unknown as {
        update: (data: Record<string, unknown>) => {
          eq: (field: string, value: string) => Promise<{ error: Error | null }>
        }
      }
      const nextProfileValues = {
        username: sanitizedUsername || null,
        avatar_url: avatarUrl || null
      }
      const nextAuthMetadata = {
        username: sanitizedUsername || null,
        avatar_url: avatarUrl || null,
        display_name: sanitizedUsername || null
      }
      const previousProfileValues = {
        username: profile.username || null,
        avatar_url: profile.avatar_url || null
      }
      const { error } = await profilesTable
        .update(nextProfileValues)
        .eq("id", profile.id)

      if (error) throw error

      const { error: authError } = await supabase.auth.updateUser({
        data: nextAuthMetadata
      })

      if (authError) {
        const { error: rollbackError } = await profilesTable
          .update(previousProfileValues)
          .eq("id", profile.id)
        if (rollbackError) {
          setProfile({
            ...profile,
            username: nextProfileValues.username,
            avatar_url: nextProfileValues.avatar_url
          })
          setUsername(nextProfileValues.username ?? "")
          setAvatarUrl(nextProfileValues.avatar_url ?? "")
          console.error("Failed to rollback profile update", {
            authError,
            rollbackError,
            userId: profile.id,
            nextProfileValues
          })
        } else {
          setProfile({
            ...profile,
            username: previousProfileValues.username,
            avatar_url: previousProfileValues.avatar_url
          })
          setUsername(previousProfileValues.username ?? "")
          setAvatarUrl(previousProfileValues.avatar_url ?? "")
        }
        console.error("Failed to update auth metadata", {
          authError,
          userId: profile.id
        })
        toast.error("Failed to update profile")
        return
      }
      setProfile({
        ...profile,
        username: nextProfileValues.username,
        avatar_url: nextProfileValues.avatar_url
      })
      toast.success("Profile updated successfully")
    } catch {
      toast.error("Failed to update profile")
    } finally {
      setIsSaving(false)
    }
  }

  const handleAvatarFileChange = async (file: File) => {
    if (!file) return
    if (file.size <= 0 || file.size > MAX_AVATAR_BYTES) {
      toast.error("Avatar must be smaller than 2MB")
      setPreviewUrl(null)
      return
    }

    let previewUrl: string
    try {
      const { url, width, height } = await loadImageDimensions(file)
      if (width > MAX_AVATAR_DIMENSION || height > MAX_AVATAR_DIMENSION) {
        URL.revokeObjectURL(url)
        toast.error("Avatar must be 512x512 or smaller")
        setPreviewUrl(null)
        return
      }
      previewUrl = url
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to read image"
      toast.error(message)
      setPreviewUrl(null)
      return
    }

    setPreviewUrl(previewUrl)
    setIsUploadingAvatar(true)
    try {
      const replacePath = extractStoragePath(avatarUrl)
      const url = await uploadImage(file, "avatar", {
        replacePath: replacePath ?? undefined
      })
      setAvatarUrl(url)
      const resolvedUrl = resolveImageUrl(url)
      if (resolvedUrl) {
        void preloadImage(resolvedUrl)
          .then(() => {
            if (previewUrlRef.current === previewUrl) {
              setPreviewUrl(null)
            }
          })
          .catch((error) => {
            console.error("Failed to load uploaded avatar", {
              error,
              url: resolvedUrl
            })
          })
      }
      toast.success("Avatar uploaded")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed"
      toast.error(message)
      setPreviewUrl(null)
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const resolvedAvatarUrl = resolveImageUrl(avatarUrl)
  const avatarPreview = avatarPreviewUrl || resolvedAvatarUrl

  useEffect(() => {
    setAvatarPreviewError(false)
  }, [avatarPreview])

  useEffect(() => {
    if (isLoading) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    )
    for (const section of settingsNav) {
      const el = document.getElementById(section.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [isLoading])

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10 lg:px-10">
        <Skeleton className="mb-2 h-9 w-40 rounded-xl" />
        <Skeleton className="mb-10 h-5 w-64 rounded-lg" />
        <div className="grid gap-10 lg:grid-cols-[200px_1fr] lg:gap-14">
          <Skeleton className="hidden h-48 rounded-xl lg:block" />
          <div className="space-y-8">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 lg:px-10">
      {/* Header */}
      <div className="animate-fade-in mb-8 lg:mb-10">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your profile, preferences, and data
        </p>
      </div>

      {/* Mobile section tabs */}
      <div className="-mx-6 mb-8 overflow-x-auto border-b px-6 lg:hidden">
        <div className="flex gap-1 pb-px">
          {settingsNav.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={cn(
                "relative shrink-0 px-3 py-2.5 text-sm font-medium transition-colors",
                activeSection === section.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              {section.label}
              {activeSection === section.id && (
                <span className="bg-primary absolute inset-x-1 bottom-0 h-0.5 rounded-full" />
              )}
            </a>
          ))}
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[200px_1fr] lg:gap-14">
        {/* Desktop section nav */}
        <nav className="hidden lg:block">
          <div className="sticky top-6">
            <ul className="space-y-1">
              {settingsNav.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      activeSection === section.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground hover:shadow-sm"
                    )}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4 shrink-0"
                    >
                      {section.id === "profile" && (
                        <>
                          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </>
                      )}
                      {section.id === "preferences" && (
                        <>
                          <path d="M20 7h-9" />
                          <path d="M14 17H5" />
                          <circle cx="14" cy="7" r="3" />
                          <circle cx="8" cy="17" r="3" />
                        </>
                      )}
                      {section.id === "appearance" && (
                        <>
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
                        </>
                      )}
                      {section.id === "pricing" && (
                        <>
                          <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
                          <path d="M7 7h.01" />
                        </>
                      )}
                      {section.id === "data" && (
                        <>
                          <ellipse cx="12" cy="5" rx="9" ry="3" />
                          <path d="M3 5v14a9 3 0 0 0 18 0V5" />
                          <path d="M3 12a9 3 0 0 0 18 0" />
                        </>
                      )}
                    </svg>
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Content sections */}
        <div className="min-w-0">
          {/* ── Profile ───────────────────────────── */}
          <section
            id="profile"
            className="animate-fade-in-up scroll-mt-24 pb-8"
            style={{ animationDelay: "0ms", animationFillMode: "both" }}
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
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight">
                  Profile
                </h2>
                <p className="text-muted-foreground text-sm">
                  Manage your account information
                </p>
              </div>
            </div>

            <div className="bg-muted/30 rounded-2xl border p-6">
              <div className="mb-6 flex flex-col items-start gap-6 sm:flex-row">
                {/* Avatar preview */}
                <div className="relative shrink-0">
                  <Avatar className="ring-border h-20 w-20 ring-2">
                    {avatarPreview && !avatarPreviewError && (
                      <AvatarImage
                        src={avatarPreview}
                        alt="Avatar preview"
                        onError={() => setAvatarPreviewError(true)}
                        onLoad={() => setAvatarPreviewError(false)}
                      />
                    )}
                    {!(avatarPreview && !avatarPreviewError) &&
                      resolvedAvatarUrl && (
                        <AvatarImage src={resolvedAvatarUrl} alt="Avatar" />
                      )}
                    <AvatarFallback className="bg-primary/10 text-primary font-display text-2xl font-semibold">
                      {(username || profile?.email || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {isUploadingAvatar && (
                    <div className="bg-background/80 absolute inset-0 flex items-center justify-center rounded-full backdrop-blur-sm">
                      <div className="border-primary h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
                    </div>
                  )}
                </div>

                {/* Name + email */}
                <div className="flex-1 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => handleUsernameChange(e.target.value)}
                      placeholder="Choose a unique username"
                      className="max-w-sm"
                    />
                    {username && !usernameFormatValid && (
                      <p className="text-destructive text-xs">
                        3-20 characters. Letters, numbers, and underscores only.
                      </p>
                    )}
                    {usernameFormatValid &&
                      username !== (profile?.username || "") && (
                        <p className="text-xs">
                          {usernameChecking && (
                            <span className="text-muted-foreground">
                              Checking...
                            </span>
                          )}
                          {!usernameChecking && usernameAvailable === true && (
                            <span className="text-emerald-600">
                              ✓ Available
                            </span>
                          )}
                          {!usernameChecking && usernameAvailable === false && (
                            <span className="text-destructive">
                              ✗ Already taken
                            </span>
                          )}
                        </p>
                      )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile?.email || ""}
                      disabled
                      className="bg-muted max-w-sm"
                    />
                    <p className="text-muted-foreground text-xs">
                      Email cannot be changed
                    </p>
                  </div>
                </div>
              </div>

              {/* Avatar controls */}
              <div className="bg-background/50 space-y-3 rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Avatar</p>
                    <p className="text-muted-foreground text-xs">
                      Square images work best.
                    </p>
                  </div>
                  {avatarUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAvatarUrl("")
                        setPreviewUrl(null)
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="avatarUrl"
                      className="text-muted-foreground text-xs"
                    >
                      Image URL
                    </Label>
                    {extractStoragePath(avatarUrl) ? (
                      <Input
                        id="avatarUrl"
                        value="Uploaded image"
                        disabled
                        className="bg-muted max-w-sm"
                      />
                    ) : (
                      <Input
                        id="avatarUrl"
                        type="url"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="avatarUpload"
                      className="text-muted-foreground text-xs"
                    >
                      Upload file
                    </Label>
                    <Input
                      id="avatarUpload"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          void handleAvatarFileChange(file)
                        }
                        e.currentTarget.value = ""
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <Button
                onClick={handleSaveProfile}
                disabled={isSaving || isUploadingAvatar || !hasProfileChanges}
                className="rounded-xl px-6"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </section>

          {/* ── Preferences ────────────────────────── */}
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
                      <Label
                        htmlFor="show-reading-progress"
                        className="font-medium"
                      >
                        Show reading progress
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        Display reading progress bars on volume cards in the
                        library.
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
                      <Label
                        htmlFor="show-series-progress"
                        className="font-medium"
                      >
                        Show collection progress
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        Display the ownership progress bar on series cards in
                        the library.
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
                      <Label
                        htmlFor="delete-series-volumes"
                        className="font-medium"
                      >
                        Delete volumes with series
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        When enabled, deleting a series also deletes its
                        volumes.
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
                      <Label
                        htmlFor="confirm-before-delete"
                        className="font-medium"
                      >
                        Confirm before deleting
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        Show a confirmation dialog before deleting series or
                        volumes.
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
                      <Label
                        htmlFor="auto-purchase-date"
                        className="font-medium"
                      >
                        Auto-set purchase date
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        Automatically set the purchase date to today when
                        ownership changes to &quot;Owned&quot;.
                      </p>
                    </div>
                    <Switch
                      id="auto-purchase-date"
                      checked={autoPurchaseDate}
                      onCheckedChange={setAutoPurchaseDate}
                    />
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
                      <Label
                        htmlFor="default-ownership"
                        className="font-medium"
                      >
                        Default ownership status
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        The default ownership status when adding books via
                        search.
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
                      <Label
                        htmlFor="default-search-source"
                        className="font-medium"
                      >
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
                      <SelectTrigger
                        id="default-search-source"
                        className="sm:w-48"
                      >
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
                      <Label
                        htmlFor="default-scrape-mode"
                        className="font-medium"
                      >
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
                      <SelectTrigger
                        id="default-scrape-mode"
                        className="sm:w-48"
                      >
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
                        Choose whether navigation lives in the sidebar or top
                        header.
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
                      <Label
                        htmlFor="sidebar-collapsed"
                        className="font-medium"
                      >
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

          {/* ── Appearance ─────────────────────────── */}
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
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="enable-animations"
                        className="font-medium"
                      >
                        Animations
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        Enable transitions and micro-animations throughout the
                        app.
                      </p>
                    </div>
                    <Switch
                      id="enable-animations"
                      checked={enableAnimations}
                      onCheckedChange={setEnableAnimations}
                    />
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
                      {
                        displayFontOptions.find((o) => o.value === displayFont)
                          ?.label
                      }
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
                  ShelfArc helps you track, organize, and celebrate your
                  collection with a beautifully crafted personal library
                  manager.
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

          {/* ── Pricing ────────────────────────────── */}
          <section
            id="pricing"
            className="animate-fade-in-up scroll-mt-24 py-8"
            style={{ animationDelay: "225ms", animationFillMode: "both" }}
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
                  <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
                  <path d="M7 7h.01" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight">
                  Pricing
                </h2>
                <p className="text-muted-foreground text-sm">
                  Price sources, currency, and display settings
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              {/* Source & Currency */}
              <div className="bg-muted/30 rounded-2xl border p-5">
                <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-wider uppercase">
                  Source & Currency
                </p>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="price-source">Price source</Label>
                    <Select
                      value={priceSource}
                      onValueChange={(value) => {
                        if (isValidOption(value, priceSourceOptions)) {
                          setPriceSource(value)
                        }
                      }}
                    >
                      <SelectTrigger id="price-source">
                        <SelectValue placeholder="Choose a source" />
                      </SelectTrigger>
                      <SelectContent>
                        {priceSourceOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-xs">
                      Used for volume price lookups.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amazon-domain">Amazon domain</Label>
                    <Select
                      value={amazonDomain}
                      onValueChange={(value) =>
                        setAmazonDomain(value as AmazonDomain)
                      }
                    >
                      <SelectTrigger id="amazon-domain">
                        <SelectValue placeholder="Select a domain" />
                      </SelectTrigger>
                      <SelectContent>
                        {amazonDomainOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-xs">
                      Amazon marketplace region.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="display-currency">Display currency</Label>
                    <Select
                      value={priceDisplayCurrency}
                      onValueChange={(value) =>
                        setPriceDisplayCurrency(value as CurrencyCode)
                      }
                    >
                      <SelectTrigger id="display-currency">
                        <SelectValue placeholder="Choose currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencyOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-xs">
                      How prices are formatted across the app.
                    </p>
                  </div>
                </div>
              </div>

              {/* Amazon Options */}
              <div className="bg-muted/30 rounded-2xl border p-5">
                <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-wider uppercase">
                  Amazon Options
                </p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="amazon-prefer-kindle"
                        className="font-medium"
                      >
                        Prefer Kindle pricing
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        Use Kindle as the primary Amazon price lookup.
                      </p>
                    </div>
                    <Switch
                      id="amazon-prefer-kindle"
                      checked={amazonPreferKindle}
                      onCheckedChange={setAmazonPreferKindle}
                    />
                  </div>
                  <div className="border-border/40 border-t" />
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="amazon-fallback-kindle"
                        className="font-medium"
                      >
                        Fallback to Kindle pricing
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        If Paperback pricing is missing, try the Kindle price
                        instead.
                      </p>
                    </div>
                    <Switch
                      id="amazon-fallback-kindle"
                      checked={amazonFallbackToKindle}
                      onCheckedChange={setAmazonFallbackToKindle}
                      disabled={amazonPreferKindle}
                    />
                  </div>
                  <div className="border-border/40 border-t" />
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="show-amazon-disclaimer"
                        className="font-medium"
                      >
                        Show Amazon data disclaimer
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        Display the disclaimer after fetching prices or images.
                      </p>
                    </div>
                    <Switch
                      id="show-amazon-disclaimer"
                      checked={showAmazonDisclaimer}
                      onCheckedChange={setShowAmazonDisclaimer}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Data Management ────────────────────── */}
          <section
            id="data"
            className="animate-fade-in-up scroll-mt-24 py-8"
            style={{ animationDelay: "300ms", animationFillMode: "both" }}
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
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M3 5v14a9 3 0 0 0 18 0V5" />
                  <path d="M3 12a9 3 0 0 0 18 0" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight">
                  Data Management
                </h2>
                <p className="text-muted-foreground text-sm">
                  Export or import your library data
                </p>
              </div>
            </div>

            <div className="grid-stagger grid gap-4 sm:grid-cols-2">
              <Link href="/settings/export" className="group">
                <div className="bg-muted/30 hover:bg-accent/60 hover-lift rounded-2xl border p-5 transition-colors">
                  <div className="text-primary bg-primary/8 group-hover:bg-primary/12 mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="h-5 w-5"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </div>
                  <h3 className="font-display mb-1 text-base font-semibold">
                    Export Data
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Download your collection as JSON or CSV for backup or
                    migration.
                  </p>
                </div>
              </Link>
              <Link href="/settings/import" className="group">
                <div className="bg-muted/30 hover:bg-accent/60 hover-lift rounded-2xl border p-5 transition-colors">
                  <div className="text-primary bg-primary/8 group-hover:bg-primary/12 mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="h-5 w-5"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <h3 className="font-display mb-1 text-base font-semibold">
                    Import Data
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Import books from CSV (ISBN list) or restore from a ShelfArc
                    JSON backup.
                  </p>
                </div>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
