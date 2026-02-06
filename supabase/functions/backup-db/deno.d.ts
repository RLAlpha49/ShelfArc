declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

declare module "https://deno.land/std@0.224.0/http/server.ts" {
  export function serve(
    handler: (request: Request) => Response | Promise<Response>
  ): void
}

declare module "https://esm.sh/@supabase/supabase-js@2.49.1" {
  export type SupabaseClient = {
    storage: {
      from(bucket: string): {
        list(
          path?: string,
          options?: { limit?: number; offset?: number }
        ): Promise<{
          data: { name: string; metadata?: { size?: number } }[] | null
          error: { message: string } | null
        }>
        upload(
          path: string,
          body: Blob | ArrayBuffer | Uint8Array,
          options?: { contentType?: string; upsert?: boolean }
        ): Promise<{ error: { message: string } | null }>
        remove(paths: string[]): Promise<{ error: { message: string } | null }>
      }
    }
    rpc<T = unknown>(
      fn: string
    ): Promise<{ data: T | null; error: { message: string } | null }>
    from(table: string): {
      select(columns: string): {
        range(
          from: number,
          to: number
        ): Promise<{
          data: unknown[] | null
          error: { message: string } | null
        }>
      }
    }
  }

  export function createClient(
    url: string,
    key: string,
    options?: unknown
  ): SupabaseClient
}
