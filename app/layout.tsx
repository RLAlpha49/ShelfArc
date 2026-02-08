import type { Metadata } from "next"
import {
  Playfair_Display,
  Lora,
  Crimson_Text,
  Source_Serif_4,
  Plus_Jakarta_Sans,
  Inter,
  DM_Sans
} from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SettingsApplier } from "@/components/settings-applier"
import { Toaster } from "@/components/ui/sonner"

// Display / heading fonts
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap"
})

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap"
})

const crimsonText = Crimson_Text({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-crimson-text",
  display: "swap"
})

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap"
})

// Body / UI fonts
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap"
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
})

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap"
})

export const metadata: Metadata = {
  title: "ShelfArc — Your Personal Library, Beautifully Organized",
  description:
    "Track, organize, and celebrate your light novel and manga collection with a beautifully crafted personal library manager."
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={[
        playfair.variable,
        lora.variable,
        crimsonText.variable,
        sourceSerif.variable,
        plusJakarta.variable,
        inter.variable,
        dmSans.variable
      ].join(" ")}
      suppressHydrationWarning
    >
      <body className="bg-background min-h-screen font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SettingsApplier />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
