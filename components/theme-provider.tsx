"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

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
