import { z } from "zod"

import {
  sanitizeOptionalHtml,
  sanitizeOptionalPlainText,
  sanitizePlainText
} from "@/lib/sanitize-html"

import {
  BOOK_ORIENTATIONS,
  OWNERSHIP_STATUSES,
  READING_STATUSES,
  SERIES_STATUSES,
  TITLE_TYPES,
  VOLUME_EDITIONS,
  VOLUME_FORMATS
} from "../validation"

export const CreateSeriesSchema = z
  .object({
    title: z
      .string()
      .min(1)
      .max(500)
      .transform((v) => sanitizePlainText(v, 500)),
    original_title: z
      .string()
      .max(500)
      .optional()
      .nullable()
      .transform((v) => sanitizeOptionalPlainText(v, 500)),
    description: z
      .string()
      .optional()
      .nullable()
      .transform((v) => sanitizeOptionalHtml(v)),
    author: z
      .string()
      .max(1000)
      .optional()
      .nullable()
      .transform((v) => sanitizeOptionalPlainText(v, 1000)),
    artist: z
      .string()
      .max(1000)
      .optional()
      .nullable()
      .transform((v) => sanitizeOptionalPlainText(v, 1000)),
    publisher: z
      .string()
      .max(1000)
      .optional()
      .nullable()
      .transform((v) => sanitizeOptionalPlainText(v, 1000)),
    notes: z
      .string()
      .max(5000)
      .optional()
      .nullable()
      .transform((v) => sanitizeOptionalPlainText(v, 5000)),
    type: z.enum(TITLE_TYPES as [string, ...string[]]).default("other"),
    tags: z
      .array(z.string().max(100))
      .max(20)
      .optional()
      .default([])
      .transform((tags) =>
        tags.map((t) => sanitizePlainText(t, 100)).filter(Boolean)
      ),
    total_volumes: z.number().int().positive().optional().nullable(),
    cover_image_url: z
      .string()
      .max(2000)
      .optional()
      .nullable()
      .transform((v) => sanitizeOptionalPlainText(v, 2000)),
    status: z
      .enum(SERIES_STATUSES as [string, ...string[]])
      .optional()
      .nullable()
  })
  .strip()

export const UpdateSeriesSchema = CreateSeriesSchema.partial().strip()

export const CreateVolumeSchema = z
  .object({
    series_id: z.string().uuid().optional().nullable(),
    volume_number: z.number().int().nonnegative(),
    title: z
      .string()
      .max(500)
      .optional()
      .nullable()
      .transform((v) => sanitizeOptionalPlainText(v, 500)),
    original_title: z
      .string()
      .max(500)
      .optional()
      .nullable()
      .transform((v) => sanitizeOptionalPlainText(v, 500)),
    isbn: z
      .string()
      .max(20)
      .optional()
      .nullable()
      .transform((v) => sanitizeOptionalPlainText(v, 20)),
    release_date: z.string().optional().nullable(), // YYYY-MM-DD
    cover_image_url: z
      .string()
      .max(2000)
      .optional()
      .nullable()
      .transform((v) => sanitizeOptionalPlainText(v, 2000)),
    format: z
      .enum(VOLUME_FORMATS as [string, ...string[]])
      .optional()
      .nullable(),
    edition: z
      .enum(VOLUME_EDITIONS as [string, ...string[]])
      .optional()
      .nullable(),
    page_count: z.number().int().positive().optional().nullable(),
    book_orientation: z
      .enum(BOOK_ORIENTATIONS as [string, ...string[]])
      .optional()
      .nullable(),
    ownership_status: z
      .enum(OWNERSHIP_STATUSES as [string, ...string[]])
      .default("owned"),
    reading_status: z
      .enum(READING_STATUSES as [string, ...string[]])
      .default("unread"),
    rating: z.number().int().min(0).max(10).optional().nullable(),
    purchase_price: z.number().nonnegative().optional().nullable(),
    purchase_currency: z.string().length(3).optional().nullable(),
    purchase_date: z.string().optional().nullable(), // YYYY-MM-DD
    store_url: z
      .string()
      .max(2000)
      .optional()
      .nullable()
      .transform((v) => sanitizeOptionalPlainText(v, 2000)),
    notes: z
      .string()
      .max(5000)
      .optional()
      .nullable()
      .transform((v) => sanitizeOptionalPlainText(v, 5000))
  })
  .strip()
  .transform((data) => {
    if (data.purchase_price != null && !data.purchase_currency) {
      data.purchase_currency = "USD"
    }
    return data
  })

