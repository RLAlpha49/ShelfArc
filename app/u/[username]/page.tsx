import Link from "next/link"
import { notFound } from "next/navigation"

// eslint-disable-next-line no-restricted-imports -- Admin client required: public page needs RLS bypass for unauthenticated visitors
import { createAdminClient } from "@/lib/supabase/admin"
import { resolveImageUrl } from "@/lib/uploads/resolve-image-url"

export const dynamic = "force-dynamic"

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

type PublicSeries = {
  id: string
  title: string
  original_title: string | null
  author: string | null
  artist: string | null
  publisher: string | null
  cover_image_url: string | null
  type: string
  total_volumes: number | null
  status: string | null
  tags: string[]
  created_at: string
  volumeCount: number
}

const TYPE_LABELS: Record<string, string> = {
  manga: "Manga",
  light_novel: "Light Novel",
  other: "Other"
}

const STATUS_LABELS: Record<string, string> = {
  ongoing: "Ongoing",
  completed: "Completed",
  hiatus: "Hiatus",
  cancelled: "Cancelled",
  upcoming: "Upcoming"
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

  if (seriesData && seriesData.length > 0) {
    const seriesIds = seriesData.map((s) => s.id)

    // Single aggregated query instead of N+1 per-series count queries
    const { data: volumeRows } = await admin
      .from("volumes")
      .select("series_id")
      .eq("user_id", profile.id)
      .in("series_id", seriesIds)

    const countBySeries = new Map<string, number>()
    for (const row of volumeRows ?? []) {
      if (!row.series_id) continue
      const prev = countBySeries.get(row.series_id) ?? 0
      countBySeries.set(row.series_id, prev + 1)
    }

    for (const s of seriesData) {
      seriesList.push({ ...s, volumeCount: countBySeries.get(s.id) ?? 0 })
    }
  }

  // Calculate stats
  const totalSeries = seriesList.length
  const totalVolumes = seriesList.reduce((sum, s) => sum + s.volumeCount, 0)

  const resolvedAvatar = resolveImageUrl(profile.avatar_url)
  const displayName = profile.username ?? username
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
              <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                {displayName}
              </h1>
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {seriesList.map((series) => {
                const coverUrl = resolveImageUrl(series.cover_image_url)
                return (
                  <a
                    key={series.id}
                    href={`/u/${encodeURIComponent(displayName)}/${series.id}`}
                    className="group overflow-hidden rounded-xl border border-neutral-200 bg-white transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    {/* Cover */}
                    <div className="aspect-2/3 w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={series.title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <span className="text-xs text-neutral-400">
                            No Cover
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <p className="line-clamp-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {series.title}
                      </p>
                      {series.author && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">
                          {series.author}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                          {TYPE_LABELS[series.type] ?? series.type}
                        </span>
                        {series.status && (
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                            {STATUS_LABELS[series.status] ?? series.status}
                          </span>
                        )}
                        <span className="text-[10px] text-neutral-500">
                          {series.volumeCount}{" "}
                          {series.volumeCount === 1 ? "vol" : "vols"}
                        </span>
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
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
