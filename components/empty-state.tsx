import { Button } from "@/components/ui/button"

/** A single action button for the empty state. @source */
interface EmptyStateAction {
  readonly label: string
  readonly onClick: () => void
  readonly variant?: "default" | "outline" | "secondary" | "ghost"
}

function buildActions(
  actions?: readonly EmptyStateAction[],
  action?: { label: string; onClick: () => void }
): EmptyStateAction[] {
  if (actions?.length) return [...actions]
  if (action) return [{ label: action.label, onClick: action.onClick, variant: "default" }]
  return []
}

/** Props for the {@link EmptyState} placeholder. @source */
interface EmptyStateProps {
  readonly icon?: React.ReactNode
  readonly title: string
  readonly description: string
  /** @deprecated Use `actions` array instead. Single action shorthand. */
  readonly action?: {
    label: string
    onClick: () => void
  }
  /** Multiple action buttons — first is primary, rest are outline by default. */
  readonly actions?: readonly EmptyStateAction[]
  /** Optional tip or hint displayed below the description. */
  readonly tip?: string
}

/**
 * Centered placeholder shown when a list or view has no content.
 * Supports multiple actions and an optional tip for new users.
 * @param props - {@link EmptyStateProps}
 * @source
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  actions,
  tip
}: EmptyStateProps) {
  const allActions: EmptyStateAction[] = buildActions(actions, action)

  return (
    <div className="animate-fade-in-up relative flex flex-col items-center justify-center px-4 py-24 text-center">
      {icon && (
        <div
          className="from-copper/20 to-gold/20 bg-primary/10 text-primary icon-float relative mb-6 flex h-18 w-18 items-center justify-center rounded-2xl bg-linear-to-br shadow-[0_0_40px_var(--warm-glow-strong)]"
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <h3 className="font-display animate-blur-in mb-2 text-2xl font-bold tracking-tight">
        {title}
      </h3>
      <p className="text-muted-foreground mb-6 max-w-sm leading-relaxed">
        {description}
      </p>
      {tip && (
        <p className="text-muted-foreground/70 mb-6 flex items-center gap-1.5 text-xs">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-gold h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          >
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 12 18.469c-.874 0-1.71.346-2.329.963l-.209.21" />
          </svg>
          {tip}
        </p>
      )}
      {allActions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {allActions.map((a, i) => (
            <Button
              key={a.label}
              onClick={a.onClick}
              variant={a.variant ?? (i === 0 ? "default" : "outline")}
              className="rounded-xl px-6 shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
