"use client"

import { cloneElement, isValidElement, useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const CONFIRM_PHRASE = "DELETE MY COLLECTION"

interface CollectionResetDialogProps {
  readonly trigger: React.ReactNode
}

export function CollectionResetDialog({
  trigger
}: Readonly<CollectionResetDialogProps>) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const canSubmit = confirmText === CONFIRM_PHRASE && !loading

  const resetForm = () => {
    setConfirmText("")
    setError("")
    setLoading(false)
  }

  const handleReset = async () => {
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/library/reset", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmText })
      })

      if (res.ok || res.status === 204) {
        setOpen(false)
        toast.success("Collection deleted. Your account is still active.")
        globalThis.location.href = "/library"
        return
      }

      const data = (await res.json().catch(() => null)) as {
        error?: string
      } | null
      setError(data?.error ?? "Failed to reset collection")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {isValidElement<{ onClick?: () => void }>(trigger)
        ? cloneElement(trigger, { onClick: () => setOpen(true) })
        : trigger}
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) resetForm()
        }}
      >
        <AlertDialogContent className="max-w-md sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive text-base font-semibold">
              Reset Collection
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This action is <strong>permanent and irreversible</strong>. The
              following will be deleted:
            </AlertDialogDescription>
          </AlertDialogHeader>

          <ul className="text-muted-foreground list-inside list-disc space-y-0.5 text-xs">
            <li>All series and volumes</li>
            <li>Price history and alerts</li>
            <li>Collection groupings</li>
          </ul>

          <p className="text-muted-foreground text-xs">
            Your account, settings, and activity log will <strong>not</strong>{" "}
            be affected.
          </p>

          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="reset-confirm" className="text-sm">
                Type{" "}
                <span className="font-mono font-semibold">
                  {CONFIRM_PHRASE}
                </span>{" "}
                to confirm
              </Label>
              <Input
                id="reset-confirm"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                autoComplete="off"
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <p className="text-destructive text-sm font-medium">{error}</p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={!canSubmit}
              onClick={handleReset}
            >
              {loading ? "Deleting..." : "Reset Collection"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
