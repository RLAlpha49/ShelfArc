"use client"

import { useCallback } from "react"

import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface TagFilterControlProps {
  readonly availableTags: string[]
  readonly includeTags: string[]
  readonly excludeTags: string[]
  readonly onIncludeChange: (tags: string[]) => void
  readonly onExcludeChange: (tags: string[]) => void
}

type TagMode = "neutral" | "include" | "exclude"

function getTagMode(
  tag: string,
  includeTags: string[],
  excludeTags: string[]
): TagMode {
  if (includeTags.includes(tag)) return "include"
  if (excludeTags.includes(tag)) return "exclude"
  return "neutral"
}

function getTagCycleLabel(mode: TagMode, tag: string): string {
  if (mode === "neutral") return `Include tag ${tag}`
  if (mode === "include") return `Exclude tag ${tag}`
  return `Remove filter for tag ${tag}`
}

/**
 * Multi-tag filter with include/exclude modes.
 * Clicking cycles: neutral → include → exclude → neutral.
 */
export function TagFilterControl({
  availableTags,
  includeTags,
  excludeTags,
  onIncludeChange,
  onExcludeChange
}: TagFilterControlProps) {
  const activeCount = includeTags.length + excludeTags.length

  const cycleTag = useCallback(
    (tag: string) => {
      const mode = getTagMode(tag, includeTags, excludeTags)

      if (mode === "neutral") {
        onIncludeChange([...includeTags, tag])
      } else if (mode === "include") {
        onIncludeChange(includeTags.filter((t) => t !== tag))
        onExcludeChange([...excludeTags, tag])
      } else {
        onExcludeChange(excludeTags.filter((t) => t !== tag))
      }
    },
    [includeTags, excludeTags, onIncludeChange, onExcludeChange]
  )

  const removeTag = useCallback(
    (tag: string) => {
      onIncludeChange(includeTags.filter((t) => t !== tag))
      onExcludeChange(excludeTags.filter((t) => t !== tag))
    },
    [includeTags, excludeTags, onIncludeChange, onExcludeChange]
  )

  const clearAll = useCallback(() => {
    onIncludeChange([])
    onExcludeChange([])
  }, [onIncludeChange, onExcludeChange])

  return (
    <div className="space-y-1">
      <span className="text-muted-foreground text-[11px] font-medium">
        Tags
      </span>
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              className={cn(
                "border-input bg-background hover:bg-accent flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs shadow-sm transition-all",
                activeCount > 0 && "border-primary/40"
              )}
            />
          }
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground h-3.5 w-3.5"
          >
            <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
            <path d="M7 7h.01" />
          </svg>
          <span>Tags</span>
          {activeCount > 0 && (
            <span className="bg-primary text-primary-foreground flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium">
              {activeCount}
            </span>
          )}
        </PopoverTrigger>

        <PopoverContent align="start" className="w-64">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Filter by tags</span>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-muted-foreground hover:text-foreground text-[11px] transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Tag list */}
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map((tag) => {
                const mode = getTagMode(tag, includeTags, excludeTags)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => cycleTag(tag)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all",
                      mode === "neutral" &&
                        "border-border hover:bg-accent text-muted-foreground hover:text-foreground",
                      mode === "include" &&
                        "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400",
                      mode === "exclude" &&
                        "border-red-500/40 bg-red-500/10 text-red-700 hover:bg-red-500/20 dark:text-red-400"
                    )}
                    aria-label={getTagCycleLabel(mode, tag)}
                  >
                    {mode === "include" && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-2.5 w-2.5"
                      >
                        <path d="M5 12h14" />
                        <path d="M12 5v14" />
                      </svg>
                    )}
                    {mode === "exclude" && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-2.5 w-2.5"
                      >
                        <path d="M5 12h14" />
                      </svg>
                    )}
                    {tag}
                  </button>
                )
              })}
            </div>

            {/* Active filters summary */}
            {activeCount > 0 && (
              <div className="border-border space-y-1.5 border-t pt-2">
                <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  Active filters
                </span>
                <div className="flex flex-wrap gap-1">
                  {includeTags.map((tag) => (
                    <Badge
                      key={`inc-${tag}`}
                      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    >
                      + {tag}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeTag(tag)
                        }}
                        className="hover:text-foreground ml-0.5 transition-colors"
                        aria-label={`Remove include filter for ${tag}`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-2.5 w-2.5"
                        >
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </Badge>
                  ))}
                  {excludeTags.map((tag) => (
                    <Badge
                      key={`exc-${tag}`}
                      className="border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400"
                    >
                      − {tag}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeTag(tag)
                        }}
                        className="hover:text-foreground ml-0.5 transition-colors"
                        aria-label={`Remove exclude filter for ${tag}`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-2.5 w-2.5"
                        >
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
