import Link from "next/link"
import { createUserClient } from "@/lib/supabase/server"
import { ThemeToggle } from "@/components/theme-toggle"

/**
 * Public landing page with hero, features, and CTA sections.
 * @source
 */
export default async function HomePage() {
  const supabase = await createUserClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Atmospheric background */}
      <div className="bg-hero-mesh fixed inset-0 -z-10" />
      <div className="noise-overlay pointer-events-none fixed inset-0 -z-10" />

      {/* Navigation — minimal, floating */}
      <nav className="animate-fade-in-down relative z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="bg-primary flex h-9 w-9 items-center justify-center rounded-lg">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary-foreground h-4.5 w-4.5"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            </div>
            <span className="font-display text-xl font-bold tracking-tight">
              ShelfArc
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <Link
                href="/library"
                className="bg-primary text-primary-foreground hover:bg-primary/90 glow-ring inline-flex h-10 items-center justify-center rounded-xl px-5 text-sm font-semibold shadow-sm transition-all hover:shadow-md"
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
                  className="bg-primary text-primary-foreground hover:bg-primary/90 glow-ring inline-flex h-10 items-center justify-center rounded-xl px-5 text-sm font-semibold shadow-sm transition-all hover:shadow-md"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero — Asymmetric editorial layout */}
      <section className="relative px-6 pt-16 pb-24 lg:px-8 lg:pt-24 lg:pb-32">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
            {/* Left: text content — 7 columns */}
            <div className="lg:col-span-7">
              <div className="animate-fade-in-up max-w-2xl">
                <h1 className="font-display mb-6 text-5xl leading-[1.1] font-bold tracking-tight md:text-6xl lg:text-7xl">
                  Curate your
                  <br />
                  <span className="text-gradient from-copper to-gold bg-linear-to-r">
                    literary world
                  </span>
                </h1>

                <p className="text-muted-foreground mb-10 max-w-lg text-lg leading-relaxed">
                  ShelfArc is your sanctuary for light novels and manga. Track
                  every volume and watch your collection come alive.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {user ? (
                    <Link
                      href="/library"
                      className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-semibold shadow-lg transition-all hover:shadow-xl active:scale-[0.98]"
                    >
                      Open My Library
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
                  ) : (
                    <>
                      <Link
                        href="/signup"
                        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-semibold shadow-lg transition-all hover:shadow-xl active:scale-[0.98]"
                      >
                        Start your collection
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
                      <Link
                        href="/login"
                        className="text-muted-foreground hover:text-foreground inline-flex h-12 items-center justify-center px-4 text-sm font-medium transition-colors"
                      >
                        Sign in to your library
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: decorative book stack — 5 columns */}
            <div className="hidden lg:col-span-5 lg:block">
              <div className="animate-fade-in stagger-2 relative">
                <div className="relative mx-auto aspect-square w-full max-w-md">
                  <div className="absolute inset-0 rounded-full bg-[radial-gradient(ellipse_at_center,var(--warm-glow-strong),transparent_70%)]" />
                  <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-end gap-1.5">
                    {[
                      {
                        h: "h-52",
                        bg: "from-primary/80 to-primary/50",
                        w: "w-8"
                      },
                      {
                        h: "h-60",
                        bg: "from-copper/70 to-copper/40",
                        w: "w-7"
                      },
                      {
                        h: "h-48",
                        bg: "from-gold/60 to-gold/30",
                        w: "w-9"
                      },
                      {
                        h: "h-56",
                        bg: "from-primary/60 to-primary/30",
                        w: "w-6"
                      },
                      {
                        h: "h-64",
                        bg: "from-copper/80 to-copper/50",
                        w: "w-8"
                      },
                      {
                        h: "h-44",
                        bg: "from-gold/70 to-gold/40",
                        w: "w-7"
                      },
                      {
                        h: "h-58",
                        bg: "from-primary/70 to-primary/40",
                        w: "w-6"
                      },
                      {
                        h: "h-50",
                        bg: "from-copper/60 to-copper/30",
                        w: "w-8"
                      },
                      {
                        h: "h-54",
                        bg: "from-gold/80 to-gold/50",
                        w: "w-7"
                      }
                    ].map((spine, i) => (
                      <div
                        key={`spine-${spine.h}-${spine.w}`}
                        className={`${spine.h} ${spine.w} animate-fade-in-up rounded-t-sm bg-linear-to-t shadow-md`}
                        style={{ animationDelay: `${0.3 + i * 0.08}s` }}
                      >
                        <div
                          className={`h-full w-full rounded-t-sm bg-linear-to-t ${spine.bg}`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="from-border via-border/60 to-border absolute right-4 bottom-7 left-4 h-1 rounded-full bg-linear-to-r" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10">
        <div className="border-t">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
            <div className="animate-fade-in-up mb-14">
              <span className="text-muted-foreground mb-3 block text-xs tracking-widest uppercase">
                Features
              </span>
              <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                Everything your collection deserves
              </h2>
            </div>

            <div className="grid gap-px overflow-hidden rounded-lg border md:grid-cols-2 lg:grid-cols-3">
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
                      className="h-5 w-5"
                    >
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                    </svg>
                  ),
                  title: "Series Tracking",
                  description:
                    "Organize your manga and light novels by series. Track owned volumes, wishlists, and completion progress effortlessly."
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
                      className="h-5 w-5"
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
                      className="h-5 w-5"
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
                      className="h-5 w-5"
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
                      className="h-5 w-5"
                    >
                      <path d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  ),
                  title: "Price Tracking",
                  description:
                    "Log purchase prices, fetch current retail prices, and keep track of how much you have invested in your growing collection."
                }
              ].map((feature, featureIndex) => (
                <div
                  key={feature.id}
                  className="bg-card group feature-card-reveal hover:bg-accent/40 icon-hover-bob p-6 md:p-8"
                  style={{ animationDelay: `${featureIndex * 100}ms` }}
                >
                  <div className="text-primary bg-primary/8 group-hover:bg-primary/12 mb-4 inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors">
                    {feature.icon}
                  </div>
                  <h3 className="font-display mb-1.5 text-base font-semibold">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
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
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
          <div className="animate-blur-in mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Ready to organize
              <br />
              your collection?
            </h2>
            <p className="text-muted-foreground mx-auto mt-4 max-w-md text-lg leading-relaxed">
              Join fellow collectors and bring order and beauty to your manga
              and light novel library.
            </p>
            <div className="mt-10">
              <Link
                href="/signup"
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-12 items-center justify-center rounded-xl px-8 text-base font-semibold shadow-lg transition-all hover:shadow-xl active:scale-[0.98]"
              >
                Create free account
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
        </div>
      </section>

      {/* Footer — minimal */}
      <footer className="animate-fade-in relative z-10 border-t">
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="bg-primary flex h-6 w-6 items-center justify-center rounded-md">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary-foreground h-3 w-3"
                >
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                </svg>
              </div>
              <span className="text-muted-foreground text-sm">
                ShelfArc &mdash; Your personal library manager
              </span>
            </div>
            <p className="text-muted-foreground text-sm">
              &copy; {new Date().getFullYear()} ShelfArc
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
