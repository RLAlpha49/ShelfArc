import { redirect } from "next/navigation"

/**
 * Legacy route that redirects `/library/[id]` to `/library/series/[id]`.
 * @param params - Route params containing the series ID.
 * @source
 */
export default function SeriesRedirectPage({
  params
}: {
  params: { id: string }
}) {
  redirect(`/library/series/${params.id}`)
}
