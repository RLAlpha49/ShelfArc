"use client"

import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import { useLibraryStore } from "@/lib/store/library-store"

/** Horizontal preset pill strip + dialogs for saved filter presets. Intended for LibraryToolbar. @source */
export function FilterPresetsControl() {
  const filterPresets = useLibraryStore((s) => s.filterPresets)
  const activeFilterPresetId = useLibraryStore((s) => s.activeFilterPresetId)
  const applyFilterPreset = useLibraryStore((s) => s.applyFilterPreset)
  const saveFilterPreset = useLibraryStore((s) => s.saveFilterPreset)
  const renameFilterPreset = useLibraryStore((s) => s.renameFilterPreset)
  const deleteFilterPreset = useLibraryStore((s) => s.deleteFilterPreset)

  const presets = useMemo(() => {
    return [...filterPresets].sort((a, b) => a.name.localeCompare(b.name))
  }, [filterPresets])

  const [saveOpen, setSaveOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [presetName, setPresetName] = useState("")
  const [includeSortAndView, setIncludeSortAndView] = useState(false)
  const [draftNames, setDraftNames] = useState<Record<string, string>>({})
  const scrollRef = useRef<HTMLDivElement>(null)

  const canSave = presetName.trim().length > 0

  return (
    <>
      <div className="space-y-1">
        <span className="text-muted-foreground text-[11px] font-medium">
          Presets
        </span>
        <div className="flex items-center gap-1.5">
          <div
            ref={scrollRef}
            className="scrollbar-none flex items-center gap-1.5 overflow-x-auto"
          >
            {presets.map((preset) => {
              const isActive = preset.id === activeFilterPresetId
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyFilterPreset(preset.id)}
                  className={`focus-visible:ring-ring inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium whitespace-nowrap transition-all focus-visible:ring-1 focus-visible:outline-none ${
                    isActive
                      ? "bg-copper text-white shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border/50 border border-transparent"
                  }`}
                >
                  {isActive && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3 w-3"
                      aria-hidden="true"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                  {preset.name}
                </button>
              )
            })}
          </div>

          {/* Save current filters as new preset */}
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => setSaveOpen(true)}
                  className="focus-visible:ring-ring border-input text-muted-foreground hover:border-copper/40 hover:text-copper inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed transition-all focus-visible:ring-1 focus-visible:outline-none"
                  aria-label="Save current filters as preset"
                />
              }
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
              >
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Save current filters</p>
            </TooltipContent>
          </Tooltip>

          {/* Manage presets */}
          {presets.length > 0 && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => setManageOpen(true)}
                    className="focus-visible:ring-ring text-muted-foreground hover:text-foreground inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-1 focus-visible:outline-none"
                    aria-label="Manage presets"
                  />
                }
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5"
                >
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                  <circle cx="5" cy="12" r="1" />
                </svg>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Manage presets</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Save Dialog */}
      <Dialog
        open={saveOpen}
        onOpenChange={(nextOpen) => {
          setSaveOpen(nextOpen)
          if (!nextOpen) {
            setPresetName("")
            setIncludeSortAndView(false)
          }
        }}
      >
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Save preset</DialogTitle>
            <DialogDescription>
              Store your current filters as a named preset for quick access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs tracking-widest uppercase">
                Name
              </div>
              <Input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="e.g. Wishlist"
                className="rounded-xl"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={includeSortAndView}
                onCheckedChange={(next) => {
                  setIncludeSortAndView(Boolean(next))
                }}
                id="include-sort-view"
              />
              <Label htmlFor="include-sort-view" className="text-xs">
                Include sort &amp; view settings
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaveOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!canSave) return
                saveFilterPreset(presetName, { includeSortAndView })
                setSaveOpen(false)
              }}
              disabled={!canSave}
              className="rounded-xl"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Dialog */}
      <Dialog
        open={manageOpen}
        onOpenChange={(nextOpen) => {
          setManageOpen(nextOpen)
          if (nextOpen) {
            setDraftNames(
              Object.fromEntries(presets.map((p) => [p.id, p.name]))
            )
          }
        }}
      >
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Manage presets</DialogTitle>
            <DialogDescription>
              Rename or delete saved presets.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {presets.length === 0 ? (
              <div className="text-muted-foreground rounded-xl border p-3 text-xs">
                You don&apos;t have any presets yet.
              </div>
            ) : (
              presets.map((preset) => {
                const draft = draftNames[preset.id] ?? preset.name
                const trimmedDraft = draft.trim()
                const canRename =
                  trimmedDraft.length > 0 && trimmedDraft !== preset.name

                return (
                  <div
                    key={preset.id}
                    className="bg-muted/20 flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-muted-foreground mb-1 text-[11px] font-medium">
                        Preset name
                      </div>
                      <Input
                        value={draft}
                        onChange={(e) =>
                          setDraftNames((prev) => ({
                            ...prev,
                            [preset.id]: e.target.value
                          }))
                        }
                        className="rounded-xl"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (!canRename) return
                          renameFilterPreset(preset.id, trimmedDraft)
                          setDraftNames((prev) => ({
                            ...prev,
                            [preset.id]: trimmedDraft
                          }))
                        }}
                        disabled={!canRename}
                        className="rounded-xl"
                      >
                        Rename
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/10 rounded-xl"
                            >
                              Delete
                            </Button>
                          }
                        />
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete preset?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove{" "}
                              <span className="font-medium">{preset.name}</span>
                              .
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              className="rounded-xl"
                              onClick={() => deleteFilterPreset(preset.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setManageOpen(false)}
              className="rounded-xl"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
