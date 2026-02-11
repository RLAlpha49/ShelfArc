/** Ambient Deno runtime namespace for edge functions. @source */
declare const Deno: {
  env: {
    /** Retrieves an environment variable by key. @param key - Environment variable name. @returns The value, or `undefined` if unset. @source */
    get(key: string): string | undefined
  }
}

/** Type declarations for the Deno standard HTTP server module. @source */
declare module "https://deno.land/std@0.224.0/http/server.ts" {
  /**
   * Starts an HTTP server with the given request handler.
   * @param handler - Callback invoked for each incoming request.
   * @source
   */
  export function serve(
    handler: (request: Request) => Response | Promise<Response>
  ): void
}

/** Type declarations for the Supabase JS client used in edge functions. @source */
declare module "https://esm.sh/@supabase/supabase-js@2.49.1" {
  /** Chainable query builder for filtering, ordering, and paginating Supabase queries. @source */
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

  /** Supabase client interface exposing storage, auth, RPC, and table operations. @source */
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

  /**
   * Creates a Supabase client instance.
   * @param url - Supabase project URL.
   * @param key - Supabase API key (anon or service role).
   * @param options - Optional client configuration.
   * @returns A configured Supabase client.
   * @source
   */
  export function createClient(
    url: string,
    key: string,
    options?: unknown
  ): SupabaseClient
}
