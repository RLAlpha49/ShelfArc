"use client"

import { useCallback, useMemo } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import { useSettingsStore } from "@/lib/store/settings-store"
import {
  DASHBOARD_WIDGETS,
  type DashboardWidgetColumn,
  type DashboardWidgetId,
  type DashboardWidgetMeta
} from "@/lib/store/settings-store"

const COLUMN_LABELS: Record<DashboardWidgetColumn, string> = {
  full: "Full Width",
  left: "Left Column",
  right: "Right Column"
}

const COLUMN_ABBR: Record<DashboardWidgetColumn, string> = {
  full: "F",
  left: "L",
  right: "R"
}

/**
 * Standalone panel content — embed in a Sheet, Dialog, or other container.
 * @source
 */
export function DashboardLayoutCustomizerContent() {
  const layout = useSettingsStore((s) => s.dashboardLayout)
  const setLayout = useSettingsStore((s) => s.setDashboardLayout)
  const resetLayout = useSettingsStore((s) => s.resetDashboardLayout)

  const widgetsByColumn = useMemo(() => {
    const groups: Record<DashboardWidgetColumn, DashboardWidgetMeta[]> = {
      full: [],
      left: [],
      right: []
    }
    const ordered = [...DASHBOARD_WIDGETS].sort((a, b) => {
      const ai = layout.order.indexOf(a.id)
      const bi = layout.order.indexOf(b.id)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
    for (const w of ordered) {
      const effectiveColumn = layout.columns?.[w.id] ?? w.column
      groups[effectiveColumn].push(w)
    }
    return groups
  }, [layout.order, layout.columns])

  const toggleVisibility = useCallback(
    (id: DashboardWidgetId) => {
      const hidden = layout.hidden.includes(id)
        ? layout.hidden.filter((h) => h !== id)
        : [...layout.hidden, id]
      setLayout({ ...layout, hidden })
    },
    [layout, setLayout]
  )

  const setColumnOverride = useCallback(
    (id: DashboardWidgetId, column: DashboardWidgetColumn) => {
      const current =
        layout.columns?.[id] ??
        DASHBOARD_WIDGETS.find((w) => w.id === id)?.column
      const newColumns = { ...layout.columns }
      if (current === column) {
        delete newColumns[id]
      } else {
        newColumns[id] = column
      }
      setLayout({ ...layout, columns: newColumns })
    },
    [layout, setLayout]
  )

  const moveWidget = useCallback(
    (id: DashboardWidgetId, direction: "up" | "down") => {
      const widget = DASHBOARD_WIDGETS.find((w) => w.id === id)
      if (!widget) return
      const effectiveCol = layout.columns?.[id] ?? widget.column

      const sameColumn = layout.order.filter((wId) => {
        const meta = DASHBOARD_WIDGETS.find((w) => w.id === wId)
        return meta
          ? (layout.columns?.[wId] ?? meta.column) === effectiveCol
          : false
      })

      const idx = sameColumn.indexOf(id)
      if (idx === -1) return

      const targetIdx = direction === "up" ? idx - 1 : idx + 1
      if (targetIdx < 0 || targetIdx >= sameColumn.length) return

      const newColumnOrder = [...sameColumn]
      ;[newColumnOrder[idx], newColumnOrder[targetIdx]] = [
        newColumnOrder[targetIdx],
        newColumnOrder[idx]
      ]

      const newOrder = [...layout.order]
      let colIdx = 0
      for (let i = 0; i < newOrder.length; i++) {
        const meta = DASHBOARD_WIDGETS.find((w) => w.id === newOrder[i])
        if (meta?.column === widget.column) {
          newOrder[i] = newColumnOrder[colIdx++]
        }
      }

      setLayout({ ...layout, order: newOrder })
    },
    [layout, setLayout]
  )

  return (
    <>
      <div className="border-b p-3">
        <h3 className="text-sm font-semibold">Dashboard Layout</h3>
        <p className="text-muted-foreground text-xs">
          Show, hide, or reorder widgets
        </p>
      </div>

      <div className="max-h-80 overflow-y-auto p-2">
        {(["full", "left", "right"] as const).map((column) => {
          const widgets = widgetsByColumn[column]
          if (widgets.length === 0) return null
          return (
            <div key={column} className="mb-3 last:mb-0">
              <span className="text-muted-foreground mb-1.5 block px-1 text-[10px] font-medium tracking-wider uppercase">
                {COLUMN_LABELS[column]}
              </span>
              <div className="space-y-0.5">
                {widgets.map((widget, idx) => {
                  const isHidden = layout.hidden.includes(widget.id)
                  return (
                    <div
                      key={widget.id}
                      className="hover:bg-accent/50 flex items-center gap-2 rounded-md px-1.5 py-1.5"
                    >
                      <Checkbox
                        id={`widget-${widget.id}`}
                        checked={!isHidden}
                        onCheckedChange={() => toggleVisibility(widget.id)}
                      />
                      <label
                        htmlFor={`widget-${widget.id}`}
                        className="min-w-0 flex-1 cursor-pointer text-xs font-medium"
                      >
                        {widget.label}
                      </label>
                      <div className="flex shrink-0 items-center gap-0.5">
                        {(["left", "right", "full"] as const).map((col) => {
                          const isActive =
                            (layout.columns?.[widget.id] ?? widget.column) ===
                            col
                          return (
                            <button
                              key={col}
                              type="button"
                              onClick={() => setColumnOverride(widget.id, col)}
                              className={
                                isActive
                                  ? "bg-primary/10 text-primary rounded px-1 py-0.5 text-[9px] font-semibold"
                                  : "text-muted-foreground hover:text-foreground rounded px-1 py-0.5 text-[9px] font-medium transition-colors"
                              }
                              aria-label={`Set ${widget.label} to ${col} column`}
                              aria-pressed={isActive}
                            >
                              {COLUMN_ABBR[col]}
                            </button>
                          )
                        })}
                        <button
                          type="button"
                          onClick={() => moveWidget(widget.id, "up")}
                          disabled={idx === 0}
                          className="text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors disabled:opacity-30"
                          aria-label={`Move ${widget.label} up`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="h-3 w-3"
                          >
                            <polyline points="18,15 12,9 6,15" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveWidget(widget.id, "down")}
                          disabled={idx === widgets.length - 1}
                          className="text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors disabled:opacity-30"
                          aria-label={`Move ${widget.label} down`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="h-3 w-3"
                          >
                            <polyline points="6,9 12,15 18,9" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => {
            if (
              globalThis.confirm(
                "Reset dashboard layout to defaults? This cannot be undone."
              )
            ) {
              resetLayout()
            }
          }}
        >
          Reset to Default
        </Button>
      </div>
    </>
  )
}

/** @source */
export function DashboardLayoutCustomizer() {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="border-input dark:bg-input/30 hover:bg-accent hover:text-foreground hover:border-border/80 inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs/relaxed font-medium transition-all outline-none hover:shadow-sm"
          />
        }
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-3.5 w-3.5"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        Customize
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <DashboardLayoutCustomizerContent />
      </PopoverContent>
    </Popover>
  )
}
