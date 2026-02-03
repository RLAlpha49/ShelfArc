import type { NextConfig } from "next"

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
