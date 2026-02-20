import Link from "next/link"
import { notFound } from "next/navigation"

import { ShareButton } from "@/components/ui/share-button"
import { getPublicProfileUrl } from "@/lib/share-url"
// eslint-disable-next-line no-restricted-imports -- Admin client required: public page needs RLS bypass for unauthenticated visitors
import { createAdminClient } from "@/lib/supabase/admin"
import {
  extractStoragePath,
  resolveImageUrl
} from "@/lib/uploads/resolve-image-url"

import type { PublicSeries } from "./series-grid"
import { SeriesGrid } from "./series-grid"

export const dynamic = "force-dynamic"

type VolumeRow = { series_id: string | null; reading_status: string | null }

function buildVolumeStats(rows: VolumeRow[]) {
  const countBySeries = new Map<string, number>()
  let completedCount = 0
  for (const row of rows) {
    if (!row.series_id) continue
    countBySeries.set(
      row.series_id,
      (countBySeries.get(row.series_id) ?? 0) + 1
    )
    if (row.reading_status === "completed") completedCount++
  }
  return { countBySeries, completedCount }
}

type Props = {
  readonly params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params
  return {
    title: `${username}'s Collection — ShelfArc`,
    description: `View ${username}'s manga and light novel collection on ShelfArc`
  }
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params
  const admin = createAdminClient({ reason: "Public profile page lookup" })

  // Look up profile by username
  const { data: profile } = await admin
    .from("profiles")
    .select(
      "id, username, avatar_url, public_bio, public_stats, is_public, created_at"
    )
    .ilike("username", username)
    .single()

  if (!profile?.is_public) {
    notFound()
  }

  // Fetch public series for this user
  const { data: seriesData } = await admin
    .from("series")
    .select(
      "id, title, original_title, author, artist, publisher, cover_image_url, type, total_volumes, status, tags, created_at"
    )
    .eq("user_id", profile.id)
    .eq("is_public", true)
    .order("title", { ascending: true })

  const seriesList: PublicSeries[] = []
  let totalCompletedVolumes = 0

  if (seriesData && seriesData.length > 0) {
    const seriesIds = seriesData.map((s) => s.id)

    // Single aggregated query instead of N+1 per-series count queries
    // Exclude wishlist volumes from public counts
    const { data: volumeRows } = await admin
      .from("volumes")
      .select("series_id, reading_status")
      .eq("user_id", profile.id)
      .in("series_id", seriesIds)
      .eq("ownership_status", "owned")

    const { countBySeries, completedCount } = buildVolumeStats(volumeRows ?? [])
    totalCompletedVolumes = completedCount

    for (const s of seriesData) {
      seriesList.push({ ...s, volumeCount: countBySeries.get(s.id) ?? 0 })
    }
  }

  // Calculate stats
  const totalSeries = seriesList.length
  const totalVolumes = seriesList.reduce((sum, s) => sum + s.volumeCount, 0)
  const readingCompletionPct =
    totalVolumes > 0
      ? Math.round((totalCompletedVolumes / totalVolumes) * 100)
      : 0

  // For public profiles, use a short-lived signed URL so unauthenticated visitors
  // can see the avatar without accessing the authenticated storage proxy.
  let resolvedAvatar: string | undefined
  if (profile.avatar_url) {
    const storagePath = extractStoragePath(profile.avatar_url)
    if (storagePath) {
      const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "media"
      const { data: signedData } = await admin.storage
        .from(bucket)
        .createSignedUrl(storagePath, 86_400) // 24-hour signed URL
      resolvedAvatar = signedData?.signedUrl ?? undefined
    } else {
      resolvedAvatar = resolveImageUrl(profile.avatar_url)
    }
  }
  const displayName = profile.username ?? username
  const shareUrl = getPublicProfileUrl(displayName)
  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  })

  return (
    <div className="min-h-screen bg-linear-to-b from-neutral-50 to-white dark:from-neutral-950 dark:to-neutral-900">
      {/* Profile Header */}
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {/* Avatar */}
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-200 ring-4 ring-neutral-100 dark:bg-neutral-700 dark:ring-neutral-800">
              {resolvedAvatar ? (
                <img
                  src={resolvedAvatar}
                  alt={`${displayName}'s avatar`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-3xl font-semibold text-neutral-500 dark:text-neutral-400">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="text-center sm:text-left">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                  {displayName}
                </h1>
                <ShareButton url={shareUrl} label="Share" />
              </div>
              {profile.public_bio && (
                <p className="mt-2 max-w-lg text-neutral-600 dark:text-neutral-400">
                  {profile.public_bio}
                </p>
              )}
              <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-500">
                Member since {memberSince}
              </p>
            </div>
          </div>

          {/* Stats */}
          {profile.public_stats && (
            <div className="mt-8 flex gap-8">
              <div>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {totalSeries}
                </p>
                <p className="text-sm text-neutral-500">Series</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {totalVolumes}
                </p>
                <p className="text-sm text-neutral-500">
                  {totalVolumes === 1 ? "Volume" : "Volumes"}
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {readingCompletionPct}%
                </p>
                <p className="text-sm text-neutral-500">Read</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Series Grid */}
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {seriesList.length === 0 ? (
          <p className="text-center text-neutral-500">
            No public series to display yet.
          </p>
        ) : (
          <>
            <h2 className="mb-6 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Collection
            </h2>
            <SeriesGrid seriesList={seriesList} displayName={displayName} />
          </>
        )}
      </main>

      {/* Footer branding */}
      <footer className="border-t border-neutral-200 py-6 text-center dark:border-neutral-800">
        <Link
          href="/"
          className="text-sm text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-300"
        >
          Powered by ShelfArc
        </Link>
      </footer>
    </div>
  )
}
