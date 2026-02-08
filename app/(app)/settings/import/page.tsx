"use client"

import { useState, useRef } from "react"
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
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import type {
  SeriesWithVolumes,
  SeriesInsert,
  VolumeInsert
} from "@/lib/types/database"

type ImportMode = "merge" | "replace"

interface ImportPreview {
  seriesCount: number
  volumeCount: number
  data: SeriesWithVolumes[]
}

export default function ImportPage() {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<ImportMode>("merge")
  const [isImporting, setIsImporting] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const content = await file.text()

      if (!file.name.endsWith(".json")) {
        throw new TypeError("Please select a JSON file exported from ShelfArc")
      }

      const data = JSON.parse(content) as SeriesWithVolumes[]

      if (!Array.isArray(data)) {
        throw new TypeError("Invalid JSON format: expected an array of series")
      }

      const volumeCount = data.reduce(
        (acc, s) => acc + (s.volumes?.length || 0),
        0
      )

      setPreview({
        seriesCount: data.length,
        volumeCount,
        data
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse file")
      setPreview(null)
    }
  }

  const handleImport = async () => {
    if (!preview) return

    setIsImporting(true)

    try {
      const {
        data: { user }
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const seriesTable = supabase.from("series") as unknown as {
        delete: () => {
          eq: (field: string, value: string) => Promise<{ error: Error | null }>
        }
        insert: (data: SeriesInsert) => {
          select: () => {
            single: () => Promise<{
              data: { id: string } | null
              error: Error | null
            }>
          }
        }
      }

      const volumesTable = supabase.from("volumes") as unknown as {
        delete: () => {
          eq: (field: string, value: string) => Promise<{ error: Error | null }>
        }
        insert: (data: VolumeInsert[]) => Promise<{ error: Error | null }>
      }

      if (mode === "replace") {
        await volumesTable.delete().eq("user_id", user.id)
        await seriesTable.delete().eq("user_id", user.id)
      }

      for (const s of preview.data) {
        const seriesInsert: SeriesInsert = {
          user_id: user.id,
          title: s.title,
          type: s.type,
          original_title: s.original_title,
          description: s.description,
          author: s.author,
          artist: s.artist,
          publisher: s.publisher,
          cover_image_url: s.cover_image_url,
          total_volumes: s.total_volumes,
          status: s.status,
          tags: s.tags || []
        }

        const { data: newSeries, error: seriesError } = await seriesTable
          .insert(seriesInsert)
          .select()
          .single()

        if (seriesError || !newSeries) continue

        if (s.volumes && s.volumes.length > 0) {
          const volumeInserts: VolumeInsert[] = s.volumes.map((v) => ({
            series_id: newSeries.id,
            user_id: user.id,
            volume_number: v.volume_number,
            title: v.title,
            description: v.description,
            isbn: v.isbn,
            cover_image_url: v.cover_image_url,
            ownership_status: v.ownership_status,
            reading_status: v.reading_status,
            current_page: v.current_page,
            page_count: v.page_count,
            rating: v.rating,
            notes: v.notes,
            purchase_date: v.purchase_date,
            purchase_price: v.purchase_price
          }))

          await volumesTable.insert(volumeInserts)
        }
      }

      toast.success(
        `Imported ${preview.seriesCount} series with ${preview.volumeCount} volumes`
      )

      setPreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import data")
    } finally {
      setIsImporting(false)
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
          Import Data
        </h1>
      </div>

      <div className="animate-fade-in-up">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Import Your Library</CardTitle>
            <CardDescription>
              Upload a JSON file exported from ShelfArc to restore your
              collection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="file">Select File</Label>
              <input
                ref={fileInputRef}
                type="file"
                id="file"
                accept=".json"
                onChange={handleFileSelect}
                className="text-muted-foreground file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 block w-full cursor-pointer text-sm file:mr-4 file:rounded-md file:border-0 file:px-4 file:py-2 file:text-sm file:font-medium"
              />
              <p className="text-muted-foreground text-xs">
                Only JSON exports from ShelfArc are supported
              </p>
            </div>

            {preview && (
              <div className="bg-muted/50 rounded-lg border p-4">
                <h3 className="mb-2 font-medium">Preview</h3>
                <p className="text-muted-foreground text-sm">
                  Found{" "}
                  <span className="text-foreground font-medium">
                    {preview.seriesCount}
                  </span>{" "}
                  series with{" "}
                  <span className="text-foreground font-medium">
                    {preview.volumeCount}
                  </span>{" "}
                  volumes
                </p>
              </div>
            )}

            {preview && (
              <div className="space-y-3">
                <Label>Import Mode</Label>
                <RadioGroup
                  value={mode}
                  onValueChange={(value: ImportMode) => setMode(value)}
                  className="space-y-2"
                >
                  <div className="flex items-start space-x-3 rounded-lg border p-4">
                    <RadioGroupItem value="merge" id="merge" className="mt-1" />
                    <div className="space-y-1">
                      <Label
                        htmlFor="merge"
                        className="cursor-pointer font-medium"
                      >
                        Add to Collection
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        Import as new entries. Existing data will not be
                        affected.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 rounded-lg border p-4">
                    <RadioGroupItem
                      value="replace"
                      id="replace"
                      className="mt-1"
                    />
                    <div className="space-y-1">
                      <Label
                        htmlFor="replace"
                        className="text-destructive cursor-pointer font-medium"
                      >
                        Replace Collection
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        Delete all existing data and import fresh. This cannot
                        be undone.
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            )}

            <div className="flex gap-4">
              <Button
                onClick={handleImport}
                disabled={!preview || isImporting}
                className="rounded-xl px-6"
              >
                {isImporting ? "Importing..." : "Import"}
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
