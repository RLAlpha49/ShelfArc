"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"

import { logout } from "@/app/auth/actions"
import { NotificationBell } from "@/components/notification-bell"
import { ThemeToggle } from "@/components/theme-toggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip"
import { useSettingsStore } from "@/lib/store/settings-store"
import { resolveImageUrl } from "@/lib/uploads/resolve-image-url"
import { cn } from "@/lib/utils"

/** Props for the {@link SidebarNav} component. @source */
interface SidebarNavProps {
  readonly user?: {
    email?: string
    user_metadata?: {
      username?: string
      avatar_url?: string
    }
  } | null
  readonly collapsed?: boolean
  readonly onCollapsedChange?: (value: boolean) => void
}

/** Navigation items rendered in the sidebar. @source */
const navItems = [
  {
    href: "/library",
    label: "Library",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      </svg>
    )
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <path d="M12 20V10" />
        <path d="M18 20V4" />
        <path d="M6 20v-4" />
      </svg>
    )
  },
  {
    href: "/activity",
    label: "Activity",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    )
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
]

/**
 * Collapsible sidebar navigation with mobile drawer support and user profile dropdown.
 * @param props - {@link SidebarNavProps}
 * @source
 */
export function SidebarNav({
  user,
  collapsed: collapsedProp,
  onCollapsedChange
}: SidebarNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useSettingsStore((s) => s.setSidebarCollapsed)
  const hydrated = useSettingsStore((s) => s._hydrated)
  const collapsed = collapsedProp ?? sidebarCollapsed
  const setCollapsed = onCollapsedChange ?? setSidebarCollapsed
  const [mobileOpen, setMobileOpen] = useState(false)
  const avatarUrl = resolveImageUrl(user?.user_metadata?.avatar_url)
  const mobileSidebarId = "mobile-sidebar"

  return (
    <>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        {/* Mobile header bar */}
        <div className="bg-background/80 fixed top-0 right-0 left-0 z-50 flex h-14 items-center border-b px-4 backdrop-blur-xl md:hidden">
          <SheetTrigger
            aria-controls={mobileSidebarId}
            aria-expanded={mobileOpen}
            render={
              <button
                type="button"
                className="focus-visible:ring-ring focus-visible:ring-offset-background hover:bg-accent mr-3 inline-flex h-9 w-9 items-center justify-center rounded-lg transition-all hover:shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              />
            }
            aria-label="Open navigation"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <line x1="4" x2="20" y1="12" y2="12" />
              <line x1="4" x2="20" y1="6" y2="6" />
              <line x1="4" x2="20" y1="18" y2="18" />
            </svg>
          </SheetTrigger>
          <Link
            href="/"
            className="focus-visible:ring-ring focus-visible:ring-offset-background flex items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <div className="bg-primary flex h-7 w-7 items-center justify-center rounded-md">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary-foreground h-3.5 w-3.5"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            </div>
            <span className="font-display text-base font-bold tracking-tight">
              ShelfArc
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
          </div>
        </div>

        {/* Mobile drawer */}
        <SheetContent
          id={mobileSidebarId}
          side="left"
          className="bg-sidebar w-72 p-0"
          aria-label="Navigation"
        >
          <SheetHeader className="border-b">
            <SheetTitle className="font-display">Navigation</SheetTitle>
          </SheetHeader>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {user &&
              navItems.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <Link
                    key={`mobile-${item.href}`}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "focus-visible:ring-ring focus-visible:ring-offset-background group relative flex items-center justify-start gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.97]",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground hover:shadow-sm"
                    )}
                  >
                    {isActive && (
                      <span className="bg-primary animate-scale-in absolute top-1/2 -left-3 h-5 w-1 -translate-y-1/2 rounded-r-full" />
                    )}
                    <span className="shrink-0 transition-transform duration-200 group-hover:scale-110">
                      {item.icon}
                    </span>
                    <span className="whitespace-nowrap">{item.label}</span>
                  </Link>
                )
              })}
          </nav>

          {user && (
            <div className="border-t px-3 py-3">
              <div className="flex items-center gap-3 rounded-xl p-2">
                <Avatar className="ring-border h-8 w-8 shrink-0 ring-1">
                  <AvatarImage
                    src={avatarUrl}
                    alt={user.user_metadata?.username || "User"}
                  />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {(user.user_metadata?.username || user.email || "U")
                      .charAt(0)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {user.user_metadata?.username || "User"}
                  </p>
                  {user.email && (
                    <p className="text-muted-foreground truncate text-xs">
                      {user.email}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="focus-visible:ring-ring focus-visible:ring-offset-background text-destructive hover:bg-destructive/10 mt-2 inline-flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                onClick={async () => {
                  await logout()
                  setMobileOpen(false)
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Sidebar */}
      <aside
        className={cn(
          "bg-sidebar fixed top-0 left-0 z-50 hidden h-screen flex-col border-r md:flex",
          hydrated
            ? "transition-[width,transform] duration-300 ease-in-out"
            : "transition-transform duration-300 ease-in-out",
          collapsed ? "w-17" : "w-60",
          "translate-x-0"
        )}
        data-collapsed={collapsed ? "true" : "false"}
      >
        {/* Logo zone */}
        <div className="flex h-16 items-center gap-3 border-b px-3.5">
          <Link
            href="/"
            className="focus-visible:ring-ring focus-visible:ring-offset-background flex items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <div className="bg-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
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
            <span
              className={cn(
                "font-display overflow-hidden text-lg font-bold tracking-tight whitespace-nowrap transition-all duration-300",
                collapsed
                  ? "max-w-0 -translate-x-2 opacity-0"
                  : "max-w-40 translate-x-0 opacity-100"
              )}
              aria-hidden={collapsed}
            >
              ShelfArc
            </span>
          </Link>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {user &&
            navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`)
              const linkClass = cn(
                "focus-visible:ring-ring focus-visible:ring-offset-background group relative flex items-center justify-start gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.97]",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground hover:shadow-sm"
              )
              const linkInner = (
                <>
                  {isActive && (
                    <span className="bg-primary animate-scale-in absolute top-1/2 -left-3 h-5 w-1 -translate-y-1/2 rounded-r-full" />
                  )}
                  <span className="shrink-0 transition-transform duration-200 group-hover:scale-110">
                    {item.icon}
                  </span>
                  <span
                    className={cn(
                      "overflow-hidden whitespace-nowrap transition-all duration-300",
                      collapsed
                        ? "max-w-0 -translate-x-2 opacity-0"
                        : "max-w-40 translate-x-0 opacity-100"
                    )}
                    aria-hidden={collapsed}
                  >
                    {item.label}
                  </span>
                </>
              )
              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger
                      render={
                        <Link
                          href={item.href}
                          aria-current={isActive ? "page" : undefined}
                          aria-label={item.label}
                          className={linkClass}
                        />
                      }
                    >
                      {linkInner}
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                )
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={linkClass}
                >
                  {linkInner}
                </Link>
              )
            })}
        </nav>

        {/* Bottom section — user + collapse + theme */}
        <div className="border-t px-3 py-3 transition-all duration-300">
          <div
            className={cn(
              "mb-2 flex p-1 transition-all duration-300",
              collapsed ? "flex-col items-start gap-2" : "items-center"
            )}
          >
            <div>
              <ThemeToggle />
            </div>
            <div>
              <NotificationBell />
            </div>
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className={cn(
                "focus-visible:ring-ring focus-visible:ring-offset-background text-muted-foreground hover:text-foreground hover:bg-accent hidden h-8 w-8 items-center justify-center rounded-lg transition-all hover:shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none md:inline-flex",
                collapsed ? "self-start" : "ml-auto"
              )}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(
                  "h-4 w-4 transition-transform duration-300",
                  collapsed ? "rotate-180" : "rotate-0"
                )}
              >
                <path d="m11 17-5-5 5-5" />
                <path d="m18 17-5-5 5-5" />
              </svg>
            </button>
          </div>

          {user && (
            <button
              type="button"
              onClick={() =>
                globalThis.dispatchEvent(new Event("open-command-palette"))
              }
              className={cn(
                "focus-visible:ring-ring focus-visible:ring-offset-background text-muted-foreground hover:text-foreground hover:bg-accent mb-2 flex w-full items-center rounded-xl px-3 py-2 text-sm transition-all hover:shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                collapsed ? "justify-center px-0" : "gap-3"
              )}
              aria-label="Open command palette"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 shrink-0"
              >
                <circle cx="7" cy="7" r="4.5" />
                <path d="m12.5 12.5-2.8-2.8" />
              </svg>
              <span
                className={cn(
                  "overflow-hidden whitespace-nowrap transition-all duration-300",
                  collapsed
                    ? "max-w-0 -translate-x-2 opacity-0"
                    : "max-w-40 flex-1 translate-x-0 opacity-100"
                )}
                aria-hidden={collapsed}
              >
                Search…
              </span>
            </button>
          )}

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "focus-visible:ring-ring focus-visible:ring-offset-background group flex w-full items-center rounded-xl p-1.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                  collapsed ? "justify-center" : "justify-start gap-3"
                )}
                aria-label="Open user menu"
              >
                <Avatar className="ring-border h-8 w-8 shrink-0 cursor-pointer ring-1 transition-shadow group-hover:ring-2">
                  <AvatarImage
                    src={avatarUrl}
                    alt={user.user_metadata?.username || "User"}
                  />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {(user.user_metadata?.username || user.email || "U")
                      .charAt(0)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    "min-w-0 overflow-hidden text-left transition-all duration-300",
                    collapsed
                      ? "max-w-0 -translate-x-2 opacity-0"
                      : "max-w-45 flex-1 translate-x-0 opacity-100"
                  )}
                  aria-hidden={collapsed}
                >
                  <p className="truncate text-sm font-medium">
                    {user.user_metadata?.username || "User"}
                  </p>
                  {user.email && (
                    <p className="text-muted-foreground truncate text-xs">
                      {user.email}
                    </p>
                  )}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align={collapsed ? "center" : "end"}
                side="top"
                className="w-56"
              >
                <div className="flex items-center gap-3 p-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage
                      src={avatarUrl}
                      alt={user.user_metadata?.username || "User"}
                    />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {(user.user_metadata?.username || user.email || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col leading-none">
                    {user.user_metadata?.username && (
                      <p className="truncate text-sm font-semibold">
                        {user.user_metadata.username}
                      </p>
                    )}
                    {user.email && (
                      <p className="text-muted-foreground mt-1 truncate text-xs">
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => {
                    router.push("/settings")
                  }}
                >
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive cursor-pointer"
                  onClick={async () => {
                    await logout()
                  }}
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </aside>
    </>
  )
}
