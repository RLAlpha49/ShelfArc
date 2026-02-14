"use client"

import { useMemo } from "react"
import { computeHealthScore } from "@/lib/library/health-score"
import type { SeriesWithVolumes } from "@/lib/types/database"

interface CollectionHealthCardProps {
  readonly series: readonly SeriesWithVolumes[]
}

function getRingColorClass(score: number) {
  if (score > 60) return "stroke-[url(#health-gradient)]"
  if (score >= 40) return "stroke-primary"
  return "stroke-red-500"
}

export function CollectionHealthCard({ series }: CollectionHealthCardProps) {
  const health = useMemo(() => computeHealthScore(series), [series])

  const circumference = 2 * Math.PI * 42
  const filled = (health.overall / 100) * circumference

  return (
    <div className="glass-card rounded-xl p-6">
      {/* Score ring */}
      <div className="mb-6 flex flex-col items-center">
        <div className="relative h-28 w-28">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <defs>
              <linearGradient
                id="health-gradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="var(--color-copper)" />
                <stop offset="100%" stopColor="var(--color-gold)" />
              </linearGradient>
            </defs>
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              className="stroke-primary/10"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              className={getRingColorClass(health.overall)}
              stroke={health.overall > 60 ? "url(#health-gradient)" : undefined}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference - filled}`}
              style={{ transition: "stroke-dasharray 1s ease-out" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-2xl font-bold">
              {health.overall}
            </span>
            <span className="text-muted-foreground text-[10px] font-medium">
              {health.label}
            </span>
          </div>
        </div>
      </div>

      {/* Factor bars */}
      <div className="space-y-3">
        {health.factors.map((factor) => (
          <div key={factor.id}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{factor.label}</span>
              <span className="font-medium">
                {factor.score}/{factor.maxScore}
              </span>
            </div>
            <div className="bg-primary/8 mt-1 h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-all duration-700"
                style={{
                  width: `${factor.maxScore > 0 ? (factor.score / factor.maxScore) * 100 : 0}%`
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      {health.suggestions.length > 0 && (
        <div className="mt-5 space-y-2 border-t pt-4">
          {health.suggestions.map((tip) => (
            <div key={tip} className="flex gap-2 text-xs">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-gold mt-0.5 h-3.5 w-3.5 shrink-0"
              >
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 12 18.469c-.874 0-1.71.346-2.329.963l-.209.21" />
              </svg>
              <span className="text-muted-foreground">{tip}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
