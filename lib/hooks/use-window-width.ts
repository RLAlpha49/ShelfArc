"use client"

import { useEffect, useState } from "react"

/**
 * Tracks the current window innerWidth.
 * @source
 */
export function useWindowWidth() {
  const [width, setWidth] = useState(() => {
    return globalThis.window === undefined ? 0 : globalThis.window.innerWidth
  })

  useEffect(() => {
    const handleResize = () => {
      setWidth(globalThis.window.innerWidth)
    }

    globalThis.addEventListener("resize", handleResize, { passive: true })
    return () => {
      globalThis.removeEventListener("resize", handleResize)
    }
  }, [])

  return width
}
