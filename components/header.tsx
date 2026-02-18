"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSyncExternalStore } from "react"

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
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip"
import { resolveImageUrl } from "@/lib/uploads/resolve-image-url"
import { cn } from "@/lib/utils"

const noopSubscribe = () => () => {}
const getIsMac = () => /mac|iphone|ipad/i.test(navigator.userAgent)
const getIsMacServer = () => false

/** Props for the {@link Header} component. @source */
interface HeaderProps {
  readonly user?: {
    email?: string
    user_metadata?: {
      username?: string
      avatar_url?: string
    }
  } | null
}

/**
 * Sticky top-bar header with center navigation, logo, theme toggle, and user avatar dropdown.
 * @param props - {@link HeaderProps}
 * @source
 */
export function Header({ user }: HeaderProps) {
  const pathname = usePathname()
  const avatarUrl = resolveImageUrl(user?.user_metadata?.avatar_url)

  const isMac = useSyncExternalStore(noopSubscribe, getIsMac, getIsMacServer)

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
          className="h-4 w-4"
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
          className="h-4 w-4"
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
          className="h-4 w-4"
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
          className="h-4 w-4"
        >
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    }
  ]

  return (
    <header className="bg-background/90 sticky top-0 z-50 w-full backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-6 lg:px-8">
        {/* Wordmark */}
        <Link
          href="/"
          className="group focus-visible:ring-ring focus-visible:ring-offset-background flex items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <div className="bg-primary flex h-7 w-7 items-center justify-center rounded-md">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary-foreground h-3.5 w-3.5"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
          </div>
          <span className="font-display text-base font-semibold tracking-tight">
            ShelfArc
          </span>
        </Link>

        {/* Center navigation */}
        {user && (
          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 md:flex">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group focus-visible:ring-ring focus-visible:ring-offset-background relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.97]",
                    isActive
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground hover:shadow-sm"
                  )}
                >
                  <span className="transition-transform duration-200 group-hover:scale-110">
                    {item.icon}
                  </span>
                  {item.label}
                  {isActive && (
                    <span className="bg-primary animate-scale-in absolute inset-x-2 -bottom-3 h-0.5" />
                  )}
                </Link>
              )
            })}
          </nav>
        )}

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-1.5">
          {user && (
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="focus-visible:ring-ring focus-visible:ring-offset-background hover:bg-accent inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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
                    className="h-4 w-4"
                  >
                    <line x1="4" x2="20" y1="12" y2="12" />
                    <line x1="4" x2="20" y1="6" y2="6" />
                    <line x1="4" x2="20" y1="18" y2="18" />
                  </svg>
                  <span className="sr-only">Menu</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-muted-foreground text-[11px] tracking-widest uppercase">
                      Navigate
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  {navItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      pathname.startsWith(`${item.href}/`)
                    return (
                      <DropdownMenuItem key={`mobile-${item.href}`}>
                        <Link
                          href={item.href}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "flex w-full items-center gap-2",
                            isActive ? "font-medium" : undefined
                          )}
                        >
                          {item.icon}
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          {user && (
            <>
              {/* Command palette – icon button (mobile) */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="focus-visible:ring-ring focus-visible:ring-offset-background text-muted-foreground hover:text-foreground hover:bg-accent border-border/50 inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-transparent transition-all hover:shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:hidden"
                      aria-label="Open command palette"
                      onClick={() =>
                        globalThis.dispatchEvent(
                          new Event("open-command-palette")
                        )
                      }
                    />
                  }
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-3.5"
                  >
                    <circle cx="7" cy="7" r="4.5" />
                    <path d="m12.5 12.5-2.8-2.8" />
                  </svg>
                </TooltipTrigger>
                <TooltipContent side="bottom">Search commands</TooltipContent>
              </Tooltip>
              {/* Command palette – search bar (desktop) */}
              <button
                type="button"
                className="focus-visible:ring-ring focus-visible:ring-offset-background text-muted-foreground hover:text-foreground hover:bg-accent border-border/50 hidden h-8 min-w-48 items-center gap-2 rounded-lg border bg-transparent px-3 transition-all hover:shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:inline-flex"
                aria-label="Open command palette"
                onClick={() =>
                  globalThis.dispatchEvent(new Event("open-command-palette"))
                }
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-3.5 shrink-0 opacity-60"
                >
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="m12.5 12.5-2.8-2.8" />
                </svg>
                <span className="text-sm">Search…</span>
                <kbd className="bg-muted ml-auto rounded px-1.5 py-0.5 font-mono text-[10px]">
                  {isMac ? "⌘" : "Ctrl+"}K
                </kbd>
              </button>
            </>
          )}
          {user && <NotificationBell />}
          <ThemeToggle />

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="focus-visible:ring-ring focus-visible:ring-offset-background rounded-full focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                aria-label="Open user menu"
              >
                <Avatar className="ring-border h-8 w-8 cursor-pointer ring-1 transition-shadow hover:ring-2">
                  <AvatarImage
                    src={avatarUrl}
                    alt={user.user_metadata?.username || "User"}
                  />
                  <AvatarFallback className="bg-primary/8 text-primary text-xs font-medium">
                    {(user.user_metadata?.username || user.email || "U")
                      .charAt(0)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center gap-3 p-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage
                      src={avatarUrl}
                      alt={user.user_metadata?.username || "User"}
                    />
                    <AvatarFallback className="bg-primary/8 text-primary text-xs font-medium">
                      {(user.user_metadata?.username || user.email || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col leading-none">
                    {user.user_metadata?.username && (
                      <p className="truncate text-sm font-medium">
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
                <DropdownMenuItem>
                  <Link href="/settings" className="w-full">
                    Settings
                  </Link>
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
          ) : (
            <div className="flex items-center gap-1.5">
              <Link
                href="/login"
                className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium transition-all hover:shadow-sm"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex h-8 items-center justify-center rounded-md px-3.5 text-sm font-medium transition-all hover:shadow-md"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Thin editorial bottom line */}
      <div className="editorial-rule" />
    </header>
  )
}
