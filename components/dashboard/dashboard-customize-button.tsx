"use client"

import { DashboardLayoutCustomizerContent } from "@/components/dashboard/dashboard-layout-customizer"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet"

/**
 * Gear icon button that opens a slide-over Sheet containing the dashboard
 * layout customizer. Placed in the dashboard page header (server component area)
 * so users can access layout settings without scrolling to the content.
 * @source
 */
export function DashboardCustomizeButton() {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <button
            type="button"
            className="border-input dark:bg-input/30 hover:bg-accent hover:text-foreground hover:border-border/80 mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-all outline-none hover:shadow-sm"
            aria-label="Customize dashboard layout"
          />
        }
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-4 w-4"
        >
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 p-0">
        <SheetHeader className="border-b p-3">
          <SheetTitle className="text-sm font-semibold">
            Dashboard Layout
          </SheetTitle>
        </SheetHeader>
        <DashboardLayoutCustomizerContent />
      </SheetContent>
    </Sheet>
  )
}
