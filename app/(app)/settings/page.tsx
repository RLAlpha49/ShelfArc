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
import { cn } from "@/lib/utils"
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

const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const MAX_AVATAR_DIMENSION = 1024

const amazonDomainOptions: Array<{ value: AmazonDomain; label: string }> = [
  { value: "amazon.com", label: "amazon.com (US)" },
  { value: "amazon.co.uk", label: "amazon.co.uk (UK)" },
  { value: "amazon.ca", label: "amazon.ca (Canada)" },
  { value: "amazon.de", label: "amazon.de (Germany)" },
  { value: "amazon.co.jp", label: "amazon.co.jp (Japan)" }
]

const currencyOptions: Array<{ value: CurrencyCode; label: string }> = [
  { value: "USD", label: "USD ($)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "CAD", label: "CAD ($)" },
  { value: "JPY", label: "JPY (¥)" }
]

const priceSourceOptions: Array<{ value: PriceSource; label: string }> = [
  { value: "amazon", label: "Amazon" }
]

const navigationOptions: Array<{ value: NavigationMode; label: string }> = [
  { value: "sidebar", label: "Sidebar (default)" },
  { value: "header", label: "Header" }
]

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

const settingsNav = [
  { id: "profile", label: "Profile" },
  { id: "preferences", label: "Preferences" },
  { id: "bookshelf", label: "Bookshelf" },
  { id: "appearance", label: "Appearance" },
  { id: "pricing", label: "Pricing" },
  { id: "data", label: "Data" }
] as const

const isValidOption = <T extends string>(
  value: string | null | undefined,
  options: Array<{ value: T }>
): value is T =>
  value !== null &&
  value !== undefined &&
  options.some((option) => option.value === value)

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

const preloadImage = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => reject(new Error("Image failed to load"))
    image.src = src
  })

