type LogLevel = 'info' | 'warn' | 'error'
type LogContext = Record<string, unknown>

function serializeError(error: unknown): LogContext {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack }
  }
  return { message: String(error) }
}

/** Emit machine-readable logs that Vercel and log drains can index directly. */
export function log(level: LogLevel, event: string, context: LogContext = {}): void {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    service: 'tipwall',
    level,
    event,
    ...context,
  })
  if (level === 'error') console.error(entry)
  else if (level === 'warn') console.warn(entry)
  else console.log(entry)
}

export function logError(event: string, error: unknown, context: LogContext = {}): void {
  log('error', event, { ...context, error: serializeError(error) })
}
