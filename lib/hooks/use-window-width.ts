"use client"

import { useEffect, useState } from "react"

export type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl"

function getBreakpoint(width: number): Breakpoint {
  if (width < 640) return "xs"
  if (width < 768) return "sm"
  if (width < 1024) return "md"
  if (width < 1280) return "lg"
  return "xl"
}

/**
 * Tracks the current window breakpoint.
 * @source
 */
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() => {
    return globalThis.window === undefined
      ? "xs"
      : getBreakpoint(globalThis.window.innerWidth)
  })

  useEffect(() => {
    const handleResize = () => {
      const next = getBreakpoint(globalThis.window.innerWidth)
      setBp((prev) => (prev === next ? prev : next))
    }

    globalThis.addEventListener("resize", handleResize, { passive: true })
    return () => {
      globalThis.removeEventListener("resize", handleResize)
    }
  }, [])

  return bp
}
