"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "@/components/ui/command"
import { useLibraryStore } from "@/lib/store/library-store"

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if (target.isContentEditable) return true
  return Boolean(target.closest("[contenteditable='true']"))
}

function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
}

function volumeDisplayTitle(volumeNumber: number, title?: string | null) {
  return title?.trim() || `Vol. ${volumeNumber}`
}

type JumpItem =
  | {
      kind: "series"
      id: string
      title: string
      subtitle?: string
      value: string
      href: string
    }
  | {
      kind: "volume"
      id: string
      title: string
      subtitle?: string
      value: string
      href: string
    }

function collectSeriesJumpItems(
  series: Array<{
    id: string
    title: string
    author?: string | null
    tags?: string[]
  }>,
  normalizedQuery: string,
  limit: number
): JumpItem[] {
  const matches: JumpItem[] = []

  for (const s of series) {
    if (matches.length >= limit) break

    const haystack = normalizeQuery(
      `${s.title} ${s.author ?? ""} ${(s.tags ?? []).join(" ")}`
    )

    if (!haystack.includes(normalizedQuery)) continue

    matches.push({
      kind: "series",
      id: s.id,
      title: s.title,
      subtitle: s.author ?? undefined,
      value: `series ${s.title} ${s.author ?? ""}`,
      href: `/library/series/${s.id}`
    })
  }

  return matches
}

function collectVolumeJumpItemsFromSeries(
  series: Array<{
    id: string
    title: string
    author?: string | null
    volumes: Array<{
      id: string
      title?: string | null
      isbn?: string | null
      volume_number: number
    }>
  }>,
  normalizedQuery: string,
  limit: number
): JumpItem[] {
  const matches: JumpItem[] = []

  for (const s of series) {
    if (matches.length >= limit) break

    for (const v of s.volumes) {
      if (matches.length >= limit) break

      const displayTitle = volumeDisplayTitle(v.volume_number, v.title)
      const haystack = normalizeQuery(
        `${displayTitle} ${v.isbn ?? ""} ${s.title} ${s.author ?? ""} ${v.volume_number}`
      )

      if (!haystack.includes(normalizedQuery)) continue

      matches.push({
        kind: "volume",
        id: v.id,
        title: displayTitle,
        subtitle: `${s.title} · Vol. ${v.volume_number}`,
        value: `volume ${displayTitle} ${v.isbn ?? ""} ${s.title}`,
        href: `/library/volume/${v.id}`
      })
    }
  }

  return matches
}

function collectVolumeJumpItemsFromUnassigned(
  volumes: Array<{
    id: string
    title?: string | null
    isbn?: string | null
    volume_number: number
  }>,
  normalizedQuery: string,
  limit: number
): JumpItem[] {
  const matches: JumpItem[] = []
  for (const v of volumes) {
    if (matches.length >= limit) break

    const displayTitle = volumeDisplayTitle(v.volume_number, v.title)
    const haystack = normalizeQuery(
      `${displayTitle} ${v.isbn ?? ""} unassigned ${v.volume_number}`
    )
    if (!haystack.includes(normalizedQuery)) continue

    matches.push({
      kind: "volume",
      id: v.id,
      title: displayTitle,
      subtitle: `Unassigned · Vol. ${v.volume_number}`,
      value: `volume ${displayTitle} ${v.isbn ?? ""} unassigned`,
      href: `/library/volume/${v.id}`
    })
  }
  return matches
}

