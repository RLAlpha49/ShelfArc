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
  type QueryBuilder = {
    eq(column: string, value: unknown): QueryBuilder
    neq(column: string, value: unknown): QueryBuilder
    order(
      column: string,
      options?: {
        ascending?: boolean
        nullsFirst?: boolean
        foreignTable?: string
        referencedTable?: string
      } | null
    ): QueryBuilder
    limit(
      count: number,
      options?: { foreignTable?: string; referencedTable?: string } | null
    ): QueryBuilder
    range(
      from: number,
      to: number
    ): Promise<{
      data: unknown[] | null
      error: { message: string } | null
    }>
    single(): Promise<{
      data: unknown | null
      error: { message: string } | null
    }>
  }

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
        ): Promise<{
          data: { path: string } | null
          error: { message: string } | null
        }>
        remove(paths: string[]): Promise<{ error: { message: string } | null }>
      }
    }
    auth: {
      getUser(token?: string): Promise<{
        data: { user: unknown | null } | null
        error: { message: string } | null
      }>
    }
    rpc<T = unknown, P = Record<string, unknown> | unknown[] | null>(
      fn: string,
      params?: P
    ): Promise<{ data: T | null; error: { message: string } | null }>
    from(table: string): {
      select(columns: string, options?: unknown): QueryBuilder
      insert(values: unknown | unknown[], options?: unknown): QueryBuilder
      update(
        values: Partial<Record<string, unknown>>,
        options?: unknown
      ): QueryBuilder
      delete(filter?: unknown, options?: unknown): QueryBuilder
      upsert(values: unknown | unknown[], options?: unknown): QueryBuilder
    }
  }

  export function createClient(
    url: string,
    key: string,
    options?: unknown
  ): SupabaseClient
}
