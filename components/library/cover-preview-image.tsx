"use client"

import { useState } from "react"
import { cn } from "../../lib/utils"

/** Props for the {@link CoverPreviewImage} component. @source */
interface CoverPreviewImageProps extends Omit<
  React.ComponentProps<"img">,
  "alt"
> {
  readonly alt: string
  readonly wrapperClassName?: string
}

/**
 * Cover image preview with a fixed aspect ratio and loading spinner overlay.
 * @param props - {@link CoverPreviewImageProps}
 * @source
 */
export function CoverPreviewImage(props: Readonly<CoverPreviewImageProps>) {
  const {
    wrapperClassName,
    className,
    alt,
    onLoad,
    onError,
    loading = "lazy",
    decoding = "async",
    ...imgProps
  } = props
  const [isLoading, setIsLoading] = useState(true)

  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoading(false)
    onLoad?.(event)
  }

  const handleError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoading(false)
    onError?.(event)
  }

  return (
    <div
      className={cn(
        "bg-muted relative aspect-2/3 w-40 overflow-hidden rounded-xl shadow-md",
        wrapperClassName
      )}
      aria-busy={isLoading}
    >
      <img
        {...imgProps}
        alt={alt}
        loading={loading}
        decoding={decoding}
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100",
          className
        )}
        onLoad={handleLoad}
        onError={handleError}
      />
      {isLoading && (
        <output
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-live="polite"
        >
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
    </div>
  )
}
