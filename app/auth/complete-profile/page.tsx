"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef, useState } from "react"

import { completeOAuthProfile } from "@/app/auth/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ALLOWED_REDIRECT_PREFIXES } from "@/lib/auth/constants"

function getValidNext(raw: string | null): string {
  if (!raw) return "/library"
  const path = raw.trim()
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    !ALLOWED_REDIRECT_PREFIXES.some((p) => path.startsWith(p))
  ) {
    return "/library"
  }
  return path
}

/**
 * Username-picker page shown to new OAuth users after their first sign-in.
 * The DB trigger auto-generates a username from their email prefix; this page
 * lets them choose a custom one before entering the app.
 * @source
 */
export default function CompleteProfilePage() {
  return (
    <Suspense>
      <CompleteProfileContent />
    </Suspense>
  )
}

type UsernameStatus = "idle" | "checking" | "available" | "taken"

function CompleteProfileContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const next = getValidNext(searchParams.get("next"))

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [usernameValue, setUsernameValue] = useState("")
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle")
  const errorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  // Debounced username availability check
  useEffect(() => {
    if (usernameValue.length < 3) return
    const timer = setTimeout(async () => {
      setUsernameStatus("checking")
      try {
        const res = await fetch(
          `/api/username/check?username=${encodeURIComponent(usernameValue)}`
        )
        const json = (await res.json()) as { data: { available: boolean } }
        setUsernameStatus(json.data.available ? "available" : "taken")
      } catch {
        setUsernameStatus("idle")
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [usernameValue])

  const isSubmitDisabled =
    loading ||
    usernameValue.length < 3 ||
    usernameStatus === "checking" ||
    usernameStatus === "taken"

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await completeOAuthProfile(formData)
    if (result && "error" in result) {
      setError(result.error ?? null)
      setLoading(false)
      return
    }
    router.push(next)
  }

  return (
    <div className="bg-hero-mesh noise-overlay relative flex min-h-screen">
      {/* Left: Decorative panel */}
      <div className="bg-primary animate-slide-in-left relative hidden w-[45%] overflow-hidden lg:block">
        <div className="from-copper to-gold absolute inset-0 bg-linear-to-br opacity-90" />
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <Link
            href="/"
            className="animate-fade-in stagger-1 flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 text-white"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            </div>
            <span className="font-display text-xl font-bold text-white">
              ShelfArc
            </span>
          </Link>

          <div className="animate-fade-in-up stagger-2 space-y-6">
            <h2 className="font-display text-4xl leading-tight font-bold text-white">
              Almost there — pick your username
            </h2>
            <p className="max-w-sm text-lg leading-relaxed text-white/80">
              Your username appears on your public profile and can be changed
              later in Settings.
            </p>
          </div>

          {/* Decorative book spines */}
          <div className="animate-fade-in-up stagger-3 flex items-end gap-2">
            {[
              { h: "h-32", bg: "bg-white/15" },
              { h: "h-40", bg: "bg-white/10" },
              { h: "h-36", bg: "bg-white/20" },
              { h: "h-28", bg: "bg-white/12" },
              { h: "h-44", bg: "bg-white/8" },
              { h: "h-34", bg: "bg-white/15" },
              { h: "h-38", bg: "bg-white/10" }
            ].map((spine, idx) => (
              <div
                key={spine.h + spine.bg}
                className={`${spine.h} ${spine.bg} animate-fade-in-up w-6 rounded-t-sm backdrop-blur-sm`}
                style={{
                  animationDelay: `${idx * 100}ms`,
                  animationFillMode: "both"
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right: Form */}
      <div className="animate-slide-in-right relative z-10 flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="animate-fade-in mb-10 lg:hidden">
            <Link href="/" className="flex items-center gap-3">
              <div className="bg-primary flex h-9 w-9 items-center justify-center rounded-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary-foreground h-5 w-5"
                >
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                </svg>
              </div>
              <span className="font-display text-xl font-bold">ShelfArc</span>
            </Link>
          </div>

          <div className="animate-fade-in-up mb-8">
            <h1 className="font-display text-3xl font-bold tracking-tight">
              Choose a username
            </h1>
            <p className="text-muted-foreground mt-2">
              This is how others will find you on ShelfArc
            </p>
          </div>

          <form action={handleSubmit} className="space-y-5">
            {error && (
              <div
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                className="text-destructive focus-visible:ring-ring focus-visible:ring-offset-background bg-destructive/10 rounded-xl p-4 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {error}
              </div>
            )}

            <div
              className="animate-fade-in-up space-y-2"
              style={{ animationDelay: "100ms", animationFillMode: "both" }}
            >
              <Label htmlFor="username" className="text-sm font-medium">
                Username
              </Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Choose a username"
                required
                className="h-11 rounded-xl"
                value={usernameValue}
                onChange={(e) => setUsernameValue(e.target.value)}
                autoComplete="username"
                autoFocus
              />
              {usernameValue.length >= 3 && usernameStatus === "checking" && (
                <p className="text-muted-foreground text-xs">Checking…</p>
              )}
              {usernameValue.length >= 3 && usernameStatus === "available" && (
                <p className="text-xs text-emerald-600">✓ Available</p>
              )}
              {usernameValue.length >= 3 && usernameStatus === "taken" && (
                <p className="text-xs text-red-500">✗ Username already taken</p>
              )}
              {(usernameValue.length < 3 || usernameStatus === "idle") && (
                <p className="text-muted-foreground text-xs">
                  3–20 characters. Letters, numbers, and underscores only.
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="animate-fade-in-up h-11 w-full rounded-xl text-base font-semibold"
              disabled={isSubmitDisabled}
              style={{ animationDelay: "200ms", animationFillMode: "both" }}
            >
              {loading ? "Saving…" : "Continue to ShelfArc"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
