/** Extract a native NIM balance (in luna) from common Nimiq RPC responses. */
export function parseBalanceLuna(payload: unknown): number | null {
  const queue: unknown[] = [payload]
  const seen = new Set<object>()

  while (queue.length > 0) {
    const current = queue.shift()
    if (current == null) continue

    if (typeof current === 'number' || typeof current === 'string') {
      const value = Number(current)
      if (Number.isFinite(value) && value >= 0) return value
      continue
    }

    if (typeof current !== 'object') continue
    if (seen.has(current)) continue
    seen.add(current)

    const record = current as Record<string, unknown>
    for (const key of ['balance', 'balanceLuna', 'lunaBalance']) {
      const value = record[key]
      if (typeof value === 'number' || typeof value === 'string') {
        const parsed = Number(value)
        if (Number.isFinite(parsed) && parsed >= 0) return parsed
      }
    }

    for (const key of ['result', 'data', 'account']) {
      if (record[key] != null) queue.push(record[key])
    }
  }

  return null
}
