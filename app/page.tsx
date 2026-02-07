import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { ThemeToggle } from "@/components/theme-toggle"

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  return (
    <div className="noise-overlay relative min-h-screen overflow-hidden">
      {/* Hero gradient mesh background */}
      <div className="bg-hero-mesh fixed inset-0 -z-10" />

      {/* Navigation */}
      <nav className="animate-fade-in-down relative z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="bg-primary flex h-9 w-9 items-center justify-center rounded-lg">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary-foreground h-5 w-5"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            </div>
            <span className="font-display text-xl font-bold tracking-tight">
              ShelfArc
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {user ? (
              <Link
                href="/library"
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-lg px-5 text-sm font-semibold shadow-sm transition-all hover:shadow-md"
              >
                Go to Library
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-foreground/70 hover:text-foreground hidden h-10 items-center justify-center px-4 text-sm font-medium transition-colors sm:inline-flex"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-lg px-5 text-sm font-semibold shadow-sm transition-all hover:shadow-md"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 pt-24 pb-32 md:pt-36 md:pb-40">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute top-0 left-1/2 -z-10 h-150 w-200 -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,var(--warm-glow-strong),transparent_70%)] blur-3xl" />

        <div className="mx-auto max-w-5xl text-center">
          <div className="ornament-line mb-8">
            <span className="text-muted-foreground px-4 text-xs tracking-[0.3em] uppercase">
              A personal library, refined
            </span>
          </div>

          <h1 className="mb-8 font-serif text-5xl leading-tight tracking-tight md:text-7xl md:leading-tight">
            Curate Your
            <br />
            <span className="text-primary">Literary Collection</span>
          </h1>

          <p className="text-muted-foreground mx-auto mb-12 max-w-2xl text-lg leading-relaxed md:text-xl">
            ShelfArc is your sanctuary for light novels and manga. Track every
            volume, organize bookshelves, and watch your collection come to life
            — all in one beautifully thoughtful space.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            {user ? (
              <Link
                href="/library"
                className="bg-primary text-primary-foreground hover:bg-primary/90 warm-shadow-lg inline-flex h-12 items-center justify-center rounded-md px-8 text-sm font-medium tracking-wide transition-all hover:scale-[1.02]"
              >
                Open My Library
              </Link>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 warm-shadow-lg inline-flex h-12 items-center justify-center rounded-md px-8 text-sm font-medium tracking-wide transition-all hover:scale-[1.02]"
                >
                  Start Your Collection
                </Link>
                <Link
                  href="/login"
                  className="text-muted-foreground hover:text-foreground inline-flex h-12 items-center justify-center border-none px-6 text-sm font-medium transition-colors"
                >
                  Sign in to your library
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 border-t">
        <div className="bg-warm-gradient">
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            <div className="mb-16 text-center">
              <h2 className="animate-fade-in-up font-display text-3xl font-bold tracking-tight md:text-4xl">
                Everything Your Collection Deserves
              </h2>
              <p className="animate-fade-in-up stagger-1 text-muted-foreground mx-auto mt-4 max-w-2xl text-lg">
                Built with care for collectors who value both organization and
                aesthetics.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  id: "series-tracking",
                  icon: (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="h-6 w-6"
                    >
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                    </svg>
                  ),
                  title: "Series Tracking",
                  description:
                    "Organize your manga and light novels by series. Track owned volumes, wishlists, and completion progress effortlessly."
                },
                {
                  id: "virtual-bookshelf",
                  icon: (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="h-6 w-6"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <line x1="3" x2="21" y1="9" y2="9" />
                      <line x1="3" x2="21" y1="15" y2="15" />
                      <line x1="9" x2="9" y1="3" y2="21" />
                    </svg>
                  ),
                  title: "Virtual Bookshelf",
                  description:
                    "Arrange your books on beautiful virtual shelves. Drag, drop, and display your collection exactly how you want."
                },
                {
                  id: "reading-progress",
                  icon: (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="h-6 w-6"
                    >
                      <path d="M12 20V10" />
                      <path d="M18 20V4" />
                      <path d="M6 20v-4" />
                    </svg>
                  ),
                  title: "Reading Progress",
                  description:
                    "Keep track of where you are in each volume. Never lose your place across multiple series again."
                },
                {
                  id: "smart-search",
                  icon: (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="h-6 w-6"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                  ),
                  title: "Smart Search",
                  description:
                    "Find and add books instantly with ISBN lookup, title search, and automatic metadata enrichment."
                },
                {
                  id: "import-export",
                  icon: (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="h-6 w-6"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  ),
                  title: "Import & Export",
                  description:
                    "Bring your existing collection data in or take it with you. Your data is always yours to keep."
                },
                {
                  id: "price-tracking",
                  icon: (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="h-6 w-6"
                    >
                      <path d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  ),
                  title: "Price Tracking",
                  description:
                    "Log purchase prices, fetch current retail prices, and keep track of how much you have invested in your growing collection."
                }
              ].map((feature) => (
                <div
                  key={feature.id}
                  className="bg-card group rounded-2xl border p-7 transition-all hover:shadow-lg"
                >
                  <div className="bg-primary/10 text-primary group-hover:bg-copper/15 mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl transition-colors">
                    {feature.icon}
                  </div>
                  <h3 className="font-display mb-2 text-lg font-semibold">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 border-t">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center md:py-32">
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Ready to Organize Your Collection?
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg">
            Join fellow collectors and bring order and beauty to your manga and
            light novel library.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-12 items-center justify-center rounded-xl px-8 text-base font-semibold shadow-md transition-all hover:shadow-lg active:scale-[0.98]"
            >
              Create Free Account
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="ml-2 h-4 w-4"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground h-4 w-4"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
              <span className="text-muted-foreground text-sm">
                ShelfArc &mdash; Your personal library manager
              </span>
            </div>
            <p className="text-muted-foreground text-sm">
              &copy; {new Date().getFullYear()} ShelfArc. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
