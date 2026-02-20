"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ALLOWED_REDIRECT_PREFIXES } from "@/lib/auth/constants"
import { createClient } from "@/lib/supabase/client"

function getSafeRedirect(raw: string | null): string {
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

export default function MfaChallengePage() {
  return (
    <Suspense>
      <MfaChallengeContent />
    </Suspense>
  )
}

function MfaChallengeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = getSafeRedirect(searchParams.get("redirectTo"))
  const supabase = createClient()

  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const errorRef = useRef<HTMLDivElement | null>(null)

  const handleVerify = async () => {
    if (code.length !== 6) return
    setLoading(true)
    setError(null)

    try {
      const { data: factors, error: factorsError } =
        await supabase.auth.mfa.listFactors()
      if (factorsError || !factors?.totp?.length) {
        setError("No MFA factor found. Please contact support.")
        return
      }

      const totpFactor = factors.totp.find((f) => f.status === "verified")
      if (!totpFactor) {
        setError("No verified MFA factor found.")
        return
      }

      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: totpFactor.id })
      if (challengeError) {
        setError(challengeError.message)
        return
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code
      })

      if (verifyError) {
        setError("Invalid verification code. Please try again.")
        return
      }

      router.push(redirectTo)
      router.refresh()
    } catch {
      setError("Verification failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Two-Factor Authentication
          </h1>
          <p className="text-muted-foreground text-sm">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>

        {error && (
          <div
            ref={errorRef}
            role="alert"
            aria-live="assertive"
            className="text-destructive bg-destructive/10 rounded-xl p-4 text-sm"
          >
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="mfa-code">Verification Code</Label>
            <Input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replaceAll(/\D/g, "").slice(0, 6))
              }
              autoComplete="one-time-code"
              className="rounded-xl text-center text-lg tracking-widest"
            />
          </div>

          <Button
            onClick={handleVerify}
            disabled={code.length !== 6 || loading}
            className="w-full rounded-xl"
          >
            {loading ? "Verifying..." : "Verify"}
          </Button>
        </div>
      </div>
    </div>
  )
}
