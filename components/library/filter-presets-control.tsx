"use client"

import { useMemo, useState } from "react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mr-1.5 h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function BookmarkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mr-1.5 h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

/** Compact dropdown + dialogs for saved filter presets. Intended for LibraryToolbar. @source */
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

  const activePreset = useMemo(() => {
    return presets.find((p) => p.id === activeFilterPresetId) ?? null
  }, [activeFilterPresetId, presets])

  const [saveOpen, setSaveOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)

  const [presetName, setPresetName] = useState("")
  const [includeSortAndView, setIncludeSortAndView] = useState(false)

  const [draftNames, setDraftNames] = useState<Record<string, string>>({})

  const canSave = presetName.trim().length > 0

  return (
    <>
      <div className="space-y-1">
        <span className="text-muted-foreground text-[11px] font-medium">
          Presets
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger className="focus-visible:ring-ring bg-background border-input hover:bg-accent inline-flex h-9 items-center justify-center rounded-xl border px-3 text-xs font-medium shadow-sm transition-all hover:shadow-md focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50">
            <BookmarkIcon />
            {activePreset ? `Preset: ${activePreset.name}` : "Presets"}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 rounded-xl">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Apply preset</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {presets.length === 0 ? (
                <DropdownMenuItem disabled className="text-muted-foreground">
                  No presets yet
                </DropdownMenuItem>
              ) : (
                presets.map((preset) => {
                  const isActive = preset.id === activeFilterPresetId
                  return (
                    <DropdownMenuItem
                      key={preset.id}
                      onClick={() => applyFilterPreset(preset.id)}
                      className={isActive ? "bg-accent font-medium" : ""}
                    >
                      {isActive && <CheckIcon />}
                      <span className="truncate">{preset.name}</span>
                    </DropdownMenuItem>
                  )
                })
              )}
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => setSaveOpen(true)}
                className="font-medium"
              >
                Save current...
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setManageOpen(true)}>
                Manage presets
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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
              Rename or delete saved presets. Applying a preset is available
              from the dropdown.
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
                            />
                          }
                        >
                          Delete
                        </AlertDialogTrigger>
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
