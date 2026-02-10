import { NextRequest, NextResponse } from "next/server"
import { createUserClient } from "@/lib/supabase/server"
import { isValidBookOrientation } from "@/lib/validation"
import type {
  ShelfItem,
  ShelfItemInsert,
  ShelfItemUpdate,
  ShelfItemWithVolume
} from "@/lib/types/database"

function validateShelfItemInput(
  item: Partial<ShelfItemInsert>,
  index: number
): string | null {
  if (!item.volume_id) return `items[${index}].volume_id is required`
  if (item.row_index === undefined)
    return `items[${index}].row_index is required`
  if (item.position_x === undefined)
    return `items[${index}].position_x is required`
  if (
    typeof item.row_index !== "number" ||
    !Number.isInteger(item.row_index) ||
    item.row_index < 0
  ) {
    return `items[${index}].row_index must be a non-negative integer`
  }
  if (
    typeof item.position_x !== "number" ||
    !Number.isFinite(item.position_x) ||
    item.position_x < 0
  ) {
    return `items[${index}].position_x must be a non-negative number`
  }
  if (
    item.orientation !== undefined &&
    !isValidBookOrientation(item.orientation)
  ) {
    return `items[${index}].orientation must be 'vertical' or 'horizontal'`
  }
  if (
    item.z_index !== undefined &&
    (typeof item.z_index !== "number" ||
      !Number.isInteger(item.z_index) ||
      item.z_index < 0)
  ) {
    return `items[${index}].z_index must be a non-negative integer`
  }
  return null
}

function validateShelfItemUpdate(
  update: ShelfItemUpdate,
  index: number
): string | null {
  if (
    update.row_index !== undefined &&
    (typeof update.row_index !== "number" ||
      !Number.isInteger(update.row_index) ||
      update.row_index < 0)
  ) {
    return `updates[${index}].row_index must be a non-negative integer`
  }
  if (
    update.position_x !== undefined &&
    (typeof update.position_x !== "number" ||
      !Number.isFinite(update.position_x) ||
      update.position_x < 0)
  ) {
    return `updates[${index}].position_x must be a non-negative number`
  }
  if (
    update.orientation !== undefined &&
    !isValidBookOrientation(update.orientation)
  ) {
    return `updates[${index}].orientation must be 'vertical' or 'horizontal'`
  }
  if (
    update.z_index !== undefined &&
    (typeof update.z_index !== "number" ||
      !Number.isInteger(update.z_index) ||
      update.z_index < 0)
  ) {
    return `updates[${index}].z_index must be a non-negative integer`
  }
  return null
}

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const supabase = await createUserClient()
  const { id: bookshelfId } = await params

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: items, error } = await supabase
    .from("shelf_items")
    .select(
      `
      *,
      volume:volumes(*, series:series(*))
    `
    )
    .eq("bookshelf_id", bookshelfId)
    .eq("user_id", user.id)
    .order("row_index", { ascending: true })
    .order("position_x", { ascending: true })

  if (error) {
    console.error("Failed to fetch shelf items:", error)
    return NextResponse.json(
      { error: "Failed to fetch shelf items" },
      { status: 500 }
    )
  }

  return NextResponse.json({ items })
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const supabase = await createUserClient()
  const { id: bookshelfId } = await params

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: ownedBookshelf, error: ownershipError } = await supabase
    .from("bookshelves")
    .select("id")
    .eq("id", bookshelfId)
    .eq("user_id", user.id)
    .limit(1)

  if (ownershipError) {
    console.error("Failed to verify bookshelf ownership:", ownershipError)
    return NextResponse.json(
      { error: "Failed to verify bookshelf ownership" },
      { status: 500 }
    )
  }

  if (!ownedBookshelf || ownedBookshelf.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: Partial<ShelfItemInsert> | Partial<ShelfItemInsert>[]
  try {
    body = (await request.json()) as
      | Partial<ShelfItemInsert>
      | Partial<ShelfItemInsert>[]
  } catch {
    return NextResponse.json(
      { error: "Malformed JSON in request body" },
      { status: 400 }
    )
  }

  // Handle single or batch insert
  const items = Array.isArray(body) ? body : [body]

  // Validate all items
  for (let i = 0; i < items.length; i += 1) {
    const validationError = validateShelfItemInput(items[i], i)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }
  }

  const insertData: ShelfItemInsert[] = items.map((item) => ({
    bookshelf_id: bookshelfId,
    volume_id: item.volume_id!,
    user_id: user.id,
    row_index: item.row_index!,
    position_x: item.position_x!,
    orientation: item.orientation ?? "vertical",
    z_index: item.z_index ?? 0
  }))

  const { data: insertedItems, error } = await supabase
    .from("shelf_items")
    .insert(insertData)
    .select(
      `
      *,
      volume:volumes(*, series:series(*))
    `
    )

  if (error) {
    if (error.code === "23505") {
      // Unique constraint violation - volume already on shelf
      return NextResponse.json(
        { error: "One or more volumes are already on this shelf" },
        { status: 409 }
      )
    }
    console.error("Failed to add shelf items:", error)
    return NextResponse.json(
      { error: "Failed to add items to shelf" },
      { status: 500 }
    )
  }

  const typedInsertedItems: ShelfItemWithVolume[] = insertedItems ?? []

  return NextResponse.json({
    items: typedInsertedItems
  })
}

