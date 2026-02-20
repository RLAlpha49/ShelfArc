import Link from "next/link"
import { notFound } from "next/navigation"

import { ShareButton } from "@/components/ui/share-button"
import { getPublicSeriesUrl } from "@/lib/share-url"
// eslint-disable-next-line no-restricted-imports -- Admin client required: public page needs RLS bypass for unauthenticated visitors
import { createAdminClient } from "@/lib/supabase/admin"
import { resolveImageUrl } from "@/lib/uploads/resolve-image-url"

export const dynamic = "force-dynamic"

type Props = {
  readonly params: Promise<{ username: string; seriesId: string }>
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

const READING_STATUS_LABELS: Record<string, string> = {
  unread: "Unread",
  reading: "Reading",
  completed: "Completed",
  on_hold: "On Hold",
  dropped: "Dropped"
}

export async function generateMetadata({ params }: Props) {
  const { username, seriesId } = await params
  const admin = createAdminClient({
    reason: "Public series metadata generation"
  })

  const { data: series } = await admin
    .from("series")
    .select("title")
    .eq("id", seriesId)
    .eq("is_public", true)
    .single()

  const title = series?.title ?? "Series"

  return {
    title: `${title} — ${username}'s Collection — ShelfArc`,
    description: `View ${title} in ${username}'s collection on ShelfArc`
  }
}

export default async function PublicSeriesPage({ params }: Props) {
  const { username, seriesId } = await params
  const admin = createAdminClient({ reason: "Public series page lookup" })

  // Verify profile is public
  const { data: profile } = await admin
    .from("profiles")
    .select("id, username, is_public")
    .ilike("username", username)
    .single()

  if (!profile?.is_public) {
    notFound()
  }

  // Fetch the series — must belong to user and be public
  const { data: series } = await admin
    .from("series")
    .select(
      "id, title, original_title, author, artist, publisher, cover_image_url, type, total_volumes, status, tags, description, created_at"
    )
    .eq("id", seriesId)
    .eq("user_id", profile.id)
    .eq("is_public", true)
    .single()

  if (!series) {
    notFound()
  }

  // Fetch volumes — only safe columns, excluding wishlist items
  const { data: volumes } = await admin
    .from("volumes")
    .select(
      "id, volume_number, title, isbn, cover_image_url, edition, format, page_count, publish_date, reading_status, rating, description"
    )
    .eq("series_id", series.id)
    .neq("ownership_status", "wishlist")
    .order("volume_number", { ascending: true })

  const displayName = profile.username ?? username
  const seriesCover = resolveImageUrl(series.cover_image_url)
  const shareUrl = getPublicSeriesUrl(displayName, seriesId)

  return (
    <div className="min-h-screen bg-linear-to-b from-neutral-50 to-white dark:from-neutral-950 dark:to-neutral-900">
      {/* Back nav */}
      <div className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
          <Link
            href={`/u/${encodeURIComponent(displayName)}`}
            className="text-sm text-neutral-500 transition-colors hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            &larr; Back to {displayName}&apos;s collection
          </Link>
        </div>
      </div>

      {/* Series Header */}
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row">
            {/* Cover */}
            {seriesCover && (
              <div className="w-40 shrink-0 overflow-hidden rounded-lg bg-neutral-100 shadow-md dark:bg-neutral-800">
                <img
                  src={seriesCover}
                  alt={series.title}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            {/* Details */}
            <div className="flex-1">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                  {series.title}
                </h1>
                <ShareButton
                  url={shareUrl}
                  label="Share"
                  className="shrink-0"
                />
              </div>
              {series.original_title && (
                <p className="mt-1 text-sm text-neutral-500">
                  {series.original_title}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                  {TYPE_LABELS[series.type] ?? series.type}
                </span>
                {series.status && (
                  <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                    {STATUS_LABELS[series.status] ?? series.status}
                  </span>
                )}
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {series.author && (
                  <div>
                    <dt className="text-neutral-500">Author</dt>
                    <dd className="font-medium text-neutral-900 dark:text-neutral-100">
                      {series.author}
                    </dd>
                  </div>
                )}
                {series.artist && series.artist !== series.author && (
                  <div>
                    <dt className="text-neutral-500">Artist</dt>
                    <dd className="font-medium text-neutral-900 dark:text-neutral-100">
                      {series.artist}
                    </dd>
                  </div>
                )}
                {series.publisher && (
                  <div>
                    <dt className="text-neutral-500">Publisher</dt>
                    <dd className="font-medium text-neutral-900 dark:text-neutral-100">
                      {series.publisher}
                    </dd>
                  </div>
                )}
                {series.total_volumes != null && (
                  <div>
                    <dt className="text-neutral-500">Total Volumes</dt>
                    <dd className="font-medium text-neutral-900 dark:text-neutral-100">
                      {series.total_volumes}
                    </dd>
                  </div>
                )}
              </dl>

              {series.description && (
                <p
                  className="mt-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400"
                  dangerouslySetInnerHTML={{ __html: series.description }}
                />
              )}

              {series.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {series.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Volumes Grid */}
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {!volumes || volumes.length === 0 ? (
          <p className="text-center text-neutral-500">
            No volumes cataloged yet.
          </p>
        ) : (
          <>
            <h2 className="mb-6 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Volumes ({volumes.length})
            </h2>
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {volumes.map((vol) => {
                const volCover = resolveImageUrl(vol.cover_image_url)
                return (
                  <div
                    key={vol.id}
                    className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    {/* Cover */}
                    <div className="aspect-2/3 w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                      {volCover ? (
                        <img
                          src={volCover}
                          alt={`Volume ${vol.volume_number}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <span className="text-lg font-semibold text-neutral-400">
                            {vol.volume_number}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-2">
                      <p className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                        Vol. {vol.volume_number}
                      </p>
                      {vol.title && (
                        <p className="mt-0.5 line-clamp-1 text-[10px] text-neutral-500">
                          {vol.title}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {vol.format && (
                          <span className="rounded bg-neutral-100 px-1.5 py-px text-[9px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                            {vol.format}
                          </span>
                        )}
                        {vol.edition && (
                          <span className="rounded bg-neutral-100 px-1.5 py-px text-[9px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                            {vol.edition}
                          </span>
                        )}
                        {vol.reading_status && (
                          <span className="rounded bg-neutral-100 px-1.5 py-px text-[9px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                            {READING_STATUS_LABELS[vol.reading_status] ??
                              vol.reading_status}
                          </span>
                        )}
                      </div>
                      {vol.rating != null && (
                        <p className="mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          {vol.rating}/10
                        </p>
                      )}
                    </div>
                  </div>
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
