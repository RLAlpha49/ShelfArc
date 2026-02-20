export interface ImportEvent {
  id: string
  format: string
  seriesAdded: number
  volumesAdded: number
  errors: number
  importedAt: string
}

export type ImportFormat =
  | "json"
  | "csv-isbn"
  | "csv-shelfarc"
  | "mal"
  | "anilist"
  | "goodreads"
  | "barcode"

export async function logImportEvent(
  format: ImportFormat,
  stats: { seriesAdded: number; volumesAdded: number; errors: number }
): Promise<void> {
  try {
    await fetch("/api/settings/import-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format, ...stats })
    })
  } catch {
    // non-critical: logging failure should not surface to user
  }
}
