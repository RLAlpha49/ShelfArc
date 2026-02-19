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
