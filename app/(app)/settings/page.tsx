"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useLibraryStore } from "@/lib/store/library-store"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { uploadImage } from "@/lib/uploads/upload-image"
import {
  extractStoragePath,
  resolveImageUrl
} from "@/lib/uploads/resolve-image-url"
import type { Profile } from "@/lib/types/database"

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
  const { deleteSeriesVolumes, setDeleteSeriesVolumes } = useLibraryStore()

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

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-6">
        <Skeleton className="mb-6 h-8 w-32" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      {/* Profile Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Manage your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={profile?.email || ""}
              disabled
              className="bg-muted"
            />
            <p className="text-muted-foreground text-xs">
              Email cannot be changed
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How should we call you?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatarUrl">Avatar URL</Label>
            <Input
              id="avatarUrl"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatarUpload">Upload Avatar</Label>
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
            <div className="flex items-center gap-2">
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
              {isUploadingAvatar && (
                <span className="text-muted-foreground text-xs">
                  Uploading...
                </span>
              )}
            </div>
            {avatarPreview && !avatarPreviewError && (
              <div className="flex items-center gap-3">
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="h-14 w-14 rounded-full object-cover"
                  onError={() => setAvatarPreviewError(true)}
                  onLoad={() => setAvatarPreviewError(false)}
                />
                <span className="text-muted-foreground text-xs">Preview</span>
              </div>
            )}
            <p className="text-muted-foreground text-xs">
              Square images work best. Uploads are compressed to WebP.
            </p>
          </div>

          <Button
            onClick={handleSaveProfile}
            disabled={isSaving || isUploadingAvatar}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      <Separator className="my-6" />

      {/* Preferences */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Customize your experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Theme</div>
              <div className="text-muted-foreground text-sm">
                Choose your preferred color scheme
              </div>
            </div>
            <div className="text-muted-foreground text-sm">
              Use the theme toggle in the header
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="delete-series-volumes" className="font-medium">
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
        </CardContent>
      </Card>

      <Separator className="my-6" />

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>Export or import your library data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <a
              href="/settings/export"
              className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="mr-2 h-4 w-4"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export Data
            </a>
            <a
              href="/settings/import"
              className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="mr-2 h-4 w-4"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Import Data
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
