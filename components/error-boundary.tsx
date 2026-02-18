"use client"

import type { ErrorInfo, ReactNode } from "react"
import { Component } from "react"

import { Button } from "@/components/ui/button"
import { logger } from "@/lib/logger"

interface ErrorBoundaryProps {
  readonly children: ReactNode
  readonly fallback?: ReactNode
  readonly onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * React error boundary that catches rendering errors in child components.
 * Displays a fallback UI and logs errors via the structured logger.
 * @source
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error("ErrorBoundary caught an error", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack ?? undefined
    })
  }

  resetErrorBoundary = () => {
    this.props.onReset?.()
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return <ErrorFallback onReset={this.resetErrorBoundary} />
    }

    return this.props.children
  }
}

/** Default fallback UI shown when an error boundary catches an error. @source */
function ErrorFallback({ onReset }: { readonly onReset: () => void }) {
  return (
    <div
      role="alert"
      className="glass-card flex flex-col items-center justify-center rounded-2xl px-6 py-10 text-center"
    >
      <div className="bg-destructive/10 text-destructive mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" x2="12" y1="8" y2="12" />
          <line x1="12" x2="12.01" y1="16" y2="16" />
        </svg>
      </div>
      <h3 className="font-display mb-1 text-base font-semibold">
        Something went wrong
      </h3>
      <p className="text-muted-foreground mb-4 max-w-xs text-sm">
        This section encountered an unexpected error.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={onReset}
        className="rounded-xl"
      >
        Try Again
      </Button>
    </div>
  )
}
