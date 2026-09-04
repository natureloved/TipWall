import { describe, expect, it } from 'vitest'
import { LocalKv } from '../local-kv'

describe('LocalKv', () => {
  it('supports expiring NX writes used by rate limits', async () => {
    const store = new LocalKv()
    await expect(store.set('counter', 1, { nx: true, px: 60_000 })).resolves.toBe('OK')
    await expect(store.set('counter', 2, { nx: true, px: 60_000 })).resolves.toBeNull()
    await expect(store.get('counter')).resolves.toBe(1)
  })

  it('keeps profile indexes and recent activity ordered', async () => {
    const store = new LocalKv()
    await store.sadd('profiles', 'Alice', 'bob', 'Alice')
    await store.zadd('active', { score: 1, member: 'alice' }, { score: 3, member: 'bob' })

    await expect(store.smembers<string[]>('profiles')).resolves.toEqual(['Alice', 'bob'])
    await expect(store.zrange<string[]>('active', 0, -1, { rev: true })).resolves.toEqual(['bob', 'alice'])
  })

  it('records a tip atomically and prevents a transaction replay', async () => {
    const store = new LocalKv()
    const script = "if redis.call('SADD', KEYS[1], ARGV[1]) == 1 then redis.call('SADD',KEYS[2],ARGV[1]); if ARGV[3]=='1' then redis.call('SADD',KEYS[3],ARGV[1]) end; redis.call('LPUSH', KEYS[4], ARGV[2]); return 1 else return 0 end"
    const tip = JSON.stringify({ id: 'tip-1', verified: true, amountNIM: 2 })

    await expect(store.eval(script, ['all', 'wall', 'verified', 'tips'], ['tx-1', tip, '1'])).resolves.toBe(1)
    await expect(store.eval(script, ['all', 'wall', 'verified', 'tips'], ['tx-1', tip, '1'])).resolves.toBe(0)
    await expect(store.lrange('tips', 0, -1)).resolves.toEqual([{ id: 'tip-1', verified: true, amountNIM: 2 }])
  })
})
