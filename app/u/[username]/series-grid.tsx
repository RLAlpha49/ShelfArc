"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { resolveImageUrl } from "@/lib/uploads/resolve-image-url"

export type PublicSeries = {
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

const PAGE_SIZE = 12

type Props = {
  readonly seriesList: PublicSeries[]
  readonly displayName: string
}

export function SeriesGrid({ seriesList, displayName }: Props) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(seriesList.length / PAGE_SIZE))
  const start = (page - 1) * PAGE_SIZE
  const visibleSeries = seriesList.slice(start, start + PAGE_SIZE)

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {visibleSeries.map((series) => {
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
                    <span className="text-xs text-neutral-400">No Cover</span>
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

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-neutral-500">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </>
  )
}
