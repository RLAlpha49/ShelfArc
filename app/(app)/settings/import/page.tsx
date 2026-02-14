"use client"

import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CsvImport } from "@/components/settings/csv-import"
import { JsonImport } from "@/components/settings/json-import"

/**
 * Import page with tabbed CSV and JSON import workflows.
 * @source
 */
export default function ImportPage() {
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
          <Tabs defaultValue="csv">
            <CardHeader>
              <CardTitle>Import Your Library</CardTitle>
              <CardDescription>
                Import books from a CSV file with ISBNs or restore from a
                ShelfArc JSON backup.
              </CardDescription>
              <TabsList className="mt-3 w-full rounded-xl sm:w-auto">
                <TabsTrigger value="csv" className="rounded-lg">
                  CSV Import
                </TabsTrigger>
                <TabsTrigger value="json" className="rounded-lg">
                  JSON Import
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="csv" className="mt-0">
                <CsvImport />
              </TabsContent>
              <TabsContent value="json" className="mt-0">
                <JsonImport />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}
