import { NextRequest, NextResponse } from "next/server"
import { normalizeGoogleBooksItems } from "@/lib/books/search"
import { getGoogleBooksApiKeys } from "@/lib/books/google-books-keys"

const GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes"

const resolveGoogleBooksStatus = (response: Response) => {
  if (response.status === 404) return 404
  if (response.status === 429) return 429
  return 502
}

const fetchGoogleBooksVolumeResponse = async (
  volumeId: string,
  apiKeys: string[]
): Promise<Response | undefined> => {
  for (let attempt = 0; attempt < apiKeys.length; attempt += 1) {
    const apiKey = apiKeys[attempt]
    const url = new URL(`${GOOGLE_BOOKS_URL}/${encodeURIComponent(volumeId)}`)
    url.searchParams.set("key", apiKey)
    const response = await fetch(url.toString(), { cache: "no-store" })

    if (response.status === 429 && apiKeys.length > 1 && attempt < apiKeys.length - 1) {
      continue
    }

    return response
  }

  return undefined
}

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

  const googleApiKeys = getGoogleBooksApiKeys()
  if (googleApiKeys.length === 0) {
    return NextResponse.json(
      { error: "Google Books API key is not configured" },
      { status: 400 }
    )
  }

  try {
    const response = await fetchGoogleBooksVolumeResponse(
      volumeId,
      googleApiKeys
    )

    if (!response) {
      return NextResponse.json(
        { error: "Google Books volume fetch failed" },
        { status: 502 }
      )
    }

    if (!response.ok) {
      const status = resolveGoogleBooksStatus(response)
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