export const UpdateVolumeSchema = z
  .object({
    series_id: z.string().uuid().optional().nullable(),
    volume_number: z.number().int().nonnegative().optional(),
    title: z
      .string()
      .max(500)
      .optional()
      .nullable()
      .transform((v) => sanitizeOptionalPlainText(v, 500)),
    original_title: z
      .string()
      .max(500)
      .optional()
      .nullable()
      .transform((v) => sanitizeOptionalPlainText(v, 500)),
    isbn: z
      .string()
      .max(20)
      .optional()
      .nullable()
      .transform((v) => sanitizeOptionalPlainText(v, 20)),
    release_date: z.string().optional().nullable(), // YYYY-MM-DD
    cover_image_url: z
      .string()
      .max(2000)
      .optional()
      .nullable()
      .transform((v) => sanitizeOptionalPlainText(v, 2000)),
    format: z
      .enum(VOLUME_FORMATS as [string, ...string[]])
      .optional()
      .nullable(),
    edition: z
      .enum(VOLUME_EDITIONS as [string, ...string[]])
      .optional()
      .nullable(),
    page_count: z.number().int().positive().optional().nullable(),
    book_orientation: z
      .enum(BOOK_ORIENTATIONS as [string, ...string[]])
      .optional()
      .nullable(),
    ownership_status: z
      .enum(OWNERSHIP_STATUSES as [string, ...string[]])
      .optional(),
    reading_status: z
      .enum(READING_STATUSES as [string, ...string[]])
      .optional(),
    rating: z.number().int().min(0).max(10).optional().nullable(),
    purchase_price: z.number().nonnegative().optional().nullable(),
    purchase_currency: z.string().length(3).optional().nullable(),
    purchase_date: z.string().optional().nullable(), // YYYY-MM-DD
    store_url: z
      .string()
      .max(2000)
      .optional()
      .nullable()
      .transform((v) => sanitizeOptionalPlainText(v, 2000)),
    notes: z
      .string()
      .max(5000)
      .optional()
      .nullable()
      .transform((v) => sanitizeOptionalPlainText(v, 5000))
  })
  .strip()
  .transform((data) => {
    if (data.purchase_price != null && !data.purchase_currency) {
      data.purchase_currency = "USD"
    }
    return data
  })

export const BatchUpdateVolumesSchema = z
  .object({
    volume_ids: z.array(z.string().uuid()).min(1).max(100),
    updates: UpdateVolumeSchema
  })
  .strip()

export const CreateCollectionSchema = z
  .object({
    id: z.string().refine((val) => {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          val
        )
      const isSystemId = /^[a-z][a-z0-9_-]{0,49}$/.test(val)
      return isUuid || isSystemId
    }, "Invalid collection ID format"),
    name: z
      .string()
      .min(1)
      .max(100)
      .transform((v) => sanitizePlainText(v, 100)),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{3,8}$/, "Invalid color format")
      .optional()
      .nullable(),
    isSystem: z.boolean().optional().default(false),
    sortOrder: z.number().int().optional().default(0),
    createdAt: z.string().optional().nullable()
  })
  .strip()

export const UpdateCollectionSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(100)
      .transform((v) => sanitizePlainText(v, 100))
      .optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{3,8}$/, "Invalid color format")
      .optional(),
    sort_order: z.number().int().optional()
  })
  .strip()

export const CollectionVolumesSchema = z
  .object({
    volumeIds: z.array(z.string().uuid()).min(1).max(100)
  })
  .strip()

export const SortCollectionsSchema = z.array(
  z
    .object({
      id: z.string().uuid("Invalid collection ID"),
      sort_order: z.number().int()
    })
    .strip()
)

export const BatchScrapeSchema = z
  .object({
    volumeIds: z.array(z.string().uuid()).min(1).max(10),
    mode: z.enum(["price", "image", "both"]),
    skipExisting: z.boolean().optional().default(false),
    domain: z.string().optional().default("amazon.com"),
    binding: z.string().optional().default("Paperback")
  })
  .strip()

export const ALLOWED_SETTINGS_KEYS = [
  "showReadingProgress",
  "showSeriesProgressBar",
  "cardSize",
  "confirmBeforeDelete",
  "defaultOwnershipStatus",
  "defaultSearchSource",
  "defaultScrapeMode",
  "autoPurchaseDate",
  "sidebarCollapsed",
  "enableAnimations",
  "displayFont",
  "bodyFont",
  "dateFormat",
  "highContrastMode",
  "fontSizeScale",
  "focusIndicators",
  "automatedPriceChecks",
  "releaseReminders",
  "releaseReminderDays",
  "notifyOnImportComplete",
  "notifyOnScrapeComplete",
  "notifyOnPriceAlert",
  "emailNotifications",
  "defaultSortBy",
  "defaultSortDir",
  "hasCompletedOnboarding",
  "navigationMode",
  "dashboardLayout",
  "readingGoal",
  "lastSyncedAt"
] as const