export default function SettingsPage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("")
  const [avatarPreviewError, setAvatarPreviewError] = useState(false)
  const previewUrlRef = useRef<string | null>(null)
  const {
    deleteSeriesVolumes,
    setDeleteSeriesVolumes,
    priceSource,
    amazonDomain,
    priceDisplayCurrency,
    setPriceSource,
    setAmazonDomain,
    setPriceDisplayCurrency,
    navigationMode,
    setNavigationMode
  } = useLibraryStore()
  const {
    showSpineCovers,
    setShowSpineCovers,
    showSpineLabels,
    setShowSpineLabels,
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
    sidebarCollapsed,
    setSidebarCollapsed,
    dateFormat,
    setDateFormat
  } = useSettingsStore()
  const [activeSection, setActiveSection] = useState("profile")

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
        setDisplayName(profileData.display_name || "")
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

  const handleSaveProfile = async () => {
    if (!profile) return

    setIsSaving(true)
    try {
      const profilesTable = supabase.from("profiles") as unknown as {
        update: (data: Record<string, unknown>) => {
          eq: (field: string, value: string) => Promise<{ error: Error | null }>
        }
      }
      const nextProfileValues = {
        display_name: displayName || null,
        avatar_url: avatarUrl || null
      }
      const previousProfileValues = {
        display_name: profile.display_name || null,
        avatar_url: profile.avatar_url || null
      }
      const { error } = await profilesTable
        .update(nextProfileValues)
        .eq("id", profile.id)

      if (error) throw error

      const { error: authError } = await supabase.auth.updateUser({
        data: nextProfileValues
      })

      if (authError) {
        const { error: rollbackError } = await profilesTable
          .update(previousProfileValues)
          .eq("id", profile.id)
        if (rollbackError) {
          setProfile({
            ...profile,
            display_name: nextProfileValues.display_name,
            avatar_url: nextProfileValues.avatar_url
          })
          setDisplayName(nextProfileValues.display_name ?? "")
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
            display_name: previousProfileValues.display_name,
            avatar_url: previousProfileValues.avatar_url
          })
          setDisplayName(previousProfileValues.display_name ?? "")
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
        display_name: nextProfileValues.display_name,
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
                  : "text-muted-foreground hover:text-foreground"
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
                      "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      activeSection === section.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Content sections */}
        <div className="animate-fade-in-up min-w-0">
          {/* ── Profile ───────────────────────────── */}
          <section id="profile" className="scroll-mt-24 pb-10">
            <div className="mb-6">
              <h2 className="font-display text-xl font-semibold tracking-tight">
                Profile
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Manage your account information
              </p>
            </div>

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
                    {(displayName || profile?.email || "U")
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
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="How should we call you?"
                    className="max-w-sm"
                  />
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
            <div className="bg-muted/30 space-y-3 rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Avatar</p>
                  <p className="text-muted-foreground text-xs">
                    Square images work best. Uploads are compressed to WebP.
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
                  <Input
                    id="avatarUrl"
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://..."
                  />
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

            <div className="mt-6">
              <Button
                onClick={handleSaveProfile}
                disabled={isSaving || isUploadingAvatar}
                className="rounded-xl px-6"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </section>

          <div className="border-t" />

          {/* ── Preferences ────────────────────────── */}
          <section id="preferences" className="scroll-mt-24 py-10">
            <div className="mb-6">
              <h2 className="font-display text-xl font-semibold tracking-tight">
                Preferences
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Customize your experience
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Theme</p>
                  <p className="text-muted-foreground text-sm">
                    Choose your preferred color scheme
                  </p>
                </div>
                <span className="text-muted-foreground text-sm">
                  Use the theme toggle in the{" "}
                  {navigationMode === "header" ? "header" : "sidebar"}
                </span>
              </div>

              <div className="border-t" />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
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
                  <SelectTrigger id="navigation-mode" className="sm:w-56">
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

              <div className="border-t" />

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label
                    htmlFor="delete-series-volumes"
                    className="font-medium"
                  >
                    Delete volumes with series
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    When enabled, deleting a series also deletes its volumes.
                    Otherwise, volumes become unassigned.
                  </p>
                </div>
                <Switch
                  id="delete-series-volumes"
                  checked={deleteSeriesVolumes}
                  onCheckedChange={setDeleteSeriesVolumes}
                />
              </div>

              <div className="border-t" />

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
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

              <div className="border-t" />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <Label htmlFor="card-size" className="font-medium">
                    Library card size
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
                  <SelectTrigger id="card-size" className="sm:w-56">
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

              <div className="border-t" />

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="show-series-progress" className="font-medium">
                    Show collection progress on series cards
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

              <div className="border-t" />

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label
                    htmlFor="confirm-before-delete"
                    className="font-medium"
                  >
                    Confirm before deleting
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    Show a confirmation dialog before deleting series or
                    volumes. Disable to delete immediately.
                  </p>
                </div>
                <Switch
                  id="confirm-before-delete"
                  checked={confirmBeforeDelete}
                  onCheckedChange={setConfirmBeforeDelete}
                />
              </div>

              <div className="border-t" />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
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
                  <SelectTrigger id="default-ownership" className="sm:w-56">
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

              <div className="border-t" />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
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
                  <SelectTrigger id="default-search-source" className="sm:w-56">
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

              <div className="border-t" />

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="sidebar-collapsed" className="font-medium">
                    Start sidebar collapsed
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    Open the sidebar in its collapsed state by default. Only
                    applies when navigation mode is &quot;Sidebar&quot;.
                  </p>
                </div>
                <Switch
                  id="sidebar-collapsed"
                  checked={sidebarCollapsed}
                  onCheckedChange={setSidebarCollapsed}
                />
              </div>
            </div>
          </section>

          <div className="border-t" />

          {/* ── Bookshelf ──────────────────────────── */}
          <section id="bookshelf" className="scroll-mt-24 py-10">
            <div className="mb-6">
              <h2 className="font-display text-xl font-semibold tracking-tight">
                Bookshelf
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Customize how books appear on the bookshelf canvas
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="show-spine-covers" className="font-medium">
                    Show cover images on spines
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    Display volume cover art on book spines. When disabled,
                    spines show a solid color derived from the cover.
                  </p>
                </div>
                <Switch
                  id="show-spine-covers"
                  checked={showSpineCovers}
                  onCheckedChange={setShowSpineCovers}
                />
              </div>

              <div className="border-t" />

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="show-spine-labels" className="font-medium">
                    Show title labels on spines
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    Overlay the volume title or number on each book spine.
                  </p>
                </div>
                <Switch
                  id="show-spine-labels"
                  checked={showSpineLabels}
                  onCheckedChange={setShowSpineLabels}
                />
              </div>
            </div>
          </section>

          <div className="border-t" />

          {/* ── Appearance ─────────────────────────── */}
          <section id="appearance" className="scroll-mt-24 py-10">
            <div className="mb-6">
              <h2 className="font-display text-xl font-semibold tracking-tight">
                Appearance
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Font choices and visual preferences
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="enable-animations" className="font-medium">
                    Animations
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    Enable page transitions and micro-animations. Disable for a
                    faster, reduced-motion experience.
                  </p>
                </div>
                <Switch
                  id="enable-animations"
                  checked={enableAnimations}
                  onCheckedChange={setEnableAnimations}
                />
              </div>

              <div className="border-t" />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
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
                  <SelectTrigger id="display-font" className="sm:w-56">
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

              <div className="border-t" />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
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
                  <SelectTrigger id="body-font" className="sm:w-56">
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

              <div className="border-t" />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
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
                  <SelectTrigger id="date-format" className="sm:w-56">
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

              {/* Live font preview */}
              <div className="bg-muted/30 rounded-xl border p-5">
                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
                  Preview
                </p>
                <h3 className="font-display text-lg leading-snug font-semibold">
                  The quick brown fox jumps over the lazy dog
                </h3>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  ShelfArc helps you track, organize, and celebrate your
                  collection with a beautifully crafted personal library
                  manager.
                </p>
              </div>
            </div>
          </section>

          <div className="border-t" />

          {/* ── Pricing ────────────────────────────── */}
          <section id="pricing" className="scroll-mt-24 py-10">
            <div className="mb-6">
              <h2 className="font-display text-xl font-semibold tracking-tight">
                Pricing
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Configure where prices are fetched from and how they are
                displayed
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="price-source">Default price source</Label>
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
                  Used when fetching prices for volumes.
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
                  Used for Amazon price lookups.
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
                  Controls how prices are formatted across the app.
                </p>
              </div>
            </div>
          </section>

          <div className="border-t" />

          {/* ── Data Management ────────────────────── */}
          <section id="data" className="scroll-mt-24 py-10">
            <div className="mb-6">
              <h2 className="font-display text-xl font-semibold tracking-tight">
                Data Management
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Export or import your library data
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Link href="/settings/export" className="group rounded-xl">
                <div className="bg-card hover:bg-accent/40 rounded-xl border p-5 transition-colors">
                  <div className="text-primary bg-primary/8 group-hover:bg-primary/12 mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors">
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
              <Link href="/settings/import" className="group rounded-xl">
                <div className="bg-card hover:bg-accent/40 rounded-xl border p-5 transition-colors">
                  <div className="text-primary bg-primary/8 group-hover:bg-primary/12 mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors">
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
