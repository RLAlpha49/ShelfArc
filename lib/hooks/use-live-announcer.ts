import { useCallback } from "react"

import { announce } from "@/components/live-announcer"

/**
 * Hook providing the {@link announce} function for screen reader updates.
 * @returns Object with `announce` function.
 * @source
 */
export function useLiveAnnouncer() {
  const announceMessage = useCallback(
    (message: string, priority?: "polite" | "assertive") => {
      announce(message, priority)
    },
    []
  )

  return { announce: announceMessage }
}