export const SettingsSchema = z
  .object({
    settings: z.record(z.enum(ALLOWED_SETTINGS_KEYS), z.unknown())
  })
  .strip()

export const ProfileSchema = z
  .object({
    username: z
      .string()
      .max(20)
      .transform((v) => sanitizePlainText(v, 20))
      .optional()
      .nullable(),
    publicBio: z
      .string()
      .max(500)
      .transform((v) => sanitizePlainText(v, 500))
      .optional()
      .nullable(),
    isPublic: z.boolean().optional(),
    publicStats: z.boolean().optional(),
    avatarUrl: z.string().optional().nullable()
  })
  .strip()

export const PriceAlertSchema = z
  .object({
    volumeId: z.string().uuid("Invalid volume ID"),
    targetPrice: z.number().positive(),
    currency: z.string().length(3).toUpperCase().optional().default("USD"),
    enabled: z.boolean().optional()
  })
  .strip()

export const UpdatePriceAlertSchema = z
  .object({
    id: z.string().uuid("Invalid alert ID"),
    snooze_days: z
      .union([z.literal(7), z.literal(30), z.literal(0), z.null()])
      .optional()
  })
  .strip()

export const PriceHistorySchema = z
  .object({
    volumeId: z.string().uuid("Invalid volume ID"),
    price: z.number().positive(),
    currency: z.string().length(3).toUpperCase().optional().default("USD"),
    source: z
      .enum(["amazon", "manual", "imported"])
      .optional()
      .default("amazon"),
    productUrl: z
      .string()
      .url()
      .regex(
        /^https?:\/\/(?:www\.)?amazon\.[a-z.]{2,6}\//i,
        "Must be a valid Amazon URL"
      )
      .optional()
      .nullable()
  })
  .strip()

export const NotificationSchema = z
  .object({
    type: z.enum([
      "import_complete",
      "scrape_complete",
      "price_alert",
      "release_reminder",
      "info"
    ]),
    title: z
      .string()
      .min(1)
      .max(200)
      .transform((v) => sanitizePlainText(v, 200)),
    message: z
      .string()
      .min(1)
      .max(2000)
      .transform((v) => sanitizePlainText(v, 2000)),
    metadata: z.record(z.string(), z.unknown()).optional().default({})
  })
  .strip()

export const UpdateNotificationSchema = z
  .object({
    read: z.boolean()
  })
  .strip()

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(1, "New password is required")
  })
  .strip()

export const ImportEventSchema = z
  .object({
    format: z.enum([
      "json",
      "csv-isbn",
      "csv-shelfarc",
      "mal",
      "anilist",
      "goodreads",
      "barcode"
    ]),
    seriesAdded: z.number().int().nonnegative().optional().default(0),
    volumesAdded: z.number().int().nonnegative().optional().default(0),
    errors: z.number().int().nonnegative().optional().default(0)
  })
  .strip()

export const ExportSchema = z
  .object({
    format: z.enum(["json", "csv"]),
    scope: z.enum(["all", "selected"]),
    ids: z
      .array(z.string().uuid("All IDs must be valid UUIDs."))
      .max(500, "Maximum 500 series IDs allowed")
      .optional()
  })
  .strip()
  .superRefine((data, ctx) => {
    if (data.scope === "selected") {
      if (!data.ids || data.ids.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selected scope requires a non-empty 'ids' array of strings",
          path: ["ids"]
        })
      }
    }
  })

export const DeleteAccountSchema = z
  .object({
    confirmText: z.literal("DELETE", {
      message: 'You must type "DELETE" to confirm'
    }),
    // Optional: required only for users with email/password auth; omitted for OAuth-only accounts.
    password: z.string().optional()
  })
  .strip()

export const AutomationSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(200)
      .transform((v) => sanitizePlainText(v, 200)),
    trigger_type: z.enum([
      "price_drop",
      "new_volume",
      "release_date",
      "status_change"
    ]),
    conditions: z.record(z.string(), z.unknown()).optional().default({}),
    actions: z.record(z.string(), z.unknown()).optional().default({}),
    enabled: z.boolean().optional().default(true)
  })
  .strip()

export const UpdateAutomationSchema = AutomationSchema.partial().strip()
