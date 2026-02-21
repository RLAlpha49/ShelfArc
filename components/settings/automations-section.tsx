"use client"

import { type ChangeEvent, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export type TriggerType =
  | "price_drop"
  | "new_volume"
  | "release_date"
  | "status_change"

export type Automation = {
  id: string
  user_id: string
  name: string
  trigger_type: TriggerType
  conditions: Record<string, unknown>
  actions: Record<string, unknown>
  enabled: boolean
  last_triggered_at: string | null
  created_at: string
  updated_at: string
}

interface AutomationsSectionProps {
  initialAutomations: Automation[]
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  price_drop: "Price Drop",
  new_volume: "New Volume",
  release_date: "Release Date",
  status_change: "Status Change"
}

export function AutomationsSection({
  initialAutomations
}: Readonly<AutomationsSectionProps>) {
  const [automations, setAutomations] =
    useState<Automation[]>(initialAutomations)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [name, setName] = useState("")
  const [triggerType, setTriggerType] = useState<TriggerType>("price_drop")
  const [conditionsJson, setConditionsJson] = useState("{}")
  const [actionsJson, setActionsJson] = useState("{}")
  const [enabled, setEnabled] = useState(true)

  const resetForm = () => {
    setName("")
    setTriggerType("price_drop")
    setConditionsJson("{}")
    setActionsJson("{}")
    setEnabled(true)
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }

    let conditions: Record<string, unknown>
    let actions: Record<string, unknown>

    try {
      conditions = JSON.parse(conditionsJson) as Record<string, unknown>
    } catch {
      toast.error("Invalid JSON in Conditions")
      return
    }

    try {
      actions = JSON.parse(actionsJson) as Record<string, unknown>
    } catch {
      toast.error("Invalid JSON in Actions")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          trigger_type: triggerType,
          conditions,
          actions,
          enabled
        })
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        toast.error(err.error ?? "Failed to create automation")
        return
      }

      const data = (await res.json()) as Automation
      setAutomations((prev) => [data, ...prev])
      setDialogOpen(false)
      resetForm()
      toast.success("Automation created")
    } catch {
      toast.error("Network error — please try again")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggle = async (id: string, newEnabled: boolean) => {
    try {
      const res = await fetch(`/api/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newEnabled })
      })
      if (!res.ok) {
        toast.error("Failed to update automation")
        return
      }
      setAutomations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, enabled: newEnabled } : a))
      )
      toast.success(newEnabled ? "Automation enabled" : "Automation disabled")
    } catch {
      toast.error("Network error — please try again")
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/automations/${id}`, {
        method: "DELETE"
      })
      if (!res.ok) {
        toast.error("Failed to delete automation")
        return
      }
      setAutomations((prev) => prev.filter((a) => a.id !== id))
      toast.success("Automation deleted")
    } catch {
      toast.error("Network error — please try again")
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 lg:px-10">
      <section
        id="automations"
        className="animate-fade-in-up scroll-mt-24 py-8"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
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
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight">
                Automations
              </h2>
              <p className="text-muted-foreground text-sm">
                Create rules that trigger actions based on book events
              </p>
            </div>
          </div>

          <Button size="sm" onClick={() => setDialogOpen(true)}>
            New Automation
          </Button>
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open: boolean) => {
            setDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New Automation</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-1.5">
                <Label htmlFor="automation-name">Name</Label>
                <Input
                  id="automation-name"
                  placeholder="e.g. Notify me on price drop"
                  value={name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setName(e.target.value)
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="trigger-type">Trigger</Label>
                <Select
                  value={triggerType}
                  onValueChange={(v: string | null) => {
                    if (v) setTriggerType(v as TriggerType)
                  }}
                >
                  <SelectTrigger id="trigger-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="price_drop">Price Drop</SelectItem>
                    <SelectItem value="new_volume">New Volume</SelectItem>
                    <SelectItem value="release_date">Release Date</SelectItem>
                    <SelectItem value="status_change">Status Change</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="conditions-json">
                  Conditions{" "}
                  <span className="text-muted-foreground font-normal">
                    (JSON)
                  </span>
                </Label>
                <Textarea
                  id="conditions-json"
                  className="font-mono text-sm"
                  rows={3}
                  value={conditionsJson}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    setConditionsJson(e.target.value)
                  }
                  placeholder='{"threshold": 5.00}'
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="actions-json">
                  Actions{" "}
                  <span className="text-muted-foreground font-normal">
                    (JSON)
                  </span>
                </Label>
                <Textarea
                  id="actions-json"
                  className="font-mono text-sm"
                  rows={3}
                  value={actionsJson}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    setActionsJson(e.target.value)
                  }
                  placeholder='{"type": "send_notification"}'
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="enabled-toggle">Enabled</Label>
                <Switch
                  id="enabled-toggle"
                  checked={enabled}
                  onCheckedChange={setEnabled}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false)
                  resetForm()
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleCreate()}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {automations.length === 0 ? (
          <div className="bg-muted/30 rounded-2xl border p-10 text-center">
            <div className="text-muted-foreground mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <p className="font-medium">No automations yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Create your first rule to automate library actions.
            </p>
          </div>
        ) : (
          <div className="bg-muted/30 rounded-2xl border">
            <ul className="divide-y">
              {automations.map((automation, index) => (
                <li
                  key={automation.id}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4",
                    index === 0 && "rounded-t-2xl",
                    index === automations.length - 1 && "rounded-b-2xl"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{automation.name}</p>
                    <Badge variant="secondary" className="mt-1">
                      {TRIGGER_LABELS[automation.trigger_type]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={automation.enabled}
                      onCheckedChange={(checked: boolean) =>
                        void handleToggle(automation.id, checked)
                      }
                      aria-label={`Toggle ${automation.name}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0"
                      onClick={() => void handleDelete(automation.id)}
                      aria-label={`Delete ${automation.name}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
