"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import * as React from "react"

/** Props forwarded to the next-themes provider. @source */
type ThemeProviderProps = Readonly<
  React.ComponentProps<typeof NextThemesProvider>
>

/**
 * Thin wrapper around next-themes `ThemeProvider`.
 * @param props - {@link ThemeProviderProps}
 * @source
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
