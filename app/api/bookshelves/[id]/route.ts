import { NextRequest, NextResponse } from "next/server"
import { createUserClient } from "@/lib/supabase/server"
import type { BookshelfUpdate } from "@/lib/types/database"

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

  const updateData: BookshelfUpdate = {}
  if (typeof body.name === "string") {
    const trimmedName = body.name.trim()
    if (!trimmedName) {
      return NextResponse.json(
        { error: "Bookshelf name cannot be empty" },
        { status: 400 }
      )
    }
    updateData.name = trimmedName
  }
  if (body.description !== undefined)
    updateData.description = body.description?.trim() || null
  if (body.row_count !== undefined) updateData.row_count = body.row_count
  if (body.row_height !== undefined) updateData.row_height = body.row_height
  if (body.row_width !== undefined) updateData.row_width = body.row_width
  if (body.shelf_color !== undefined)
    updateData.shelf_color = body.shelf_color?.trim() || null

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

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
