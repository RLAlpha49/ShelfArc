import { ImageResponse } from "next/og"

// eslint-disable-next-line no-restricted-imports -- Admin client required: public OG image needs RLS bypass for unauthenticated visitors
import { createAdminClient } from "@/lib/supabase/admin"

export const alt = "ShelfArc series"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

type Props = {
  readonly params: Promise<{ username: string; seriesId: string }>
}

const TYPE_LABELS: Record<string, string> = {
  manga: "Manga",
  light_novel: "Light Novel",
  other: "Other"
}

const STATUS_LABELS: Record<string, string> = {
  ongoing: "Ongoing",
  completed: "Completed",
  hiatus: "Hiatus",
  cancelled: "Cancelled",
  upcoming: "Upcoming"
}

export default async function SeriesOGImage({ params }: Props) {
  const { username, seriesId } = await params
  const admin = createAdminClient({ reason: "OG image: public series data" })

  const { data: profile } = await admin
    .from("profiles")
    .select("id, username, is_public")
    .ilike("username", username)
    .single()

  if (!profile?.is_public) {
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

  const { data: series } = await admin
    .from("series")
    .select(
      "id, title, original_title, author, cover_image_url, type, status, user_id"
    )
    .eq("id", seriesId)
    .eq("is_public", true)
    .single()

  if (series?.user_id !== profile.id) {
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

  // Fetch owned volume count
  const { count: volumeCount } = await admin
    .from("volumes")
    .select("id", { count: "exact", head: true })
    .eq("series_id", seriesId)
    .neq("ownership_status", "wishlist")

  const displayName = profile.username ?? username
  const coverUrl = series.cover_image_url
  const typeLabel = TYPE_LABELS[series.type] ?? series.type
  const statusLabel = series.status
    ? (STATUS_LABELS[series.status] ?? series.status)
    : null

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "linear-gradient(135deg, #1c1a14 0%, #2a2419 100%)",
        fontFamily: "sans-serif",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Cover image on right */}
      {coverUrl && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            width: 380,
            height: "100%",
            display: "flex"
          }}
        >
          <img
            src={coverUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {/* Gradient overlay so right edge blends into the bg */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to right, #1c1a14 0%, transparent 40%)"
            }}
          />
        </div>
      )}

      {/* Content */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          height: "100%",
          padding: "60px 80px",
          maxWidth: coverUrl ? 780 : "100%"
        }}
      >
        {/* Type + status badges */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <span
            style={{
              background: "rgba(217,119,6,0.25)",
              border: "1px solid rgba(217,119,6,0.5)",
              borderRadius: 999,
              padding: "4px 14px",
              fontSize: 16,
              color: "#fbbf24",
              fontWeight: 600
            }}
          >
            {typeLabel}
          </span>
          {statusLabel && (
            <span
              style={{
                background: "rgba(100,100,100,0.2)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 999,
                padding: "4px 14px",
                fontSize: 16,
                color: "#d6d3d1",
                fontWeight: 500
              }}
            >
              {statusLabel}
            </span>
          )}
        </div>

        {/* Title */}
        <span
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: "#fef3c7",
            lineHeight: 1.15,
            maxWidth: 620,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden"
          }}
        >
          {series.title}
        </span>

        {series.original_title && (
          <span
            style={{
              fontSize: 22,
              color: "#d6b78a",
              marginTop: 8,
              maxWidth: 580,
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis"
            }}
          >
            {series.original_title}
          </span>
        )}

        {series.author && (
          <span
            style={{
              fontSize: 22,
              color: "#a8956e",
              marginTop: 12
            }}
          >
            by {series.author}
          </span>
        )}

        {/* Volume count */}
        {typeof volumeCount === "number" && volumeCount > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 36
            }}
          >
            <div
              style={{
                background: "rgba(217,119,6,0.15)",
                border: "1px solid rgba(217,119,6,0.4)",
                borderRadius: 12,
                padding: "12px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 2
              }}
            >
              <span style={{ fontSize: 36, fontWeight: 800, color: "#fbbf24" }}>
                {volumeCount}
              </span>
              <span style={{ fontSize: 14, color: "#d6b78a" }}>
                {volumeCount === 1 ? "Volume" : "Volumes"}
              </span>
            </div>
          </div>
        )}

        {/* Collector credit */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 80,
            display: "flex",
            gap: 6,
            alignItems: "center"
          }}
        >
          <span style={{ fontSize: 15, color: "#d97706", fontWeight: 600 }}>
            ShelfArc
          </span>
          <span style={{ fontSize: 14, color: "#6b5a3e" }}>
            · {displayName}&rsquo;s collection
          </span>
        </div>
      </div>
    </div>,
    { width: 1200, height: 630 }
  )
}
