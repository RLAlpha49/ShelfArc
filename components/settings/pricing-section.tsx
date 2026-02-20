"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { fetchPriceAlerts } from "@/lib/api/endpoints"
import { formatDate } from "@/lib/format-date"
import type {
  AmazonDomain,
  CurrencyCode,
  PriceSource
} from "@/lib/store/library-store"
import { useLibraryStore } from "@/lib/store/library-store"
import { useSettingsStore } from "@/lib/store/settings-store"
import type { PriceAlert } from "@/lib/types/database"

const amazonDomainOptions: Array<{ value: AmazonDomain; label: string }> = [
  { value: "amazon.com", label: "amazon.com (US)" },
  { value: "amazon.co.uk", label: "amazon.co.uk (UK)" },
  { value: "amazon.ca", label: "amazon.ca (Canada)" },
  { value: "amazon.de", label: "amazon.de (Germany)" },
  { value: "amazon.co.jp", label: "amazon.co.jp (Japan)" }
]

const currencyOptions: Array<{ value: CurrencyCode; label: string }> = [
  { value: "USD", label: "USD ($)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "CAD", label: "CAD ($)" },
  { value: "JPY", label: "JPY (¥)" }
]

const priceSourceOptions: Array<{ value: PriceSource; label: string }> = [
  { value: "amazon", label: "Amazon" },
  { value: "bookwalker", label: "BookWalker Global" }
]

const isValidOption = <T extends string>(
  value: string | null | undefined,
  options: Array<{ value: T }>
): value is T =>
  value !== null &&
  value !== undefined &&
  options.some((option) => option.value === value)

export function PricingSection() {
  const {
    priceSource,
    amazonDomain,
    amazonPreferKindle,
    amazonFallbackToKindle,
    priceDisplayCurrency,
    showAmazonDisclaimer,
    setPriceSource,
    setAmazonDomain,
    setAmazonPreferKindle,
    setAmazonFallbackToKindle,
    setPriceDisplayCurrency,
    setShowAmazonDisclaimer
  } = useLibraryStore()

  const { automatedPriceChecks, setAutomatedPriceChecks, dateFormat } =
    useSettingsStore()

  const [isCheckingNow, setIsCheckingNow] = useState(false)
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const [snoozingId, setSnoozingId] = useState<string | null>(null)

  const priceFormatter = useMemo(() => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: priceDisplayCurrency
      })
    } catch {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD"
      })
    }
  }, [priceDisplayCurrency])

  const fetchAlerts = useCallback(async () => {
    try {
      const { data } = await fetchPriceAlerts()
      setAlerts(data ?? [])
    } catch {
      // Non-critical — silently ignore
    }
  }, [])

  useEffect(() => {
    void fetchAlerts()
  }, [fetchAlerts])

  const handleSnooze = useCallback(
    async (alertId: string, snoozeDays: 7 | 30 | 0) => {
      setSnoozingId(alertId)
      try {
        const res = await fetch("/api/books/price/alerts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: alertId, snooze_days: snoozeDays })
        })
        if (!res.ok) {
          toast.error("Failed to update snooze. Please try again.")
          return
        }
        const json = (await res.json()) as { data?: PriceAlert }
        setAlerts((prev) =>
          prev.map((a) => (a.id === alertId ? (json.data ?? a) : a))
        )
        if (snoozeDays === 0) {
          toast.success("Snooze removed.")
        } else {
          toast.success(`Alert snoozed for ${snoozeDays} days.`)
        }
      } catch {
        toast.error("Could not update snooze. Please try again.")
      } finally {
        setSnoozingId(null)
      }
    },
    []
  )

  const handleCheckNow = async () => {
    setIsCheckingNow(true)
    try {
      const res = await fetch("/api/automations/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      })
      const json = await res.json()
      if (res.ok) {
        const { triggered = 0, evaluated = 0 } = json?.data ?? {}
        if (triggered > 0) {
          toast.success(
            `Price check complete — ${triggered} alert${triggered === 1 ? "" : "s"} triggered out of ${evaluated} checked.`
          )
        } else {
          toast.success(
            `Price check complete — ${evaluated} alert${evaluated === 1 ? "" : "s"} checked, no thresholds met.`
          )
        }
      } else {
        const msg =
          typeof json?.error === "string"
            ? json.error
            : "Price check failed. Please try again."
        toast.error(msg)
      }
    } catch {
      toast.error("Could not reach the price check service. Please try again.")
    } finally {
      setIsCheckingNow(false)
    }
  }

  return (
    <section
      id="pricing"
      className="animate-fade-in-up scroll-mt-24 py-8"
      style={{ animationDelay: "250ms", animationFillMode: "both" }}
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
            <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
            <path d="M7 7h.01" />
          </svg>
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Pricing
          </h2>
          <p className="text-muted-foreground text-sm">
            Price sources, currency, and display settings
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {/* Source & Currency */}
        <div className="bg-muted/30 rounded-2xl border p-5">
          <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-wider uppercase">
            Source & Currency
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="price-source">Price source</Label>
              <Select
                value={priceSource}
                onValueChange={(value) => {
                  if (isValidOption(value, priceSourceOptions)) {
                    setPriceSource(value)
                  }
                }}
              >
                <SelectTrigger id="price-source">
                  <SelectValue placeholder="Choose a source" />
                </SelectTrigger>
                <SelectContent>
                  {priceSourceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Used for volume price lookups.
              </p>
            </div>

            {priceSource === "amazon" && (
              <div className="space-y-2">
                <Label htmlFor="amazon-domain">Amazon domain</Label>
                <Select
                  value={amazonDomain}
                  onValueChange={(value) =>
                    setAmazonDomain(value as AmazonDomain)
                  }
                >
                  <SelectTrigger id="amazon-domain">
                    <SelectValue placeholder="Select a domain" />
                  </SelectTrigger>
                  <SelectContent>
                    {amazonDomainOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Amazon marketplace region.
                </p>
              </div>
            )}

            {priceSource === "bookwalker" && (
              <p className="text-muted-foreground self-end pb-1 text-sm sm:col-span-2">
                BookWalker Global pricing (global.bookwalker.jp) is used for
                digital manga and light novels. Prices are shown in USD.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="display-currency">Display currency</Label>
              <Select
                value={priceDisplayCurrency}
                onValueChange={(value) =>
                  setPriceDisplayCurrency(value as CurrencyCode)
                }
              >
                <SelectTrigger id="display-currency">
                  <SelectValue placeholder="Choose currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                How prices are formatted across the app.
              </p>
            </div>
          </div>
        </div>

        {/* Amazon Options */}
        {priceSource === "amazon" && (
          <div className="bg-muted/30 rounded-2xl border p-5">
            <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-wider uppercase">
              Amazon Options
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="amazon-prefer-kindle" className="font-medium">
                    Prefer Kindle pricing
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    Use Kindle as the primary Amazon price lookup.
                  </p>
                </div>
                <Switch
                  id="amazon-prefer-kindle"
                  checked={amazonPreferKindle}
                  onCheckedChange={setAmazonPreferKindle}
                />
              </div>
              <div className="border-border/40 border-t" />
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="amazon-fallback-kindle"
                    className="font-medium"
                  >
                    Fallback to Kindle pricing
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    If Paperback pricing is missing, try the Kindle price
                    instead.
                  </p>
                </div>
                <Switch
                  id="amazon-fallback-kindle"
                  checked={amazonFallbackToKindle}
                  onCheckedChange={setAmazonFallbackToKindle}
                  disabled={amazonPreferKindle}
                />
              </div>
              <div className="border-border/40 border-t" />
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="show-amazon-disclaimer"
                    className="font-medium"
                  >
                    Show Amazon data disclaimer
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    Display the disclaimer after fetching prices or images.
                  </p>
                </div>
                <Switch
                  id="show-amazon-disclaimer"
                  checked={showAmazonDisclaimer}
                  onCheckedChange={setShowAmazonDisclaimer}
                />
              </div>
            </div>
          </div>
        )}

        {/* Automated Price Checks */}
        <div className="bg-muted/30 rounded-2xl border p-5">
          <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-wider uppercase">
            Automated Price Checks
          </p>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="automated-price-checks" className="font-medium">
                  Enable automated price checks
                </Label>
                <p className="text-muted-foreground text-sm">
                  When enabled, ShelfArc automatically checks Amazon prices for
                  your active alerts. Prices are updated approximately every 24
                  hours.
                </p>
              </div>
              <Switch
                id="automated-price-checks"
                checked={automatedPriceChecks}
                onCheckedChange={setAutomatedPriceChecks}
              />
            </div>
            <div className="border-border/40 border-t" />
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                disabled={isCheckingNow}
                onClick={() => void handleCheckNow()}
              >
                {isCheckingNow ? "Checking…" : "Check Now"}
              </Button>
            </div>
          </div>
        </div>

        {/* Active Alerts */}
        {alerts.some((a) => a.enabled) && (
          <div className="bg-muted/30 rounded-2xl border p-5">
            <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-wider uppercase">
              Active Alerts
            </p>
            <div className="divide-border divide-y overflow-hidden rounded-xl border">
              {alerts
                .filter((a) => a.enabled)
                .map((alert) => {
                  const isSnoozed =
                    alert.snoozed_until !== null &&
                    new Date(alert.snoozed_until) > new Date()
                  return (
                    <div
                      key={alert.id}
                      className="bg-card flex items-center justify-between gap-3 p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">
                            Target: {priceFormatter.format(alert.target_price)}{" "}
                            {alert.currency}
                          </span>
                          {isSnoozed && (
                            <Badge variant="secondary">
                              Snoozed until{" "}
                              {formatDate(alert.snoozed_until, dateFormat)}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm"
                          })}
                          disabled={snoozingId === alert.id}
                        >
                          {snoozingId === alert.id ? "Saving…" : "Snooze"}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => void handleSnooze(alert.id, 7)}
                          >
                            Snooze 7 days
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => void handleSnooze(alert.id, 30)}
                          >
                            Snooze 30 days
                          </DropdownMenuItem>
                          {isSnoozed && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => void handleSnooze(alert.id, 0)}
                              >
                                Remove snooze
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
