"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useLibrary } from "@/lib/hooks/use-library"
import { toast } from "sonner"

type ExportFormat = "json" | "csv"

export default function ExportPage() {
  const { series, fetchSeries } = useLibrary()
  const [format, setFormat] = useState<ExportFormat>("json")
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)

    try {
      // Ensure data is loaded
      if (series.length === 0) {
        await fetchSeries()
      }

      let content: string
      let filename: string
      let mimeType: string

      if (format === "json") {
        content = JSON.stringify(series, null, 2)
        filename = `shelfarc-export-${new Date().toISOString().split("T")[0]}.json`
        mimeType = "application/json"
      } else {
        // CSV export
        const rows: string[] = []

        // Headers
        rows.push(
          [
            "Series Title",
            "Series Type",
            "Author",
            "Publisher",
            "Volume Number",
            "Volume Title",
            "Volume Description",
            "ISBN",
            "Ownership Status",
            "Reading Status",
            "Current Page",
            "Page Count",
            "Rating",
            "Purchase Date",
            "Purchase Price",
            "Notes"
          ]
            .map((h) => `"${h}"`)
            .join(",")
        )

        // Data rows
        for (const s of series) {
          if (s.volumes.length === 0) {
            // Series with no volumes
            rows.push(
              [
                s.title,
                s.type,
                s.author || "",
                s.publisher || "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                ""
              ]
                .map((v) => `"${String(v).replaceAll('"', '""')}"`)
                .join(",")
            )
          } else {
            // Each volume as a row
            for (const v of s.volumes) {
              rows.push(
                [
                  s.title,
                  s.type,
                  s.author || "",
                  s.publisher || "",
                  v.volume_number,
                  v.title || "",
                  v.description || "",
                  v.isbn || "",
                  v.ownership_status,
                  v.reading_status,
                  v.current_page || "",
                  v.page_count || "",
                  v.rating || "",
                  v.purchase_date || "",
                  v.purchase_price || "",
                  v.notes || ""
                ]
                  .map((val) => `"${String(val).replaceAll('"', '""')}"`)
                  .join(",")
              )
            }
          }
        }

        content = rows.join("\n")
        filename = `shelfarc-export-${new Date().toISOString().split("T")[0]}.csv`
        mimeType = "text/csv"
      }

      // Download file
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      toast.success(`Exported ${series.length} series successfully`)
    } catch {
      toast.error("Failed to export data")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm">
        <Link
          href="/settings"
          className="text-muted-foreground hover:text-foreground"
        >
          Settings
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">Export</span>
      </nav>

      <h1 className="mb-6 text-2xl font-bold">Export Data</h1>

      <Card>
        <CardHeader>
          <CardTitle>Export Your Library</CardTitle>
          <CardDescription>
            Download your entire collection as a file for backup or migration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Export Format</Label>
            <RadioGroup
              value={format}
              onValueChange={(value: ExportFormat) => setFormat(value)}
              className="grid grid-cols-2 gap-4"
            >
              <div className="flex items-start space-x-3 rounded-lg border p-4">
                <RadioGroupItem value="json" id="json" className="mt-1" />
                <div className="space-y-1">
                  <Label htmlFor="json" className="cursor-pointer font-medium">
                    JSON
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    Full data with nested volumes. Best for backup and
                    re-import.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 rounded-lg border p-4">
                <RadioGroupItem value="csv" id="csv" className="mt-1" />
                <div className="space-y-1">
                  <Label htmlFor="csv" className="cursor-pointer font-medium">
                    CSV
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    Flat spreadsheet format. Good for viewing in Excel.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          <div className="flex gap-4">
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? "Exporting..." : "Export"}
            </Button>
            <Link href="/settings">
              <Button variant="outline">Cancel</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
