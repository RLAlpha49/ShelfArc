import type { RateLimitPreset } from "@/lib/api/protected-route"

/** Centralized rate limit presets for all API routes. */
export const RATE_LIMITS = {
  // Read endpoints
  libraryRead: {
    prefix: "library-read",
    maxHits: 120,
    windowMs: 60_000,
    cooldownMs: 30_000
  },
  analyticsRead: {
    prefix: "analytics-read",
    maxHits: 12,
    windowMs: 60_000,
    cooldownMs: 60_000
  },
  activityRead: {
    prefix: "activity-read",
    maxHits: 60,
    windowMs: 60_000,
    cooldownMs: 30_000
  },

  // Write endpoints
  mutationWrite: {
    prefix: "mutation-write",
    maxHits: 60,
    windowMs: 60_000,
    cooldownMs: 30_000
  },
  alertWrite: {
    prefix: "alert-write",
    maxHits: 30,
    windowMs: 60_000,
    cooldownMs: 60_000
  },
  historyWrite: {
    prefix: "history-write",
    maxHits: 60,
    windowMs: 60_000,
    cooldownMs: 30_000
  },
  uploadWrite: {
    prefix: "upload-write",
    maxHits: 20,
    windowMs: 60_000,
    cooldownMs: 60_000
  },

  // Proxy/external endpoints
  bookSearch: {
    prefix: "book-search",
    maxHits: 30,
    windowMs: 60_000,
    cooldownMs: 30_000
  },
  coverProxy: {
    prefix: "cover-proxy",
    maxHits: 120,
    windowMs: 60_000,
    cooldownMs: 30_000
  },

  // Activity write
  activityWrite: {
    prefix: "activity-write",
    maxHits: 60,
    windowMs: 60_000,
    cooldownMs: 30_000
  },

  suggestRead: {
    prefix: "suggest-read",
    maxHits: 60,
    windowMs: 60_000,
    cooldownMs: 30_000
  },
  exportRead: {
    prefix: "export-read",
    maxHits: 5,
    windowMs: 60_000,
    cooldownMs: 120_000
  },
  storageRead: {
    prefix: "storage-read",
    maxHits: 120,
    windowMs: 60_000,
    cooldownMs: 30_000
  },
  batchScrape: {
    prefix: "batch-scrape",
    maxHits: 3,
    windowMs: 300_000,
    cooldownMs: 300_000
  },
  collectionReset: {
    prefix: "collection-reset",
    maxHits: 3,
    windowMs: 3_600_000,
    cooldownMs: 3_600_000
  },
  importWrite: {
    prefix: "import-write",
    maxHits: 5,
    windowMs: 300_000,
    cooldownMs: 300_000
  }
} as const satisfies Record<string, RateLimitPreset & { prefix: string }>
