import { redirect } from "next/navigation"

export default function SeriesRedirectPage({
  params
}: {
  params: { id: string }
}) {
  redirect(`/library/series/${params.id}`)
}
