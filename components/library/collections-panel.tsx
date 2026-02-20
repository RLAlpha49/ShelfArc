"use client"

import { useCallback, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  COLLECTION_COLORS,
  MAX_COLLECTIONS,
  useCollectionsStore
} from "@/lib/store/collections-store"

/** Collapsible panel displaying custom collections as filter chips. @source */
export function CollectionsPanel() {
  const {
    collections,
    activeCollectionId,
    setActiveCollection,
    addCollection,
    renameCollection,
    deleteCollection,
    setCollectionColor
  } = useCollectionsStore()

  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState("")
  const [createColor, setCreateColor] = useState<string>(COLLECTION_COLORS[0])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  const [expanded, setExpanded] = useState(true)

  const userCollections = collections.filter((c) => !c.isSystem)
  const canCreate = userCollections.length < MAX_COLLECTIONS

  const handleCreate = useCallback(() => {
    if (!createName.trim()) return
    addCollection(createName, createColor)
    setCreateName("")
    setCreateColor(COLLECTION_COLORS[0])
    setCreateOpen(false)
  }, [createName, createColor, addCollection])

  const handleRename = useCallback(() => {
    if (!editingId || !editName.trim()) return
    renameCollection(editingId, editName)
    setEditingId(null)
    setEditName("")
  }, [editingId, editName, renameCollection])

  const handleToggleFilter = useCallback(
    (collectionId: string) => {
      setActiveCollection(
        activeCollectionId === collectionId ? null : collectionId
      )
    },
    [activeCollectionId, setActiveCollection]
  )

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1.5 text-xs tracking-widest uppercase transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        Collections
        <span className="text-muted-foreground/60 ml-auto font-normal tracking-normal normal-case">
          {userCollections.length}/{MAX_COLLECTIONS}
        </span>
        {activeCollectionId && (
          <Badge
            variant="secondary"
            className="ml-1 h-4 min-w-4 px-1 text-[10px]"
          >
            1
          </Badge>
        )}
      </button>

      {expanded && (
        <div className="flex flex-wrap items-center gap-1.5">
          {collections.map((collection) => (
            <div key={collection.id} className="group relative">
              <button
                type="button"
                onClick={() => handleToggleFilter(collection.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs transition-all ${
                  activeCollectionId === collection.id
                    ? "bg-primary text-primary-foreground border-transparent font-medium"
                    : "border-input hover:bg-accent hover:text-foreground"
                }`}
              >
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: collection.color }}
                />
                {collection.name}
                {collection.volumeIds.length > 0 && (
                  <span className="text-[10px] opacity-60">
                    {collection.volumeIds.length}
                  </span>
                )}
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  className="absolute -top-1 -right-1 hidden h-4 w-4 items-center justify-center rounded-full bg-black/50 text-white group-hover:inline-flex"
                  aria-label={`${collection.name} options`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-2.5 w-2.5"
                  >
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="12" cy="5" r="1" />
                    <circle cx="12" cy="19" r="1" />
                  </svg>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="rounded-xl">
                  <DropdownMenuItem
                    onClick={() => {
                      setEditingId(collection.id)
                      setEditName(collection.name)
                    }}
                  >
                    Rename
                  </DropdownMenuItem>
                  {COLLECTION_COLORS.map((color) => (
                    <DropdownMenuItem
                      key={color}
                      onClick={() => setCollectionColor(collection.id, color)}
                    >
                      <span
                        className="mr-2 inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      {color === collection.color ? "Current color" : "Color"}
                    </DropdownMenuItem>
                  ))}
                  {!collection.isSystem && (
                    <DropdownMenuItem
                      onClick={() => deleteCollection(collection.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {canCreate && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="border-input hover:bg-accent hover:text-foreground text-muted-foreground inline-flex items-center gap-1 rounded-xl border border-dashed px-2.5 py-1 text-xs transition-all"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3"
              >
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
              New
            </button>
          )}

          {activeCollectionId && (
            <button
              type="button"
              onClick={() => setActiveCollection(null)}
              className="text-muted-foreground hover:text-foreground text-xs underline transition-colors"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Create collection dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="collection-name">Name</Label>
              <Input
                id="collection-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="My shelf..."
                className="rounded-xl"
                maxLength={50}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate()
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLLECTION_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setCreateColor(color)}
                    className={`h-6 w-6 rounded-full border-2 transition-all ${
                      createColor === color
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!createName.trim()}
              className="rounded-xl"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename collection dialog */}
      <Dialog
        open={editingId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingId(null)
            setEditName("")
          }
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Collection</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="rename-collection">Name</Label>
            <Input
              id="rename-collection"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="mt-2 rounded-xl"
              maxLength={50}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename()
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingId(null)
                setEditName("")
              }}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={!editName.trim()}
              className="rounded-xl"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Picker dialog for adding volumes to a collection. @source */
export function AddToCollectionDialog({
  open,
  onOpenChange,
  volumeIds
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly volumeIds: string[]
}) {
  const { collections, addVolumesToCollection, addCollection } =
    useCollectionsStore()
  const [newName, setNewName] = useState("")
  const [showCreate, setShowCreate] = useState(false)

  const handleAdd = useCallback(
    (collectionId: string) => {
      addVolumesToCollection(collectionId, volumeIds)
      onOpenChange(false)
    },
    [volumeIds, addVolumesToCollection, onOpenChange]
  )

  const handleCreateAndAdd = useCallback(() => {
    if (!newName.trim()) return
    const id = addCollection(newName)
    if (id) {
      addVolumesToCollection(id, volumeIds)
      setNewName("")
      setShowCreate(false)
      onOpenChange(false)
    }
  }, [newName, addCollection, addVolumesToCollection, volumeIds, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add to Collection</DialogTitle>
        </DialogHeader>
        <div className="max-h-64 space-y-1 overflow-y-auto py-2">
          {collections.map((collection) => {
            const alreadyIn = volumeIds.every((vid) =>
              collection.volumeIds.includes(vid)
            )
            return (
              <button
                key={collection.id}
                type="button"
                disabled={alreadyIn}
                onClick={() => handleAdd(collection.id)}
                className="hover:bg-accent flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors disabled:opacity-50"
              >
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: collection.color }}
                />
                <span className="flex-1">{collection.name}</span>
                {alreadyIn && (
                  <span className="text-muted-foreground text-xs">Added</span>
                )}
              </button>
            )
          })}
        </div>
        {showCreate ? (
          <div className="flex items-center gap-2 pt-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Collection name..."
              className="flex-1 rounded-xl"
              maxLength={50}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateAndAdd()
              }}
            />
            <Button
              size="sm"
              onClick={handleCreateAndAdd}
              disabled={!newName.trim()}
              className="rounded-xl"
            >
              Add
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreate(true)}
            className="w-full rounded-xl"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1.5 h-3.5 w-3.5"
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            New Collection
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
