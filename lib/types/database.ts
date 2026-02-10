export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type TitleType = "light_novel" | "manga" | "other"
export type OwnershipStatus = "owned" | "wishlist"

export type ReadingStatus =
  | "unread"
  | "reading"
  | "completed"
  | "on_hold"
  | "dropped"

export type BookOrientation = "vertical" | "horizontal"

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          display_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          avatar_url?: string | null
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
          status: string | null
          tags: string[]
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
          status?: string | null
          tags?: string[]
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
          status?: string | null
          tags?: string[]
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
          edition: string | null
          format: string | null
          page_count: number | null
          publish_date: string | null
          purchase_date: string | null
          purchase_price: number | null
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
          edition?: string | null
          format?: string | null
          page_count?: number | null
          publish_date?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
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
          edition?: string | null
          format?: string | null
          page_count?: number | null
          publish_date?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
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
    }
  }
}

// Convenience types for use in the app
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type Series = Database["public"]["Tables"]["series"]["Row"]
export type Volume = Database["public"]["Tables"]["volumes"]["Row"]
export type Tag = Database["public"]["Tables"]["tags"]["Row"]

export type SeriesInsert = Database["public"]["Tables"]["series"]["Insert"]
export type VolumeInsert = Database["public"]["Tables"]["volumes"]["Insert"]

export type SeriesWithVolumes = Series & {
  volumes: Volume[]
}
