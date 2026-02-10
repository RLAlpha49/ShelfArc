import { NextRequest, NextResponse } from "next/server"
import { createUserClient } from "@/lib/supabase/server"
import { sanitizeOptionalPlainText } from "@/lib/sanitize-html"
import { HEX_COLOR_PATTERN } from "@/lib/validation"
import type { Bookshelf, BookshelfInsert } from "@/lib/types/database"

export async function GET() {
  const supabase = await createUserClient()

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Fetch bookshelves with their items and volume data
  const { data: bookshelves, error } = await supabase
    .from("bookshelves")
    .select(
      `
      *,
      items:shelf_items(
        *,
        volume:volumes(*, series:series(*))
      )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .order("row_index", { ascending: true, referencedTable: "shelf_items" })
    .order("position_x", { ascending: true, referencedTable: "shelf_items" })

  if (error) {
    console.error("Failed to fetch bookshelves:", error)
    return NextResponse.json(
      { error: "Failed to fetch bookshelves" },
      { status: 500 }
    )
  }

  return NextResponse.json({ bookshelves })
}

export async function POST(request: NextRequest) {
  const supabase = await createUserClient()

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: Partial<BookshelfInsert>
  try {
    body = (await request.json()) as Partial<BookshelfInsert>
  } catch {
    return NextResponse.json(
      { error: "Malformed JSON in request body" },
      { status: 400 }
    )
  }

  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: "Bookshelf name is required" },
      { status: 400 }
    )
  }

  if (body.name.trim().length > 200) {
    return NextResponse.json(
      { error: "Bookshelf name must be 200 characters or fewer" },
      { status: 400 }
    )
  }

  const shelfColor = body.shelf_color?.trim() || null
  if (shelfColor && !HEX_COLOR_PATTERN.test(shelfColor)) {
    return NextResponse.json(
      { error: "shelf_color must be a valid hex color" },
      { status: 400 }
    )
  }

  const rowCount = body.row_count ?? 3
  if (
    typeof rowCount !== "number" ||
    !Number.isInteger(rowCount) ||
    rowCount < 1 ||
    rowCount > 10
  ) {
    return NextResponse.json(
      { error: "row_count must be an integer between 1 and 10" },
      { status: 400 }
    )
  }

  const rowHeight = body.row_height ?? 200
  if (
    typeof rowHeight !== "number" ||
    !Number.isInteger(rowHeight) ||
    rowHeight < 50 ||
    rowHeight > 2000
  ) {
    return NextResponse.json(
      { error: "row_height must be an integer between 50 and 2000" },
      { status: 400 }
    )
  }

  const rowWidth = body.row_width ?? 800
  if (
    typeof rowWidth !== "number" ||
    !Number.isInteger(rowWidth) ||
    rowWidth < 100 ||
    rowWidth > 4000
  ) {
    return NextResponse.json(
      { error: "row_width must be an integer between 100 and 4000" },
      { status: 400 }
    )
  }

  const bookshelfData: BookshelfInsert = {
    user_id: user.id,
    name: body.name.trim(),
    description: sanitizeOptionalPlainText(body.description, 2000),
    row_count: rowCount,
    row_height: rowHeight,
    row_width: rowWidth,
    shelf_color: shelfColor
  }

  const { data: bookshelf, error } = await supabase
    .from("bookshelves")
    .insert(bookshelfData)
    .select()
    .single()

  if (error) {
    console.error("Failed to create bookshelf:", error)
    return NextResponse.json(
      { error: "Failed to create bookshelf" },
      { status: 500 }
    )
  }

  // Return with empty items array
  return NextResponse.json({
    bookshelf: { ...(bookshelf as Bookshelf), items: [] }
  })
}
