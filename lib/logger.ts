// Log routing: All structured JSON logs are written to stdout.
// In production, configure log ingestion (e.g., Datadog, Loki) to forward stdout.
// Set LOG_LEVEL=error|warn|info|debug to control verbosity.
// Defaults: "debug" in development, "info" in all other environments.

type LogLevel = "debug" | "info" | "warn" | "error"

type LogContext = Record<string, unknown>

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

function resolveMinLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase()
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel as LogLevel
  }
  return process.env.NODE_ENV === "development" ? "debug" : "info"
}

const minLevel: LogLevel = resolveMinLevel()

/** Structured JSON logger with optional correlation ID. @source */
export interface Logger {
  /** Log at debug level. @source */
  debug(message: string, context?: LogContext): void
  /** Log at info level. @source */
  info(message: string, context?: LogContext): void
  /** Log at warn level. @source */
  warn(message: string, context?: LogContext): void
  /** Log at error level. @source */
  error(message: string, context?: LogContext): void
  /** Returns a child logger with the given correlation ID baked in. @source */
  withCorrelationId(id: string): Logger
}

const write = (
  level: LogLevel,
  message: string,
  correlationId: string | undefined,
  context?: LogContext
) => {
  if (LOG_LEVELS[level] < LOG_LEVELS[minLevel]) return

  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    ...(correlationId ? { correlationId } : {}),
    message,
    ...context
  }

  const line = JSON.stringify(entry)

  switch (level) {
    case "debug":
      console.debug(line)
      break
    case "info":
      console.info(line)
      break
    case "warn":
      console.warn(line)
      break
    case "error":
      console.error(line)
      break
  }
}

const createLogger = (correlationId?: string): Logger => ({
  debug: (message, context) => write("debug", message, correlationId, context),
  info: (message, context) => write("info", message, correlationId, context),
  warn: (message, context) => write("warn", message, correlationId, context),
  error: (message, context) => write("error", message, correlationId, context),
  withCorrelationId: (id) => createLogger(id)
})

/** Root structured logger instance. @source */
export const logger = createLogger()
