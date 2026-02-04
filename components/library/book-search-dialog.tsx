"use client"

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  normalizeBookKey,
  type BookSearchResult,
  type BookSearchSource
} from "@/lib/books/search"
import { normalizeIsbn } from "@/lib/books/isbn"
import { CoverImage } from "@/components/library/cover-image"
import type { OwnershipStatus } from "@/lib/types/database"

type SearchContext = "series" | "volume"

interface BookSearchDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onSelectResult: (
    result: BookSearchResult,
    options?: { ownershipStatus?: OwnershipStatus }
  ) => Promise<void> | void
  readonly onSelectResults?: (
    results: BookSearchResult[],
    options?: { ownershipStatus?: OwnershipStatus }
  ) => Promise<void> | void
  readonly onAddManual: () => void
  readonly context: SearchContext
  readonly existingIsbns?: readonly string[]
  readonly existingBookKeys?: readonly string[]
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

const sourceCopy: Record<BookSearchSource, { label: string; hint: string }> = {
  google_books: {
    label: "Google Books",
    hint: "Best for rich metadata and cover art."
  },
  open_library: {
    label: "Open Library",
    hint: "Great for older or rare editions."
  }
}

const SEARCH_PLACEHOLDER = "Search by title, author, or ISBN..."
const SKELETON_ROWS = ["primary", "secondary", "tertiary"]
const RESULTS_PAGE_SIZE = 50

