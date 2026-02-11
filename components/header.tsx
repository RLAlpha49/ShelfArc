"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { logout } from "@/app/auth/actions"
import { cn } from "@/lib/utils"
import { resolveImageUrl } from "@/lib/uploads/resolve-image-url"

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
    }
  ]

  return (
    <header className="bg-background/90 sticky top-0 z-50 w-full backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-6 lg:px-8">
        {/* Wordmark */}
        <Link href="/" className="group flex items-center gap-2.5">
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
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-all duration-200 active:scale-[0.97]",
                  pathname === item.href
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground hover:shadow-sm"
                )}
              >
                <span className="transition-transform duration-200 group-hover:scale-110">
                  {item.icon}
                </span>
                {item.label}
                {pathname === item.href && (
                  <span className="bg-primary animate-scale-in absolute inset-x-2 -bottom-3 h-0.5" />
                )}
              </Link>
            ))}
          </nav>
        )}

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="focus:outline-none">
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
                  <div className="flex flex-col leading-none">
                    {user.user_metadata?.username && (
                      <p className="text-sm font-medium">
                        {user.user_metadata.username}
                      </p>
                    )}
                    {user.email && (
                      <p className="text-muted-foreground mt-1 text-xs">
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
