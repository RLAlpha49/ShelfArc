"use client"

import { AccountDeleteDialog } from "@/components/settings/account-delete-dialog"
import { CollectionResetDialog } from "@/components/settings/collection-reset-dialog"
import { Button } from "@/components/ui/button"

export function DangerZoneSection() {
  return (
    <section id="danger-zone" className="scroll-mt-8">
      <div className="border-destructive/30 bg-destructive/5 rounded-2xl border p-6 md:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="bg-destructive/10 flex h-10 w-10 items-center justify-center rounded-xl">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-destructive h-5 w-5"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">Danger Zone</h2>
            <p className="text-muted-foreground text-sm">
              Irreversible actions that affect your account
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="border-destructive/20 bg-background/50 rounded-xl border p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-medium">Reset Collection</h3>
                <p className="text-muted-foreground text-sm">
                  Permanently delete all series, volumes, price history, and
                  price alerts. Your account and settings will not be affected.
                </p>
              </div>
              <CollectionResetDialog
                trigger={
                  <Button variant="destructive" size="sm">
                    Reset Collection
                  </Button>
                }
              />
            </div>
          </div>
          <div className="border-destructive/20 bg-background/50 rounded-xl border p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-medium">Delete Account</h3>
                <p className="text-muted-foreground text-sm">
                  Permanently delete your account and all associated data. This
                  action cannot be undone.
                </p>
              </div>
              <AccountDeleteDialog
                trigger={
                  <Button variant="destructive" size="sm">
                    Delete Account
                  </Button>
                }
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
