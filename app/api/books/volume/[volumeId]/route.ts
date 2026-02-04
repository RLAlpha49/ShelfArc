import { NextRequest, NextResponse } from "next/server"
import { normalizeGoogleBooksItems } from "@/lib/books/search"

const GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes"

interface RouteContext {
  params: Promise<{
    volumeId: string
  }>
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { volumeId: paramVolumeId } = await params
  const volumeIdFromParams = paramVolumeId.trim()
  const fallbackSegment = request.nextUrl.pathname
    .split("/")
    .findLast((segment) => segment.length > 0)
  const fallbackId = fallbackSegment ? decodeURIComponent(fallbackSegment) : ""
  const volumeId = (volumeIdFromParams || fallbackId).trim()
  if (!volumeId) {
    return NextResponse.json({ error: "Missing volume id" }, { status: 400 })
  }

  const googleApiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim()
  if (!googleApiKey) {
    return NextResponse.json(
      { error: "Google Books API key is not configured" },
      { status: 400 }
    )
  }

  const url = new URL(`${GOOGLE_BOOKS_URL}/${encodeURIComponent(volumeId)}`)
  url.searchParams.set("key", googleApiKey)

  try {
    const response = await fetch(url.toString(), { cache: "no-store" })
    if (!response.ok) {
      const status = response.status === 404 ? 404 : 502
      return NextResponse.json(
        { error: "Google Books volume fetch failed" },
        { status }
      )
    }

    const data = (await response.json()) as unknown
    const result = normalizeGoogleBooksItems([data])[0]
    if (!result) {
      return NextResponse.json(
        { error: "Google Books volume not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ result })
  } catch (error) {
    console.error("Google Books volume fetch failed", error)
    return NextResponse.json(
      { error: "Google Books volume fetch failed" },
      { status: 502 }
    )
  }
}
