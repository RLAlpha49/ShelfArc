"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { sanitizePlainText } from "@/lib/sanitize-html"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/types/database"
import {
  extractStoragePath,
  resolveImageUrl
} from "@/lib/uploads/resolve-image-url"
import { uploadImage } from "@/lib/uploads/upload-image"
import { USERNAME_PATTERN } from "@/lib/validation"

const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const MAX_AVATAR_DIMENSION = 1024

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

interface ProfileSectionProps {
  readonly profile: Profile | null
}

export function ProfileSection({ profile }: ProfileSectionProps) {
  const [baseProfile, setBaseProfile] = useState<Profile | null>(profile)
  const [username, setUsername] = useState(profile?.username ?? "")
  const [isPublic, setIsPublic] = useState(profile?.is_public ?? false)
  const [publicBio, setPublicBio] = useState(profile?.public_bio ?? "")
  const [publicStats, setPublicStats] = useState(profile?.public_stats ?? false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null
  )
  const [usernameChecking, setUsernameChecking] = useState(false)
  const usernameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "")
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("")
  const [avatarPreviewError, setAvatarPreviewError] = useState(false)
  const previewUrlRef = useRef<string | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showEmailChange, setShowEmailChange] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [emailChangePending, setEmailChangePending] = useState(false)
  const [emailChangeSuccess, setEmailChangeSuccess] = useState(false)

  // Sync local state when profile prop arrives (initial fetch resolves)
  useEffect(() => {
    if (profile && !baseProfile) {
      setBaseProfile(profile)
      setUsername(profile.username ?? "")
      setAvatarUrl(profile.avatar_url ?? "")
      setIsPublic(profile.is_public ?? false)
      setPublicBio(profile.public_bio ?? "")
      setPublicStats(profile.public_stats ?? false)
    }
  }, [profile, baseProfile])

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  const resolvedAvatarUrl = resolveImageUrl(avatarUrl)
  const avatarPreview = avatarPreviewUrl || resolvedAvatarUrl

  useEffect(() => {
    setAvatarPreviewError(false)
  }, [avatarPreview])

  const usernameFormatValid = USERNAME_PATTERN.test(username)

  const hasProfileChanges =
    username !== (baseProfile?.username ?? "") ||
    avatarUrl !== (baseProfile?.avatar_url ?? "") ||
    isPublic !== (baseProfile?.is_public ?? false) ||
    publicBio !== (baseProfile?.public_bio ?? "") ||
    publicStats !== (baseProfile?.public_stats ?? false)

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

    if (
      !USERNAME_PATTERN.test(value) ||
      value === (baseProfile?.username ?? "")
    ) {
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
          const json = (await res.json()) as { data: { available: boolean } }
          setUsernameAvailable(json.data.available)
        }
      } catch {
        // Silently ignore network errors for availability check
      } finally {
        setUsernameChecking(false)
      }
    }, 300)
  }

  const handleEmailChange = async () => {
    const trimmed = newEmail.trim()
    if (!trimmed) {
      toast.error("Please enter a new email address")
      return
    }
    if (trimmed === (baseProfile?.email ?? "")) {
      toast.error("New email must be different from your current email")
      return
    }

    setEmailChangePending(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ email: trimmed })
      if (error) {
        toast.error(error.message ?? "Failed to request email change")
        return
      }
      setEmailChangeSuccess(true)
      setShowEmailChange(false)
      setNewEmail("")
      toast.success(
        "Confirmation emails sent to both addresses. Check your inbox to verify the change."
      )
    } catch {
      toast.error("Failed to request email change")
    } finally {
      setEmailChangePending(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!baseProfile) return

    setIsSaving(true)
    try {
      const sanitizedUsername = sanitizePlainText(username, 20)
      setUsername(sanitizedUsername)

      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: sanitizedUsername,
          avatarUrl: avatarUrl || null,
          isPublic,
          publicBio,
          publicStats
        })
      })

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          error?: string
        }
        toast.error(json.error ?? "Failed to update profile")
        return
      }

      const updated: Profile = {
        ...baseProfile,
        username: sanitizedUsername || null,
        avatar_url: avatarUrl || null,
        is_public: isPublic,
        public_bio: publicBio,
        public_stats: publicStats
      }
      setBaseProfile(updated)
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

  return (
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
              {!(avatarPreview && !avatarPreviewError) && resolvedAvatarUrl && (
                <AvatarImage src={resolvedAvatarUrl} alt="Avatar" />
              )}
              <AvatarFallback className="bg-primary/10 text-primary font-display text-2xl font-semibold">
                {(username || baseProfile?.email || "U")
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
                username !== (baseProfile?.username ?? "") && (
                  <p className="text-xs">
                    {usernameChecking && (
                      <span className="text-muted-foreground">Checking...</span>
                    )}
                    {!usernameChecking && usernameAvailable === true && (
                      <span className="text-emerald-600">✓ Available</span>
                    )}
                    {!usernameChecking && usernameAvailable === false && (
                      <span className="text-destructive">✗ Already taken</span>
                    )}
                  </p>
                )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={baseProfile?.email ?? ""}
                disabled
                className="bg-muted max-w-sm"
              />
              {emailChangeSuccess && (
                <p className="text-xs text-emerald-600">
                  Verification emails sent. Check your inbox to confirm the
                  change.
                </p>
              )}
              {!showEmailChange && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1 h-7 rounded-lg px-3 text-xs"
                  onClick={() => {
                    setShowEmailChange(true)
                    setEmailChangeSuccess(false)
                  }}
                >
                  Change Email
                </Button>
              )}
              {showEmailChange && (
                <div className="mt-2 max-w-sm space-y-2">
                  <Input
                    id="new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="New email address"
                    disabled={emailChangePending}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 rounded-lg px-4 text-xs"
                      onClick={() => void handleEmailChange()}
                      disabled={emailChangePending}
                    >
                      {emailChangePending ? "Sending..." : "Send Verification"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-lg px-3 text-xs"
                      onClick={() => {
                        setShowEmailChange(false)
                        setNewEmail("")
                      }}
                      disabled={emailChangePending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
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

        {/* Privacy & Sharing */}
        <div className="mt-6 border-t pt-6">
          <h3 className="mb-4 text-sm font-semibold">Privacy &amp; Sharing</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is-public">Public Profile</Label>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Allow others to view your profile at /u/{username}
                </p>
              </div>
              <Switch
                id="is-public"
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
            </div>

            {isPublic && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="public-bio">Public Bio</Label>
                  <Input
                    id="public-bio"
                    value={publicBio}
                    onChange={(e) => setPublicBio(e.target.value)}
                    placeholder="A short bio for your public profile"
                    maxLength={200}
                    className="max-w-sm"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="public-stats">Show Collection Stats</Label>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Display total series and volume counts on your profile
                    </p>
                  </div>
                  <Switch
                    id="public-stats"
                    checked={publicStats}
                    onCheckedChange={setPublicStats}
                  />
                </div>
              </>
            )}
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
  )
}
