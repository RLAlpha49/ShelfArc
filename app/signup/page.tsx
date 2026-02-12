"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signup } from "@/app/auth/actions"

/**
 * Signup page with email/password/display-name form and decorative side panel.
 * @source
 */
export default function SignupPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const errorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (error) {
      errorRef.current?.focus()
    }
  }, [error])

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
              />
              <p className="text-muted-foreground text-xs">
                3-20 characters. Letters, numbers, and underscores only.
              </p>
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
                minLength={6}
                autoComplete="new-password"
                className="h-11 rounded-xl"
              />
              <p className="text-muted-foreground text-xs">
                Must be at least 6 characters
              </p>
            </div>

            <Button
              type="submit"
              className="animate-fade-in-up h-11 w-full rounded-xl text-base font-semibold"
              disabled={loading}
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
