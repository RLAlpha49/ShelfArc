import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import type { SuggestedBuy, SuggestionCategory } from "@/lib/library/analytics"

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

  return (
    <Link
      href={`/library/series/${suggestion.seriesId}`}
      className="glass-card group block rounded-xl p-4 transition-all hover:shadow-md"
    >
      <div className="flex items-center justify-between">
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
            {suggestion.isWishlisted && (
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
  )
}
