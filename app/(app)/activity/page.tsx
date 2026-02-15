"use client"

import { ActivityFeed } from "@/components/activity/activity-feed"

export default function ActivityPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 lg:px-10">
      <section className="animate-fade-in-down mb-8">
        <span className="text-muted-foreground mb-1 block text-xs tracking-widest uppercase">
          Activity
        </span>
        <h1 className="font-display text-4xl leading-tight font-bold tracking-tight md:text-5xl">
          Activity{" "}
          <span className="text-gradient from-copper to-gold bg-linear-to-r">
            Timeline
          </span>
        </h1>
        <p className="text-muted-foreground mt-2 max-w-lg text-base leading-relaxed">
          Track all changes to your library
        </p>
      </section>

      <ActivityFeed />
    </div>
  )
}
