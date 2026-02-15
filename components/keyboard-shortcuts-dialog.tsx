"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import {
  KEYBOARD_SHORTCUTS,
  SHORTCUT_CATEGORY_LABELS,
  type ShortcutCategory
} from "@/lib/keyboard-shortcuts"

/** Props for the {@link KeyboardShortcutsDialog}. @source */
interface KeyboardShortcutsDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

/** Parses a shortcut key string into displayable key badges. @source */
function parseKeys(keys: string): string[] {
  return keys.split(" then ").map((k) => k.trim())
}

const categories: ShortcutCategory[] = [
  "navigation",
  "library",
  "views",
  "system"
]

/**
 * Modal dialog listing all keyboard shortcuts grouped by category.
 * @param props - {@link KeyboardShortcutsDialogProps}
 * @source
 */
export function KeyboardShortcutsDialog({
  open,
  onOpenChange
}: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="command-palette-glass max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-semibold tracking-tight">
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Use these shortcuts to navigate and control ShelfArc
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 max-h-96 space-y-5 overflow-y-auto">
          {categories.map((category) => {
            const shortcuts = KEYBOARD_SHORTCUTS.filter(
              (s) => s.category === category
            )
            if (shortcuts.length === 0) return null

            return (
              <div key={category}>
                <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                  {SHORTCUT_CATEGORY_LABELS[category]}
                </p>
                <div className="space-y-1">
                  {shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.keys}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5"
                    >
                      <span className="text-sm">{shortcut.label}</span>
                      <div className="flex items-center gap-1">
                        {parseKeys(shortcut.keys).map((key, i) => (
                          <span key={`${shortcut.keys}-${key}`} className="flex items-center gap-1">
                            {i > 0 && (
                              <span className="text-muted-foreground text-[10px]">
                                then
                              </span>
                            )}
                            <kbd className="bg-muted text-muted-foreground rounded-md border px-2 py-0.5 font-mono text-xs">
                              {key}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
