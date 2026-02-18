/** JSON-compatible value type matching Supabase/PostgREST conventions. @source */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

import type { NotificationType } from "@/lib/types/notification"

/** Series classification: light novel, manga, or other. @source */
export type TitleType = "light_novel" | "manga" | "other"
/** Volume ownership status. @source */
export type OwnershipStatus = "owned" | "wishlist"

/** Volume reading progress status. @source */
export type ReadingStatus =
  | "unread"
  | "reading"
  | "completed"
  | "on_hold"
  | "dropped"

/** Physical book orientation for display layout. @source */
export type BookOrientation = "vertical" | "horizontal"

/** Series publication status. @source */
export type SeriesStatus =
  | "ongoing"
  | "completed"
  | "hiatus"
  | "cancelled"
  | "announced"

/** Volume edition variant. @source */
export type VolumeEdition =
  | "standard"
  | "first_edition"
  | "collectors"
  | "omnibus"
  | "box_set"
  | "limited"
  | "deluxe"

/** Volume physical format. @source */
export type VolumeFormat = "paperback" | "hardcover" | "digital" | "audiobook"

/** Activity event type enum values. @source */
export type ActivityEventType =
  | "volume_added"
  | "volume_updated"
  | "volume_deleted"
  | "series_created"
  | "series_updated"
  | "series_deleted"
  | "price_alert_triggered"
  | "import_completed"
  | "scrape_completed"

