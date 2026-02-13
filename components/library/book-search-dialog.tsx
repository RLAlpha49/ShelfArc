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
  type BookSearchResult,
  type BookSearchSource
} from "@/lib/books/search"
import { searchBooks } from "@/lib/api/endpoints"
import { normalizeIsbn } from "@/lib/books/isbn"
import { CoverImage } from "@/components/library/cover-image"
import { useSettingsStore } from "@/lib/store/settings-store"
import type { OwnershipStatus } from "@/lib/types/database"

/** Whether the search dialog is used to add a series or a volume. @source */
type SearchContext = "series" | "volume"

/** Props for the {@link BookSearchDialog} component. @source */
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
}

/** Dialog title and description per search context. @source */
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

/** Human-readable labels and hints per search source. @source */
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

/** Default placeholder for the search input. @source */
const SEARCH_PLACEHOLDER = "Search by title, author, or ISBN..."
/** Keys for rendering skeleton loading rows. @source */
const SKELETON_ROWS = ["primary", "secondary", "tertiary"]
/** Number of results fetched per page. @source */
const RESULTS_PAGE_SIZE = 50
/** Result count above which virtualised rendering kicks in. @source */
const VIRTUALIZE_THRESHOLD = 40

/**
 * Removes duplicate search results by `source:id` key.
 * @param items - Raw search result array.
 * @returns De-duplicated array.
 * @source
 */
