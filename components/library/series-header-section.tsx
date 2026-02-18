"use client"

import { CoverImage } from "@/components/library/cover-image"
import { ExternalLinks } from "@/components/library/external-links"
import { SeriesInsightsPanel } from "@/components/library/series-insights-panel"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { SeriesStatusBadge, TypeBadge } from "@/components/ui/status-badge"
import type { SeriesInsightData } from "@/lib/library/series-insights"
import { sanitizeHtml } from "@/lib/sanitize-html"
import type {
  OwnershipStatus,
  ReadingStatus,
  SeriesWithVolumes
} from "@/lib/types/database"

/** Series header section with cover, metadata, stats, insights, and notes. @source */
export function SeriesHeaderSection({
  currentSeries,
  insights,
  primaryIsbn,
  descriptionHtml,
  formatPrice,
  onEditSeries,
  onDeleteSeries,
  onApplyAllOwnership,
  onApplyAllReading
}: {
  readonly currentSeries: SeriesWithVolumes
  readonly insights: SeriesInsightData
  readonly primaryIsbn: string | null
  readonly descriptionHtml: string
  readonly formatPrice: (value: number) => string
  readonly onEditSeries: () => void
  readonly onDeleteSeries: () => void
  readonly onApplyAllOwnership: (status: OwnershipStatus) => void
  readonly onApplyAllReading: (status: ReadingStatus) => void
}) {
  return (
    <div className="relative mb-10">
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl bg-[radial-gradient(ellipse_at_30%_50%,var(--warm-glow-strong),transparent_70%)]" />
      <div className="animate-fade-in-up grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Cover Image */}
        <div className="lg:col-span-4">
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-[radial-gradient(ellipse_at_center,var(--warm-glow-strong),transparent_70%)]" />
            <div className="bg-muted relative aspect-2/3 overflow-hidden rounded-2xl shadow-lg">
              <CoverImage
                isbn={primaryIsbn}
                coverImageUrl={currentSeries.cover_image_url}
                alt={currentSeries.title}
                className="absolute inset-0 h-full w-full object-cover"
                loading="eager"
                decoding="async"
                fetchPriority="high"
                fallback={
                  <div className="flex h-full items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-muted-foreground/50 h-16 w-16"
                    >
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                    </svg>
                  </div>
                }
              />
            </div>
          </div>
        </div>

        {/* Series Info */}
        <div className="space-y-4 lg:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <TypeBadge type={currentSeries.type} />
                {currentSeries.status && (
                  <SeriesStatusBadge status={currentSeries.status} />
                )}
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                {currentSeries.title}
              </h1>
              {currentSeries.original_title && (
                <p className="text-muted-foreground mt-1 text-lg">
                  {currentSeries.original_title}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={buttonVariants({
                    variant: "outline",
                    className:
                      "rounded-xl shadow-sm hover:shadow-md active:scale-[0.98]"
                  })}
                >
                  Set all volumes
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Ownership</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => onApplyAllOwnership("owned")}
                    >
                      Mark all owned
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onApplyAllOwnership("wishlist")}
                    >
                      Mark all wishlisted
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Reading</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => onApplyAllReading("completed")}
                    >
                      Mark all completed
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onApplyAllReading("unread")}
                    >
                      Mark all unread
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                className="rounded-xl shadow-sm hover:shadow-md active:scale-[0.98]"
                onClick={onEditSeries}
              >
                Edit Series
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl shadow-sm"
                onClick={onDeleteSeries}
              >
                Delete Series
              </Button>
            </div>
          </div>

          {currentSeries.author && (
            <p className="text-muted-foreground">
              By{" "}
              <span className="text-foreground font-medium">
                {currentSeries.author}
              </span>
              {currentSeries.artist &&
                currentSeries.artist !== currentSeries.author && (
                  <>
                    , illustrated by{" "}
                    <span className="text-foreground font-medium">
                      {currentSeries.artist}
                    </span>
                  </>
                )}
            </p>
          )}

          {currentSeries.publisher && (
            <p className="text-muted-foreground text-sm">
              Published by {currentSeries.publisher}
            </p>
          )}

          {descriptionHtml && (
            <div
              className="text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: descriptionHtml }}
            />
          )}

          {currentSeries.tags.length > 0 && (
            <div className="animate-fade-in stagger-2 flex flex-wrap gap-2">
              {currentSeries.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="badge-pop border-primary/15 rounded-lg"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* External Links */}
          <div className="animate-fade-in stagger-2">
            <ExternalLinks title={currentSeries.title} />
          </div>

          {/* Stats strip */}
          <div className="animate-fade-in-up stagger-1 mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border sm:grid-cols-3 lg:grid-cols-6">
            <div className="bg-card hover:bg-accent/50 flex flex-col gap-1 p-4 text-center transition-colors">
              <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                Volumes
              </span>
              <div className="font-display text-xl font-bold">
                {insights.ownedVolumes}
                <span className="text-muted-foreground text-sm font-normal">
                  /{insights.totalVolumes}
                </span>
              </div>
              <div className="text-muted-foreground text-[10px]">owned</div>
            </div>
            <div className="bg-card hover:bg-accent/50 flex flex-col gap-1 p-4 text-center transition-colors">
              <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                Reading
              </span>
              <div className="font-display text-xl font-bold">
                {insights.readVolumes}
                <span className="text-muted-foreground text-sm font-normal">
                  /{insights.totalVolumes}
                </span>
              </div>
              <div className="text-muted-foreground text-[10px]">
                {insights.readPercent}% complete
              </div>
            </div>
            <div className="bg-card hover:bg-accent/50 flex flex-col gap-1 p-4 text-center transition-colors">
              <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                Total Spent
              </span>
              <div className="font-display text-xl font-bold">
                {formatPrice(insights.totalSpent)}
              </div>
              <div className="text-muted-foreground text-[10px]">
                {insights.pricedVolumes} owned
              </div>
            </div>
            <div className="bg-card hover:bg-accent/50 flex flex-col gap-1 p-4 text-center transition-colors">
              <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                Avg Price
              </span>
              <div className="font-display text-xl font-bold">
                {insights.pricedVolumes > 0
                  ? formatPrice(insights.averagePrice)
                  : "—"}
              </div>
              <div className="text-muted-foreground text-[10px]">
                per volume
              </div>
            </div>
            <div className="bg-card hover:bg-accent/50 flex flex-col gap-1 p-4 text-center transition-colors">
              <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                Pages
              </span>
              <div className="font-display text-xl font-bold">
                {insights.totalPages > 0
                  ? insights.totalPages.toLocaleString()
                  : "—"}
              </div>
              <div className="text-muted-foreground text-[10px]">total</div>
            </div>
            <div className="bg-card hover:bg-accent/50 flex flex-col gap-1 p-4 text-center transition-colors">
              <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
                Wishlist
              </span>
              <div className="font-display text-xl font-bold">
                {insights.wishlistVolumes}
              </div>
              <div className="text-muted-foreground text-[10px]">items</div>
            </div>
          </div>

          <SeriesInsightsPanel insights={insights} />

          {currentSeries.notes && (
            <div
              className="animate-fade-in-up border-border/60 bg-card/60 mt-6 rounded-2xl border p-5"
              style={{ animationDelay: "400ms", animationFillMode: "both" }}
            >
              <span className="text-muted-foreground block text-xs tracking-widest uppercase">
                Personal
              </span>
              <h2 className="font-display mt-2 text-lg font-semibold tracking-tight">
                Notes
              </h2>
              <div
                className="prose-notes text-muted-foreground mt-2"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(currentSeries.notes)
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
