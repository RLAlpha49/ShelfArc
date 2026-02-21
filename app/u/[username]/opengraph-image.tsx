import { ImageResponse } from "next/og"

// eslint-disable-next-line no-restricted-imports -- Admin client required: public OG image needs RLS bypass for unauthenticated visitors
import { createAdminClient } from "@/lib/supabase/admin"

export const alt = "ShelfArc public collection"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

type Props = {
  readonly params: Promise<{ username: string }>
}

export default async function ProfileOGImage({ params }: Props) {
  const { username } = await params
  const admin = createAdminClient({ reason: "OG image: public profile stats" })

  const { data: profile } = await admin
    .from("profiles")
    .select("id, username, public_bio, public_stats, is_public")
    .ilike("username", username)
    .single()

  if (!profile?.is_public) {
    // Return a generic brand card when the profile is private / missing
    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1c1a14 0%, #2a2419 100%)"
        }}
      >
        <span style={{ fontSize: 56, fontWeight: 700, color: "#d97706" }}>
          ShelfArc
        </span>
      </div>,
      { width: 1200, height: 630 }
    )
  }

  const displayName = profile.username ?? username

  // Aggregate series + volume stats
  let totalSeries = 0
  let totalVolumes = 0

  const { data: seriesData } = await admin
    .from("series")
    .select("id")
    .eq("user_id", profile.id)
    .eq("is_public", true)

  if (seriesData) {
    totalSeries = seriesData.length
    const seriesIds = seriesData.map((s) => s.id)
    if (seriesIds.length > 0) {
      const { count } = await admin
        .from("volumes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .in("series_id", seriesIds)
        .eq("ownership_status", "owned")
      totalVolumes = count ?? 0
    }
  }

  // Fetch up to 6 cover URLs for a cover collage background
  const { data: coverRows } = await admin
    .from("series")
    .select("cover_image_url")
    .eq("user_id", profile.id)
    .eq("is_public", true)
    .not("cover_image_url", "is", null)
    .limit(6)

  const covers = (coverRows ?? [])
    .map((r) => r.cover_image_url)
    .filter(Boolean) as string[]

  const initial = displayName.charAt(0).toUpperCase()

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #1c1a14 0%, #2a2419 100%)",
        fontFamily: "sans-serif",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Cover mosaic background (decorative) */}
      {covers.length > 0 && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            height: "100%",
            width: 360,
            display: "flex",
            flexWrap: "wrap",
            opacity: 0.25,
            overflow: "hidden"
          }}
        >
          {covers.map((url) => (
            <img
              key={url}
              src={url}
              alt=""
              style={{
                width: 120,
                height: 180,
                objectFit: "cover",
                flexShrink: 0
              }}
            />
          ))}
        </div>
      )}

      {/* Dark overlay gradient to keep text readable */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to right, #1c1a14 55%, transparent 100%)"
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          height: "100%",
          padding: "60px 80px"
        }}
      >
        {/* Avatar + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              background: "#92400e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontWeight: 700,
              color: "#fef3c7",
              flexShrink: 0,
              border: "3px solid #d97706"
            }}
          >
            {initial}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 48, fontWeight: 800, color: "#fef3c7" }}>
              {displayName}
            </span>
            {profile.public_bio && (
              <span
                style={{
                  fontSize: 20,
                  color: "#d6b78a",
                  maxWidth: 520,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis"
                }}
              >
                {profile.public_bio}
              </span>
            )}
          </div>
        </div>

        {/* Stats row */}
        {profile.public_stats && (
          <div style={{ display: "flex", gap: 24, marginTop: 48 }}>
            <div
              style={{
                background: "rgba(217,119,6,0.15)",
                border: "1px solid rgba(217,119,6,0.4)",
                borderRadius: 16,
                padding: "16px 28px",
                display: "flex",
                flexDirection: "column",
                gap: 4
              }}
            >
              <span style={{ fontSize: 40, fontWeight: 800, color: "#fbbf24" }}>
                {totalSeries}
              </span>
              <span style={{ fontSize: 16, color: "#d6b78a" }}>Series</span>
            </div>
            <div
              style={{
                background: "rgba(217,119,6,0.15)",
                border: "1px solid rgba(217,119,6,0.4)",
                borderRadius: 16,
                padding: "16px 28px",
                display: "flex",
                flexDirection: "column",
                gap: 4
              }}
            >
              <span style={{ fontSize: 40, fontWeight: 800, color: "#fbbf24" }}>
                {totalVolumes}
              </span>
              <span style={{ fontSize: 16, color: "#d6b78a" }}>Volumes</span>
            </div>
          </div>
        )}

        {/* Branding */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 80,
            display: "flex",
            alignItems: "center",
            gap: 8
          }}
        >
          <span style={{ fontSize: 16, color: "#d97706", fontWeight: 600 }}>
            ShelfArc
          </span>
          <span style={{ fontSize: 14, color: "#6b5a3e" }}>
            · Track your manga &amp; light novels
          </span>
        </div>
      </div>
    </div>,
    { width: 1200, height: 630 }
  )
}
