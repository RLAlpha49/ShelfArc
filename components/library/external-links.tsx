import { Badge } from "@/components/ui/badge"

/** An outward-pointing arrow icon for external links. @source */
function ExternalLinkIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  )
}

/** Generates a list of external search links for a series title. @source */
function buildSeriesLinks(title: string) {
  const q = encodeURIComponent(title)
  return [
    {
      name: "MyAnimeList",
      url: `https://myanimelist.net/manga.php?q=${q}`
    },
    {
      name: "AniList",
      url: `https://anilist.co/search/manga?search=${q}`
    },
    {
      name: "MangaUpdates",
      url: `https://www.mangaupdates.com/search.html?search=${q}`
    },
    {
      name: "Goodreads",
      url: `https://www.goodreads.com/search?q=${q}`
    }
  ]
}

/** Props for the {@link ExternalLinks} component. @source */
interface ExternalLinksProps {
  /** Series title to generate search URLs from. */
  readonly title: string
  /** Direct Amazon URL for a volume, shown as the first link when present. */
  readonly amazonUrl?: string | null
}

/**
 * A row of small badge-style external links to third-party databases.
 * For series: renders search links derived from the title.
 * For volumes: optionally prepends an Amazon link.
 * @source
 */
export function ExternalLinks({ title, amazonUrl }: ExternalLinksProps) {
  const searchLinks = buildSeriesLinks(title)

  return (
    <div className="flex flex-wrap gap-1.5">
      {amazonUrl && (
        <a href={amazonUrl} target="_blank" rel="noopener noreferrer">
          <Badge
            variant="outline"
            className="hover:bg-accent/60 cursor-pointer gap-1 rounded-lg px-2.5 py-0.5 text-xs transition-colors"
          >
            Amazon
            <ExternalLinkIcon className="h-3 w-3" />
          </Badge>
        </a>
      )}
      {searchLinks.map((link) => (
        <a
          key={link.name}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Badge
            variant="outline"
            className="hover:bg-accent/60 cursor-pointer gap-1 rounded-lg px-2.5 py-0.5 text-xs transition-colors"
          >
            {link.name}
            <ExternalLinkIcon className="h-3 w-3" />
          </Badge>
        </a>
      ))}
    </div>
  )
}
