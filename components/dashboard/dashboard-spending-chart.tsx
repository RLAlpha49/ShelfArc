"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"

import type { SpendingDataPoint } from "@/lib/library/analytics"

interface DashboardSpendingChartProps {
  readonly data: SpendingDataPoint[]
  readonly priceFormatter: Intl.NumberFormat
  readonly mode?: "spending" | "velocity"
  /** Owned volumes with a price but no purchase date — excluded from this chart but counted in "Invested" */
  readonly undatedCount?: number
  /** Total spent by undated volumes */
  readonly undatedSpent?: number
}

type TimeRange = "6M" | "1Y" | "All"

interface TooltipState {
  x: number
  y: number
  label: string
  value: number
  visible: boolean
}

const CHART_H = 160
const PAD_TOP = 12
const PAD_BOTTOM = 36
const PAD_SIDE = 8
const MAX_BAR_FILL = 0.8
const ROTATE_AT = 9

export default function DashboardSpendingChart({
  data,
  priceFormatter,
  mode = "spending",
  undatedCount,
  undatedSpent
}: DashboardSpendingChartProps) {
  const isVelocity = mode === "velocity"
  const uid = useId()
  const gradientId = `spend-grad-${uid.replaceAll(":", "")}`

  const [range, setRange] = useState<TimeRange>("1Y")
  const [tooltip, setTooltip] = useState<TooltipState>({
    x: 0,
    y: 0,
    label: "",
    value: 0,
    visible: false
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const [svgWidth, setSvgWidth] = useState(600)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setSvgWidth(Math.floor(entry.contentRect.width))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const filtered = useMemo(() => {
    if (range === "6M") return data.slice(-6)
    if (range === "1Y") return data.slice(-12)
    return data
  }, [data, range])

  const stats = useMemo(() => {
    if (filtered.length === 0) return null
    const firstPoint = filtered[0]
    if (!firstPoint) return null
    const total = filtered.reduce((sum, d) => sum + d.total, 0)
    const peak = filtered.reduce(
      (best, d) => (d.total > best.total ? d : best),
      firstPoint
    )
    const months = filtered.filter((d) => d.total > 0)
    const avg = months.length > 0 ? total / months.length : 0
    return { total, peak, avg }
  }, [filtered])

  const chartBars = useMemo(() => {
    if (filtered.length === 0) return []
    const maxVal = Math.max(...filtered.map((d) => d.total), 0)
    const innerW = svgWidth - PAD_SIDE * 2
    const innerH = CHART_H - PAD_TOP - PAD_BOTTOM
    const slotW = innerW / filtered.length
    const barW = Math.min(slotW * 0.65, 40)
    const maxBarH = innerH * MAX_BAR_FILL
    const rotate = filtered.length > ROTATE_AT

    return filtered.map((d, i) => {
      const barH = maxVal > 0 ? (d.total / maxVal) * maxBarH : 0
      const cx = PAD_SIDE + i * slotW + slotW / 2
      return {
        d,
        x: cx - barW / 2,
        y: d.total > 0 ? PAD_TOP + innerH - barH : PAD_TOP + innerH - 2,
        w: barW,
        h: d.total > 0 ? barH : 2,
        cx,
        labelY: CHART_H - PAD_BOTTOM + 14,
        abbr: d.label.split(" ")[0],
        rotate
      }
    })
  }, [filtered, svgWidth])

  const gridLines = useMemo(() => {
    const innerH = CHART_H - PAD_TOP - PAD_BOTTOM
    const maxBarH = innerH * MAX_BAR_FILL
    return [0.25, 0.5, 0.75, 1].map((f) => ({
      f,
      y: PAD_TOP + innerH - f * maxBarH
    }))
  }, [])

  const onBarEnter = (
    e: React.MouseEvent<SVGRectElement>,
    label: string,
    value: number
  ) => {
    const r = (
      e.currentTarget.closest("svg") as SVGSVGElement
    ).getBoundingClientRect()
    setTooltip({
      x: e.clientX - r.left,
      y: e.clientY - r.top,
      label,
      value,
      visible: true
    })
  }

  const onBarMove = (e: React.MouseEvent<SVGRectElement>) => {
    const r = (
      e.currentTarget.closest("svg") as SVGSVGElement
    ).getBoundingClientRect()
    setTooltip((p) => ({ ...p, x: e.clientX - r.left, y: e.clientY - r.top }))
  }

  const onLeave = () => setTooltip((p) => ({ ...p, visible: false }))

  if (data.length === 0) {
    return (
      <div className="glass-card flex flex-col items-center justify-center rounded-xl px-6 py-14 text-center">
        <div className="text-copper bg-copper/10 mb-3 flex h-11 w-11 items-center justify-center rounded-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-5 w-5"
          >
            <path d="M3 3v18h18" />
            <path d="M7 16l4-4 4 4 4-8" />
          </svg>
        </div>
        <p className="text-muted-foreground text-sm">
          {isVelocity ? "No completed volumes yet" : "No purchase data yet"}
        </p>
        <p className="text-muted-foreground/60 mt-1 text-xs">
          {isVelocity
            ? "Mark volumes as completed to see your reading velocity"
            : "Add purchase dates and prices to volumes to see spending trends"}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          {isVelocity ? "Monthly completed volumes" : "Monthly spending"}
        </span>
        <div className="flex gap-1">
          {(["6M", "1Y", "All"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={
                range === r
                  ? "bg-primary/10 text-primary rounded-md px-2.5 py-1 text-xs font-medium"
                  : "text-muted-foreground hover:text-foreground rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
              }
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="relative w-full">
        <svg
          width={svgWidth}
          height={CHART_H}
          onMouseLeave={onLeave}
          aria-label={
            isVelocity
              ? "Monthly reading velocity chart"
              : "Monthly spending chart"
          }
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-copper)" />
              <stop offset="100%" stopColor="var(--color-gold)" />
            </linearGradient>
          </defs>

          {gridLines.map(({ f, y }) => (
            <line
              key={f}
              x1={PAD_SIDE}
              y1={y}
              x2={svgWidth - PAD_SIDE}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.07}
              strokeWidth={1}
            />
          ))}

          {chartBars.map((bar) => (
            <g key={bar.d.yearMonth}>
              <title>
                {`${bar.d.label}: ` +
                  (isVelocity
                    ? `${bar.d.total} volumes`
                    : priceFormatter.format(bar.d.total))}
              </title>
              <rect
                x={bar.x}
                y={bar.y}
                width={bar.w}
                height={bar.h}
                rx={3}
                fill={bar.d.total > 0 ? `url(#${gradientId})` : "currentColor"}
                fillOpacity={bar.d.total > 0 ? 1 : 0.1}
                className="cursor-pointer transition-opacity hover:opacity-75"
                onMouseEnter={(e) => onBarEnter(e, bar.d.label, bar.d.total)}
                onMouseMove={onBarMove}
              />
              <text
                x={bar.cx}
                y={bar.labelY}
                textAnchor={bar.rotate ? "end" : "middle"}
                fontSize={9}
                fill="currentColor"
                fillOpacity={0.4}
                transform={
                  bar.rotate
                    ? `rotate(-45, ${bar.cx}, ${bar.labelY})`
                    : undefined
                }
              >
                {bar.abbr}
              </text>
            </g>
          ))}
        </svg>

        {tooltip.visible && (
          <div
            className="bg-card border-border pointer-events-none absolute z-10 rounded-md border px-2.5 py-1.5 shadow-md"
            style={{
              left: tooltip.x,
              top: tooltip.y - 44,
              transform:
                tooltip.x > svgWidth * 0.65
                  ? "translateX(calc(-100% - 8px))"
                  : "translateX(8px)"
            }}
          >
            <p className="text-muted-foreground text-[10px]">{tooltip.label}</p>
            <p className="font-display text-xs font-semibold">
              {isVelocity
                ? `${tooltip.value} vol`
                : priceFormatter.format(tooltip.value)}
            </p>
          </div>
        )}
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border">
          <div className="bg-card p-3 text-center">
            <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
              Total
            </span>
            <div className="text-copper font-display mt-0.5 text-sm font-semibold">
              {isVelocity ? stats.total : priceFormatter.format(stats.total)}
            </div>
          </div>
          <div className="bg-card p-3 text-center">
            <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
              Peak
            </span>
            <div className="font-display mt-0.5 text-sm font-semibold">
              {isVelocity
                ? stats.peak.total
                : priceFormatter.format(stats.peak.total)}
            </div>
            <div className="text-muted-foreground/60 mt-0.5 text-[9px]">
              {stats.peak.label}
            </div>
          </div>
          <div className="bg-card p-3 text-center">
            <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
              Avg / mo
            </span>
            <div className="font-display mt-0.5 text-sm font-semibold">
              {isVelocity
                ? stats.avg.toFixed(1)
                : priceFormatter.format(stats.avg)}
            </div>
          </div>
        </div>
      )}

      {!isVelocity && undatedCount != null && undatedCount > 0 && (
        <p className="text-muted-foreground mt-1 text-xs">
          Based on volumes with recorded purchase dates.{" "}
          {undatedCount === 1
            ? `1 volume with a price but no date (${priceFormatter.format(undatedSpent ?? 0)}) is`
            : `${undatedCount} volumes with a price but no date (${priceFormatter.format(undatedSpent ?? 0)}) are`}{" "}
          counted in &ldquo;Invested&rdquo; but not shown here.
        </p>
      )}
    </div>
  )
}
