"use client"

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react"
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

const PLATFORM_MOD =
  typeof navigator !== "undefined" &&
  /mac|iphone|ipad/i.test(navigator.userAgent)
    ? "⌘"
    : "Ctrl+"

function highlightMatch(text: string, query: string) {
  if (!query || query.trim().length < 2) return text
  const trimmed = query.trim()
  const idx = text.toLowerCase().indexOf(trimmed.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="text-copper bg-transparent font-semibold">
        {text.slice(idx, idx + trimmed.length)}
      </mark>
      {text.slice(idx + trimmed.length)}
    </>
  )
}

function SectionHeading({
  icon,
  children
}: Readonly<{
  icon: ReactNode
  children: ReactNode
}>) {
  return (
    <span className="text-copper/70 flex items-center gap-1.5">
      {icon}
      {children}
    </span>
  )
}

const sectionIcons = {
  navigate: (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3"
    >
      <path d="M3 8h10M11 6l2 2-2 2" />
    </svg>
  ),
  library: (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3"
    >
      <path d="M3 13V3.5A1.5 1.5 0 0 1 4.5 2H13v12H4.5a1.5 1.5 0 0 1 0-3H13" />
    </svg>
  ),
  views: (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3"
    >
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </svg>
  ),
  shell: (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3"
    >
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M6 2v12" />
    </svg>
  ),
  series: (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3"
    >
      <path d="M4 2v12M7 2v12M10 3l3 1v9l-3-1z" />
    </svg>
  ),
  volume: (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3"
    >
      <path d="M3 13V3.5A1.5 1.5 0 0 1 4.5 2H13v12H4.5a1.5 1.5 0 0 1 0-3H13" />
      <path d="M7 5h3M7 7.5h2" />
    </svg>
  )
}

