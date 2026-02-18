"use client"

import type { Button as ButtonPrimitive } from "@base-ui/react/button"
import type { VariantProps } from "class-variance-authority"
import { Button, type buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Props for the {@link LoadingButton} component. @source */
interface LoadingButtonProps
  extends ButtonPrimitive.Props,
    VariantProps<typeof buttonVariants> {
  /** Shows a spinner and disables the button when true. */
  readonly loading?: boolean
}

/**
 * Button wrapper that shows a spinner icon when loading and disables interaction.
 * Drop-in replacement for {@link Button} when async feedback is needed.
 * @param props - {@link LoadingButtonProps}
 * @source
 */
export function LoadingButton({
  loading = false,
  disabled,
  children,
  className,
  ...props
}: Readonly<LoadingButtonProps>) {
  return (
    <Button
      disabled={disabled || loading}
      className={cn(className)}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <svg
          className="h-3.5 w-3.5 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
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
      )}
      {children}
    </Button>
  )
}
