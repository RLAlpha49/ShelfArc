"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { BookSearchResult } from "@/lib/books/search"
import { CoverImage } from "@/components/library/cover-image"

type SearchContext = "series" | "volume"

interface BookSearchDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onSelectResult: (result: BookSearchResult) => Promise<void> | void
  readonly onAddManual: () => void
  readonly context: SearchContext
}

const contextCopy: Record<
  SearchContext,
  { title: string; description: string }
> = {
  series: {
    title: "Search books to add",
    description:
      "Search by title, author, or ISBN. Selecting a result will create a series if needed and add the volume."
  },
  volume: {
    title: "Search volumes to add",
    description:
      "Search by title, author, or ISBN. Selecting a result will add a volume to this series."
  }
}

const sourceLabels: Record<BookSearchResult["source"], string> = {
  google_books: "Google Books",
  open_library: "Open Library"
}

const SEARCH_PLACEHOLDER = "Search by title, author, or ISBN..."

export function BookSearchDialog({
  open,
  onOpenChange,
  onSelectResult,
  onAddManual,
  context
}: BookSearchDialogProps) {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [results, setResults] = useState<BookSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sourceUsed, setSourceUsed] = useState<string | null>(null)
  const [selectingId, setSelectingId] = useState<string | null>(null)

  const manualLabel =
    context === "volume" ? "Add volume manually" : "Add book manually"

  useEffect(() => {
    if (!open) {
      setQuery("")
      setDebouncedQuery("")
      setResults([])
      setError(null)
      setSourceUsed(null)
      setSelectingId(null)
    }
  }, [open])

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 400)

    return () => clearTimeout(handle)
  }, [query])

  useEffect(() => {
    if (!open) return
    if (debouncedQuery.length < 2) {
      setResults([])
      setError(null)
      setSourceUsed(null)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    fetch(`/api/books/search?q=${encodeURIComponent(debouncedQuery)}`, {
      signal: controller.signal
    })
      .then(async (response) => {
        const data = (await response.json()) as {
          results?: BookSearchResult[]
          sourceUsed?: string | null
          error?: string
        }

        if (!response.ok) {
          throw new Error(data.error ?? "Search failed")
        }

        setResults(data.results ?? [])
        setSourceUsed(data.sourceUsed ?? null)
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return
        setError(err.message || "Search failed")
        setResults([])
        setSourceUsed(null)
      })
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [debouncedQuery, open])

  const handleSelect = useCallback(
    async (result: BookSearchResult) => {
      setSelectingId(result.id)
      try {
        await onSelectResult(result)
        onOpenChange(false)
      } finally {
        setSelectingId(null)
      }
    },
    [onOpenChange, onSelectResult]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{contextCopy[context].title}</DialogTitle>
          <DialogDescription>
            {contextCopy[context].description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder={SEARCH_PLACEHOLDER}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          {sourceUsed && results.length > 0 && (
            <p className="text-muted-foreground text-xs">
              Source:{" "}
              {sourceUsed === "google_books" ? "Google Books" : "Open Library"}
            </p>
          )}

          <ScrollArea className="max-h-[50vh] pr-2">
            <div className="space-y-3">
              {isLoading && (
                <div className="text-muted-foreground text-sm">
                  Searching...
                </div>
              )}
              {!isLoading && error && (
                <div className="text-destructive text-sm">{error}</div>
              )}
              {!isLoading &&
                !error &&
                results.length === 0 &&
                debouncedQuery && (
                  <div className="text-muted-foreground text-sm">
                    No results found. Try a different query.
                  </div>
                )}

              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  className="hover:bg-accent/50 flex w-full gap-3 rounded-md border p-3 text-left transition-colors disabled:cursor-not-allowed"
                  onClick={() => handleSelect(result)}
                  disabled={selectingId === result.id}
                >
                  <div className="bg-muted relative h-20 w-14 shrink-0 overflow-hidden rounded">
                    <CoverImage
                      isbn={result.isbn}
                      coverImageUrl={result.coverUrl}
                      alt={result.title}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                      fallback={
                        <div className="text-muted-foreground/60 flex h-full w-full items-center justify-center text-xs">
                          No cover
                        </div>
                      }
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="line-clamp-1 font-medium">
                        {result.title}
                      </h3>
                      <Badge variant="secondary" className="text-[10px]">
                        {sourceLabels[result.source]}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground line-clamp-1 text-sm">
                      {result.authors.length > 0
                        ? result.authors.join(", ")
                        : "Unknown author"}
                    </p>
                    <div className="text-muted-foreground text-xs">
                      {result.isbn && <span>ISBN {result.isbn}</span>}
                      {result.publishedDate && (
                        <span className={result.isbn ? "ml-2" : undefined}>
                          {result.publishedDate}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" type="button" onClick={onAddManual}>
            {manualLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
