"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
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
import type { Bookshelf, BookshelfUpdate } from "@/lib/types/database"
import {
  BOOK_GRID_SIZE,
  BOOK_LENGTH,
  BOOK_MIN_ROW_HEIGHT,
  BOOK_SHELF_PADDING
} from "@/components/bookshelf/shelf-book"

interface BookshelfSettingsDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly bookshelf?: Bookshelf | null
  readonly onSave: (data: BookshelfUpdate) => Promise<void>
  readonly onDelete?: () => Promise<void>
  readonly isNew?: boolean
}

const MIN_ROW_WIDTH = BOOK_LENGTH + BOOK_SHELF_PADDING * 2
const MAX_ROW_WIDTH = 2000
const BOOK_MAX_ROW_HEIGHT = 500
const DEFAULT_SHELF_COLOR = "#92400e"
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

const defaultFormData = {
  name: "",
  description: "",
  row_count: 3,
  row_height: Math.max(200, BOOK_MIN_ROW_HEIGHT),
  row_width: Math.max(800, MIN_ROW_WIDTH),
  shelf_color: ""
}

export function BookshelfSettingsDialog({
  open,
  onOpenChange,
  bookshelf,
  onSave,
  onDelete,
  isNew = false
}: BookshelfSettingsDialogProps) {
  const [formData, setFormData] = useState(defaultFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [colorError, setColorError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      if (bookshelf) {
        setFormData({
          name: bookshelf.name,
          description: bookshelf.description ?? "",
          row_count: bookshelf.row_count,
          row_height: clampRowHeight(bookshelf.row_height),
          row_width: clampRowWidth(bookshelf.row_width),
          shelf_color: bookshelf.shelf_color ?? ""
        })
      } else {
        setFormData(defaultFormData)
      }
      setFormError(null)
      setColorError(null)
    }
  }, [open, bookshelf])

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    const shelfColor = formData.shelf_color.trim()
    const colorValidationError = getHexColorError(shelfColor)
    setColorError(colorValidationError)
    if (colorValidationError) return

    setIsSubmitting(true)
    setFormError(null)
    try {
      await onSave({
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        row_count: formData.row_count,
        row_height: clampRowHeight(formData.row_height),
        row_width: clampRowWidth(formData.row_width),
        shelf_color: shelfColor || null
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(getErrorMessage(error, "Unable to save bookshelf."))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setIsSubmitting(true)
    setFormError(null)
    try {
      await onDelete()
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to delete bookshelf", error)
      setFormError(getErrorMessage(error, "Unable to delete bookshelf."))
    } finally {
      setIsSubmitting(false)
    }
  }

  const colorInputValue = getColorInputValue(formData.shelf_color)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isNew ? "Create New Bookshelf" : "Bookshelf Settings"}
            </DialogTitle>
            <DialogDescription>
              {isNew
                ? "Create a new virtual bookshelf to organize your collection."
                : "Customize the appearance of your bookshelf."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="My Bookshelf"
                required
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value
                  }))
                }
                placeholder="Living room shelf, manga collection, etc."
                rows={2}
              />
            </div>

            {/* Shelf dimensions */}
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="row_count">Rows</Label>
                <Input
                  id="row_count"
                  type="number"
                  min={1}
                  max={10}
                  value={formData.row_count}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      row_count: Number.parseInt(e.target.value, 10) || 1
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="row_height">Height (px)</Label>
                <Input
                  id="row_height"
                  type="number"
                  min={BOOK_MIN_ROW_HEIGHT}
                  max={BOOK_MAX_ROW_HEIGHT}
                  step={BOOK_GRID_SIZE}
                  value={formData.row_height}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      row_height: Number.parseInt(e.target.value, 10) || 200
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="row_width">Width (px)</Label>
                <Input
                  id="row_width"
                  type="number"
                  min={MIN_ROW_WIDTH}
                  max={MAX_ROW_WIDTH}
                  step={BOOK_GRID_SIZE}
                  value={formData.row_width}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      row_width: Number.parseInt(e.target.value, 10) || 800
                    }))
                  }
                />
              </div>
            </div>

            {/* Shelf color */}
            <div className="grid gap-2">
              <Label htmlFor="shelf_color">Shelf Color (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="shelf_color"
                  type="color"
                  value={colorInputValue}
                  onChange={(e) => {
                    const nextValue = e.target.value
                    setFormData((prev) => ({
                      ...prev,
                      shelf_color: nextValue
                    }))
                    setColorError(getHexColorError(nextValue))
                  }}
                  aria-invalid={!!colorError}
                  aria-describedby={
                    colorError ? "shelf-color-error" : undefined
                  }
                  className="h-10 w-14 cursor-pointer p-1"
                />
                <Input
                  value={formData.shelf_color}
                  onChange={(e) => {
                    const nextValue = e.target.value
                    setFormData((prev) => ({
                      ...prev,
                      shelf_color: nextValue
                    }))
                  }}
                  onBlur={(e) => {
                    const trimmedValue = e.target.value.trim()
                    setColorError(getHexColorError(trimmedValue))
                  }}
                  pattern={HEX_COLOR_PATTERN.source}
                  aria-invalid={!!colorError}
                  aria-describedby={
                    colorError ? "shelf-color-error" : undefined
                  }
                  placeholder="#92400e"
                  className="flex-1"
                />
              </div>
              {colorError && (
                <p
                  id="shelf-color-error"
                  className="text-destructive text-sm"
                  role="alert"
                >
                  {colorError}
                </p>
              )}
            </div>
          </div>

          {formError && (
            <p className="text-destructive mt-2 text-sm" role="alert">
              {formError}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {!isNew && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger
                  disabled={isSubmitting}
                  render={
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="mr-auto"
                    />
                  }
                >
                  Delete
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Bookshelf?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the bookshelf and remove all
                      books from it. Your books will remain in your library.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.name.trim()}
            >
              {getSubmitButtonText(isSubmitting, isNew)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function getSubmitButtonText(isSubmitting: boolean, isNew: boolean): string {
  if (isSubmitting) return "Saving..."
  if (isNew) return "Create"
  return "Save Changes"
}

function alignToGrid(value: number): number {
  if (BOOK_GRID_SIZE <= 0) return value
  return Math.ceil(value / BOOK_GRID_SIZE) * BOOK_GRID_SIZE
}

function clampRowHeight(value: number): number {
  const alignedValue = alignToGrid(value)
  return Math.min(
    Math.max(alignedValue, BOOK_MIN_ROW_HEIGHT),
    BOOK_MAX_ROW_HEIGHT
  )
}

function clampRowWidth(value: number): number {
  const alignedValue = alignToGrid(value)
  return Math.min(Math.max(alignedValue, MIN_ROW_WIDTH), MAX_ROW_WIDTH)
}

function getColorInputValue(value: string): string {
  if (HEX_COLOR_PATTERN.test(value)) return value
  return DEFAULT_SHELF_COLOR
}

function getHexColorError(value: string): string | null {
  if (!value) return null
  if (HEX_COLOR_PATTERN.test(value)) return null
  return "Use a hex color like #92400e or #c084fc."
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}
