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
    <div className="mx-auto max-w-3xl px-6 py-10 lg:px-10">
      {/* Back link + heading */}
      <div className="animate-fade-in mb-8">
        <Link
          href="/settings"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Settings
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Export Data
        </h1>
      </div>

      <div className="animate-fade-in-up">
        <Card className="rounded-2xl">
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
                    <Label
                      htmlFor="json"
                      className="cursor-pointer font-medium"
                    >
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
              <Button
                onClick={handleExport}
                disabled={isExporting}
                className="rounded-xl px-6"
              >
                {isExporting ? "Exporting..." : "Export"}
              </Button>
              <Link
                href="/settings"
                className="text-muted-foreground hover:text-foreground inline-flex h-10 items-center justify-center px-4 text-sm font-medium transition-colors"
              >
                Cancel
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
