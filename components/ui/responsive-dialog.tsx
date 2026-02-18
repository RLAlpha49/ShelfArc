"use client"

import * as React from "react"
import { useWindowWidth } from "@/lib/hooks/use-window-width"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet"

/** Breakpoint below which the sheet layout is used. */
const MOBILE_BREAKPOINT = 640

/** Props for the {@link ResponsiveDialog} component. @source */
export interface ResponsiveDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: React.ReactNode
  readonly description?: React.ReactNode
  readonly children: React.ReactNode
  /** Extra footer content (action buttons, etc.). */
  readonly footer?: React.ReactNode
  /** Class name applied to the Dialog content or Sheet content. */
  readonly className?: string
  /** Whether to show the default close button. @default true */
  readonly showCloseButton?: boolean
}

/**
 * Renders a `<Dialog>` on desktop (≥640px) and a bottom `<Sheet>` on mobile (<640px).
 *
 * Provides a consistent API regardless of which underlying primitive is used,
 * so callers can pass the same children/footer/title regardless of viewport.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  showCloseButton = true
}: ResponsiveDialogProps) {
  const width = useWindowWidth()
  const isMobile = width > 0 && width < MOBILE_BREAKPOINT

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={showCloseButton}
          className={`flex max-h-[calc(100dvh-env(safe-area-inset-top))] flex-col rounded-t-2xl ${className ?? ""}`}
        >
          <SheetHeader>
            <SheetTitle className="font-display text-lg tracking-tight">
              {title}
            </SheetTitle>
            {description && (
              <SheetDescription className="text-muted-foreground/80 text-[13px]">
                {description}
              </SheetDescription>
            )}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">{children}</div>
          {footer && <SheetFooter>{footer}</SheetFooter>}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={showCloseButton} className={className}>
        <DialogHeader>
          <DialogTitle className="font-display text-lg tracking-tight">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-muted-foreground/80 text-[13px]">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}

// ── Raw wrapper for complex dialogs that manage their own header/footer ──

/** Props for the {@link ResponsiveDialogRaw} component. @source */
export interface ResponsiveDialogRawProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly children: React.ReactNode
  /** Class name applied to the Dialog content (desktop) or Sheet content (mobile). */
  readonly contentClassName?: string
  /** Whether to show the close button. @default true */
  readonly showCloseButton?: boolean
}

/**
 * Low-level responsive wrapper that renders `<Dialog>` on desktop and
 * a bottom `<Sheet>` on mobile. Unlike {@link ResponsiveDialog}, this
 * component does **not** manage header/footer — callers provide their
 * own complete inner layout. Use this for complex dialogs like
 * series/volume forms that have custom headers, footers, and scroll.
 */
export function ResponsiveDialogRaw({
  open,
  onOpenChange,
  children,
  contentClassName,
  showCloseButton = true
}: ResponsiveDialogRawProps) {
  const width = useWindowWidth()
  const isMobile = width > 0 && width < MOBILE_BREAKPOINT

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={showCloseButton}
          className={`flex max-h-[calc(100dvh-env(safe-area-inset-top))] flex-col overflow-y-auto rounded-t-2xl p-0 ${contentClassName ?? ""}`}
        >
          {children}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={showCloseButton}
        className={contentClassName}
      >
        {children}
      </DialogContent>
    </Dialog>
  )
}