const dedupeResults = (items: BookSearchResult[]) => {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.source}:${item.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Full-screen dialog for searching books via Google Books or Open Library, with
 * multi-select, virtualised list, pagination, and ownership-status selector.
 * @param props - {@link BookSearchDialogProps}
 * @source
 */
export function BookSearchDialog({
  open,
  onOpenChange,
  onSelectResult,
  onSelectResults,
  onAddManual,
  context,
  existingIsbns = []
}: BookSearchDialogProps) {
  const defaultOwnershipStatus = useSettingsStore(
    (s) => s.defaultOwnershipStatus
  )
  const defaultSearchSource = useSettingsStore((s) => s.defaultSearchSource)

  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [results, setResults] = useState<BookSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isBulkAdding, setIsBulkAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sourceUsed, setSourceUsed] = useState<BookSearchSource | null>(null)
  const [source, setSource] = useState<BookSearchSource>(defaultSearchSource)
  const [selectingId, setSelectingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [queryKey, setQueryKey] = useState("")
  const [selectedResultsById, setSelectedResultsById] = useState<
    Map<string, BookSearchResult>
  >(new Map())
  const [ownershipStatus, setOwnershipStatus] = useState<OwnershipStatus>(
    defaultOwnershipStatus
  )
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
      setSource(defaultSearchSource)
      setPage(1)
      setHasMore(false)
      setIsLoadingMore(false)
      setQueryKey("")
      setSelectedResultsById(new Map())
      setIsBulkAdding(false)
      setShowJumpToTop(false)
      setOwnershipStatus(defaultOwnershipStatus)
    }
  }, [open, defaultOwnershipStatus, defaultSearchSource])

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
      return
    }

    setPage(1)
    setHasMore(false)
    setQueryKey(`${source}:${debouncedQuery}`)
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

    searchBooks(
      { q: debouncedQuery, source, page, limit: RESULTS_PAGE_SIZE },
      controller.signal
    )
      .then((data) => {
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

  const deferredResults = useDeferredValue(results)

  const selectedIds = useMemo(() => {
    return new Set(selectedResultsById.keys())
  }, [selectedResultsById])

  const decoratedResults = useMemo(() => {
    return deferredResults.map((result) => {
      const normalizedIsbn = result.isbn ? normalizeIsbn(result.isbn) : null
      const isAlreadyAdded = normalizedIsbn
        ? existingIsbnSet.has(normalizedIsbn)
        : false
      return {
        result,
        isAlreadyAdded,
        isSelected: selectedIds.has(result.id)
      }
    })
  }, [deferredResults, existingIsbnSet, selectedIds])

  const rowVirtualizer = useVirtualizer({
    count: decoratedResults.length,
    getScrollElement: () => scrollViewportRef.current,
    estimateSize: () => 120,
    overscan: 6,
    getItemKey: (index) => decoratedResults[index]?.result.id ?? index
  })

  const virtualRows = rowVirtualizer.getVirtualItems()

  const selectedResults = useMemo(() => {
    return Array.from(selectedResultsById.values())
  }, [selectedResultsById])

  const toggleSelected = useCallback((result: BookSearchResult) => {
    setSelectedResultsById((prev) => {
      const next = new Map(prev)
      if (next.has(result.id)) {
        next.delete(result.id)
      } else {
        next.set(result.id, result)
      }
      return next
    })
  }, [])

  const handleAddSelected = useCallback(async () => {
    if (selectedResults.length === 0) return
    const resultsToAdd = selectedResults.filter((result) => {
      const normalizedIsbn = result.isbn ? normalizeIsbn(result.isbn) : null
      return normalizedIsbn ? !existingIsbnSet.has(normalizedIsbn) : true
    })
    if (resultsToAdd.length === 0) {
      setSelectedResultsById(new Map())
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
      setSelectedResultsById(new Map())
    } finally {
      setIsBulkAdding(false)
    }
  }, [
    existingIsbnSet,
    onSelectResult,
    onSelectResults,
    ownershipStatus,
    selectedResults
  ])

  const selectedSource = sourceCopy[source]
  const activeSourceLabel = sourceCopy[sourceUsed ?? source].label
  const isQueryReady = debouncedQuery.length >= 2
  const selectedCount = selectedResultsById.size
  const isAdding = isBulkAdding || selectingId !== null
  const addingUnit = selectedCount === 1 ? "book" : "books"
  const addingLabel = isBulkAdding
    ? `Adding ${selectedCount} ${addingUnit}...`
    : "Adding book..."
  const showEmptyState =
    isQueryReady && !isLoading && !error && results.length === 0
  const isDebouncing =
    query.trim().length >= 2 && query.trim() !== debouncedQuery
  const shouldVirtualize = decoratedResults.length > VIRTUALIZE_THRESHOLD

  const renderResultCard = useCallback(
    (item: {
      result: BookSearchResult
      isAlreadyAdded: boolean
      isSelected: boolean
    }) => {
      const { result, isAlreadyAdded, isSelected } = item
      return (
        <div
          className={`group/card relative flex w-full items-stretch gap-4 rounded-xl border p-3 pr-4 text-left transition-all duration-300 ${
            isSelected
              ? "border-copper/50 bg-copper/6 shadow-[0_0_20px_-4px_var(--warm-glow),inset_0_1px_0_var(--copper)/0.08]"
              : "border-border/60 bg-card/60"
          } ${isAlreadyAdded ? "opacity-60" : "hover:border-copper/30 hover:bg-warm/15 hover:-translate-y-px hover:shadow-[0_8px_24px_-8px_var(--warm-glow)]"}`}
        >
          {/* Selection checkbox */}
          <button
            type="button"
            aria-pressed={isSelected}
            className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all duration-200 ${
              isSelected
                ? "border-copper bg-copper text-white shadow-[0_0_8px_var(--warm-glow)]"
                : "border-border/80 bg-background hover:border-copper/50"
            } ${isAlreadyAdded || isBulkAdding ? "pointer-events-none opacity-40" : "cursor-pointer"}`}
            disabled={isAlreadyAdded || isBulkAdding}
            onClick={() => toggleSelected(result)}
          >
            {isSelected && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2.5 6.5L4.5 8.5L9.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            <span className="sr-only">
              {isSelected ? "Deselect" : "Select"} book
            </span>
          </button>

          {/* Cover image — prominent, bookshelf-style */}
          <div className="relative h-30 w-20 shrink-0 overflow-hidden rounded-lg shadow-[2px_4px_12px_-2px_oklch(0_0_0/0.15)] transition-shadow duration-300 group-hover/card:shadow-[3px_6px_16px_-2px_oklch(0_0_0/0.2)]">
            <div className="absolute inset-y-0 left-0 z-10 w-0.75 bg-linear-to-r from-black/8 to-transparent" />
            <CoverImage
              isbn={result.isbn}
              coverImageUrl={result.coverUrl}
              alt={result.title}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
              fallback={
                <div className="from-warm/80 to-warm/40 flex h-full w-full flex-col items-center justify-center bg-linear-to-br p-2">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-muted-foreground/40 mb-1"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 4.5A2.5 2.5 0 016.5 2H14l6 6v11.5a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 19.5v-15z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M14 2v6h6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="text-muted-foreground/50 text-center text-[9px] leading-tight">
                    No cover
                  </span>
                </div>
              }
            />
          </div>

          {/* Book details — editorial typography hierarchy */}
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display line-clamp-2 text-[15px] leading-snug font-semibold tracking-tight">
                {result.title}
              </h3>
              {isAlreadyAdded && (
                <span className="bg-copper/10 text-copper inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2.5 6.5L4.5 8.5L9.5 3.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  In Library
                </span>
              )}
              {selectingId === result.id && (
                <span className="bg-copper/10 text-copper inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
                  <svg
                    className="h-2.5 w-2.5 animate-spin"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="8"
                      cy="8"
                      r="6"
                      stroke="currentColor"
                      strokeWidth="2"
                      opacity="0.3"
                    />
                    <path
                      d="M14 8a6 6 0 00-6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  Adding…
                </span>
              )}
            </div>
            <p className="text-muted-foreground line-clamp-1 text-[13px]">
              {result.authors.length > 0
                ? result.authors.join(", ")
                : "Unknown author"}
            </p>
            <div className="text-muted-foreground/70 flex items-center gap-2 text-[11px]">
              {result.isbn && (
                <span className="font-mono tracking-wide">{result.isbn}</span>
              )}
              {result.isbn && result.publishedDate && (
                <span
                  className="bg-border/60 inline-block h-3 w-px"
                  aria-hidden="true"
                />
              )}
              {result.publishedDate && <span>{result.publishedDate}</span>}
              {result.pageCount && (
                <>
                  <span
                    className="bg-border/60 inline-block h-3 w-px"
                    aria-hidden="true"
                  />
                  <span>{result.pageCount} pp.</span>
                </>
              )}
            </div>
          </div>

          {/* Action button — right-aligned */}
          <div className="flex shrink-0 items-center">
            {!isAlreadyAdded && (
              <Button
                type="button"
                size="sm"
                variant={selectingId === result.id ? "outline" : "secondary"}
                className="rounded-lg px-3 text-xs"
                disabled={selectingId === result.id || isBulkAdding}
                onClick={() => handleSelect(result)}
              >
                {selectingId === result.id ? (
                  <span className="flex items-center gap-1.5">
                    <svg
                      className="h-3 w-3 animate-spin"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        cx="8"
                        cy="8"
                        r="6"
                        stroke="currentColor"
                        strokeWidth="2"
                        opacity="0.3"
                      />
                      <path
                        d="M14 8a6 6 0 00-6-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    Adding…
                  </span>
                ) : (
                  "Add"
                )}
              </Button>
            )}
          </div>
        </div>
      )
    },
    [handleSelect, isBulkAdding, selectingId, toggleSelected]
  )

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
      <DialogContent
        className="noise-overlay flex max-h-[90vh] min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-2xl border-none p-0 shadow-[0_24px_64px_-16px_oklch(0_0_0/0.25),0_0_0_1px_var(--copper)/0.1] sm:max-w-3xl"
        aria-busy={isAdding}
      >
        {/* Adding overlay — glass effect */}
        {isAdding && (
          <div className="animate-fade-in absolute inset-0 z-20 flex items-center justify-center bg-black/20 backdrop-blur-md">
            <div className="animate-scale-in glass-card flex items-center gap-4 rounded-2xl px-6 py-4 shadow-[0_12px_40px_-8px_oklch(0_0_0/0.2),0_0_0_1px_var(--copper)/0.15]">
              <div className="from-copper/20 to-gold/20 flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br">
                <svg
                  className="text-copper h-5 w-5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    opacity="0.2"
                  />
                  <path
                    d="M21 12a9 9 0 00-9-9"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <output
                className="font-display text-sm font-semibold"
                aria-live="polite"
              >
                {addingLabel}
              </output>
            </div>
          </div>
        )}

        {/* Header — search engine-style prominent input */}
        <DialogHeader className="bg-warm/20 relative shrink-0 overflow-hidden px-6 pt-6 pb-5">
          {/* Subtle decorative gradient wash */}
          <div
            className="from-copper/4 via-gold/2 pointer-events-none absolute inset-0 bg-linear-to-br to-transparent"
            aria-hidden="true"
          />

          <div className="relative flex flex-col gap-1">
            <DialogTitle className="font-display text-lg font-semibold tracking-tight">
              {contextCopy[context].title}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground/80 text-[13px]">
              {contextCopy[context].description}
            </DialogDescription>
          </div>

          {/* Search input — large, prominent */}
          <div className="relative mt-5">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                className="text-muted-foreground/50 z-10"
                aria-hidden="true"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="7"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M16 16l4.5 4.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <Input
              placeholder={SEARCH_PLACEHOLDER}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="bg-background/80 h-12 rounded-xl border-none pl-11 text-base shadow-[inset_0_1px_2px_oklch(0_0_0/0.06),0_0_0_1px_var(--border)/0.5] backdrop-blur-sm transition-shadow duration-300 placeholder:text-sm focus-visible:shadow-[inset_0_1px_2px_oklch(0_0_0/0.04),0_0_0_1px_var(--copper)/0.4,0_0_24px_-4px_var(--warm-glow)]"
            />
            {isDebouncing && (
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                <svg
                  className="text-copper h-4 w-4 animate-spin"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="8"
                    cy="8"
                    r="6"
                    stroke="currentColor"
                    strokeWidth="2"
                    opacity="0.3"
                  />
                  <path
                    d="M14 8a6 6 0 00-6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Source tabs + ownership selector row */}
          <div className="relative mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <Tabs
                value={source}
                onValueChange={(value) => setSource(value as BookSearchSource)}
              >
                <TabsList className="bg-background/60 h-8 rounded-lg">
                  <TabsTrigger value="google_books" className="text-[11px]">
                    Google Books
                  </TabsTrigger>
                  <TabsTrigger value="open_library" className="text-[11px]">
                    Open Library
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <span className="text-muted-foreground/50 hidden text-[10px] sm:inline">
                {selectedSource.hint}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Label
                htmlFor="ownership_status"
                className="text-muted-foreground/70 text-[11px] font-medium tracking-wider uppercase"
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
                  className="h-8 w-32 rounded-lg text-xs"
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

          {/* Decorative divider with book icon */}
          <div
            className="border-border/40 relative mt-5 border-t"
            aria-hidden="true"
          />
        </DialogHeader>

        {/* Scrollable results area */}
        <ScrollArea
          className="relative min-h-0 flex-1 overflow-y-auto"
          viewportRef={scrollViewportRef}
          viewportClassName="scroll-smooth"
        >
          <div className="px-6 py-4">
            {/* Initial state — no query */}
            {!isQueryReady && !isDebouncing && (
              <div className="animate-fade-in flex flex-col items-center justify-center py-20 text-center">
                <div className="from-warm/60 to-warm/20 mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-linear-to-br shadow-[0_0_40px_var(--warm-glow)]">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-copper/60"
                    aria-hidden="true"
                  >
                    <circle
                      cx="11"
                      cy="11"
                      r="7"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M16 16l4.5 4.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M8 8.5h6M8 11h4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <p className="font-display text-muted-foreground/80 text-sm font-medium">
                  Search by title, author, or ISBN
                </p>
                <p className="text-muted-foreground/50 mt-1 text-xs">
                  We&apos;ll find matches from {selectedSource.label}
                </p>
              </div>
            )}

            {/* Loading skeletons — atmospheric book-shaped */}
            {isLoading && (
              <div className="animate-fade-in space-y-3">
                <p className="text-muted-foreground/60 mb-4 flex items-center gap-2 text-xs">
                  <svg
                    className="text-copper/50 h-4 w-4 animate-spin"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="8"
                      cy="8"
                      r="6"
                      stroke="currentColor"
                      strokeWidth="2"
                      opacity="0.3"
                    />
                    <path
                      d="M14 8a6 6 0 00-6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="font-display italic">
                    Searching the shelves…
                  </span>
                </p>
                {SKELETON_ROWS.map((row, i) => (
                  <div
                    key={`skeleton-${row}`}
                    className="animate-fade-in-up flex gap-4 rounded-xl border p-3 opacity-0"
                    style={{
                      animationDelay: `${i * 120}ms`,
                      animationFillMode: "forwards"
                    }}
                  >
                    <Skeleton className="h-30 w-20 shrink-0 rounded-lg" />
                    <div className="flex flex-1 flex-col justify-center gap-2.5 py-1">
                      <Skeleton className="h-4 w-3/4 rounded" />
                      <Skeleton className="h-3 w-1/2 rounded" />
                      <Skeleton className="h-3 w-2/5 rounded" />
                    </div>
                    <Skeleton className="h-7 w-12 self-center rounded-lg" />
                  </div>
                ))}
              </div>
            )}

            {/* Debouncing state */}
            {!isLoading && isDebouncing && (
              <div className="animate-fade-in flex items-center gap-2.5 py-4">
                <svg
                  className="text-copper/60 h-4 w-4 animate-spin"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="8"
                    cy="8"
                    r="6"
                    stroke="currentColor"
                    strokeWidth="2"
                    opacity="0.3"
                  />
                  <path
                    d="M14 8a6 6 0 00-6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-muted-foreground font-display text-sm italic">
                  Searching the shelves…
                </span>
              </div>
            )}

            {/* Error state */}
            {!isLoading && error && (
              <div className="animate-fade-in flex flex-col items-center py-12 text-center">
                <div className="bg-destructive/10 mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-destructive/70"
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M12 8v4M12 16h.01"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <p className="font-display text-sm font-semibold">
                  Something went wrong
                </p>
                <p className="text-destructive/80 mt-1 max-w-xs text-xs">
                  {error}
                </p>
              </div>
            )}

            {/* Empty state — evocative, atmospheric */}
            {showEmptyState && !isDebouncing && (
              <div className="animate-fade-in flex flex-col items-center justify-center py-20 text-center">
                <div className="from-copper/15 to-gold/10 mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-linear-to-br shadow-[0_0_40px_var(--warm-glow)]">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-copper/50"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 010-5H20"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9 7h6M9 10h4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      opacity="0.5"
                    />
                  </svg>
                </div>
                <p className="font-display text-base font-semibold tracking-tight">
                  No volumes found
                </p>
                <p className="text-muted-foreground/70 mt-1.5 max-w-70 text-[13px] leading-relaxed">
                  We couldn&apos;t find any matches. Try adjusting your search
                  or switching to{" "}
                  {source === "google_books" ? "Open Library" : "Google Books"}.
                </p>
              </div>
            )}

            {/* Results header */}
            {!isLoading && !error && results.length > 0 && (
              <div className="text-muted-foreground/60 mb-4 flex items-center justify-between">
                <span className="text-[10px] font-medium tracking-[0.15em] uppercase">
                  Results from {activeSourceLabel}
                </span>
                <span className="bg-warm/40 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums">
                  {results.length} result{results.length === 1 ? "" : "s"}
                </span>
              </div>
            )}

            {/* Results list */}
            {decoratedResults.length > 0 && (
              <div className="relative w-full">
                {shouldVirtualize ? (
                  <ul
                    className="relative m-0 w-full list-none p-0"
                    aria-label="Search results"
                    style={{ height: rowVirtualizer.getTotalSize() }}
                  >
                    {virtualRows.map((virtualRow) => {
                      const item = decoratedResults[virtualRow.index]
                      if (!item) return null

                      return (
                        <li
                          key={item.result.id}
                          ref={rowVirtualizer.measureElement}
                          data-index={virtualRow.index}
                          className="absolute top-0 left-0 w-full pb-3"
                          style={{
                            transform: `translateY(${virtualRow.start}px)`
                          }}
                        >
                          {renderResultCard(item)}
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <ul
                    className="m-0 list-none space-y-3 p-0"
                    aria-label="Search results"
                  >
                    {decoratedResults.map((item) => (
                      <li key={item.result.id}>{renderResultCard(item)}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Load more */}
            {!isLoading && !error && results.length > 0 && hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="border-copper/20 hover:border-copper/40 hover:bg-copper/5 rounded-xl px-6 text-xs transition-colors"
                  onClick={() => setPage((prev) => prev + 1)}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="h-3.5 w-3.5 animate-spin"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                      >
                        <circle
                          cx="8"
                          cy="8"
                          r="6"
                          stroke="currentColor"
                          strokeWidth="2"
                          opacity="0.3"
                        />
                        <path
                          d="M14 8a6 6 0 00-6-6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                      Loading more…
                    </span>
                  ) : (
                    "Load more results"
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Jump to top — floating pill */}
          {showJumpToTop && (
            <div className="pointer-events-none absolute right-4 bottom-4 z-10">
              <button
                type="button"
                className="bg-background/90 border-border/60 text-muted-foreground hover:text-foreground hover:border-copper/30 animate-fade-in-up pointer-events-auto flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-lg backdrop-blur-sm transition-colors"
                onClick={() =>
                  scrollViewportRef.current?.scrollTo({
                    top: 0,
                    behavior: "smooth"
                  })
                }
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M6 9V3M3 5.5L6 2.5L9 5.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Top
              </button>
            </div>
          )}
        </ScrollArea>

        {/* Footer — sticky with selected count */}
        <DialogFooter className="bg-background/95 shrink-0 border-t px-6 py-3 backdrop-blur-sm">
          <div className="flex w-full items-center justify-between gap-3">
            {/* Left — selected count pill */}
            <div className="flex items-center gap-2">
              {selectedCount > 0 && (
                <span className="bg-copper/10 text-copper animate-scale-in inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2.5 6.5L4.5 8.5L9.5 3.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {selectedCount} selected
                </span>
              )}
            </div>

            {/* Right — action buttons */}
            <div className="flex items-center gap-2">
              {selectedCount > 0 && (
                <Button
                  type="button"
                  className="bg-copper hover:bg-copper/90 press-effect rounded-xl px-4 text-xs text-white shadow-[0_2px_8px_var(--warm-glow)]"
                  onClick={handleAddSelected}
                  disabled={isBulkAdding}
                >
                  {isBulkAdding
                    ? `Adding ${selectedCount}…`
                    : `Add ${selectedCount} ${addingUnit}`}
                </Button>
              )}
              <Button
                variant="outline"
                type="button"
                className="border-border/60 hover:border-copper/30 hover:bg-warm/20 rounded-xl text-xs transition-colors"
                onClick={onAddManual}
              >
                {manualLabel}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground rounded-xl text-xs"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
