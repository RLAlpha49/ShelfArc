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
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      {icon && (
        <div className="bg-primary/10 text-primary mb-5 flex h-16 w-16 items-center justify-center rounded-2xl">
          {icon}
        </div>
      )}
      <h3 className="font-display mb-2 text-xl font-semibold tracking-tight">
        {title}
      </h3>
      <p className="text-muted-foreground mb-8 max-w-sm leading-relaxed">
        {description}
      </p>
      {action && (
        <Button onClick={action.onClick} className="rounded-xl px-6">
          {action.label}
        </Button>
      )}
    </div>
  )
}
