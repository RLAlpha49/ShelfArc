"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"

/**
 * Email verification page shown to users who haven't confirmed their email.
 * @source
 */
export default function VerifyEmailPage() {
  const router = useRouter()
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [email, setEmail] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )

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

  const handleResend = async () => {
    if (!email || resending) return
    setResending(true)

    const { error } = await supabase.auth.resend({
      type: "signup",
      email
    })

    setResending(false)
    if (!error) {
      setResent(true)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
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

        <h1 className="font-display mb-2 text-2xl font-bold">
          Verify your email
        </h1>
        <p className="text-muted-foreground mb-6">
          {email
            ? `We sent a verification link to ${email}. Please check your inbox and click the link to continue.`
            : "Please check your inbox for a verification link."}
        </p>

        <div className="space-y-3">
          <Button
            onClick={handleResend}
            disabled={resending || resent}
            variant="outline"
            className="w-full"
          >
            {resent
              ? "Email sent! Check your inbox"
              : resending
                ? "Sending..."
                : "Resend verification email"}
          </Button>

          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground block text-sm"
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  )
}
