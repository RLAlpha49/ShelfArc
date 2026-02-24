"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useState } from "react"

import { AccessibilitySection } from "@/components/settings/accessibility-section"
import { AppearanceSection } from "@/components/settings/appearance-section"
import { NotificationsSection } from "@/components/settings/notifications-section"
import { PreferencesSection } from "@/components/settings/preferences-section"
import { ProfileSection } from "@/components/settings/profile-section"

const sectionSkeleton = (
  <div className="bg-muted mb-10 h-64 animate-pulse rounded-xl" />
)

const PricingSection = dynamic(
  () =>
    import("@/components/settings/pricing-section").then(
      (m) => m.PricingSection
    ),
  { ssr: false, loading: () => sectionSkeleton }
)
const SecuritySection = dynamic(
  () =>
    import("@/components/settings/security-section").then(
      (m) => m.SecuritySection
    ),
  { ssr: false, loading: () => sectionSkeleton }
)
const DataSection = dynamic(
  () => import("@/components/settings/data-section").then((m) => m.DataSection),
  { ssr: false, loading: () => sectionSkeleton }
)
const DangerZoneSection = dynamic(
  () =>
    import("@/components/settings/danger-zone-section").then(
      (m) => m.DangerZoneSection
    ),
  { ssr: false, loading: () => sectionSkeleton }
)
import { useSettingsStore } from "@/lib/store/settings-store"
import type { Profile } from "@/lib/types/database"
import { cn } from "@/lib/utils"

const settingsNav = [
  { id: "profile", label: "Profile" },
  { id: "preferences", label: "Preferences" },
  { id: "appearance", label: "Appearance" },
  { id: "accessibility", label: "Accessibility" },
  { id: "pricing", label: "Pricing" },
  { id: "notifications", label: "Notifications" },
  { id: "security", label: "Security" },
  { id: "data", label: "Data" },
  { id: "danger-zone", label: "Danger Zone" }
] as const

interface SettingsPageClientProps {
  profile: Profile | null
}

export function SettingsPageClient({
  profile
}: Readonly<SettingsPageClientProps>) {
  const [activeSection, setActiveSection] = useState("profile")
  const syncStatus = useSettingsStore((s) => s.syncStatus)

  useEffect(() => {
    if (syncStatus !== "saved") return
    const timer = setTimeout(() => {
      useSettingsStore.setState({ syncStatus: "idle" })
    }, 3000)
    return () => clearTimeout(timer)
  }, [syncStatus])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    )
    for (const section of settingsNav) {
      const el = document.getElementById(section.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 lg:px-10">
      {/* Header */}
      <div className="animate-fade-in mb-8 lg:mb-10">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Settings
          </h1>
          {syncStatus === "saved" && (
            <span className="text-sm font-medium text-green-600">Saved ✓</span>
          )}
          {syncStatus === "failed" && (
            <button
              type="button"
              onClick={() => useSettingsStore.getState().syncToServer()}
              className="text-destructive hover:text-destructive/80 text-sm font-medium underline-offset-2 hover:underline"
            >
              Sync failed — Retry
            </button>
          )}
        </div>
        <p className="text-muted-foreground mt-2">
          Manage your profile, preferences, and data
        </p>
      </div>

      {/* Mobile section tabs */}
      <nav
        aria-label="Settings sections"
        className="-mx-6 mb-8 overflow-x-auto border-b px-6 lg:hidden"
      >
        <div className="flex gap-1 pb-px">
          {settingsNav.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={activeSection === section.id ? "page" : undefined}
              className={cn(
                "relative shrink-0 px-3 py-2.5 text-sm font-medium transition-colors",
                activeSection === section.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              {section.label}
              {activeSection === section.id && (
                <span className="bg-primary absolute inset-x-1 bottom-0 h-0.5 rounded-full" />
              )}
            </a>
          ))}
          <Link
            href="/settings/automations"
            className="text-muted-foreground hover:text-foreground hover:bg-accent/50 relative shrink-0 px-3 py-2.5 text-sm font-medium transition-colors"
          >
            Automations
          </Link>
        </div>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[200px_1fr] lg:gap-14">
        {/* Desktop section nav */}
        <nav aria-label="Settings sections" className="hidden lg:block">
          <div className="sticky top-6">
            <ul className="space-y-1">
              {settingsNav.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    aria-current={
                      activeSection === section.id ? "page" : undefined
                    }
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      activeSection === section.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground hover:shadow-sm"
                    )}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4 shrink-0"
                    >
                      {section.id === "profile" && (
                        <>
                          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </>
                      )}
                      {section.id === "preferences" && (
                        <>
                          <path d="M20 7h-9" />
                          <path d="M14 17H5" />
                          <circle cx="14" cy="7" r="3" />
                          <circle cx="8" cy="17" r="3" />
                        </>
                      )}
                      {section.id === "appearance" && (
                        <>
                          <circle
                            cx="13.5"
                            cy="6.5"
                            r="1.5"
                            fill="currentColor"
                            stroke="none"
                          />
                          <circle
                            cx="17.5"
                            cy="10.5"
                            r="1.5"
                            fill="currentColor"
                            stroke="none"
                          />
                          <circle
                            cx="8.5"
                            cy="7.5"
                            r="1.5"
                            fill="currentColor"
                            stroke="none"
                          />
                          <circle
                            cx="6.5"
                            cy="12.5"
                            r="1.5"
                            fill="currentColor"
                            stroke="none"
                          />
                          <path d="M12 2a10 10 0 0 0 0 20 1.7 1.7 0 0 0 1.7-1.7c0-.5-.2-.8-.4-1.1a1.7 1.7 0 0 1 1.3-2.8H16a5.5 5.5 0 0 0 5.5-5.5C21.5 6 17.2 2 12 2z" />
                        </>
                      )}
                      {section.id === "accessibility" && (
                        <>
                          <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      )}
                      {section.id === "pricing" && (
                        <>
                          <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
                          <path d="M7 7h.01" />
                        </>
                      )}
                      {section.id === "notifications" && (
                        <>
                          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                        </>
                      )}
                      {section.id === "security" && (
                        <>
                          <rect
                            width="18"
                            height="11"
                            x="3"
                            y="11"
                            rx="2"
                            ry="2"
                          />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </>
                      )}
                      {section.id === "data" && (
                        <>
                          <ellipse cx="12" cy="5" rx="9" ry="3" />
                          <path d="M3 5v14a9 3 0 0 0 18 0V5" />
                          <path d="M3 12a9 3 0 0 0 18 0" />
                        </>
                      )}
                      {section.id === "danger-zone" && (
                        <>
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </>
                      )}
                    </svg>
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t pt-4">
              <Link
                href="/settings/automations"
                className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:shadow-sm"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 shrink-0"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                Automations
              </Link>
            </div>
          </div>
        </nav>

        {/* Content sections */}
        <div className="min-w-0">
          <ProfileSection profile={profile} />

          <PreferencesSection />

          <AppearanceSection />

          <AccessibilitySection />

          <PricingSection />

          <NotificationsSection />

          <SecuritySection />

          <DataSection />

          <DangerZoneSection />
        </div>
      </div>
    </div>
  )
}
