/** Keyboard shortcut category. @source */
export type ShortcutCategory = "navigation" | "library" | "views" | "system"

/** A keyboard shortcut definition. @source */
export interface KeyboardShortcut {
  keys: string
  label: string
  category: ShortcutCategory
}

/** Platform-aware modifier key display. @source */
export const PLATFORM_MOD =
  typeof navigator !== "undefined" &&
  /mac|iphone|ipad/i.test(navigator.userAgent)
    ? "⌘"
    : "Ctrl+"

/** All available keyboard shortcuts grouped by category. @source */
export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  // Navigation
  { keys: "g then d", label: "Go to Dashboard", category: "navigation" },
  { keys: "g then l", label: "Go to Library", category: "navigation" },
  { keys: "g then s", label: "Go to Settings", category: "navigation" },
  { keys: "g then a", label: "Go to Activity", category: "navigation" },

  // Library
  {
    keys: `${PLATFORM_MOD}K`,
    label: "Open command palette",
    category: "library"
  },
  { keys: "a then b", label: "Add book", category: "library" },
  { keys: "a then s", label: "Add series", category: "library" },
  { keys: "r", label: "Reload library data", category: "library" },
  {
    keys: `${PLATFORM_MOD}A`,
    label: "Select all in library",
    category: "library"
  },

  // Views
  { keys: "v then g", label: "Switch to grid view", category: "views" },
  { keys: "v then l", label: "Switch to list view", category: "views" },
  { keys: "v then s", label: "Collection: Series", category: "views" },
  { keys: "v then v", label: "Collection: Volumes", category: "views" },

  // System
  { keys: "?", label: "Show keyboard shortcuts", category: "system" },
  { keys: "t", label: "Toggle theme", category: "system" },
  { keys: "[", label: "Toggle sidebar", category: "system" },
  { keys: "n", label: "Open notification center", category: "system" },
  {
    keys: "Escape",
    label: "Cancel pending shortcut prefix",
    category: "system"
  }
]

/** Category display labels. @source */
export const SHORTCUT_CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: "Navigation",
  library: "Library",
  views: "Views",
  system: "System"
}
