export type NotificationType =
  | "import_complete"
  | "scrape_complete"
  | "price_alert"
  | "info"

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: number
  read: boolean
  metadata?: Record<string, unknown>
}
