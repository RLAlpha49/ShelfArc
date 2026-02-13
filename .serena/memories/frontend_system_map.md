# Frontend system map (components/hooks/stores)

- Main shell components: `app-shell`, `header`, `sidebar-nav`, `command-palette`, theme/settings applicators.
- Library feature components: cards (`series-card`, `volume-card`), dialogs (`series-dialog`, `volume-dialog`, `book-search-dialog`, `bulk-scrape-dialog`, `duplicate-merge-dialog`, `assign-to-series-dialog`), tooling (`library-toolbar`, `filter-presets-control`), price widgets.
- Performance helpers: `components/library/virtualized-window.tsx` for list/grid virtualization; `useDeferredValue`, memoization, and batching patterns appear in heavy flows.
- Hooks:
  - `use-library`: core CRUD/fetch/state sync logic for library domain.
  - `use-bulk-scrape`: queued scrape workflow and status handling.
  - `use-price-history`: history retrieval + alert mutation pipeline.
  - `use-window-width`: responsive behavior helper.
- Stores (persisted Zustand):
  - `library-store`: data slices + filters/sort/view presets + selection state.
  - `settings-store`: appearance/workflow preferences and hydration-aware settings.
- UI system conventions: local shadcn primitives in `components/ui/**`, rounded-xl/2xl style language, glass/warm-accent visual system from `app/globals.css`.
