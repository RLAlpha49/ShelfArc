export function getPublicProfileUrl(username: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || ""
  return `${base}/u/${encodeURIComponent(username)}`
}

export function getPublicSeriesUrl(username: string, seriesId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || ""
  return `${base}/u/${encodeURIComponent(username)}/${seriesId}`
}
