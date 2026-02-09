"use client"

import { useCallback, useMemo, useState } from "react"
import { getCoverCandidates } from "@/lib/uploads/resolve-image-url"
import { cn } from "@/lib/utils"

interface CoverImageProps {
  readonly isbn?: string | null
  readonly coverImageUrl?: string | null
  readonly fallbackCoverImageUrl?: string | null
  readonly alt: string
  readonly className?: string
  readonly loading?: "eager" | "lazy"
  readonly decoding?: "async" | "auto" | "sync"
  readonly fetchPriority?: "high" | "low" | "auto"
  readonly fallback?: React.ReactNode
}

export function CoverImage({
  isbn,
  coverImageUrl,
  fallbackCoverImageUrl,
  alt,
  className,
  loading,
  decoding,
  fetchPriority,
  fallback
}: CoverImageProps) {
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

interface CoverImageFrameProps {
  readonly candidates: string[]
  readonly alt: string
  readonly className?: string
  readonly loading?: "eager" | "lazy"
  readonly decoding?: "async" | "auto" | "sync"
  readonly fetchPriority?: "high" | "low" | "auto"
  readonly fallback?: React.ReactNode
}

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
      {isLoading && (
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
      )}
    </span>
  )
}
