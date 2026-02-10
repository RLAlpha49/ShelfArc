import { NextRequest, NextResponse } from "next/server"
import { createUserClient } from "@/lib/supabase/server"
import { sanitizeOptionalPlainText } from "@/lib/sanitize-html"
import { HEX_COLOR_PATTERN } from "@/lib/validation"
import type { BookshelfUpdate } from "@/lib/types/database"

function isIntegerInRange(value: unknown, min: number, max: number): boolean {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  )
}

function validateBookshelfName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return "Bookshelf name cannot be empty"
  if (trimmed.length > 200)
    return "Bookshelf name must be 200 characters or fewer"
  return null
}

function validateHexColor(color: string | null | undefined): string | null {
  const trimmed = color?.trim() || null
  if (trimmed && !HEX_COLOR_PATTERN.test(trimmed)) {
    return "shelf_color must be a valid hex color"
  }
  return null
}

function validateDimensionFields(
  body: BookshelfUpdate,
  updateData: BookshelfUpdate
): string | null {
  if (body.row_count !== undefined) {
    if (!isIntegerInRange(body.row_count, 1, 10))
      return "row_count must be an integer between 1 and 10"
    updateData.row_count = body.row_count
  }
  if (body.row_height !== undefined) {
    if (!isIntegerInRange(body.row_height, 50, 2000))
      return "row_height must be an integer between 50 and 2000"
    updateData.row_height = body.row_height
  }
  if (body.row_width !== undefined) {
    if (!isIntegerInRange(body.row_width, 100, 4000))
      return "row_width must be an integer between 100 and 4000"
    updateData.row_width = body.row_width
  }
  return null
}

function validateBookshelfUpdate(
  body: BookshelfUpdate
): { data: BookshelfUpdate } | { error: string } {
  const updateData: BookshelfUpdate = {}

  if (typeof body.name === "string") {
    const nameError = validateBookshelfName(body.name)
    if (nameError) return { error: nameError }
    updateData.name = body.name.trim()
  }

  if (body.description !== undefined) {
    updateData.description = sanitizeOptionalPlainText(body.description, 2000)
  }

  const dimensionError = validateDimensionFields(body, updateData)
  if (dimensionError) return { error: dimensionError }

  if (body.shelf_color !== undefined) {
    const colorError = validateHexColor(body.shelf_color)
    if (colorError) return { error: colorError }
    updateData.shelf_color = body.shelf_color?.trim() || null
  }

  if (Object.keys(updateData).length === 0) {
    return { error: "No fields to update" }
  }

  return { data: updateData }
}

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const supabase = await createUserClient()
  const { id } = await params

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: bookshelf, error } = await supabase
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
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Bookshelf not found" },
        { status: 404 }
      )
    }
    console.error("Failed to fetch bookshelf:", error)
    return NextResponse.json(
      { error: "Failed to fetch bookshelf" },
      { status: 500 }
    )
  }

  return NextResponse.json({ bookshelf })
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const supabase = await createUserClient()
  const { id } = await params

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: BookshelfUpdate
  try {
    body = (await request.json()) as BookshelfUpdate
  } catch {
    return NextResponse.json(
      { error: "Malformed JSON in request body" },
      { status: 400 }
    )
  }

  const result = validateBookshelfUpdate(body)
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  const updateData = result.data

  const { data: bookshelf, error } = await supabase
    .from("bookshelves")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(
      `
      *,
      items:shelf_items(
        *,
        volume:volumes(*, series:series(*))
      )
    `
    )
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Bookshelf not found" },
        { status: 404 }
      )
    }
    console.error("Failed to update bookshelf:", error)
    return NextResponse.json(
      { error: "Failed to update bookshelf" },
      { status: 500 }
    )
  }

  return NextResponse.json({ bookshelf })
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const supabase = await createUserClient()
  const { id } = await params

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("bookshelves")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")

  if (error) {
    console.error("Failed to delete bookshelf:", error)
    return NextResponse.json(
      { error: "Failed to delete bookshelf" },
      { status: 500 }
    )
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Bookshelf not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
