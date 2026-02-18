import { cn } from "@/lib/utils"

/** Props for the {@link SyncIndicator} component. @source */
interface SyncIndicatorProps {
  /** Whether a background sync is in progress. */
  readonly active?: boolean
  /** Label shown next to the pulsing dot. */
  readonly label?: string
  readonly className?: string
}

/**
 * Subtle pulsing dot indicator for background data refreshes.
 * Renders nothing when inactive.
 * @param props - {@link SyncIndicatorProps}
 * @source
 */
export function SyncIndicator({
  active = false,
  label = "Syncing",
  className
}: SyncIndicatorProps) {
  if (!active) return null

  return (
    <output
      className={cn(
        "text-muted-foreground flex items-center gap-1.5 text-xs",
        className
      )}
      aria-live="polite"
    >
      <span className="relative flex h-2 w-2">
        <span className="bg-copper absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
        <span className="bg-copper relative inline-flex h-2 w-2 rounded-full" />
      </span>
      <span>{label}</span>
    </output>
  )
}
