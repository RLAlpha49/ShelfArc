"use client"

import { useMemo, useState } from "react"

import type { TagBreakdown } from "@/lib/library/analytics"

type SortField = "owned" | "volumes" | "spent" | "rating"

interface DashboardTagAnalyticsProps {
  readonly breakdown: TagBreakdown[]
  readonly priceFormatter: Intl.NumberFormat
}

const INITIAL_LIMIT = 6

const COLS: { field: SortField; label: string }[] = [
  { field: "volumes", label: "Volumes" },
  { field: "owned", label: "Owned" },
  { field: "spent", label: "Spent" },
  { field: "rating", label: "Rating" }
]

function tagHue(tag: string): number {
  let sum = 0
  for (const ch of tag) sum += ch.codePointAt(0) ?? 0
  return sum % 360
}

export default function DashboardTagAnalytics({
  breakdown,
  priceFormatter
}: DashboardTagAnalyticsProps) {
  const [sortField, setSortField] = useState<SortField>("owned")
  const [expanded, setExpanded] = useState(false)

  const sorted = useMemo(
    () =>
      [...breakdown].sort((a, b) => {
        if (sortField === "volumes") return b.volumeCount - a.volumeCount
        if (sortField === "spent") return b.totalSpent - a.totalSpent
        if (sortField === "rating") return b.avgRating - a.avgRating
        return b.ownedCount - a.ownedCount
      }),
    [breakdown, sortField]
  )

  const visible = useMemo(
    () => (expanded ? sorted : sorted.slice(0, INITIAL_LIMIT)),
    [sorted, expanded]
  )

  const remaining = sorted.length - INITIAL_LIMIT

  if (breakdown.length === 0) {
    return (
      <div className="glass-card flex flex-col items-center justify-center rounded-xl px-6 py-14 text-center">
        <div className="text-primary bg-primary/10 mb-3 flex h-11 w-11 items-center justify-center rounded-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-5 w-5"
          >
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
        </div>
        <p className="text-muted-foreground text-sm">No tags yet</p>
        <p className="text-muted-foreground/60 mt-1 text-xs">
          Add tags to your series to see a breakdown here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="pb-2 text-left font-normal">
                <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  Tag
                </span>
              </th>
              {COLS.map(({ field, label }) => (
                <th key={field} className="pb-2 text-right font-normal">
                  <button
                    type="button"
                    onClick={() => setSortField(field)}
                    className={`text-[10px] font-medium tracking-wider uppercase transition-colors ${
                      sortField === field
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                    {sortField === field && <span className="ml-0.5">↓</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => {
              const hue = tagHue(item.tag)
              const pct =
                item.volumeCount > 0
                  ? Math.round((item.ownedCount / item.volumeCount) * 100)
                  : 0

              return (
                <tr
                  key={item.tag}
                  className="border-border/20 border-t transition-colors hover:bg-white/5"
                >
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white"
                        style={{ background: `hsl(${hue}, 65%, 55%)` }}
                      >
                        {item.tag.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 truncate font-medium">
                        {item.tag}
                      </span>
                    </div>
                  </td>
                  <td className="text-muted-foreground py-2 text-right tabular-nums">
                    {item.volumeCount}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center justify-end">
                      <span className="text-muted-foreground tabular-nums">
                        {item.ownedCount}
                      </span>
                      <div className="bg-primary/8 ml-2 h-1.5 w-16 overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="text-muted-foreground py-2 text-right tabular-nums">
                    {item.totalSpent > 0
                      ? priceFormatter.format(item.totalSpent)
                      : "—"}
                  </td>
                  <td className="text-muted-foreground py-2 text-right tabular-nums">
                    {item.avgRating > 0
                      ? `★ ${item.avgRating.toFixed(1)}`
                      : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!expanded && remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-primary hover:text-primary/80 text-xs font-medium transition-colors"
        >
          Show {remaining} more
        </button>
      )}
    </div>
  )
}
