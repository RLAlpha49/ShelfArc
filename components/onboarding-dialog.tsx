"use client"

import { useCallback, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { useSettingsStore } from "@/lib/store/settings-store"

interface OnboardingDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  /** When true the user already has series — adapts the flow to skip basic library-building steps. */
  readonly hasExistingLibrary?: boolean
}

const STEPS = [
  {
    id: "welcome",
    title: "Welcome to ShelfArc",
    description:
      "Your personal manga & light novel collection tracker. Let\u2019s take a quick tour of the key features.",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-10 w-10"
      >
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        <path d="M9 10h6" />
        <path d="M12 7v6" />
      </svg>
    )
  },
  {
    id: "build",
    title: "Build Your Library",
    description:
      "Add books one by one or import your existing collection. Search by title, ISBN, or add manually.",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-10 w-10"
      >
        <path d="M12 7v14" />
        <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
      </svg>
    )
  },
  {
    id: "organize",
    title: "Organize with Series",
    description:
      "Group your volumes into series, add tags, and use filters to find anything instantly.",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-10 w-10"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    )
  },
  {
    id: "track",
    title: "Track Your Progress",
    description:
      "See reading stats, price tracking, collection health, and personalized recommendations on your dashboard.",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-10 w-10"
      >
        <path d="M3 3v18h18" />
        <path d="M7 16l4-8 4 5 5-9" />
      </svg>
    )
  },
  {
    id: "customize",
    title: "Make It Yours",
    description:
      "Adjust themes, fonts, navigation layout, and more in Settings. ShelfArc adapts to your style.",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-10 w-10"
      >
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
] as const

/**
 * Replacement step shown to users who already have an existing library.
 * Directs them to advanced features rather than basic book-adding instructions.
 */
const DISCOVER_STEP = {
  id: "discover",
  title: "Discover New Features",
  description:
    "You already have a great library! Explore advanced features: price tracking, automations, collection health, and more.",
  icon: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-10 w-10"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
      <path d="M11 8v6" />
      <path d="M8 11h6" />
    </svg>
  )
} as const

export function OnboardingDialog({
  open,
  onOpenChange,
  hasExistingLibrary = false
}: OnboardingDialogProps) {
  const [step, setStep] = useState(0)
  const setHasCompletedOnboarding = useSettingsStore(
    (s) => s.setHasCompletedOnboarding
  )

  // Compute the active step list: for users with books, replace the
  // "Build Your Library" step with a "Discover New Features" step.
  const activeSteps = hasExistingLibrary
    ? STEPS.map((s) => (s.id === "build" ? DISCOVER_STEP : s))
    : STEPS

  const finish = useCallback(() => {
    setHasCompletedOnboarding(true)
    onOpenChange(false)
    setStep(0)
  }, [setHasCompletedOnboarding, onOpenChange])

  const current = activeSteps[step]
  const isLast = step === activeSteps.length - 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="from-background to-muted/40 ring-border/60 rounded-2xl border-0 bg-linear-to-b p-0 shadow-xl ring-1 sm:max-w-md"
      >
        <div
          key={step}
          style={{ animation: "fade-in-up 150ms ease-out both" }}
          className="flex flex-col items-center px-6 pt-8 pb-2 text-center"
        >
          <div className="bg-primary/8 text-primary mb-5 flex h-20 w-20 items-center justify-center rounded-2xl">
            {current.icon}
          </div>
          <DialogHeader className="items-center">
            <DialogTitle className="font-display text-xl font-bold tracking-tight">
              {current.title}
            </DialogTitle>
            <DialogDescription className="mt-2 max-w-xs text-sm leading-relaxed">
              {current.description}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Progress dots */}
        <div
          className="flex items-center justify-center gap-1.5 py-3"
          aria-label={`Step ${step + 1} of ${activeSteps.length}`}
        >
          {activeSteps.map((s, i) => (
            <span
              key={s.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? "bg-primary w-6" : "bg-muted-foreground/25 w-1.5"
              }`}
            />
          ))}
        </div>

        <DialogFooter className="border-border/40 border-t px-6 py-4">
          <div className="flex w-full items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={finish}
              className="text-muted-foreground"
            >
              Skip
            </Button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep((s) => s - 1)}
                  className="rounded-xl"
                >
                  Back
                </Button>
              )}
              <Button
                size="sm"
                onClick={isLast ? finish : () => setStep((s) => s + 1)}
                className="rounded-xl px-5"
              >
                {isLast ? "Get Started" : "Next"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
