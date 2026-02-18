"use client"

import { useEffect, useState } from "react"

const THROTTLE_MS = 100

/**
 * Tracks the current window innerWidth (throttled at 100 ms).
 * @source
 */
export function useWindowWidth() {
  const [width, setWidth] = useState(() => {
    return globalThis.window === undefined ? 0 : globalThis.window.innerWidth
  })

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const handleResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setWidth(globalThis.window.innerWidth)
      }, THROTTLE_MS)
    }

    globalThis.addEventListener("resize", handleResize, { passive: true })
    return () => {
      globalThis.removeEventListener("resize", handleResize)
      clearTimeout(timeoutId)
    }
  }, [])

  return width
}
