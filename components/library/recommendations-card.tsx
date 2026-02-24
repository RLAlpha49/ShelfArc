"use client"

import Link from "next/link"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import type { SuggestedBuy, SuggestionCategory } from "@/lib/library/analytics"
import { useLibraryStore } from "@/lib/store/library-store"
import { resolveImageUrl } from "@/lib/uploads/resolve-image-url"

const CATEGORY_CONFIG: Record<
  SuggestionCategory,
  { label: string; className: string }
> = {
  gap_fill: {
    label: "Gap Fill",
    className:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
  },
  continue: {
    label: "Continue",
    className:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
  },
  complete_series: {
    label: "Complete",
    className:
      "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
  },
  continue_reading: {
    label: "Reading",
    className:
      "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
  }
}

interface RecommendationsCardProps {
  readonly suggestion: SuggestedBuy
  readonly currencyFormatter: Intl.NumberFormat
}

export function RecommendationsCard({
  suggestion,
  currencyFormatter
}: RecommendationsCardProps) {
  const cat = CATEGORY_CONFIG[suggestion.category]
  const coverUrl = resolveImageUrl(suggestion.coverImageUrl ?? "")
  const [isDismissed, setIsDismissed] = useState(false)
  const dismissSuggestion = useLibraryStore((s) => s.dismissSuggestion)
  const [isWishlisted, setIsWishlisted] = useState(suggestion.isWishlisted)
  const [wishlistVolumeId, setWishlistVolumeId] = useState(
    suggestion.wishlistVolumeId
  )
  const [isPending, setIsPending] = useState(false)

  if (isDismissed) return null

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDismissed(true)
    dismissSuggestion(suggestion.seriesId)
  }

  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isPending) return

    const prevWishlisted = isWishlisted
    const prevId = wishlistVolumeId
    setIsWishlisted(!prevWishlisted)
    setIsPending(true)

    try {
      if (prevWishlisted && prevId) {
        const res = await fetch(`/api/library/volumes/${prevId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownership_status: null })
        })
        if (!res.ok) {
          throw new Error("Failed to remove from wishlist")
        }
        setWishlistVolumeId(null)
      } else {
        const res = await fetch("/api/library/volumes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            series_id: suggestion.seriesId,
            volume_number: suggestion.volumeNumber,
            ownership_status: "wishlist"
          })
        })
        if (res.ok) {
          const json = (await res.json()) as { data?: { id?: string } }
          setWishlistVolumeId(json.data?.id ?? null)
        } else {
          throw new Error("Failed to wishlist")
        }
      }
    } catch {
      setIsWishlisted(prevWishlisted)
      setWishlistVolumeId(prevId)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="glass-card group relative rounded-xl transition-all hover:shadow-md">
      <Link
        href={`/library/series/${suggestion.seriesId}`}
        className="block p-4 pr-10 pb-8"
      >
        <div className="flex items-center gap-3">
          {coverUrl && (
            <img
              src={coverUrl}
              alt=""
              aria-hidden
              width={36}
              height={54}
              className="h-13.5 w-9 shrink-0 rounded-sm object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="group-hover:text-primary truncate text-sm font-semibold transition-colors">
                {suggestion.seriesTitle}
              </span>
              <Badge variant="outline" className={cat.className}>
                {cat.label}
              </Badge>
            </div>
            <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
              <span>Vol. {suggestion.volumeNumber}</span>
              {isWishlisted && (
                <span className="bg-gold/10 text-gold rounded px-1.5 py-0.5 text-[10px] font-medium">
                  Wishlisted
                </span>
              )}
              {suggestion.estimatedPrice != null &&
                suggestion.estimatedPrice > 0 && (
                  <span className="text-muted-foreground/60">
                    {currencyFormatter.format(suggestion.estimatedPrice)}
                  </span>
                )}
            </div>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-muted-foreground/40 group-hover:text-primary ml-3 h-4 w-4 shrink-0 transition-all group-hover:translate-x-0.5"
          >
            <polyline points="9,18 15,12 9,6" />
          </svg>
        </div>
      </Link>
      <button
        type="button"
        onClick={handleWishlistToggle}
        disabled={isPending}
        className={`absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
          isWishlisted
            ? "text-gold hover:text-gold/70"
            : "text-muted-foreground/40 hover:text-gold"
        }`}
        aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={isWishlisted ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-4 w-4"
        >
          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        className="text-muted-foreground/30 hover:text-destructive absolute right-3 bottom-3 flex h-6 w-6 items-center justify-center rounded-md transition-colors"
        aria-label="Not interested"
        title="Not interested"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-3.5 w-3.5"
        >
          <line x1="18" x2="6" y1="6" y2="18" />
          <line x1="6" x2="18" y1="6" y2="18" />
        </svg>
      </button>
    </div>
  )
}
