"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef, useState } from "react"

import { login, loginWithMagicLink } from "@/app/auth/actions"
import { OAuthButtons } from "@/components/auth/oauth-buttons"
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

/**
 * Login page with email/password form and decorative side panel.
 * @source
 */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const searchParams = useSearchParams()
  const redirectTo = getValidRedirect(searchParams.get("redirect"))
  const [error, setError] = useState<string | null>(null)
  const [magicLinkSuccess, setMagicLinkSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [useMagicLink, setUseMagicLink] = useState(false)
  const errorRef = useRef<HTMLDivElement | null>(null)
  const successRef = useRef<HTMLOutputElement | null>(null)

  useEffect(() => {
    if (error) {
      errorRef.current?.focus()
    }
  }, [error])

  useEffect(() => {
    if (magicLinkSuccess) {
      successRef.current?.focus()
    }
  }, [magicLinkSuccess])

  /** Submits the password login form and surfaces errors without redirect. @source */
  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    const result = await login(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  /** Submits the magic-link form. @source */
  async function handleMagicLink(formData: FormData) {
    setLoading(true)
    setError(null)
    setMagicLinkSuccess(null)

    const result = await loginWithMagicLink(formData)

    if (result?.error) {
      setError(result.error)
    } else if (result?.success) {
      setMagicLinkSuccess(result.success)
    }
    setLoading(false)
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
              Welcome back to your library
            </h2>
            <p className="max-w-sm text-lg leading-relaxed text-white/80">
              Your collection awaits. Pick up right where you left off.
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

      {/* Right: Login form */}
      <main
        id="main-content"
        className="animate-slide-in-right relative z-10 flex flex-1 items-center justify-center px-6 py-12"
      >
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
              Sign in
            </h1>
            <p className="text-muted-foreground mt-2">
              {useMagicLink
                ? "Enter your email to receive a sign-in link"
                : "Enter your credentials to access your collection"}
            </p>
          </div>

          {/* OAuth provider buttons */}
          <div
            className="animate-fade-in-up mb-6"
            style={{ animationDelay: "50ms", animationFillMode: "both" }}
          >
            <OAuthButtons redirectTo={redirectTo} disabled={loading} />
          </div>

          {/* Divider */}
          <div
            className="animate-fade-in-up relative mb-6 flex items-center"
            style={{ animationDelay: "80ms", animationFillMode: "both" }}
          >
            <div className="border-border flex-1 border-t" />
            <span className="text-muted-foreground bg-background mx-3 text-xs tracking-widest uppercase">
              or
            </span>
            <div className="border-border flex-1 border-t" />
          </div>

          {/* Error / success feedback */}
          {error && (
            <div
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
              className="text-destructive focus-visible:ring-ring focus-visible:ring-offset-background bg-destructive/10 mb-5 rounded-xl p-4 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {error}
            </div>
          )}
          {magicLinkSuccess && (
            <output
              ref={successRef}
              tabIndex={-1}
              aria-live="polite"
              aria-atomic="true"
              className="focus-visible:ring-ring focus-visible:ring-offset-background mb-5 block rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-700 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-emerald-400"
            >
              {magicLinkSuccess}
            </output>
          )}

          {useMagicLink ? (
            /* Magic-link form */
            <form action={handleMagicLink} className="space-y-5">
              {redirectTo && (
                <input type="hidden" name="redirectTo" value={redirectTo} />
              )}

              <div
                className="animate-fade-in-up space-y-2"
                style={{ animationDelay: "100ms", animationFillMode: "both" }}
              >
                <Label htmlFor="magic-email" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="magic-email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="h-11 rounded-xl"
                />
              </div>

              <Button
                type="submit"
                className="animate-fade-in-up h-11 w-full rounded-xl text-base font-semibold"
                disabled={loading || !!magicLinkSuccess}
                style={{ animationDelay: "200ms", animationFillMode: "both" }}
              >
                {loading ? "Sending…" : "Send sign-in link"}
              </Button>

              <p
                className="animate-fade-in-up text-center text-sm"
                style={{ animationDelay: "250ms", animationFillMode: "both" }}
              >
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => {
                    setUseMagicLink(false)
                    setError(null)
                    setMagicLinkSuccess(null)
                  }}
                >
                  Sign in with password instead
                </button>
              </p>
            </form>
          ) : (
            /* Password form */
            <form action={handleSubmit} className="space-y-5">
              {redirectTo && (
                <input type="hidden" name="redirectTo" value={redirectTo} />
              )}

              <div
                className="animate-fade-in-up space-y-2"
                style={{ animationDelay: "100ms", animationFillMode: "both" }}
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
                style={{ animationDelay: "200ms", animationFillMode: "both" }}
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
                  autoComplete="current-password"
                  className="h-11 rounded-xl"
                />
              </div>

              <div
                className="animate-fade-in-up flex justify-between"
                style={{ animationDelay: "250ms", animationFillMode: "both" }}
              >
                <button
                  type="button"
                  className="text-muted-foreground text-sm hover:underline"
                  onClick={() => {
                    setUseMagicLink(true)
                    setError(null)
                  }}
                >
                  Sign in with email link
                </button>
                <Link
                  href="/forgot-password"
                  className="text-primary text-sm hover:underline"
                >
                  Forgot your password?
                </Link>
              </div>

              <Button
                type="submit"
                className="animate-fade-in-up h-11 w-full rounded-xl text-base font-semibold"
                disabled={loading}
                style={{ animationDelay: "300ms", animationFillMode: "both" }}
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          )}

          <p className="text-muted-foreground animate-fade-in stagger-4 mt-8 text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-primary font-semibold hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
