import "./globals.css"

import type { Metadata, Viewport } from "next"
import { Inter, Lora } from "next/font/google"

import { SettingsApplier } from "@/components/settings-applier"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"

/** Lora serif font for headings. @source */
const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
  preload: false
})

/** Inter sans-serif font for body text. @source */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: true
})

/** Global page metadata for ShelfArc. @source */
export const metadata: Metadata = {
  metadataBase: new URL("https://shelfarc.app"),
  title: "ShelfArc — Your Personal Library, Beautifully Organized",
  description:
    "Track, organize, and celebrate your light novel and manga collection with a beautifully crafted personal library manager.",
  openGraph: {
    type: "website",
    url: "https://shelfarc.app",
    siteName: "ShelfArc",
    title: "ShelfArc — Your Personal Library, Beautifully Organized",
    description:
      "Track, organize, and celebrate your light novel and manga collection with a beautifully crafted personal library manager.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ShelfArc — Your Personal Library, Beautifully Organized"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "ShelfArc — Your Personal Library, Beautifully Organized",
    description:
      "Track, organize, and celebrate your light novel and manga collection with a beautifully crafted personal library manager.",
    images: ["/og-image.png"]
  },
  robots: {
    index: true,
    follow: true
  }
}

/** Viewport configuration for responsive display and theme colors. @source */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" }
  ]
}

/**
 * Root HTML layout wrapping all pages with theme provider, global fonts, and toast notifications.
 * @param children - Page content rendered inside the body.
 * @source
 */
export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={[lora.variable, inter.variable].join(" ")}
      data-animations="auto"
      suppressHydrationWarning
    >
      <head>
        {/* Synchronously apply animation setting before hydration to prevent reduced-motion flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var s=JSON.parse(localStorage.getItem('shelfarc-settings')||'{}');var e=s&&s.state&&s.state.enableAnimations;if(e===false){document.documentElement.dataset.animations='disabled';document.documentElement.classList.add('no-animations');}else if(typeof e==='boolean'){document.documentElement.dataset.animations='enabled';}var df=s&&s.state&&s.state.displayFont;var bf=s&&s.state&&s.state.bodyFont;var fonts=[];if(df==='playfair')fonts.push('family=Playfair+Display:ital,wght@0,400..900;1,400..900');else if(df==='crimson-text')fonts.push('family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700');else if(df==='source-serif')fonts.push('family=Source+Serif+4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900');if(bf==='plus-jakarta')fonts.push('family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800');else if(bf==='dm-sans')fonts.push('family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000');if(fonts.length>0){var link=document.createElement('link');link.rel='stylesheet';link.href='https://fonts.googleapis.com/css2?'+fonts.join('&')+'&display=swap';document.head.appendChild(link);}}catch(e){}`
          }}
        />
      </head>
      <body className="bg-background min-h-screen font-sans antialiased">
        <a
          href="#main-content"
          className="focus:bg-background focus:text-foreground focus:ring-primary sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:px-4 focus:py-2 focus:shadow-md focus:ring-2"
        >
          Skip to main content
        </a>
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
