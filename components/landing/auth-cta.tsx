"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { createClient } from "@/lib/supabase/client"

type Variant = "nav" | "hero"

interface AuthCTAProps {
  readonly variant: Variant
}

export function AuthCTA({ variant }: AuthCTAProps) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user)
    })
  }, [])

  if (variant === "nav") {
    if (isLoggedIn === null) {
      return <div className="bg-muted/40 h-10 w-28 animate-pulse rounded-xl" />
    }
    if (isLoggedIn) {
      return (
        <Link
          href="/library"
          className="bg-primary text-primary-foreground hover:bg-primary/90 glow-ring inline-flex h-10 items-center justify-center rounded-xl px-5 text-sm font-semibold shadow-sm transition-all hover:shadow-md"
        >
          Go to Library
        </Link>
      )
    }
    return (
      <>
        <Link
          href="/login"
          className="text-foreground/70 hover:text-foreground inline-flex h-10 items-center justify-center px-4 text-sm font-medium transition-colors"
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
    )
  }

  // hero variant
  if (isLoggedIn === null) {
    return <div className="bg-muted/40 h-12 w-52 animate-pulse rounded-xl" />
  }
  if (isLoggedIn) {
    return (
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
    )
  }
  return (
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
  )
}
