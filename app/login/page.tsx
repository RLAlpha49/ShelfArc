"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { login } from "@/app/auth/actions"

/**
 * Login page with email/password form and decorative side panel.
 * @source
 */
export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  /** Submits the login form and surfaces errors without redirect. @source */
  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    const result = await login(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="bg-hero-mesh noise-overlay relative flex min-h-screen">
      {/* Left: Decorative panel */}
      <div className="bg-primary relative hidden w-[45%] overflow-hidden lg:block">
        <div className="from-copper to-gold absolute inset-0 bg-linear-to-br opacity-90" />
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <Link href="/" className="flex items-center gap-3">
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

          <div className="space-y-6">
            <h2 className="font-display text-4xl leading-tight font-bold text-white">
              Welcome back to your library
            </h2>
            <p className="max-w-sm text-lg leading-relaxed text-white/80">
              Your collection awaits. Pick up right where you left off.
            </p>
          </div>

          {/* Decorative book spines */}
          <div className="flex items-end gap-2">
            {[
              { h: "h-32", bg: "bg-white/15" },
              { h: "h-40", bg: "bg-white/10" },
              { h: "h-36", bg: "bg-white/20" },
              { h: "h-28", bg: "bg-white/12" },
              { h: "h-44", bg: "bg-white/8" },
              { h: "h-34", bg: "bg-white/15" },
              { h: "h-38", bg: "bg-white/10" }
            ].map((spine) => (
              <div
                key={spine.h}
                className={`${spine.h} ${spine.bg} w-6 rounded-t-sm backdrop-blur-sm`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-10 lg:hidden">
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

          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold tracking-tight">
              Sign in
            </h1>
            <p className="text-muted-foreground mt-2">
              Enter your credentials to access your collection
            </p>
          </div>

          <form action={handleSubmit} className="space-y-5">
            {error && (
              <div className="text-destructive bg-destructive/10 rounded-xl p-4 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
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

            <div className="space-y-2">
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

            <Button
              type="submit"
              className="h-11 w-full rounded-xl text-base font-semibold"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <p className="text-muted-foreground mt-8 text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-primary font-semibold hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
