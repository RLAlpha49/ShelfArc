import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, ActivityEventType, Json } from "@/lib/types/database"

type ActivityPayload = {
  userId: string
  eventType: ActivityEventType
  entityType?: string | null
  entityId?: string | null
  metadata?: Record<string, Json> | null
}

/**
 * Inserts an activity event (best-effort, never throws).
 */
export async function recordActivityEvent(
  supabase: SupabaseClient<Database>,
  payload: ActivityPayload
): Promise<void> {
  try {
    await supabase.from("activity_events").insert({
      user_id: payload.userId,
      event_type: payload.eventType,
      entity_type: payload.entityType ?? null,
      entity_id: payload.entityId ?? null,
      metadata: payload.metadata ?? {}
    })
  } catch {
    // Best effort — never throw from activity recording
  }
}