/** Global command palette (Ctrl/⌘+K) with navigation + library shortcuts. @source */
export function CommandPalette() {
  const router = useRouter()
  const mod = PLATFORM_MOD

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

  useEffect(() => {
    const handleOpen = () => setOpen(true)
    globalThis.addEventListener("open-command-palette", handleOpen)
    return () =>
      globalThis.removeEventListener("open-command-palette", handleOpen)
  }, [])

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
      className="command-palette-glass ring-copper/10 max-w-xl"
      title="Command Palette"
      description="Search for a command to run…"
      showCloseButton={false}
    >
      <Command className="rounded-2xl bg-transparent" shouldFilter>
        <CommandInput
          placeholder="Search commands, series, volumes…"
          value={query}
          onValueChange={setQuery}
          autoFocus
        />
        <CommandList className="max-h-80 pb-0">
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-6">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground/30 size-8"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <p className="text-muted-foreground text-xs">
                {hintedEmptyMessage}
              </p>
              {!query.trim() && (
                <p className="text-muted-foreground/50 mt-1 max-w-56 text-center text-[11px] leading-relaxed">
                  Try: go to dashboard, switch to grid view, search a
                  series…
                </p>
              )}
            </div>
          </CommandEmpty>

          <CommandGroup
            heading={
              <SectionHeading icon={sectionIcons.navigate}>
                Navigate
              </SectionHeading>
            }
          >
            <CommandItem
              value="go to library navigate"
              onSelect={() => runCommand(() => router.push("/library"))}
            >
              {highlightMatch("Library", query)}
            </CommandItem>
            <CommandItem
              value="go to dashboard navigate"
              onSelect={() => runCommand(() => router.push("/dashboard"))}
            >
              {highlightMatch("Dashboard", query)}
            </CommandItem>
            <CommandItem
              value="go to settings navigate"
              onSelect={() => runCommand(() => router.push("/settings"))}
            >
              {highlightMatch("Settings", query)}
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup
            heading={
              <SectionHeading icon={sectionIcons.library}>
                Library
              </SectionHeading>
            }
          >
            <CommandItem
              value="add book new volume"
              onSelect={() =>
                runCommand(() => router.push("/library?add=book"))
              }
            >
              {highlightMatch("Add book", query)}
            </CommandItem>
            <CommandItem
              value="add series new"
              onSelect={() =>
                runCommand(() => router.push("/library?add=series"))
              }
            >
              {highlightMatch("Add series", query)}
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup
            heading={
              <SectionHeading icon={sectionIcons.views}>Views</SectionHeading>
            }
          >
            <CommandItem
              value="view series collection"
              data-checked={collectionView === "series"}
              onSelect={() => runCommand(() => setCollectionView("series"))}
            >
              {highlightMatch("Collection: Series", query)}
            </CommandItem>
            <CommandItem
              value="view volumes collection"
              data-checked={collectionView === "volumes"}
              onSelect={() => runCommand(() => setCollectionView("volumes"))}
            >
              {highlightMatch("Collection: Volumes", query)}
            </CommandItem>

            <CommandSeparator />

            <CommandItem
              value="layout grid"
              data-checked={viewMode === "grid"}
              onSelect={() => runCommand(() => setViewMode("grid"))}
            >
              {highlightMatch("Layout: Grid", query)}
            </CommandItem>
            <CommandItem
              value="layout list"
              data-checked={viewMode === "list"}
              onSelect={() => runCommand(() => setViewMode("list"))}
            >
              {highlightMatch("Layout: List", query)}
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup
            heading={
              <SectionHeading icon={sectionIcons.shell}>Shell</SectionHeading>
            }
          >
            <CommandItem
              value="navigation sidebar"
              data-checked={navigationMode === "sidebar"}
              onSelect={() => runCommand(() => setNavigationMode("sidebar"))}
            >
              {highlightMatch("Navigation: Sidebar", query)}
            </CommandItem>
            <CommandItem
              value="navigation header"
              data-checked={navigationMode === "header"}
              onSelect={() => runCommand(() => setNavigationMode("header"))}
            >
              {highlightMatch("Navigation: Header", query)}
            </CommandItem>
          </CommandGroup>

          {didRenderJumpGroup && (
            <>
              <CommandSeparator />

              {jumpItems.series.length > 0 && (
                <CommandGroup
                  heading={
                    <SectionHeading icon={sectionIcons.series}>
                      Jump to series
                    </SectionHeading>
                  }
                >
                  {jumpItems.series.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.value}
                      onSelect={() => runCommand(() => router.push(item.href))}
                    >
                      <div className="min-w-0">
                        <div className="truncate">
                          {highlightMatch(item.title, query)}
                        </div>
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
                <CommandGroup
                  heading={
                    <SectionHeading icon={sectionIcons.volume}>
                      Jump to volume
                    </SectionHeading>
                  }
                >
                  {jumpItems.volumes.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.value}
                      onSelect={() => runCommand(() => router.push(item.href))}
                    >
                      <div className="min-w-0">
                        <div className="truncate">
                          {highlightMatch(item.title, query)}
                        </div>
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

        {/* Keyboard navigation footer */}
        <div className="border-border/50 flex items-center gap-4 border-t px-3 py-2">
          <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
            <kbd className="bg-muted/80 rounded px-1 py-0.5 font-mono text-[9px]">
              ↑
            </kbd>
            <kbd className="bg-muted/80 -ml-0.5 rounded px-1 py-0.5 font-mono text-[9px]">
              ↓
            </kbd>
            <span>Navigate</span>
          </span>
          <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
            <kbd className="bg-muted/80 rounded px-1 py-0.5 font-mono text-[9px]">
              ↵
            </kbd>
            <span>Select</span>
          </span>
          <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
            <kbd className="bg-muted/80 rounded px-1 py-0.5 font-mono text-[9px]">
              Esc
            </kbd>
            <span>Close</span>
          </span>
          <span className="text-muted-foreground ml-auto flex items-center gap-1 text-[10px]">
            <kbd className="bg-muted/80 rounded px-1 py-0.5 font-mono text-[9px]">
              {mod}K
            </kbd>
          </span>
        </div>
      </Command>
    </CommandDialog>
  )
}