const dedupeResults = (items: BookSearchResult[]) => {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.source}:${item.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function BookSearchDialog({
  open,
  onOpenChange,
  onSelectResult,
  onSelectResults,
  onAddManual,
  context,
  existingIsbns = [],
  existingBookKeys = []
}: BookSearchDialogProps) {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [results, setResults] = useState<BookSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isBulkAdding, setIsBulkAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sourceUsed, setSourceUsed] = useState<BookSearchSource | null>(null)
  const [source, setSource] = useState<BookSearchSource>("google_books")
  const [selectingId, setSelectingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [queryKey, setQueryKey] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [ownershipStatus, setOwnershipStatus] =
    useState<OwnershipStatus>("owned")
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)
  const [showJumpToTop, setShowJumpToTop] = useState(false)

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
      setSource("google_books")
      setPage(1)
      setHasMore(false)
      setIsLoadingMore(false)
      setQueryKey("")
      setSelectedIds(new Set())
      setIsBulkAdding(false)
      setShowJumpToTop(false)
      setOwnershipStatus("owned")
    }
  }, [open])

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 800)

    return () => clearTimeout(handle)
  }, [query])

  useEffect(() => {
    if (!open) return
    if (debouncedQuery.length < 2) {
      setResults([])
      setError(null)
      setSourceUsed(null)
      setPage(1)
      setHasMore(false)
      setQueryKey("")
      setSelectedIds(new Set())
      return
    }

    setPage(1)
    setHasMore(false)
    setQueryKey(`${source}:${debouncedQuery}`)
    setSelectedIds(new Set())
  }, [debouncedQuery, open, source])

  useEffect(() => {
    if (!open || !queryKey) return

    const controller = new AbortController()
    const isFirstPage = page === 1
    if (isFirstPage) {
      setIsLoading(true)
      setResults([])
      setSourceUsed(null)
    } else {
      setIsLoadingMore(true)
    }
    setError(null)

    fetch(
      `/api/books/search?q=${encodeURIComponent(
        debouncedQuery
      )}&source=${source}&page=${page}&limit=${RESULTS_PAGE_SIZE}`,
      {
        signal: controller.signal
      }
    )
      .then(async (response) => {
        const data = (await response.json()) as {
          results?: BookSearchResult[]
          sourceUsed?: BookSearchSource | null
          error?: string
        }

        if (!response.ok) {
          throw new Error(data.error ?? "Search failed")
        }

        const incomingResults = data.results ?? []
        const dedupedIncoming = dedupeResults(incomingResults)
        setResults((prev) => {
          const merged = isFirstPage
            ? dedupedIncoming
            : [...prev, ...dedupedIncoming]
          return dedupeResults(merged)
        })
        setSourceUsed(data.sourceUsed ?? source)
        setHasMore(incomingResults.length === RESULTS_PAGE_SIZE)
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return
        setError(err.message || "Search failed")
        if (isFirstPage) {
          setResults([])
          setSourceUsed(null)
        }
        setHasMore(false)
      })
      .finally(() => {
        if (isFirstPage) {
          setIsLoading(false)
        } else {
          setIsLoadingMore(false)
        }
      })

    return () => controller.abort()
  }, [debouncedQuery, open, page, queryKey, source])

  useEffect(() => {
    if (!open || !queryKey || page !== 1) return
    scrollViewportRef.current?.scrollTo({ top: 0, behavior: "smooth" })
    setShowJumpToTop(false)
  }, [open, page, queryKey])

  const handleSelect = useCallback(
    async (result: BookSearchResult) => {
      setSelectingId(result.id)
      try {
        await onSelectResult(result, { ownershipStatus })
        onOpenChange(false)
      } finally {
        setSelectingId(null)
      }
    },
    [onOpenChange, onSelectResult, ownershipStatus]
  )

  const existingIsbnSet = useMemo(() => {
    if (existingIsbns.length === 0) return new Set<string>()
    return new Set(
      existingIsbns
        .map((isbn) => normalizeIsbn(isbn))
        .filter((isbn) => isbn.length > 0)
    )
  }, [existingIsbns])

  const existingBookKeySet = useMemo(() => {
    if (existingBookKeys.length === 0) return new Set<string>()
    return new Set(existingBookKeys.filter((key) => key.length > 0))
  }, [existingBookKeys])

  const deferredResults = useDeferredValue(results)

  const decoratedResults = useMemo(() => {
    return deferredResults.map((result) => {
      const normalizedIsbn = result.isbn ? normalizeIsbn(result.isbn) : null
      const normalizedKey = normalizeBookKey(
        result.title,
        result.authors[0] ?? null
      )
      const isAlreadyAdded =
        (normalizedIsbn && existingIsbnSet.has(normalizedIsbn)) ||
        (normalizedKey && existingBookKeySet.has(normalizedKey))
      return {
        result,
        isAlreadyAdded,
        isSelected: selectedIds.has(result.id)
      }
    })
  }, [deferredResults, existingBookKeySet, existingIsbnSet, selectedIds])

  const rowVirtualizer = useVirtualizer({
    count: decoratedResults.length,
    getScrollElement: () => scrollViewportRef.current,
    estimateSize: () => 120,
    overscan: 6,
    getItemKey: (index) => decoratedResults[index]?.result.id ?? index
  })

  const virtualRows = rowVirtualizer.getVirtualItems()

  const selectedResults = useMemo(() => {
    return results.filter((result) => selectedIds.has(result.id))
  }, [results, selectedIds])

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleAddSelected = useCallback(async () => {
    if (selectedResults.length === 0) return
    const resultsToAdd = selectedResults.filter((result) => {
      const normalizedIsbn = result.isbn ? normalizeIsbn(result.isbn) : null
      const normalizedKey = normalizeBookKey(
        result.title,
        result.authors[0] ?? null
      )
      return !(
        (normalizedIsbn && existingIsbnSet.has(normalizedIsbn)) ||
        (normalizedKey && existingBookKeySet.has(normalizedKey))
      )
    })
    if (resultsToAdd.length === 0) {
      setSelectedIds(new Set())
      return
    }

    setIsBulkAdding(true)
    try {
      if (onSelectResults) {
        await onSelectResults(resultsToAdd, { ownershipStatus })
      } else {
        for (const result of resultsToAdd) {
          await onSelectResult(result, { ownershipStatus })
        }
      }
      setSelectedIds(new Set())
    } finally {
      setIsBulkAdding(false)
    }
  }, [
    existingBookKeySet,
    existingIsbnSet,
    onSelectResult,
    onSelectResults,
    ownershipStatus,
    selectedResults
  ])

  const selectedSource = sourceCopy[source]
  const activeSourceLabel = sourceCopy[sourceUsed ?? source].label
  const isQueryReady = debouncedQuery.length >= 2
  const selectedCount = selectedIds.size
  const showEmptyState =
    isQueryReady && !isLoading && !error && results.length === 0

  useEffect(() => {
    const viewport = scrollViewportRef.current
    if (!viewport) return
    const updateScrollState = () => {
      setShowJumpToTop(viewport.scrollTop > 320)
    }
    const handleScroll = () => updateScrollState()
    updateScrollState()
    viewport.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      viewport.removeEventListener("scroll", handleScroll)
    }
  }, [open, queryKey])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] min-h-0 w-full max-w-3xl flex-col overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="bg-muted/30 shrink-0 border-b px-6 pt-6 pb-4">
          <div className="flex flex-col gap-1">
            <DialogTitle className="text-base">
              {contextCopy[context].title}
            </DialogTitle>
            <DialogDescription>
              {contextCopy[context].description}
            </DialogDescription>
          </div>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <Input
                  placeholder={SEARCH_PLACEHOLDER}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <p className="text-muted-foreground mt-2 text-[11px]">
                  Tip: search by title, author, or ISBN.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-xs font-medium">
                  Search in
                </span>
                <Tabs
                  value={source}
                  onValueChange={(value) =>
                    setSource(value as BookSearchSource)
                  }
                >
                  <TabsList className="h-9">
                    <TabsTrigger value="google_books">Google Books</TabsTrigger>
                    <TabsTrigger value="open_library">Open Library</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="ownership_status"
                  className="text-muted-foreground text-xs font-medium"
                >
                  Add as
                </Label>
                <Select
                  value={ownershipStatus}
                  onValueChange={(value) =>
                    setOwnershipStatus(value as OwnershipStatus)
                  }
                >
                  <SelectTrigger
                    id="ownership_status"
                    className="h-9 w-[160px]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owned">Owned</SelectItem>
                    <SelectItem value="wishlist">Wishlist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea
          className="min-h-0 flex-1 overflow-y-auto"
          viewportRef={scrollViewportRef}
          viewportClassName="scroll-smooth"
        >
          <div className="space-y-4 px-6 py-4">
            {!isQueryReady && (
              <div className="text-muted-foreground text-sm">
                Start typing to search. We&apos;ll show matches from{" "}
                {selectedSource.label}.
              </div>
            )}

            {isLoading && (
              <div className="space-y-3">
                {SKELETON_ROWS.map((row) => (
                  <div
                    key={`skeleton-${row}`}
                    className="flex gap-3 rounded-lg border p-3"
                  >
                    <Skeleton className="h-20 w-14" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && error && (
              <div className="text-destructive text-sm">{error}</div>
            )}

            {showEmptyState && (
              <div className="text-muted-foreground text-sm">
                No results found. Try a different query or switch sources.
              </div>
            )}

            {!isLoading && !error && results.length > 0 && (
              <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                <span>Results from {activeSourceLabel}</span>
                <span>
                  {results.length} result{results.length === 1 ? "" : "s"}
                </span>
              </div>
            )}

            {decoratedResults.length > 0 && (
              <div className="relative w-full">
                <div
                  className="relative w-full"
                  style={{ height: rowVirtualizer.getTotalSize() }}
                >
                  {virtualRows.map((virtualRow) => {
                    const item = decoratedResults[virtualRow.index]
                    if (!item) return null
                    const { result, isAlreadyAdded, isSelected } = item

                    return (
                      <div
                        key={result.id}
                        ref={rowVirtualizer.measureElement}
                        data-index={virtualRow.index}
                        className="absolute top-0 left-0 w-full pb-4"
                        style={{
                          transform: `translateY(${virtualRow.start}px)`
                        }}
                      >
                        <div
                          className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                            isSelected
                              ? "border-primary/40 bg-accent/30"
                              : "border-border/70"
                          } ${isAlreadyAdded ? "opacity-70" : "hover:border-primary/30 hover:bg-accent/40"}`}
                        >
                          <Button
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            size="icon-sm"
                            aria-pressed={isSelected}
                            className="shrink-0"
                            disabled={isAlreadyAdded || isBulkAdding}
                            onClick={() => toggleSelected(result.id)}
                          >
                            <span className="text-[10px] font-semibold">
                              {isSelected ? "✓" : ""}
                            </span>
                            <span className="sr-only">
                              {isSelected ? "Deselect" : "Select"} book
                            </span>
                          </Button>

                          <div className="bg-muted relative h-20 w-14 shrink-0 overflow-hidden rounded-md">
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
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="line-clamp-1 text-sm font-semibold">
                                {result.title}
                              </h3>
                              {isAlreadyAdded && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  Added
                                </Badge>
                              )}
                              {selectingId === result.id && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  Adding...
                                </Badge>
                              )}
                            </div>
                            <p className="text-muted-foreground line-clamp-1 text-sm">
                              {result.authors.length > 0
                                ? result.authors.join(", ")
                                : "Unknown author"}
                            </p>
                            <div className="text-muted-foreground text-xs">
                              {result.isbn && <span>ISBN {result.isbn}</span>}
                              {result.publishedDate && (
                                <span
                                  className={result.isbn ? "ml-2" : undefined}
                                >
                                  {result.publishedDate}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            {!isAlreadyAdded && (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={
                                  selectingId === result.id || isBulkAdding
                                }
                                onClick={() => handleSelect(result)}
                              >
                                {selectingId === result.id
                                  ? "Adding..."
                                  : "Add"}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {!isLoading && !error && results.length > 0 && hasMore && (
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPage((prev) => prev + 1)}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? "Loading more..." : "Load more"}
                </Button>
              </div>
            )}
            {isLoadingMore && (
              <div className="text-muted-foreground text-center text-xs">
                Loading more...
              </div>
            )}
            {showJumpToTop && (
              <div className="pointer-events-none sticky bottom-3 flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="pointer-events-auto shadow-sm"
                  onClick={() =>
                    scrollViewportRef.current?.scrollTo({
                      top: 0,
                      behavior: "smooth"
                    })
                  }
                >
                  Jump to top
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="bg-background shrink-0 border-t px-6 py-4 shadow-[0_-6px_16px_-12px_rgba(0,0,0,0.35)]">
          {selectedCount > 0 && (
            <Button
              type="button"
              onClick={handleAddSelected}
              disabled={isBulkAdding}
            >
              {isBulkAdding
                ? `Adding ${selectedCount}...`
                : `Add selected (${selectedCount})`}
            </Button>
          )}
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
