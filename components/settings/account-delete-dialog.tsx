"use client"

import Link from "next/link"
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

interface AccountDeleteDialogProps {
  readonly trigger: React.ReactNode
}

export function AccountDeleteDialog({
  trigger
}: Readonly<AccountDeleteDialogProps>) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmText, setConfirmText] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const canSubmit = confirmText === "DELETE" && password.length > 0 && !loading

  const resetForm = () => {
    setPassword("")
    setConfirmText("")
    setError("")
    setLoading(false)
  }

  const handleDelete = async () => {
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmText })
      })

      if (res.ok) {
        localStorage.clear()
        toast.success("Account deleted")
        globalThis.location.href = "/"
        return
      }

      const data = (await res.json().catch(() => null)) as {
        error?: string
      } | null
      setError(data?.error || "Failed to delete account")
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
              Delete Account
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This action is <strong>permanent and irreversible</strong>. All
              your data will be deleted, including:
            </AlertDialogDescription>
          </AlertDialogHeader>

          <ul className="text-muted-foreground list-inside list-disc space-y-0.5 text-xs">
            <li>All series and volumes</li>
            <li>Price history and alerts</li>
            <li>Activity log</li>
            <li>Tags and collections</li>
            <li>Profile and settings</li>
          </ul>

          <p className="text-muted-foreground text-xs">
            Consider{" "}
            <Link
              href="/settings/export"
              className="text-primary underline underline-offset-2"
            >
              exporting your data
            </Link>{" "}
            first.
          </p>

          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="delete-password" className="text-sm">
                Password
              </Label>
              <Input
                id="delete-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delete-confirm" className="text-sm">
                Type <span className="font-mono font-semibold">DELETE</span> to
                confirm
              </Label>
              <Input
                id="delete-confirm"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
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
              onClick={handleDelete}
            >
              {loading ? "Deleting..." : "Delete Account"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
