// Supabase Edge Function: send-notification-email
// Invoked by the price alert evaluation route when a user has emailNotifications enabled.
// Requires RESEND_API_KEY and SUPABASE_SERVICE_ROLE_KEY environment variables.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts"

/** Generic JSON-serializable record type. @source */
type JsonRecord = Record<string, unknown>

const jsonResponse = (status: number, body: JsonRecord): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  })

const getEnv = (key: string): string | undefined => {
  const val = Deno.env.get(key)
  return val?.trim() || undefined
}

interface PriceAlertPayload {
  userId: string
  seriesTitle: string
  volumeTitle: string
  volumeNumber: number
  currentPrice: number
  targetPrice: number
  currency: string
  isReleaseReminder?: never
}

interface ReleaseReminderPayload {
  userId: string
  seriesTitle: string
  volumeTitle: string | null
  volumeNumber: number
  isReleaseReminder: true
  publishDate: string
  daysUntil: number
}

type EmailPayload = PriceAlertPayload | ReleaseReminderPayload

async function getUserEmail(
  supabaseUrl: string,
  serviceKey: string,
  userId: string
): Promise<string | null> {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey
    }
  })
  if (!res.ok) return null
  const data = (await res.json()) as { email?: string }
  return data.email ?? null
}

interface SendEmailArgs {
  resendKey: string
  to: string
  seriesTitle: string
  volumeTitle: string
  volumeNumber: number
  currentPrice: number
  targetPrice: number
  currency: string
}

async function sendEmail({
  resendKey,
  to,
  seriesTitle,
  volumeTitle,
  volumeNumber,
  currentPrice,
  targetPrice,
  currency
}: SendEmailArgs): Promise<boolean> {
  const formattedCurrent = `${currency} ${currentPrice.toFixed(2)}`
  const formattedTarget = `${currency} ${targetPrice.toFixed(2)}`
  const subject = `Price Alert: ${seriesTitle} Vol. ${volumeNumber} dropped to ${formattedCurrent}`

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h1 style="font-size:20px;font-weight:600;margin-bottom:8px">Price Alert Triggered</h1>
      <p style="color:#555;margin-bottom:16px">
        Good news — a book on your watchlist dropped below your target price!
      </p>
      <div style="background:#f9f9f9;border:1px solid #e5e5e5;border-radius:12px;padding:20px;margin-bottom:16px">
        <p style="margin:0 0 8px;font-weight:600">${seriesTitle}</p>
        <p style="margin:0 0 16px;color:#555">${volumeTitle} (Volume ${volumeNumber})</p>
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:4px 0;color:#555">Current price</td>
            <td style="padding:4px 0;text-align:right;font-weight:600;color:#16a34a">${formattedCurrent}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#555">Your target</td>
            <td style="padding:4px 0;text-align:right">${formattedTarget}</td>
          </tr>
        </table>
      </div>
      <p style="color:#888;font-size:13px">
        You can manage your price alerts and email preferences in ShelfArc Settings → Notifications.
      </p>
    </div>
  `

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`
    },
    body: JSON.stringify({
      from: "ShelfArc <notifications@shelfarc.alpha49.com>",
      to: [to],
      subject,
      html
    })
  })

  return res.ok
}

interface SendReleaseReminderEmailArgs {
  resendKey: string
  to: string
  seriesTitle: string
  volumeTitle: string | null
  volumeNumber: number
  publishDate: string
  daysUntil: number
}

async function sendReleaseReminderEmail({
  resendKey,
  to,
  seriesTitle,
  volumeTitle,
  volumeNumber,
  publishDate,
  daysUntil
}: SendReleaseReminderEmailArgs): Promise<boolean> {
  const displayTitle = volumeTitle ?? `Volume ${volumeNumber}`
  let dayLabel: string
  if (daysUntil <= 0) {
    dayLabel = "today"
  } else if (daysUntil === 1) {
    dayLabel = "tomorrow"
  } else {
    dayLabel = `in ${daysUntil} days`
  }
  const subject = `Release Reminder: ${seriesTitle} Vol. ${volumeNumber} releases ${dayLabel}`

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h1 style="font-size:20px;font-weight:600;margin-bottom:8px">Upcoming Release</h1>
      <p style="color:#555;margin-bottom:16px">
        A book on your wishlist is releasing ${dayLabel}!
      </p>
      <div style="background:#f9f9f9;border:1px solid #e5e5e5;border-radius:12px;padding:20px;margin-bottom:16px">
        <p style="margin:0 0 8px;font-weight:600">${seriesTitle}</p>
        <p style="margin:0 0 16px;color:#555">${displayTitle} (Volume ${volumeNumber})</p>
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:4px 0;color:#555">Release date</td>
            <td style="padding:4px 0;text-align:right;font-weight:600">${publishDate}</td>
          </tr>
        </table>
      </div>
      <p style="color:#888;font-size:13px">
        You can manage your release reminders and email preferences in ShelfArc Settings → Notifications.
      </p>
    </div>
  `

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`
    },
    body: JSON.stringify({
      from: "ShelfArc <notifications@shelfarc.alpha49.com>",
      to: [to],
      subject,
      html
    })
  })

  return res.ok
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" })
  }

  const supabaseUrl = getEnv("SUPABASE_URL")
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY")
  const resendKey = getEnv("RESEND_API_KEY")

  if (!supabaseUrl || !serviceKey || !resendKey) {
    return jsonResponse(500, {
      error: "Missing required environment variables"
    })
  }

  let payload: EmailPayload
  try {
    payload = (await req.json()) as EmailPayload
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" })
  }

  const { userId, seriesTitle } = payload

  if (!userId || !seriesTitle) {
    return jsonResponse(400, { error: "Missing required fields" })
  }

  const email = await getUserEmail(supabaseUrl, serviceKey, userId)
  if (!email) {
    return jsonResponse(404, { error: "User email not found" })
  }

  let sent: boolean
  if (payload.isReleaseReminder) {
    const { volumeTitle, volumeNumber, publishDate, daysUntil } = payload
    sent = await sendReleaseReminderEmail({
      resendKey,
      to: email,
      seriesTitle,
      volumeTitle,
      volumeNumber,
      publishDate,
      daysUntil
    })
  } else {
    const { volumeTitle, volumeNumber, currentPrice, targetPrice, currency } =
      payload
    sent = await sendEmail({
      resendKey,
      to: email,
      seriesTitle,
      volumeTitle: volumeTitle ?? `Volume ${volumeNumber}`,
      volumeNumber,
      currentPrice,
      targetPrice,
      currency
    })
  }

  if (!sent) {
    return jsonResponse(502, { error: "Email delivery failed" })
  }

  return jsonResponse(200, { ok: true })
})
