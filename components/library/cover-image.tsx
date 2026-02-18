"use client"

import { useCallback, useMemo, useState } from "react"

import { getCoverCandidates } from "@/lib/uploads/resolve-image-url"
import { cn } from "@/lib/utils"

type ImageLoading = "eager" | "lazy"
type ImageDecoding = "async" | "auto" | "sync"
type FetchPriority = "high" | "low" | "auto"

/** Props for the multi-source {@link CoverImage} component (default mode). @source */
interface CoverImageBaseProps {
  readonly isbn?: string | null
  readonly coverImageUrl?: string | null
  readonly fallbackCoverImageUrl?: string | null
  readonly alt: string
  readonly className?: string
  readonly loading?: ImageLoading
  readonly decoding?: ImageDecoding
  readonly fetchPriority?: FetchPriority
  readonly fallback?: React.ReactNode
  readonly preview?: false
  readonly src?: never
  readonly wrapperClassName?: never
  readonly onError?: never
}

/**
 * Props for the preview variant of {@link CoverImage}.
 * Renders a single `src` URL inside an aspect-ratio wrapper.
 * Equivalent to the former `CoverPreviewImage` component.
 * @source
 */
interface CoverImagePreviewProps {
  readonly alt: string
  readonly src: string
  readonly preview: true
  readonly wrapperClassName?: string
  readonly className?: string
  readonly loading?: ImageLoading
  readonly decoding?: ImageDecoding
  readonly onError?: () => void
  // unused in preview mode
  readonly isbn?: never
  readonly coverImageUrl?: never
  readonly fallbackCoverImageUrl?: never
  readonly fallback?: never
  readonly fetchPriority?: never
}

type CoverImageProps = CoverImageBaseProps | CoverImagePreviewProps

/**
 * Renders a book cover image.
 *
 * **Default mode** (no `preview` prop): accepts `isbn`, `coverImageUrl`, and
 * `fallbackCoverImageUrl` and resolves through a ranked candidate list with
 * automatic fallback on error.
 *
 * **Preview mode** (`preview={true}`): accepts a single `src` URL and displays
 * it inside a fixed aspect-ratio wrapper with a loading overlay — equivalent to
 * the former `CoverPreviewImage` component.
 *
 * @param props - {@link CoverImageProps}
 * @source
 */
export function CoverImage(props: CoverImageProps) {
  if (props.preview) {
    return <CoverPreviewFrame {...props} />
  }

  const {
    isbn,
    coverImageUrl,
    fallbackCoverImageUrl,
    alt,
    className,
    loading,
    decoding,
    fetchPriority,
    fallback
  } = props

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const candidates = useMemo(
    () => getCoverCandidates({ isbn, coverImageUrl, fallbackCoverImageUrl }),
    [isbn, coverImageUrl, fallbackCoverImageUrl]
  )
  const src = candidates[0]
  if (!src) return <>{fallback ?? null}</>

  const candidatesKey = candidates.join("|")

  return (
    <CoverImageFrame
      key={candidatesKey}
      candidates={candidates}
      alt={alt}
      className={className}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      fallback={fallback}
    />
  )
}

// ─── Preview variant ─────────────────────────────────────────────────────────

/**
 * Renders a single cover image URL inside a fixed aspect-ratio wrapper with a
 * loading spinner overlay. Replaces the former `CoverPreviewImage` component.
 */
function CoverPreviewFrame({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  preview: _preview,
  src,
  alt,
  wrapperClassName,
  className,
  loading = "lazy",
  decoding = "async",
  onError
}: CoverImagePreviewProps) {
  const [isLoading, setIsLoading] = useState(true)

  return (
    <div
      className={cn(
        "bg-muted relative aspect-2/3 w-40 overflow-hidden rounded-xl shadow-md",
        wrapperClassName
      )}
      aria-busy={isLoading}
    >
      <img
        key={src}
        src={src}
        alt={alt}
        loading={loading}
        decoding={decoding}
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100",
          className
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false)
          onError?.()
        }}
      />
      {isLoading && <CoverLoadingSpinner />}
    </div>
  )
}

// ─── Multi-source variant internals ──────────────────────────────────────────

/** Props for the internal {@link CoverImageFrame} renderer. @source */
interface CoverImageFrameProps {
  readonly candidates: string[]
  readonly alt: string
  readonly className?: string
  readonly loading?: ImageLoading
  readonly decoding?: ImageDecoding
  readonly fetchPriority?: FetchPriority
  readonly fallback?: React.ReactNode
}

/**
 * Internal frame that loads a single candidate URL and cycles to the next on error.
 * @param props - {@link CoverImageFrameProps}
 * @source
 */
function CoverImageFrame({
  candidates,
  alt,
  className,
  loading,
  decoding,
  fetchPriority,
  fallback
}: CoverImageFrameProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const src = candidates[activeIndex]

  const handleError = useCallback(() => {
    const nextIndex = activeIndex + 1
    if (nextIndex >= candidates.length) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setActiveIndex(nextIndex)
  }, [activeIndex, candidates.length])

  const handleLoad = useCallback(() => {
    setIsLoading(false)
  }, [])

  return (
    <span className="relative block h-full w-full" aria-busy={isLoading}>
      {fallback && (
        <span className="absolute inset-0" aria-hidden="true">
          {fallback}
        </span>
      )}
      <img
        key={src}
        src={src}
        alt={alt}
        className={cn(
          "transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100",
          className
        )}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        onError={handleError}
        onLoad={handleLoad}
      />
      {isLoading && <CoverLoadingSpinner />}
    </span>
  )
}

/** Shared loading spinner overlay used by both cover image variants. @source */
function CoverLoadingSpinner() {
  return (
    <output className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="bg-background/70 text-foreground border-border/60 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] shadow-sm backdrop-blur">
        <svg
          className="h-3.5 w-3.5 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
        <span className="sr-only">Loading image</span>
        <span aria-hidden="true">Loading…</span>
      </span>
    </output>
  )
}
