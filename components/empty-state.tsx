import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  readonly icon?: React.ReactNode
  readonly title: string
  readonly description: string
  readonly action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({
  icon,
  title,
  description,
  action
}: EmptyStateProps) {
  return (
    <div className="animate-fade-in-up relative flex flex-col items-center justify-center px-4 py-24 text-center">
      {icon && (
        <div className="from-copper/20 to-gold/20 bg-primary/10 text-primary relative mb-6 flex h-18 w-18 items-center justify-center rounded-2xl bg-linear-to-br shadow-[0_0_40px_var(--warm-glow-strong)]">
          {icon}
        </div>
      )}
      <h3 className="font-display mb-2 text-2xl font-bold tracking-tight">
        {title}
      </h3>
      <p className="text-muted-foreground mb-10 max-w-sm leading-relaxed">
        {description}
      </p>
      {action && (
        <Button
          onClick={action.onClick}
          className="rounded-xl px-6 shadow-sm hover:shadow-md active:scale-[0.98]"
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}
