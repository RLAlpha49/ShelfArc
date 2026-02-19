"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useSettingsStore } from "@/lib/store/settings-store"

export function NotificationsSection() {
  const {
    releaseReminders,
    setReleaseReminders,
    notifyOnImportComplete,
    setNotifyOnImportComplete,
    notifyOnScrapeComplete,
    setNotifyOnScrapeComplete,
    notifyOnPriceAlert,
    setNotifyOnPriceAlert
  } = useSettingsStore()

  return (
    <section
      id="notifications"
      className="animate-fade-in-up scroll-mt-24 py-8"
      style={{ animationDelay: "300ms", animationFillMode: "both" }}
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="bg-primary/8 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4.5 w-4.5"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Notifications
          </h2>
          <p className="text-muted-foreground text-sm">
            Control which events generate in-app notifications
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {/* Activity Notifications */}
        <div className="bg-muted/30 rounded-2xl border p-5">
          <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-wider uppercase">
            Activity Notifications
          </p>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="notify-import-complete" className="font-medium">
                  Import complete
                </Label>
                <p className="text-muted-foreground text-sm">
                  Receive a notification when a library import finishes.
                </p>
              </div>
              <Switch
                id="notify-import-complete"
                checked={notifyOnImportComplete}
                onCheckedChange={setNotifyOnImportComplete}
              />
            </div>
            <div className="border-border/50 border-t" />
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="notify-scrape-complete" className="font-medium">
                  Bulk scrape complete
                </Label>
                <p className="text-muted-foreground text-sm">
                  Receive a notification when a bulk metadata scrape finishes.
                </p>
              </div>
              <Switch
                id="notify-scrape-complete"
                checked={notifyOnScrapeComplete}
                onCheckedChange={setNotifyOnScrapeComplete}
              />
            </div>
            <div className="border-border/50 border-t" />
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="notify-price-alert" className="font-medium">
                  Price alerts
                </Label>
                <p className="text-muted-foreground text-sm">
                  Receive a notification when a tracked book drops below your
                  target price.
                </p>
              </div>
              <Switch
                id="notify-price-alert"
                checked={notifyOnPriceAlert}
                onCheckedChange={setNotifyOnPriceAlert}
              />
            </div>
          </div>
        </div>

        {/* Release Reminders */}
        <div className="bg-muted/30 rounded-2xl border p-5">
          <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-wider uppercase">
            Release Reminders
          </p>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="release-reminders" className="font-medium">
                  Upcoming release notifications
                </Label>
                <p className="text-muted-foreground text-sm">
                  Receive an in-app notification when a wishlisted volume you
                  opted in to is releasing within 7 days. Enable{" "}
                  <em>Notify me</em> on individual volumes in the Releases
                  calendar.
                </p>
              </div>
              <Switch
                id="release-reminders"
                checked={releaseReminders}
                onCheckedChange={setReleaseReminders}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
