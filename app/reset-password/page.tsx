"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Suspense, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { validatePassword } from "@/lib/auth/validate-password"
import { createClient } from "@/lib/supabase/client"

/**
 * Reset-password page that handles Supabase PASSWORD_RECOVERY redirect.
 * @source
 */
export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  )
}

function ResetPasswordContent() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const errorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (error) {
      errorRef.current?.focus()
    }
  }, [error])

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    const password = formData.get("password") as string
    const confirm = formData.get("confirmPassword") as string

    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      setLoading(false)
      return
    }

    if (password !== confirm) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({
      password
    })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    toast.success("Password updated successfully")
    router.push("/library")
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
              Set a new password
            </h2>
            <p className="max-w-sm text-lg leading-relaxed text-white/80">
              Choose a strong password to keep your collection secure.
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
              New password
            </h1>
            <p className="text-muted-foreground mt-2">
              {ready
                ? "Enter your new password below"
                : "Verifying your reset link\u2026"}
            </p>
          </div>

          {ready ? (
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
                <Label htmlFor="password" className="text-sm font-medium">
                  New password
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  className="h-11 rounded-xl"
                />
              </div>

              <div
                className="animate-fade-in-up space-y-2"
                style={{ animationDelay: "200ms", animationFillMode: "both" }}
              >
                <Label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium"
                >
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
                />
              </div>

              <Button
                type="submit"
                className="animate-fade-in-up h-11 w-full rounded-xl text-base font-semibold"
                disabled={loading}
                style={{ animationDelay: "300ms", animationFillMode: "both" }}
              >
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          ) : (
            <div className="text-muted-foreground space-y-4 text-sm">
              <p>
                If the link has expired or is invalid, you can{" "}
                <Link
                  href="/forgot-password"
                  className="text-primary font-semibold hover:underline"
                >
                  request a new one
                </Link>
                .
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
