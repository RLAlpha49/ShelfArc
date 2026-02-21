"use client"

import { useOptimistic, useTransition } from "react"

import { Button } from "@/components/ui/button"

type Props = {
  readonly username: string
  readonly initialIsFollowing: boolean
  readonly initialFollowerCount: number
}

export function FollowButton({
  username,
  initialIsFollowing,
  initialFollowerCount
}: Props) {
  const [isFollowing, setIsFollowing] = useOptimistic(initialIsFollowing)
  const [isPending, startTransition] = useTransition()

  let followerDelta = 0
  if (isFollowing && isFollowing !== initialIsFollowing) {
    followerDelta = 1
  } else if (!isFollowing && isFollowing !== initialIsFollowing) {
    followerDelta = -1
  }
  const displayCount = initialFollowerCount + followerDelta

  const encodedUsername = encodeURIComponent(username)
  const apiUrl = `/api/users/${encodedUsername}/follow`

  function toggle() {
    const nextFollowing = !isFollowing
    startTransition(async () => {
      setIsFollowing(nextFollowing)
      try {
        await fetch(apiUrl, {
          method: nextFollowing ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" }
        })
      } catch {
        // Network error — optimistic state reverts automatically on error
      }
    })
  }

  let label = "Follow"
  if (isPending) label = "..."
  else if (isFollowing) label = "Following"

  return (
    <div className="flex items-center gap-3">
      <Button
        variant={isFollowing ? "outline" : "default"}
        size="sm"
        disabled={isPending}
        onClick={toggle}
        aria-label={isFollowing ? "Unfollow this user" : "Follow this user"}
        className="min-w-22.5"
      >
        {label}
      </Button>
      <span className="text-muted-foreground text-sm">
        {displayCount} {displayCount === 1 ? "follower" : "followers"}
      </span>
    </div>
  )
}
