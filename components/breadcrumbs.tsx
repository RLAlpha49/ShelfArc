"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { Skeleton } from "@/components/ui/skeleton"

/** A single breadcrumb segment. @source */
export interface BreadcrumbItem {
  /** Display text for this segment. */
  readonly label: string
  /** Optional href — omit for the current (last) segment. */
  readonly href?: string
}

interface BreadcrumbsProps {
  /** Ordered breadcrumb segments from root to current page. */
  readonly items: BreadcrumbItem[]
  /** Class name applied to the wrapping `<nav>`. */
  readonly className?: string
  /** Base URL for JSON-LD structured data (e.g. "https://shelfarc.app"). Omit to skip JSON-LD. */
  readonly baseUrl?: string
}

/**
 * Shared breadcrumb bar with Back button, chevron separators, and
 * proper `<nav aria-label="Breadcrumb">` / `<ol>` semantics.
 *
 * @param props - {@link BreadcrumbsProps}
 * @source
 */
export function Breadcrumbs({ items, className, baseUrl }: BreadcrumbsProps) {
  const router = useRouter()
  const pathname = usePathname()

  function handleBack() {
    if (
      globalThis.window !== undefined &&
      globalThis.window.history.length > 1 &&
      document.referrer &&
      new URL(document.referrer, globalThis.window.location.href).origin ===
        globalThis.window.location.origin
    ) {
      router.back()
    } else {
      // Fall back to the computed parent path
      const segments = pathname.split("/").filter(Boolean)
      const parentPath =
        segments.length > 1 ? `/${segments.slice(0, -1).join("/")}` : "/"
      router.push(parentPath)
    }
  }

  const jsonLd =
    baseUrl && items.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: items.map((item, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: item.label,
            ...(item.href ? { item: `${baseUrl}${item.href}` } : {})
          }))
        }
      : null

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <nav
        aria-label="Breadcrumb"
        className={`animate-fade-in-down mb-8 flex flex-wrap items-center gap-3 text-xs tracking-wider ${className ?? ""}`}
      >
        <button
          type="button"
          onClick={handleBack}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back
        </button>

        <ol className="flex flex-wrap items-center gap-3">
          {items.map((item, i) => {
            const isLast = i === items.length - 1

            return (
              <li key={item.label} className="flex items-center gap-3">
                {i > 0 && (
                  <span className="text-muted-foreground" aria-hidden="true">
                    /
                  </span>
                )}
                {isLast || !item.href ? (
                  <span
                    className="font-medium"
                    aria-current={isLast ? "page" : undefined}
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
    </>
  )
}

/** Skeleton placeholder matching the breadcrumb bar layout. @source */
export function BreadcrumbsSkeleton({
  segmentCount = 3
}: {
  readonly segmentCount?: number
}) {
  const widths = [48, 56, 96, 80, 64]

  return (
    <div className="mb-8 flex items-center gap-3" aria-hidden>
      <Skeleton className="h-4 w-12" />
      {Array.from({ length: segmentCount }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-3" />
          <Skeleton
            className="h-4"
            style={{ width: widths[i % widths.length] }}
          />
        </div>
      ))}
    </div>
  )
}