/** Supabase database schema definition for the public schema. @source */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: number
          email: string
          username: string | null
          avatar_url: string | null
          settings: Record<string, unknown>
          is_public: boolean
          public_bio: string | null
          public_stats: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          user_id?: number
          email: string
          username?: string | null
          avatar_url?: string | null
          settings?: Record<string, unknown>
          is_public?: boolean
          public_bio?: string
          public_stats?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          username?: string | null
          avatar_url?: string | null
          settings?: Record<string, unknown>
          is_public?: boolean
          public_bio?: string
          public_stats?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      series: {
        Row: {
          id: string
          user_id: string
          title: string
          original_title: string | null
          description: string | null
          notes: string | null
          author: string | null
          artist: string | null
          publisher: string | null
          cover_image_url: string | null
          type: TitleType
          total_volumes: number | null
          status: SeriesStatus | null
          tags: string[]
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          original_title?: string | null
          description?: string | null
          notes?: string | null
          author?: string | null
          artist?: string | null
          publisher?: string | null
          cover_image_url?: string | null
          type?: TitleType
          total_volumes?: number | null
          status?: SeriesStatus | null
          tags?: string[]
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          original_title?: string | null
          description?: string | null
          notes?: string | null
          author?: string | null
          artist?: string | null
          publisher?: string | null
          cover_image_url?: string | null
          type?: TitleType
          total_volumes?: number | null
          status?: SeriesStatus | null
          tags?: string[]
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      volumes: {
        Row: {
          id: string
          series_id: string | null
          user_id: string
          volume_number: number
          title: string | null
          description: string | null
          isbn: string | null
          cover_image_url: string | null
          edition: VolumeEdition | null
          format: VolumeFormat | null
          page_count: number | null
          publish_date: string | null
          purchase_date: string | null
          purchase_price: number | null
          purchase_currency: string
          ownership_status: OwnershipStatus
          reading_status: ReadingStatus
          current_page: number | null
          amazon_url: string | null
          rating: number | null
          notes: string | null
          started_at: string | null
          finished_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          series_id?: string | null
          user_id: string
          volume_number: number
          title?: string | null
          description?: string | null
          isbn?: string | null
          cover_image_url?: string | null
          edition?: VolumeEdition | null
          format?: VolumeFormat | null
          page_count?: number | null
          publish_date?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          purchase_currency?: string
          ownership_status?: OwnershipStatus
          reading_status?: ReadingStatus
          current_page?: number | null
          amazon_url?: string | null
          rating?: number | null
          notes?: string | null
          started_at?: string | null
          finished_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          series_id?: string | null
          user_id?: string
          volume_number?: number
          title?: string | null
          description?: string | null
          isbn?: string | null
          cover_image_url?: string | null
          edition?: VolumeEdition | null
          format?: VolumeFormat | null
          page_count?: number | null
          publish_date?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          purchase_currency?: string
          ownership_status?: OwnershipStatus
          reading_status?: ReadingStatus
          current_page?: number | null
          amazon_url?: string | null
          rating?: number | null
          notes?: string | null
          started_at?: string | null
          finished_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "volumes_series_id_fkey"
            columns: ["series_id"]
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volumes_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      tags: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      price_history: {
        Row: {
          id: string
          volume_id: string
          user_id: string
          price: number
          currency: string
          source: string
          product_url: string | null
          scraped_at: string
        }
        Insert: {
          id?: string
          volume_id: string
          user_id: string
          price: number
          currency?: string
          source?: string
          product_url?: string | null
          scraped_at?: string
        }
        Update: {
          id?: string
          volume_id?: string
          user_id?: string
          price?: number
          currency?: string
          source?: string
          product_url?: string | null
          scraped_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_volume_id_fkey"
            columns: ["volume_id"]
            referencedRelation: "volumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      price_alerts: {
        Row: {
          id: string
          volume_id: string
          user_id: string
          target_price: number
          currency: string
          enabled: boolean
          triggered_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          volume_id: string
          user_id: string
          target_price: number
          currency?: string
          enabled?: boolean
          triggered_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          volume_id?: string
          user_id?: string
          target_price?: number
          currency?: string
          enabled?: boolean
          triggered_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_alerts_volume_id_fkey"
            columns: ["volume_id"]
            referencedRelation: "volumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_alerts_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      activity_events: {
        Row: {
          id: string
          user_id: string
          event_type: ActivityEventType
          entity_type: string | null
          entity_id: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          event_type: ActivityEventType
          entity_type?: string | null
          entity_id?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          event_type?: ActivityEventType
          entity_type?: string | null
          entity_id?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: NotificationType
          title: string
          message: string
          read: boolean
          metadata: Record<string, unknown>
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: NotificationType
          title: string
          message: string
          read?: boolean
          metadata?: Record<string, unknown>
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: NotificationType
          title?: string
          message?: string
          read?: boolean
          metadata?: Record<string, unknown>
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      title_type: TitleType
      ownership_status: OwnershipStatus
      reading_status: ReadingStatus
      book_orientation: BookOrientation
      activity_event_type: ActivityEventType
      notification_type: NotificationType
      series_status: SeriesStatus
      volume_edition: VolumeEdition
      volume_format: VolumeFormat
    }
  }
}

/** User profile row type. @source */
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
/** Series row type. @source */
export type Series = Database["public"]["Tables"]["series"]["Row"]
/** Volume row type. @source */
export type Volume = Database["public"]["Tables"]["volumes"]["Row"]
/** Tag row type. @source */
export type Tag = Database["public"]["Tables"]["tags"]["Row"]

/** Series insert payload type. @source */
export type SeriesInsert = Database["public"]["Tables"]["series"]["Insert"]
/** Volume insert payload type. @source */
export type VolumeInsert = Database["public"]["Tables"]["volumes"]["Insert"]

/** A series row joined with its child volumes. @source */
export type SeriesWithVolumes = Series & {
  volumes: Volume[]
}

/** Price history row type. @source */
export type PriceHistory = Database["public"]["Tables"]["price_history"]["Row"]
/** Price history insert payload type. @source */
export type PriceHistoryInsert =
  Database["public"]["Tables"]["price_history"]["Insert"]
/** Price alert row type. @source */
export type PriceAlert = Database["public"]["Tables"]["price_alerts"]["Row"]
/** Price alert insert payload type. @source */
export type PriceAlertInsert =
  Database["public"]["Tables"]["price_alerts"]["Insert"]

/** Activity event row type. @source */
export type ActivityEvent =
  Database["public"]["Tables"]["activity_events"]["Row"]
/** Activity event insert payload type. @source */
export type ActivityEventInsert =
  Database["public"]["Tables"]["activity_events"]["Insert"]

/** Notification row type. @source */
export type DbNotification =
  Database["public"]["Tables"]["notifications"]["Row"]
