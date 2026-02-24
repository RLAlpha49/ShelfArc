import Link from "next/link"
import { notFound } from "next/navigation"

import { ShareButton } from "@/components/ui/share-button"
import { ACHIEVEMENTS } from "@/lib/achievements/definitions"
import { getPublicProfileUrl } from "@/lib/share-url"
// eslint-disable-next-line no-restricted-imports -- Admin client required: public page needs RLS bypass for unauthenticated visitors
import { createAdminClient } from "@/lib/supabase/admin"
import { createUserClient } from "@/lib/supabase/server"
import {
  extractStoragePath,
  resolveImageUrl
} from "@/lib/uploads/resolve-image-url"

import { FollowButton } from "./follow-button"
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

  const supabase = await createUserClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

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

  // Fetch follow status and counts for authenticated visitors
  const isOwnProfile = user?.id === profile.id

  // Parallelize all independent queries after obtaining the profile
  const [
    { count: followerCount },
    followData,
    { data: seriesData },
    { data: earnedAchievements },
    resolvedAvatar
  ] = await Promise.all([
    admin
      .from("user_follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", profile.id),

    user && !isOwnProfile
      ? admin
          .from("user_follows")
          .select("follower_id")
          .eq("follower_id", user.id)
          .eq("following_id", profile.id)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),

    admin
      .from("series")
      .select(
        "id, title, original_title, author, artist, publisher, cover_image_url, type, total_volumes, status, tags, created_at"
      )
      .eq("user_id", profile.id)
      .eq("is_public", true)
      .order("title", { ascending: true }),

    admin
      .from("user_achievements")
      .select("achievement_id, earned_at")
      .eq("user_id", profile.id)
      .order("earned_at", { ascending: true }),

    // Short-lived signed URL so unauthenticated visitors can see the avatar
    // without going through the authenticated storage proxy.
    (async (): Promise<string | undefined> => {
      if (!profile.avatar_url) return undefined
      const storagePath = extractStoragePath(profile.avatar_url)
      if (storagePath?.startsWith(profile.id + "/")) {
        // Only generate signed URLs for storage paths owned by this profile
        const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "media"
        const { data: signedData } = await admin.storage
          .from(bucket)
          .createSignedUrl(storagePath, 86_400) // 24-hour signed URL
        return signedData?.signedUrl ?? undefined
      } else if (!storagePath) {
        return resolveImageUrl(profile.avatar_url)
      }
      // If storagePath doesn't belong to this profile, skip it (reject cross-user path)
      return undefined
    })()
  ])

  const isFollowing = followData !== null

  // Volume stats — sequential since we need seriesIds from the series query above
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
  const displayName = profile.username ?? username
  const shareUrl = getPublicProfileUrl(displayName)
  const memberSince = new Date(profile.created_at).toLocaleDateString(
    undefined,
    {
      month: "long",
      year: "numeric"
    }
  )

  return (
    <div className="via-background to-background dark:via-background dark:to-background min-h-screen bg-linear-to-b from-amber-50/30 dark:from-amber-950/10">
      {/* Profile Header */}
      <header className="bg-card/80 border-b border-amber-500/20 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {/* Avatar */}
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-50 ring-4 ring-amber-500/20 dark:bg-amber-900/20">
              {resolvedAvatar ? (
                <img
                  src={resolvedAvatar}
                  alt={`${displayName}'s avatar`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-3xl font-semibold text-amber-600 dark:text-amber-400">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="text-center sm:text-left">
              <div className="flex items-center gap-3">
                <h1 className="font-display text-3xl font-bold tracking-tight">
                  {displayName}
                </h1>
                <ShareButton url={shareUrl} label="Share" />
              </div>
              {profile.public_bio && (
                <p className="text-muted-foreground mt-2 max-w-lg">
                  {profile.public_bio}
                </p>
              )}
              <p className="text-muted-foreground mt-2 text-sm">
                Member since {memberSince}
              </p>
              {/* Follow button — shown to authenticated users viewing someone else's profile */}
              {user && !isOwnProfile && (
                <div className="mt-4">
                  <FollowButton
                    username={displayName}
                    initialIsFollowing={isFollowing}
                    initialFollowerCount={followerCount ?? 0}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          {profile.public_stats && (
            <div className="mt-8 flex gap-4">
              <div className="bg-card/80 rounded-2xl border border-amber-500/20 px-5 py-3 backdrop-blur-sm">
                <p className="text-2xl font-bold">{totalSeries}</p>
                <p className="text-muted-foreground text-sm">Series</p>
              </div>
              <div className="bg-card/80 rounded-2xl border border-amber-500/20 px-5 py-3 backdrop-blur-sm">
                <p className="text-2xl font-bold">{totalVolumes}</p>
                <p className="text-muted-foreground text-sm">
                  {totalVolumes === 1 ? "Volume" : "Volumes"}
                </p>
              </div>
              <div className="bg-card/80 rounded-2xl border border-amber-500/20 px-5 py-3 backdrop-blur-sm">
                <p className="text-2xl font-bold">{readingCompletionPct}%</p>
                <p className="text-muted-foreground text-sm">Read</p>
              </div>
            </div>
          )}

          {/* Achievements */}
          {profile.public_stats &&
            earnedAchievements &&
            earnedAchievements.length > 0 && (
              <div className="mt-6">
                <h2 className="text-muted-foreground mb-3 text-sm font-medium">
                  Achievements
                </h2>
                <div className="flex flex-wrap gap-2">
                  {earnedAchievements.map((a) => {
                    const def =
                      ACHIEVEMENTS[
                        a.achievement_id as keyof typeof ACHIEVEMENTS
                      ]
                    if (!def) return null
                    return (
                      <div
                        key={a.achievement_id}
                        title={def.description}
                        className="bg-card/80 flex items-center gap-1.5 rounded-full border border-amber-500/20 px-3 py-1.5 text-sm backdrop-blur-sm"
                      >
                        <span aria-hidden="true">{def.emoji}</span>
                        <span className="font-medium">{def.title}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
        </div>
      </header>

      {/* Series Grid */}
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {seriesList.length === 0 ? (
          <p className="text-muted-foreground text-center">
            No public series to display yet.
          </p>
        ) : (
          <>
            <h2 className="font-display mb-6 text-lg font-semibold">
              Collection
            </h2>
            <SeriesGrid seriesList={seriesList} displayName={displayName} />
          </>
        )}
      </main>

      {/* Footer branding */}
      <footer className="border-t border-amber-500/20 py-6 text-center">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          Powered by ShelfArc
        </Link>
      </footer>

      {/* Sign-up CTA banner for unauthenticated visitors */}
      {!user && (
        <div className="bg-background/95 fixed right-0 bottom-0 left-0 z-50 border-t p-4 backdrop-blur-sm">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <p className="text-sm">Track your own manga &amp; light novels</p>
            <Link
              href="/signup"
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-xl px-5 text-sm font-semibold shadow-sm transition-all hover:shadow-md"
            >
              Start for free &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
