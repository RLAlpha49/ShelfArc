import { redirect } from "next/navigation"

/**
 * Legacy route that redirects `/library/[id]` to `/library/series/[id]`.
 * @param params - Route params containing the series ID.
 * @source
 */
export default async function SeriesRedirectPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/library/series/${id}`)
}
