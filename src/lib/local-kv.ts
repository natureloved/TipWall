type SetOptions = {
  nx?: boolean
  px?: number
  ex?: number
}

type SortedMember = { score: number; member: string }

/**
 * Small Redis-shaped store used only by the development KV transport fallback.
 * It intentionally lives in memory: production always uses the configured
 * Vercel KV instance, while local development should remain usable when the
 * sandbox or a developer network cannot reach Upstash.
 */
export class LocalKv {
  private readonly values = new Map<string, unknown>()
  private readonly expires = new Map<string, number>()

  private purge(key: string): void {
    const expiresAt = this.expires.get(key)
    if (expiresAt != null && expiresAt <= Date.now()) {
      this.values.delete(key)
      this.expires.delete(key)
    }
  }

  private value<T>(key: string): T | null {
    this.purge(key)
    return (this.values.get(key) as T | undefined) ?? null
  }

  private setExpiry(key: string, options?: SetOptions): void {
    const ttlMs = options?.px ?? (options?.ex != null ? options.ex * 1000 : undefined)
    if (ttlMs != null) this.expires.set(key, Date.now() + ttlMs)
    else this.expires.delete(key)
  }

  async get<T>(key: string): Promise<T | null> {
    return this.value<T>(key)
  }

  async set<T>(key: string, value: T, options?: SetOptions): Promise<'OK' | null> {
    if (options?.nx && this.value(key) !== null) return null
    this.values.set(key, value)
    this.setExpiry(key, options)
    return 'OK'
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0
    for (const key of keys) {
      this.purge(key)
      if (this.values.delete(key)) deleted++
      this.expires.delete(key)
    }
    return deleted
  }

  async mget<T extends unknown[]>(...keys: string[]): Promise<T> {
    return keys.map(key => this.value(key)) as T
  }

  async incr(key: string): Promise<number> {
    return this.incrby(key, 1)
  }

  async incrby(key: string, amount: number): Promise<number> {
    const next = Number(this.value<number>(key) ?? 0) + Number(amount)
    this.values.set(key, next)
    return next
  }

