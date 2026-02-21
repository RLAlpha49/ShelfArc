"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef, useState } from "react"

import { signup } from "@/app/auth/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ALLOWED_REDIRECT_PREFIXES } from "@/lib/auth/constants"

function getValidRedirect(raw: string | null): string | null {
  if (!raw) return null
  const path = raw.trim()
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    !ALLOWED_REDIRECT_PREFIXES.some((p) => path.startsWith(p))
  ) {
    return null
  }
  return path
}

function computePasswordStrength(password: string): number {
  if (!password) return 0
  let score = 0
  if (/[a-z]/.test(password)) score++
  if (/[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (password.length >= 8) score++
  return score
}

const STRENGTH_CONFIG = [
  { label: "Weak", color: "bg-red-500", textColor: "text-red-500" },
  { label: "Fair", color: "bg-orange-500", textColor: "text-orange-500" },
  { label: "Good", color: "bg-yellow-500", textColor: "text-yellow-500" },
  { label: "Strong", color: "bg-emerald-500", textColor: "text-emerald-500" }
] as const

type UsernameStatus = "idle" | "checking" | "available" | "taken"

/**
 * Signup page with email/password/display-name form and decorative side panel.
 * @source
 */
export default function SignupPage() {
  return (
    <Suspense>
      <SignupContent />
    </Suspense>
  )
}

function SignupContent() {
  const searchParams = useSearchParams()
  const redirectTo = getValidRedirect(searchParams.get("redirect"))
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [passwordValue, setPasswordValue] = useState("")
  const [confirmValue, setConfirmValue] = useState("")
  const [usernameValue, setUsernameValue] = useState("")
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle")
  const errorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (error) {
      errorRef.current?.focus()
    }
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
        const data = (await res.json()) as { available: boolean }
        setUsernameStatus(data.available ? "available" : "taken")
      } catch {
        setUsernameStatus("idle")
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [usernameValue])

  const passwordStrength = computePasswordStrength(passwordValue)
  const strengthConfig =
    passwordStrength > 0 ? STRENGTH_CONFIG[passwordStrength - 1] : null

  const passwordsMismatch =
    confirmValue.length > 0 && passwordValue !== confirmValue

  // Only gate on username check when the field is long enough to have been checked
  const isSubmitDisabled =
    loading ||
    (usernameValue.length >= 3 && usernameStatus === "checking") ||
    (usernameValue.length >= 3 && usernameStatus === "taken") ||
    passwordsMismatch

  /** Submits the signup form and surfaces errors without redirect. @source */
  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    const result = await signup(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
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
              Start building your library today
            </h2>
            <p className="max-w-sm text-lg leading-relaxed text-white/80">
              Join fellow collectors and bring beautiful organization to your
              manga and light novel collection.
            </p>
          </div>

          {/* Decorative book spines */}
          <div className="animate-fade-in-up stagger-3 flex items-end gap-2">
            {[
              { h: "h-36", bg: "bg-white/12" },
              { h: "h-28", bg: "bg-white/18" },
              { h: "h-44", bg: "bg-white/8" },
              { h: "h-32", bg: "bg-white/15" },
              { h: "h-40", bg: "bg-white/10" },
              { h: "h-30", bg: "bg-white/20" },
              { h: "h-38", bg: "bg-white/12" }
            ].map((spine, i) => (
              <div
                key={spine.h}
                className={`${spine.h} ${spine.bg} animate-fade-in-up w-6 rounded-t-sm backdrop-blur-sm`}
                style={{
                  animationDelay: `${i * 100}ms`,
                  animationFillMode: "both"
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right: Signup form */}
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
              Create your account
            </h1>
            <p className="text-muted-foreground mt-2">
              Start tracking your light novel and manga collection
            </p>
          </div>

          <form action={handleSubmit} className="space-y-5">
            {redirectTo && (
              <input type="hidden" name="redirectTo" value={redirectTo} />
            )}
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

            <div
              className="animate-fade-in-up space-y-2"
              style={{ animationDelay: "200ms", animationFillMode: "both" }}
            >
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="h-11 rounded-xl"
              />
            </div>

            <div
              className="animate-fade-in-up space-y-2"
              style={{ animationDelay: "300ms", animationFillMode: "both" }}
            >
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
                className="h-11 rounded-xl"
                value={passwordValue}
                onChange={(e) => setPasswordValue(e.target.value)}
              />
              {passwordValue ? (
                <div className="space-y-1">
                  <div className="flex gap-1" aria-hidden="true">
                    {Array.from({ length: 4 }, (_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i < passwordStrength && strengthConfig
                            ? strengthConfig.color
                            : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  {strengthConfig && (
                    <p
                      className={`text-xs font-medium ${strengthConfig.textColor}`}
                    >
                      {strengthConfig.label}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Minimum 8 characters with uppercase, lowercase, and a number
                </p>
              )}
            </div>

            {/* Confirm password */}
            <div
              className="animate-fade-in-up space-y-2"
              style={{ animationDelay: "350ms", animationFillMode: "both" }}
            >
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm password
              </Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                required
                autoComplete="new-password"
                className="h-11 rounded-xl"
                value={confirmValue}
                onChange={(e) => setConfirmValue(e.target.value)}
              />
              {passwordsMismatch && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              className="animate-fade-in-up h-11 w-full rounded-xl text-base font-semibold"
              disabled={isSubmitDisabled}
              style={{ animationDelay: "400ms", animationFillMode: "both" }}
            >
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <p className="text-muted-foreground animate-fade-in stagger-5 mt-8 text-center text-sm">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-primary font-semibold hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
