import type { NextConfig } from "next"

/** Next.js configuration with allowed remote image domains for Google Books and Open Library covers. @source */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "books.google.com",
        pathname: "/**"
      },
      {
        protocol: "https",
        hostname: "covers.openlibrary.org",
        pathname: "/**"
      }
    ]
  }
}

export default nextConfig