  async lpush(key: string, ...items: unknown[]): Promise<number> {
    const list = this.value<unknown[]>(key) || []
    for (const item of items) list.unshift(item)
    this.values.set(key, list)
    return list.length
  }

  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    const list = this.value<unknown[]>(key) || []
    const end = stop < 0 ? list.length + stop : stop
    return list
      .slice(start, end + 1)
      .map(item => {
        if (typeof item !== 'string') return item
        try { return JSON.parse(item) } catch { return item }
      }) as T[]
  }

  async sadd(key: string, ...members: unknown[]): Promise<number> {
    const set = this.value<Set<string>>(key) || new Set<string>()
    let added = 0
    for (const member of members) {
      const normalized = String(member)
      if (!set.has(normalized)) {
        set.add(normalized)
        added++
      }
    }
    this.values.set(key, set)
    return added
  }

  async smembers<T>(key: string): Promise<T> {
    return [...(this.value<Set<string>>(key) || new Set<string>())] as T
  }

  async srem(key: string, ...members: unknown[]): Promise<number> {
    const set = this.value<Set<string>>(key) || new Set<string>()
    let removed = 0
    for (const member of members) if (set.delete(String(member))) removed++
    if (set.size) this.values.set(key, set)
    else await this.del(key)
    return removed
  }

  async scard(key: string): Promise<number> {
    return (this.value<Set<string>>(key) || new Set<string>()).size
  }

  async zadd(key: string, ...entries: unknown[]): Promise<number> {
    const sorted = this.value<SortedMember[]>(key) || []
    let added = 0
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue
      const item = entry as { score?: unknown; member?: unknown }
      const member = String(item.member ?? '')
      if (!member) continue
      const existing = sorted.find(row => row.member === member)
      if (existing) existing.score = Number(item.score) || 0
      else {
        sorted.push({ score: Number(item.score) || 0, member })
        added++
      }
    }
    this.values.set(key, sorted)
    return added
  }

  async zrange<T>(key: string, start: number, stop: number, options?: { rev?: boolean }): Promise<T> {
    const sorted = [...(this.value<SortedMember[]>(key) || [])]
      .sort((a, b) => options?.rev ? b.score - a.score : a.score - b.score)
    const end = stop < 0 ? sorted.length + stop : stop
    return sorted.slice(start, end + 1).map(row => row.member) as T
  }

  async zrem(key: string, ...members: unknown[]): Promise<number> {
    const before = this.value<SortedMember[]>(key) || []
    const blocked = new Set(members.map(String))
    const after = before.filter(row => !blocked.has(row.member))
    if (after.length) this.values.set(key, after)
    else await this.del(key)
    return before.length - after.length
  }

  async hgetall<T>(key: string): Promise<T | null> {
    return this.value<T>(key)
  }

  async hincrby(key: string, field: string, amount: number): Promise<number> {
    const hash = this.value<Record<string, number>>(key) || {}
    hash[field] = Number(hash[field] || 0) + Number(amount)
    this.values.set(key, hash)
    return hash[field]
  }

  /** Handle the small set of Lua operations used by TipWall's data layer. */
  async eval(script: string, keys: string[], args: string[]): Promise<number> {
    if (script.includes("SADD',KEYS[2]") && script.includes("LPUSH', KEYS[4]")) {
      if (await this.sadd(keys[0], args[0]) !== 1) return 0
      await this.sadd(keys[1], args[0])
      if (args[2] === '1') await this.sadd(keys[2], args[0])
      await this.lpush(keys[3], args[1])
      return 1
    }

    if (script.includes('claim.claimed=true')) {
      const claim = await this.get<Record<string, unknown>>(keys[0])
      if (!claim || claim.claimed) return 0
      claim.claimed = true
      claim.claimedAt = Number(args[0])
      if (args[1]) claim.claimTxHash = args[1]
      await this.set(keys[0], claim, { px: Number(args[2]) })
      return 1
    }

    if (script.includes('incoming.threshold')) {
      const rows = (await this.get<Array<{ threshold: number }>>(keys[0])) || []
      const incoming = JSON.parse(args[0]) as { threshold: number }
      if (rows.some(row => row.threshold === incoming.threshold)) return 0
      rows.push(incoming)
      rows.sort((a, b) => a.threshold - b.threshold)
      await this.set(keys[0], rows)
      return 1
    }

    const rows = (await this.lrange<Record<string, unknown>>(keys[0], 0, -1))
    const tipId = args[0]
    const index = rows.findIndex(row => row.id === tipId)
    if (index < 0) return 0

    if (script.includes('item.reply=cjson.decode')) {
      rows[index].reply = JSON.parse(args[1])
      await this.replaceList(keys[0], rows)
      return 1
    }

    if (script.includes('item.message=nil')) {
      rows[index].message = undefined
      rows[index].senderName = undefined
      rows[index].reply = undefined
      rows[index].anonymous = true
      rows[index].hiddenAt = Number(args[1])
      rows[index].deletedAt = Number(args[1])
      await this.replaceList(keys[0], rows)
      return 1
    }

    if (script.includes('item.hiddenAt=tonumber')) {
      if (rows[index].deletedAt && args[1] !== '1') return -1
      rows[index].hiddenAt = args[1] === '1' ? Number(args[2]) : undefined
      await this.replaceList(keys[0], rows)
      return 1
    }

    if (script.includes("ARGV[2]=='remove'") && script.includes('verificationAttempts')) {
      if (args[1] === 'remove') rows.splice(index, 1)
      else if (args[1] === 'retry') {
        const attempts = Number(rows[index].verificationAttempts || 0) + 1
        if (attempts >= Number(args[4])) rows.splice(index, 1)
        else {
          rows[index].verificationAttempts = attempts
          rows[index].nextVerificationAt = Number(args[3])
        }
      } else {
        rows[index].verified = true
        rows[index].verificationAttempts = undefined
        rows[index].nextVerificationAt = undefined
        if (args[2]) rows[index].senderAddress = args[2]
      }
      await this.replaceList(keys[0], rows)
      return 1
    }

    return 0
  }

  private async replaceList(key: string, rows: unknown[]): Promise<void> {
    if (rows.length) this.values.set(key, rows)
    else await this.del(key)
  }
}
