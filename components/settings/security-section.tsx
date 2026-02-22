"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  checkPasswordStrength,
  validatePassword
} from "@/lib/auth/validate-password"
import { createClient } from "@/lib/supabase/client"

interface SessionInfo {
  id: string
  created_at: string
  last_active_at: string | null
  is_current: boolean
}

function formatSessionDate(iso: string | null | undefined): string {
  if (!iso) return "Unknown"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "Unknown"
  const diffSeconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (diffSeconds < 60) return "just now"
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  })
}

export function SecuritySection() {
  const supabase = createClient()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [mfaEnrolling, setMfaEnrolling] = useState(false)
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null)
  const [mfaSecret, setMfaSecret] = useState<string | null>(null)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [mfaVerifyCode, setMfaVerifyCode] = useState("")
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [mfaUnenrolling, setMfaUnenrolling] = useState(false)
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(
    null
  )

  useEffect(() => {
    async function checkMfaStatus() {
      const { data: mfaFactors } = await supabase.auth.mfa.listFactors()
      const totpFactor = mfaFactors?.totp?.find((f) => f.status === "verified")
      setMfaEnabled(!!totpFactor)
    }
    void checkMfaStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    async function loadSessions() {
      try {
        const res = await fetch("/api/account/sessions")
        if (res.ok) {
          const data = (await res.json()) as SessionInfo[]
          setSessions(data)
        }
      } catch {
        // ignore — sessions list is best-effort
      } finally {
        setSessionsLoading(false)
      }
    }
    void loadSessions()
  }, [])

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    const passwordError = validatePassword(newPassword)
    if (passwordError) {
      toast.error(passwordError)
      return
    }

    const strengthError = checkPasswordStrength(newPassword)
    if (strengthError) {
      toast.error(strengthError)
      return
    }

    setIsChangingPassword(true)
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword })
      })

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          error?: string
        }
        toast.error(json.error ?? "Failed to change password")
        return
      }

      toast.success("Password changed successfully")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch {
      toast.error("Failed to change password")
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleEnrollMfa = async () => {
    setMfaEnrolling(true)
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "ShelfArc Authenticator"
      })
      if (error) {
        toast.error(error.message)
        return
      }
      setMfaQrCode(data.totp.qr_code)
      setMfaSecret(data.totp.secret)
      setMfaFactorId(data.id)
    } catch {
      toast.error("Failed to set up 2FA")
    } finally {
      setMfaEnrolling(false)
    }
  }

  const handleVerifyMfa = async () => {
    if (!mfaFactorId) return
    try {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: mfaFactorId })
      if (challengeError) {
        toast.error(challengeError.message)
        return
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaVerifyCode
      })
      if (verifyError) {
        toast.error("Invalid verification code")
        return
      }

      setMfaEnabled(true)
      setMfaQrCode(null)
      setMfaSecret(null)
      setMfaFactorId(null)
      setMfaVerifyCode("")
      toast.success("Two-factor authentication enabled")
    } catch {
      toast.error("Failed to verify 2FA code")
    }
  }

  const handleUnenrollMfa = async () => {
    setMfaUnenrolling(true)
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totpFactor = factors?.totp?.find((f) => f.status === "verified")
      if (!totpFactor) {
        toast.error("No 2FA factor found")
        return
      }

      const { error } = await supabase.auth.mfa.unenroll({
        factorId: totpFactor.id
      })
      if (error) {
        toast.error(error.message)
        return
      }

      setMfaEnabled(false)
      toast.success("Two-factor authentication disabled")
    } catch {
      toast.error("Failed to disable 2FA")
    } finally {
      setMfaUnenrolling(false)
    }
  }

  const handleSignOutOtherSessions = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" })
      if (error) {
        toast.error(error.message)
        return
      }
      setSessions((prev) => prev.filter((s) => s.is_current))
      toast.success("Other sessions signed out")
    } catch {
      toast.error("Failed to sign out other sessions")
    }
  }

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId)
    try {
      const res = await fetch(`/api/account/sessions/${sessionId}`, {
        method: "DELETE"
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(json.error ?? "Failed to revoke session")
        return
      }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      toast.success("Session revoked")
    } catch {
      toast.error("Failed to revoke session")
    } finally {
      setRevokingSessionId(null)
    }
  }

  return (
    <section
      id="security"
      className="animate-fade-in-up scroll-mt-24 border-t py-8"
      style={{ animationDelay: "300ms", animationFillMode: "both" }}
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="bg-primary/8 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4.5 w-4.5"
          >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Security
          </h2>
          <p className="text-muted-foreground text-sm">
            Manage your password and two-factor authentication
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Password Change */}
        <div className="bg-muted/30 rounded-2xl border p-5">
          <h3 className="font-display mb-4 text-base font-semibold">
            Change Password
          </h3>
          <div className="max-w-sm space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="current-password" className="text-sm">
                Current Password
              </Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-sm">
                New Password
              </Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="rounded-xl"
              />
              <p className="text-muted-foreground text-xs">
                Minimum 8 characters with uppercase, lowercase, and a number
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-sm">
                Confirm New Password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="rounded-xl"
              />
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={
                isChangingPassword ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword
              }
              className="rounded-xl"
            >
              {isChangingPassword ? "Changing..." : "Change Password"}
            </Button>
          </div>
        </div>

        {/* Two-Factor Authentication */}
        <div className="bg-muted/30 rounded-2xl border p-5">
          <h3 className="font-display mb-2 text-base font-semibold">
            Two-Factor Authentication
          </h3>
          <p className="text-muted-foreground mb-4 text-sm">
            Add an extra layer of security with a TOTP authenticator app.
          </p>
          {mfaEnabled && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  Two-factor authentication is enabled
                </span>
              </div>
              <Button
                variant="destructive"
                onClick={handleUnenrollMfa}
                disabled={mfaUnenrolling}
                className="rounded-xl"
              >
                {mfaUnenrolling ? "Disabling..." : "Disable 2FA"}
              </Button>
            </div>
          )}
          {!mfaEnabled && mfaQrCode && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm">
                  Scan this QR code with your authenticator app:
                </p>
                <img
                  src={mfaQrCode}
                  alt="MFA QR Code"
                  className="h-48 w-48 rounded-xl border"
                />
                {mfaSecret && (
                  <p className="text-muted-foreground text-xs">
                    Manual entry:{" "}
                    <code className="bg-muted rounded px-1.5 py-0.5 text-xs select-all">
                      {mfaSecret}
                    </code>
                  </p>
                )}
              </div>
              <div className="max-w-50 space-y-2">
                <Label htmlFor="mfa-code" className="text-sm">
                  Verification Code
                </Label>
                <Input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={mfaVerifyCode}
                  onChange={(e) =>
                    setMfaVerifyCode(
                      e.target.value.replaceAll(/\D/g, "").slice(0, 6)
                    )
                  }
                  className="rounded-xl"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleVerifyMfa}
                  disabled={mfaVerifyCode.length !== 6}
                  className="rounded-xl"
                >
                  Verify & Enable
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setMfaQrCode(null)
                    setMfaSecret(null)
                    setMfaFactorId(null)
                    setMfaVerifyCode("")
                  }}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {!mfaEnabled && !mfaQrCode && (
            <Button
              onClick={handleEnrollMfa}
              disabled={mfaEnrolling}
              className="rounded-xl"
            >
              {mfaEnrolling ? "Setting up..." : "Enable 2FA"}
            </Button>
          )}
        </div>

        {/* Active Sessions */}
        <div className="bg-muted/30 rounded-2xl border p-5">
          <h3 className="font-display mb-2 text-base font-semibold">
            Active Sessions
          </h3>
          <p className="text-muted-foreground mb-4 text-sm">
            Manage your active sessions. Revoke any session you don&apos;t
            recognise.
          </p>

          {sessionsLoading && (
            <div className="mb-4 space-y-2">
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
            </div>
          )}
          {!sessionsLoading && sessions.length === 0 && (
            <p className="text-muted-foreground mb-4 text-sm">
              No active sessions found.
            </p>
          )}
          {!sessionsLoading && sessions.length > 0 && (
            <ul className="mb-4 space-y-2">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-mono text-xs">
                        {session.id.slice(-8).toUpperCase()}
                      </span>
                      {session.is_current && (
                        <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Started {formatSessionDate(session.created_at)}
                      {session.last_active_at &&
                        session.last_active_at !== session.created_at && (
                          <>
                            {" "}
                            &middot; Active{" "}
                            {formatSessionDate(session.last_active_at)}
                          </>
                        )}
                    </p>
                  </div>
                  {!session.is_current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleRevokeSession(session.id)}
                      disabled={revokingSessionId === session.id}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0 rounded-lg"
                    >
                      {revokingSessionId === session.id
                        ? "Revoking…"
                        : "Revoke"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <Button
            variant="outline"
            onClick={handleSignOutOtherSessions}
            className="rounded-xl"
          >
            Sign out all other sessions
          </Button>
        </div>
      </div>
    </section>
  )
}
