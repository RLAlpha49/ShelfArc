"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import { getCoverCandidates } from "@/lib/uploads/resolve-image-url"

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
  const candidatesRef = useRef<string[]>(candidates)
  const indexRef = useRef(0)

  useEffect(() => {
    candidatesRef.current = candidates
    indexRef.current = 0
  }, [candidates])

  const handleError = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const nextIndex = indexRef.current + 1
      const list = candidatesRef.current
      if (nextIndex >= list.length) return
      indexRef.current = nextIndex
      event.currentTarget.src = list[nextIndex]
    },
    []
  )

  const src = candidates[0]
  if (!src) return <>{fallback ?? null}</>

  return (
    <img
      key={src}
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      onError={handleError}
    />
  )
}
