"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

const PILL_BASE = "rounded-full px-3 py-1 text-xs font-medium transition-colors"
const PILL_ACTIVE =
  "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
const PILL_INACTIVE =
  "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"

type Props = {
  readonly seriesList: PublicSeries[]
  readonly displayName: string
}

export function SeriesGrid({ seriesList, displayName }: Props) {
  const [page, setPage] = useState(1)
  const [activeType, setActiveType] = useState<string | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const availableTypes = Array.from(
    new Set(seriesList.map((s) => s.type))
  ).sort((a, b) => a.localeCompare(b))
  const allTags = Array.from(new Set(seriesList.flatMap((s) => s.tags))).sort(
    (a, b) => a.localeCompare(b)
  )

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filtered = seriesList.filter((s) => {
    if (activeType !== null && s.type !== activeType) return false
    if (activeTag !== null && !s.tags.includes(activeTag)) return false
    if (normalizedQuery) {
      const inTitle = s.title.toLowerCase().includes(normalizedQuery)
      const inOriginal =
        s.original_title?.toLowerCase().includes(normalizedQuery) ?? false
      const inAuthor =
        s.author?.toLowerCase().includes(normalizedQuery) ?? false
      if (!inTitle && !inOriginal && !inAuthor) return false
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const start = (page - 1) * PAGE_SIZE
  const visibleSeries = filtered.slice(start, start + PAGE_SIZE)

  function handleTypeChange(type: string | null) {
    setActiveType(type)
    setPage(1)
  }

  function handleTagChange(tag: string | null) {
    setActiveTag(tag)
    setPage(1)
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value)
    setPage(1)
  }

  const showTypeFilter = availableTypes.length > 1
  const showTagFilter = allTags.length > 0

  return (
    <>
      {/* Search + Filters */}
      <div className="mb-6 flex flex-col gap-3">
        <Input
          type="search"
          placeholder="Search by title or author…"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="max-w-sm"
          aria-label="Search series"
        />

        {(showTypeFilter || showTagFilter) && (
          <div className="flex flex-col gap-3">
            {showTypeFilter && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => handleTypeChange(null)}
                  className={`${PILL_BASE} ${
                    activeType === null ? PILL_ACTIVE : PILL_INACTIVE
                  }`}
                >
                  All Types
                </button>
                {availableTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => handleTypeChange(type)}
                    className={`${PILL_BASE} ${
                      activeType === type ? PILL_ACTIVE : PILL_INACTIVE
                    }`}
                  >
                    {TYPE_LABELS[type] ?? type}
                  </button>
                ))}
              </div>
            )}

            {showTagFilter && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => handleTagChange(null)}
                  className={`${PILL_BASE} ${
                    activeTag === null ? PILL_ACTIVE : PILL_INACTIVE
                  }`}
                >
                  All Tags
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleTagChange(tag)}
                    className={`${PILL_BASE} ${
                      activeTag === tag ? PILL_ACTIVE : PILL_INACTIVE
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-neutral-500">
          No series match the selected filters.
        </p>
      ) : (
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
      )}

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