// Batch update positions (for drag-and-drop efficiency)
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const supabase = await createUserClient()
  const { id: bookshelfId } = await params

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { updates: Array<{ id: string } & ShelfItemUpdate> }
  try {
    body = (await request.json()) as {
      updates: Array<{ id: string } & ShelfItemUpdate>
    }
  } catch {
    return NextResponse.json(
      { error: "Malformed JSON in request body" },
      { status: 400 }
    )
  }

  if (
    !body.updates ||
    !Array.isArray(body.updates) ||
    body.updates.length === 0
  ) {
    return NextResponse.json(
      { error: "updates array is required" },
      { status: 400 }
    )
  }

  for (let i = 0; i < body.updates.length; i += 1) {
    const validationError = validateShelfItemUpdate(body.updates[i], i)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }
  }

  const updatesWithPayload = body.updates.map(({ id, ...updateData }) => {
    const updatePayload = Object.fromEntries(
      Object.entries({
        row_index: updateData.row_index,
        position_x: updateData.position_x,
        orientation: updateData.orientation,
        z_index: updateData.z_index
      }).filter(([, value]) => value !== undefined)
    ) as ShelfItemUpdate

    return { id, updatePayload }
  })

  const emptyUpdate = updatesWithPayload.find(
    ({ updatePayload }) => Object.keys(updatePayload).length === 0
  )
  if (emptyUpdate) {
    return NextResponse.json(
      { error: "no updatable fields provided", itemId: emptyUpdate.id },
      { status: 400 }
    )
  }

  const updateIds = updatesWithPayload.map(({ id }) => id)
  const { data: previousItems, error: previousError } = await supabase
    .from("shelf_items")
    .select("id, row_index, position_x, orientation, z_index")
    .in("id", updateIds)
    .eq("bookshelf_id", bookshelfId)
    .eq("user_id", user.id)

  if (previousError) {
    console.error("Failed to fetch existing shelf items:", previousError)
    return NextResponse.json(
      { error: "Failed to update shelf items" },
      { status: 500 }
    )
  }

  const previousItemsById = new Map(
    (previousItems ?? []).map((item) => [item.id, item])
  )

  // Perform updates with rollback on partial failure
  const results = await Promise.all(
    updatesWithPayload.map(async ({ id, updatePayload }) => {
      const { data, error } = await supabase
        .from("shelf_items")
        .update(updatePayload)
        .eq("id", id)
        .eq("bookshelf_id", bookshelfId)
        .eq("user_id", user.id)
        .select(
          `
          *,
          volume:volumes(*, series:series(*))
        `
        )
        .single()

      return { id, data, error }
    })
  )

  const errors = results.filter((r) => r.error)
  if (errors.length > 0) {
    const successfulIds = results
      .filter((r) => !r.error && r.data)
      .map((r) => r.data!.id)
    const rollbackTargets = successfulIds
      .map((id) => {
        const previous = previousItemsById.get(id)
        if (!previous) return null
        return { id, previous }
      })
      .filter(
        (
          target
        ): target is {
          id: string
          previous: Pick<
            ShelfItem,
            "id" | "row_index" | "position_x" | "orientation" | "z_index"
          >
        } => Boolean(target)
      )

    if (rollbackTargets.length > 0) {
      const rollbackResults = await Promise.allSettled(
        rollbackTargets.map(async ({ id, previous }) => {
          const { error: rollbackError } = await supabase
            .from("shelf_items")
            .update({
              row_index: previous.row_index,
              position_x: previous.position_x,
              orientation: previous.orientation,
              z_index: previous.z_index
            })
            .eq("id", id)
            .eq("bookshelf_id", bookshelfId)
            .eq("user_id", user.id)

          if (rollbackError) {
            throw rollbackError
          }
        })
      )

      const rollbackFailures = rollbackResults
        .map((result, index) => ({
          result,
          target: rollbackTargets[index]
        }))
        .filter(({ result }) => result.status === "rejected")

      if (rollbackFailures.length > 0) {
        rollbackFailures.forEach(({ result, target }) => {
          console.error("Failed to rollback shelf item update:", {
            bookshelfId,
            userId: user.id,
            itemId: target.id,
            error: result.status === "rejected" ? result.reason : null
          })
        })
        console.error("Rollback failed for one or more shelf items.")
        return NextResponse.json(
          {
            error:
              "Failed to update some items; rollback failed for one or more items"
          },
          { status: 500 }
        )
      }
    }

    console.error("Failed to update some shelf items:", errors)
    return NextResponse.json(
      { error: "Failed to update some items; changes were rolled back" },
      { status: 500 }
    )
  }

  return NextResponse.json({
    items: results.map((r) => r.data)
  })
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const supabase = await createUserClient()
  const { id: bookshelfId } = await params

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const itemId = searchParams.get("itemId")
  const volumeId = searchParams.get("volumeId")

  if (!itemId && !volumeId) {
    return NextResponse.json(
      { error: "Either itemId or volumeId is required" },
      { status: 400 }
    )
  }

  let query = supabase
    .from("shelf_items")
    .delete()
    .eq("bookshelf_id", bookshelfId)
    .eq("user_id", user.id)

  if (itemId) {
    query = query.eq("id", itemId)
  } else if (volumeId) {
    query = query.eq("volume_id", volumeId)
  }

  const { data, error } = await query.select("id")

  if (error) {
    console.error("Failed to remove shelf item:", error)
    return NextResponse.json(
      { error: "Failed to remove item from shelf" },
      { status: 500 }
    )
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Shelf item not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
