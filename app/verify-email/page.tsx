"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { resendVerificationEmail } from "@/app/auth/actions"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

function getResendLabel(countdown: number, sending: boolean): string {
  if (countdown > 0) return `Resend available in ${countdown}s`
  if (sending) return "Sending..."
  return "Resend verification email"
}

/**
 * Email verification page shown to users who haven't confirmed their email.
 * @source
 */
export default function VerifyEmailPage() {
  const router = useRouter()
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [resendError, setResendError] = useState<string | null>(null)
  const [resendCountdown, setResendCountdown] = useState(0)

  const supabase = createClient()

  useEffect(() => {
    async function checkVerification() {
      const {
        data: { user }
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace("/login")
        return
      }

      if (user.email_confirmed_at) {
        router.replace("/library")
        return
      }

      setEmail(user.email ?? null)
    }

    checkVerification()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email_confirmed_at) {
        router.replace("/library")
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, router])

  // Countdown timer: tick down 1s at a time using setTimeout
  useEffect(() => {
    if (resendCountdown <= 0) return
    const id = setTimeout(() => {
      setResendCountdown((c) => Math.max(0, c - 1))
    }, 1000)
    return () => clearTimeout(id)
  }, [resendCountdown])

  const handleResend = async () => {
    if (!email || resending || resendCountdown > 0) return
    setResending(true)
    setResendError(null)

    const result = await resendVerificationEmail()

    setResending(false)
    if ("error" in result) {
      setResendError(result.error ?? "Something went wrong. Please try again.")
    } else {
      setResent(true)
      setResendCountdown(60)
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
              Almost there!
            </h2>
            <p className="max-w-sm text-lg leading-relaxed text-white/80">
              One quick step — confirm your email to unlock your personal manga
              and light novel library.
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

      {/* Right: Verify email content */}
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

          <div className="animate-fade-in-up mb-8 text-center">
            <div className="bg-primary/10 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary h-8 w-8"
              >
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>

            <h1 className="font-display mb-2 text-3xl font-bold tracking-tight">
              Verify your email
            </h1>
            <p className="text-muted-foreground">
              {email
                ? `We sent a verification link to ${email}. Please check your inbox and click the link to continue.`
                : "Please check your inbox for a verification link."}
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleResend}
              disabled={resending || resendCountdown > 0}
              variant="outline"
              className="w-full"
            >
              {getResendLabel(resendCountdown, resending)}
            </Button>

            {resent && resendCountdown === 0 && (
              <p className="text-center text-sm text-emerald-600">
                ✓ Email sent! Check your inbox.
              </p>
            )}

            {resendError && (
              <p className="text-destructive text-sm">{resendError}</p>
            )}

            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground block text-center text-sm"
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
