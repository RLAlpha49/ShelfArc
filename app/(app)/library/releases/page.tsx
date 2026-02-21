import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { createUserClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Upcoming Releases — ShelfArc"
}

interface VolumeRelease {
  id: string
  volume_number: number
  title: string | null
  publish_date: string
  series_id: string | null
  isbn: string | null
  ownership_status: string
  release_reminder: boolean
  series: { id: string; title: string } | null
}

/** Groups an array of volumes by calendar month label (e.g. "March 2026"). */
function groupByMonth(volumes: VolumeRelease[]): [string, VolumeRelease[]][] {
  const map = new Map<string, VolumeRelease[]>()
  for (const vol of volumes) {
    const label = new Date(vol.publish_date + "T00:00:00Z").toLocaleDateString(
      "en-US",
      { month: "long", year: "numeric", timeZone: "UTC" }
    )
    const bucket = map.get(label) ?? []
    bucket.push(vol)
    map.set(label, bucket)
  }
  return [...map.entries()]
}

export default async function ReleasesPage() {
  const supabase = await createUserClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const today = new Date().toISOString().slice(0, 10)

  const { data } = await supabase
    .from("volumes")
    .select(
      "id, volume_number, title, publish_date, series_id, isbn, ownership_status, release_reminder, series:series_id(id, title)"
    )
    .eq("user_id", user.id)
    .not("publish_date", "is", null)
    .gte("publish_date", today)
    .order("publish_date", { ascending: true })
    .limit(500)

  const releases = (data ?? []) as unknown as VolumeRelease[]
  const grouped = groupByMonth(releases)
  const volumeWord = releases.length === 1 ? "volume" : "volumes"
  const countLabel =
    releases.length === 0
      ? "No upcoming releases found"
      : `${releases.length} ${volumeWord} with upcoming release dates`

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Upcoming Releases
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{countLabel}</p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {/* Filter: reminder-only */}
          <a
            href="/api/library/export/ical?filter=release_reminder"
            download="shelfarc-reminders.ics"
            className="hover:bg-accent text-muted-foreground inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            Reminders only (.ics)
          </a>

          {/* Export all */}
          <a
            href="/api/library/export/ical"
            download="shelfarc-releases.ics"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Export to Calendar (.ics)
          </a>
        </div>
      </div>

      {releases.length === 0 ? (
        <div className="bg-muted/30 rounded-2xl border p-12 text-center">
          <div className="text-muted-foreground bg-muted mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <h2 className="font-display mb-1 font-semibold">
            No upcoming releases
          </h2>
          <p className="text-muted-foreground text-sm">
            Add publish dates to your wishlist volumes — they&apos;ll appear
            here.
          </p>
          <Link
            href="/library"
            className="text-primary mt-4 inline-flex items-center text-sm font-medium underline-offset-4 hover:underline"
          >
            Go to Library
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([month, vols]) => (
            <section key={month}>
              <h2 className="font-display text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
                {month}
              </h2>
              <div className="space-y-2">
                {vols.map((vol) => {
                  const seriesTitle = vol.series?.title ?? "Unknown Series"
                  const displayDate = new Date(
                    vol.publish_date + "T00:00:00Z"
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC"
                  })

                  return (
                    <div
                      key={vol.id}
                      className="bg-muted/30 flex items-center gap-4 rounded-xl border p-4"
                    >
                      {/* Date badge */}
                      <div className="text-muted-foreground w-14 shrink-0 text-center text-xs font-medium tabular-nums">
                        {displayDate}
                      </div>

                      {/* Volume info */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {seriesTitle} Vol. {vol.volume_number}
                          {vol.title ? ` \u2014 ${vol.title}` : ""}
                        </p>
                        {vol.isbn && (
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            ISBN: {vol.isbn}
                          </p>
                        )}
                      </div>

                      {/* Badges + actions */}
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {vol.release_reminder && (
                          <span className="border-primary/20 bg-primary/8 text-primary inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
                            Reminder set
                          </span>
                        )}
                        <span
                          className={
                            vol.ownership_status === "wishlist"
                              ? "inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-400/20 dark:text-amber-400"
                              : "inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-400"
                          }
                        >
                          {vol.ownership_status}
                        </span>
                        {vol.series?.id && (
                          <Link
                            href={`/library/series/${vol.series.id}`}
                            className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 transition-colors hover:underline"
                          >
                            View series
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Subscribe hint */}
      <div className="bg-muted/20 mt-8 rounded-xl border border-dashed p-4 text-center">
        <p className="text-muted-foreground text-xs">
          <strong className="text-foreground">Pro tip:</strong> Use the
          &ldquo;Subscribe&rdquo; URL{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-xs">
            /api/library/export/ical
          </code>{" "}
          in your calendar app to get a live-updating feed of all your release
          dates.
        </p>
      </div>
    </div>
  )
}
