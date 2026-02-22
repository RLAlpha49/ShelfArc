import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/settings",
          "/library",
          "/activity",
          "/auth",
          "/api"
        ]
      }
    ],
    sitemap: "https://shelfarc.app/sitemap.xml"
  }
}
