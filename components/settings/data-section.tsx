"use client"

import Link from "next/link"

export function DataSection() {
  return (
    <section
      id="data"
      className="animate-fade-in-up scroll-mt-24 py-8"
      style={{ animationDelay: "325ms", animationFillMode: "both" }}
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="bg-primary/8 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4.5 w-4.5"
          >
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v14a9 3 0 0 0 18 0V5" />
            <path d="M3 12a9 3 0 0 0 18 0" />
          </svg>
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Data Management
          </h2>
          <p className="text-muted-foreground text-sm">
            Export or import your library data
          </p>
        </div>
      </div>

      <div className="grid-stagger grid gap-4 sm:grid-cols-2">
        <Link href="/settings/export" className="group">
          <div className="bg-muted/30 hover:bg-accent/60 hover-lift rounded-2xl border p-5 transition-colors">
            <div className="text-primary bg-primary/8 group-hover:bg-primary/12 mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-5 w-5"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <h3 className="font-display mb-1 text-base font-semibold">
              Export Data
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Export your collection as JSON or CSV for backup or migration.
            </p>
          </div>
        </Link>
        <Link href="/settings/import" className="group">
          <div className="bg-muted/30 hover:bg-accent/60 hover-lift rounded-2xl border p-5 transition-colors">
            <div className="text-primary bg-primary/8 group-hover:bg-primary/12 mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-5 w-5"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <h3 className="font-display mb-1 text-base font-semibold">
              Import Data
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Import books from CSV (ISBN list) or restore from a ShelfArc JSON
              backup.
            </p>
          </div>
        </Link>
      </div>
    </section>
  )
}
