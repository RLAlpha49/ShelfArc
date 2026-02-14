# Component Hierarchy

## Layout tree (Server vs Client)

```
app/layout.tsx [SERVER]
├── ThemeProvider [CLIENT] — next-themes, attribute="class"
│   ├── SettingsApplier [CLIENT] — applies font/animation prefs from settings-store
│   ├── {children} — route content (see below)
│   └── Toaster [CLIENT] — sonner toast notifications
│
├── /login, /signup pages [SERVER pages, no AppShell]
│
└── app/(app)/layout.tsx [SERVER] — authenticated route group
    └── fetches user via createUserClient().auth.getUser()
        └── AppShell [CLIENT] — receives user prop
            ├── Header [CLIENT] — logo, nav items, avatar, theme toggle
            │   ├── NotificationBell [CLIENT]
            │   └── ThemeToggle [CLIENT]
            ├── SidebarNav [CLIENT] — collapsible sidebar navigation
            ├── CommandPalette [CLIENT] — ⌘K global search/actions
            ├── OnboardingDialog [CLIENT] — first-use onboarding flow
            ├── NotificationCenter [CLIENT] — notification panel
            └── <main>{children}</main> — page content
```

## Page components (all Client Components)

```
/dashboard → DashboardPage [CLIENT]
├── DashboardContent [CLIENT] — stats, quick links
├── CollectionHealthCard [CLIENT] — collection health score
└── RecentlyAdded [CLIENT] — recent volumes grid

/library → LibraryPage [CLIENT]
├── LibraryToolbar [CLIENT] — search, sort, view mode, add buttons
│   ├── FilterPresetsControl [CLIENT] — saved filter management
│   └── TagFilterControl [CLIENT] — multi-tag filter
├── VolumeSelectionBar [CLIENT] — bulk actions when items selected
├── VirtualizedWindow [CLIENT] — windowed rendering for perf
│   ├── SeriesCard / SeriesListItem [CLIENT] — per collection-view
│   ├── VolumeCard / VolumeGridItem / VolumeListItem [CLIENT]
│   └── EmptyState [CLIENT]
├── lazy(SeriesDialog) [CLIENT] — create/edit series
├── lazy(VolumeDialog) [CLIENT] — create/edit volume
├── lazy(BookSearchDialog) [CLIENT] — Google Books / OpenLibrary search
├── lazy(BulkScrapeDialog) [CLIENT] — batch metadata fetch
├── lazy(DuplicateMergeDialog) [CLIENT] — merge duplicate volumes
└── lazy(AssignToSeriesDialog) [CLIENT] — assign volumes to series

/library/series/[id] → SeriesDetailPage [CLIENT]
├── SeriesHeaderSection [CLIENT] — cover, metadata, actions
├── SeriesVolumesSection [CLIENT] — volumes grid within series
├── SeriesInsightsPanel [CLIENT] — reading/spending analytics
├── PriceHistoryCard [CLIENT] — price trend chart
├── PriceAlertsDashboardCard [CLIENT] — active alerts
├── RecommendationsCard [CLIENT] — similar series suggestions
├── lazy(SeriesDialog) — edit series
├── lazy(VolumeDialog) — add/edit volume
├── lazy(BookSearchDialog) — search & add volumes
└── lazy(BulkScrapeDialog) — batch scrape volumes

/library/volume/[id] → VolumeDetailPage [CLIENT]
├── CoverImage [CLIENT] — volume cover with fallback
├── VolumeActionsMenu [CLIENT] — dropdown for edit/delete/scrape
├── PriceHistoryCard [CLIENT] — price graph for volume
├── PriceAlertsDashboardCard [CLIENT]
├── RecommendationsCard [CLIENT]
└── lazy(VolumeDialog) — edit volume

/settings → SettingsPage [CLIENT] — profile, preferences
/settings/import → ImportPage [CLIENT] → CsvImport / JsonImport [CLIENT]
/settings/export → ExportPage [CLIENT]
```

## Data flow: stores → hooks → components

```
┌──────────────────┐   persist   ┌──────────────────┐
│  useLibraryStore │ ◄─────────► │  localStorage    │
│  (Zustand)       │             │  (library-store) │
│                  │             └──────────────────┘
│  series/volumes  │
│  filters/sort    │
│  view/selection  │
└────────┬─────────┘
         │ read/write
         ▼
┌──────────────────┐  composes   ┌──────────────────────────┐
│  useLibrary()    │ ◄────────── │  useLibraryFetch         │
│  (facade hook)   │             │  useLibraryMutations     │
│                  │             │  useLibraryFilters       │
│  .series         │             │  useLibraryImport        │
│  .mutations      │             │  useLibraryUrlSync       │
│  .filters        │             └──────────────────────────┘
│  .imports        │
│  .fetchSeries    │    CRUD calls
│  .isLoading      │ ────────────────► Supabase (via browser client)
└────────┬─────────┘
         │ consumed by
         ▼
   LibraryPage, SeriesDetailPage, VolumeDetailPage

┌──────────────────────┐   persist   ┌──────────────────┐
│ useSettingsStore     │ ◄──────────►│  localStorage    │
│ (Zustand)            │             │  (settings-store)│
│                      │             └──────────────────┘
│ fonts, animations    │
│ cardSize, dateFormat │  consumed by
│ onboarding state     │ ──────────► SettingsApplier, OnboardingDialog,
│                      │             LibraryToolbar, VolumeCard, etc.
└──────────────────────┘

┌──────────────────────┐
│ useNotificationStore │  used by NotificationBell, NotificationCenter
└──────────────────────┘
```

## Dialog trigger patterns

All dialogs use controlled `open` state managed by parent page components.
Dialogs are **lazy-loaded** via `React.lazy()` for code-splitting.

| Dialog               | Triggered from                               | Key props                   |
| -------------------- | -------------------------------------------- | --------------------------- |
| SeriesDialog         | LibraryToolbar "Add Series", SeriesCard edit | series?, onSave, onClose    |
| VolumeDialog         | LibraryToolbar "Add Volume", VolumeCard edit | volume?, seriesId?, onSave  |
| BookSearchDialog     | LibraryToolbar search, SeriesDetail add      | onSelect, existingIsbns     |
| BulkScrapeDialog     | Selection bar, SeriesDetail bulk action      | target (series\|volume IDs) |
| DuplicateMergeDialog | LibraryPage duplicate detection              | duplicateGroups             |
| AssignToSeriesDialog | Selection bar for unassigned volumes         | volumeIds, onAssign         |
