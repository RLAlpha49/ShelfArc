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

interface HeaderProps {
  readonly user?: {
    email?: string
    user_metadata?: {
      display_name?: string
      avatar_url?: string
    }
  } | null
}

export function Header({ user }: HeaderProps) {
  const pathname = usePathname()
  const avatarUrl = resolveImageUrl(user?.user_metadata?.avatar_url)

  const navItems = [
    { href: "/library", label: "Library" },
    { href: "/bookshelf", label: "Bookshelf" },
    { href: "/dashboard", label: "Dashboard" }
  ]

  return (
    <header className="bg-background/80 sticky top-0 z-50 w-full border-b backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary-foreground h-4 w-4"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            </div>
            <span className="font-display text-lg font-bold tracking-tight">
              ShelfArc
            </span>
          </Link>

          {user && (
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "text-foreground bg-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  {item.label}
                  {pathname === item.href && (
                    <span className="bg-primary absolute inset-x-3 -bottom-2.25 h-0.5 rounded-full" />
                  )}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="focus:outline-none">
                <Avatar className="ring-primary/20 h-9 w-9 cursor-pointer ring-2 transition-shadow hover:ring-4">
                  <AvatarImage
                    src={avatarUrl}
                    alt={user.user_metadata?.display_name || "User"}
                  />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {(user.user_metadata?.display_name || user.email || "U")
                      .charAt(0)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <div className="flex items-center gap-3 p-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={avatarUrl}
                      alt={user.user_metadata?.display_name || "User"}
                    />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {(user.user_metadata?.display_name || user.email || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col leading-none">
                    {user.user_metadata?.display_name && (
                      <p className="text-sm font-semibold">
                        {user.user_metadata.display_name}
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
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="text-muted-foreground hover:text-foreground inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-semibold shadow-sm transition-all"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