/** Global command palette (Ctrl/⌘+K) with navigation + library shortcuts. @source */
export function CommandPalette() {
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const collectionView = useLibraryStore((s) => s.collectionView)
  const viewMode = useLibraryStore((s) => s.viewMode)
  const navigationMode = useLibraryStore((s) => s.navigationMode)

  const setCollectionView = useLibraryStore((s) => s.setCollectionView)
  const setViewMode = useLibraryStore((s) => s.setViewMode)
  const setNavigationMode = useLibraryStore((s) => s.setNavigationMode)

  const series = useLibraryStore((s) => s.series)
  const unassignedVolumes = useLibraryStore((s) => s.unassignedVolumes)

  const normalizedQuery = useMemo(() => normalizeQuery(query), [query])
  const searchEnabled = normalizedQuery.length >= 2
  const libraryLoaded = series.length > 0 || unassignedVolumes.length > 0

  const jumpItems = useMemo(() => {
    if (!searchEnabled || !libraryLoaded) return { series: [], volumes: [] }

    const maxSeries = 10
    const maxVolumes = 14

    const seriesMatches = collectSeriesJumpItems(
      series,
      normalizedQuery,
      maxSeries
    )

    const volumeMatches = collectVolumeJumpItemsFromSeries(
      series,
      normalizedQuery,
      maxVolumes
    )

    if (volumeMatches.length < maxVolumes) {
      const remaining = maxVolumes - volumeMatches.length
      volumeMatches.push(
        ...collectVolumeJumpItemsFromUnassigned(
          unassignedVolumes,
          normalizedQuery,
          remaining
        )
      )
    }

    return { series: seriesMatches, volumes: volumeMatches }
  }, [libraryLoaded, normalizedQuery, searchEnabled, series, unassignedVolumes])

  const runCommand = useCallback((action: () => void) => {
    setOpen(false)
    setQuery("")
    action()
  }, [])

  const toggleOpenFromShortcut = useCallback((event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey)) return
    if (event.key.toLowerCase() !== "k") return
    if (event.shiftKey || event.altKey) return
    if (isEditableTarget(event.target)) return

    event.preventDefault()
    setOpen(true)
  }, [])

  useEffect(() => {
    const target = globalThis as unknown as Window
    target.addEventListener("keydown", toggleOpenFromShortcut)
    return () => target.removeEventListener("keydown", toggleOpenFromShortcut)
  }, [toggleOpenFromShortcut])

  const hintedEmptyMessage = useMemo(() => {
    if (!query.trim()) return "Type to search commands…"
    if (normalizedQuery.length < 2) {
      return "Type at least 2 characters to search your library."
    }
    if (!libraryLoaded) {
      return "Library data isn’t loaded yet — open Library first."
    }
    return "No matches."
  }, [libraryLoaded, normalizedQuery.length, query])

  const didRenderJumpGroup = searchEnabled && libraryLoaded

  return (
    <CommandDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setQuery("")
      }}
      className="max-w-2xl"
      title="Command Palette"
      description="Search for a command to run…"
      showCloseButton={false}
    >
      <Command className="rounded-2xl" shouldFilter>
        <CommandInput
          placeholder="Search commands, or jump to a series/volume…"
          value={query}
          onValueChange={setQuery}
          autoFocus
        />
        <CommandList className="pb-1">
          <CommandEmpty>{hintedEmptyMessage}</CommandEmpty>

          <CommandGroup heading="Navigation">
            <CommandItem
              value="go to library navigate"
              onSelect={() => runCommand(() => router.push("/library"))}
            >
              Library
            </CommandItem>
            <CommandItem
              value="go to dashboard navigate"
              onSelect={() => runCommand(() => router.push("/dashboard"))}
            >
              Dashboard
            </CommandItem>
            <CommandItem
              value="go to settings navigate"
              onSelect={() => runCommand(() => router.push("/settings"))}
            >
              Settings
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Library">
            <CommandItem
              value="add book new volume"
              onSelect={() =>
                runCommand(() => router.push("/library?add=book"))
              }
            >
              Add book
            </CommandItem>
            <CommandItem
              value="add series new"
              onSelect={() =>
                runCommand(() => router.push("/library?add=series"))
              }
            >
              Add series
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Views">
            <CommandItem
              value="view series collection"
              data-checked={collectionView === "series"}
              onSelect={() => runCommand(() => setCollectionView("series"))}
            >
              Collection: Series
            </CommandItem>
            <CommandItem
              value="view volumes collection"
              data-checked={collectionView === "volumes"}
              onSelect={() => runCommand(() => setCollectionView("volumes"))}
            >
              Collection: Volumes
            </CommandItem>

            <CommandSeparator />

            <CommandItem
              value="layout grid"
              data-checked={viewMode === "grid"}
              onSelect={() => runCommand(() => setViewMode("grid"))}
            >
              Layout: Grid
            </CommandItem>
            <CommandItem
              value="layout list"
              data-checked={viewMode === "list"}
              onSelect={() => runCommand(() => setViewMode("list"))}
            >
              Layout: List
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Shell">
            <CommandItem
              value="navigation sidebar"
              data-checked={navigationMode === "sidebar"}
              onSelect={() => runCommand(() => setNavigationMode("sidebar"))}
            >
              Navigation: Sidebar
            </CommandItem>
            <CommandItem
              value="navigation header"
              data-checked={navigationMode === "header"}
              onSelect={() => runCommand(() => setNavigationMode("header"))}
            >
              Navigation: Header
            </CommandItem>
          </CommandGroup>

          {didRenderJumpGroup && (
            <>
              <CommandSeparator />

              {jumpItems.series.length > 0 && (
                <CommandGroup heading="Jump to series">
                  {jumpItems.series.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.value}
                      onSelect={() => runCommand(() => router.push(item.href))}
                    >
                      <div className="min-w-0">
                        <div className="truncate">{item.title}</div>
                        {item.subtitle && (
                          <div className="text-muted-foreground truncate text-[11px]">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {jumpItems.volumes.length > 0 && (
                <CommandGroup heading="Jump to volume">
                  {jumpItems.volumes.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.value}
                      onSelect={() => runCommand(() => router.push(item.href))}
                    >
                      <div className="min-w-0">
                        <div className="truncate">{item.title}</div>
                        {item.subtitle && (
                          <div className="text-muted-foreground truncate text-[11px]">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
