type LogLevel = "debug" | "info" | "warn" | "error"

type LogContext = Record<string, unknown>

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
