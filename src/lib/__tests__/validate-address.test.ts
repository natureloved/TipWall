import { describe, it, expect } from 'vitest'
import {
  isValidNimiqAddress,
  nimiqAddressError,
  nimiqCheckDigits,
  ibanCheck,
  NIMIQ_ADDRESS_LENGTH,
  NIMIQ_BASE32_ALPHABET,
} from '../profile-auth'
import { addressFromPublicKey } from '../verify-signature'

// A real mainnet address (TipWall's own wall), fetched from the live API and
// verified independently. Anchor fixture: if this ever stops validating, the
// checksum implementation has drifted from the real network.
const REAL_ADDRESS = 'NQ597VFNKLU86GK2DHMQYEK0Q6R1512X7HGE'

describe('isValidNimiqAddress', () => {
  it('accepts a real mainnet address', () => {
    expect(isValidNimiqAddress(REAL_ADDRESS)).toBe(true)
  })

  it('accepts the grouped "NQxx xxxx..." form people paste from wallets', () => {
    const grouped = 'NQ59 7VFN KLU8 6GK2 DHMQ YEK0 Q6R1 512X 7HGE'
    expect(isValidNimiqAddress(grouped)).toBe(true)
  })

  it('is case-insensitive on input', () => {
    expect(isValidNimiqAddress(REAL_ADDRESS.toLowerCase())).toBe(true)
  })

  it('rejects empty / whitespace', () => {
    expect(isValidNimiqAddress('')).toBe(false)
    expect(isValidNimiqAddress('   ')).toBe(false)
  })

  it('rejects a wrong prefix', () => {
    expect(isValidNimiqAddress('XX597VFNKLU86GK2DHMQYEK0Q6R1512X7HGE')).toBe(false)
  })

  it('rejects wrong length', () => {
    expect(isValidNimiqAddress(REAL_ADDRESS.slice(0, 35))).toBe(false)
    expect(isValidNimiqAddress(REAL_ADDRESS + 'A')).toBe(false)
  })

  it('rejects characters outside the Nimiq base32 alphabet (I, L, O, Z)', () => {
    for (const ch of ['I', 'L', 'O', 'Z']) {
      const body = ch + REAL_ADDRESS.slice(5)
      expect(isValidNimiqAddress(`NQ59${body}`)).toBe(false)
    }
  })

  // The bug this whole module exists to prevent: a one-character paste typo
  // must never produce a wall that can receive money.
  it('catches every single-character typo', () => {
    const body = REAL_ADDRESS.slice(4)
    for (let i = 0; i < body.length; i++) {
      const swap = body[i] === 'A' ? 'B' : 'A'
      const mutated = `NQ59${body.slice(0, i)}${swap}${body.slice(i + 1)}`
      expect(isValidNimiqAddress(mutated)).toBe(false)
    }
  })

  it('catches wrong check digits', () => {
    const wrongDigits = REAL_ADDRESS.slice(0, 2) + '42' + REAL_ADDRESS.slice(4)
    expect(isValidNimiqAddress(wrongDigits)).toBe(false)
  })

  it('catches adjacent transpositions', () => {
    const body = REAL_ADDRESS.slice(4)
    let caught = 0
    for (let i = 0; i < body.length - 1; i++) {
      const swapped =
        body.slice(0, i) + body[i + 1] + body[i] + body.slice(i + 2)
      if (!isValidNimiqAddress(`NQ59${swapped}`)) caught++
    }
    // mod-97 catches essentially all transpositions; assert a strong majority
    // rather than a brittle exact number.
    expect(caught).toBeGreaterThanOrEqual(body.length - 2)
  })
})

describe('nimiqAddressError', () => {
  it('returns null for a valid address', () => {
    expect(nimiqAddressError(REAL_ADDRESS)).toBeNull()
  })

  it('gives a specific message for a checksum failure', () => {
    const msg = nimiqAddressError('NQ427VFNKLU86GK2DHMQYEK0Q6R1512X7HGE')
    expect(msg).toMatch(/not valid/i)
  })

  it('gives a specific message for a bad prefix', () => {
    expect(nimiqAddressError('XX597VFNKLU86GK2DHMQYEK0Q6R1512X7HGE')).toMatch(/start with NQ/i)
  })

  it('gives a specific message for a bad length', () => {
    expect(nimiqAddressError('NQ59 TOOSHORT')).toMatch(/36 characters/)
  })
})

describe('derivation and validation agree', () => {
  // Guards the refactor that removed the duplicated ibanCheck: a derived
  // address must always pass the validator, or signing and payout diverge.
  it('every address derived from a public key validates', () => {
    for (let i = 0; i < 25; i++) {
      const pubkey = new Uint8Array(32).fill(0)
      // Deterministic but varied: fill from a simple PRNG seeded by index.
      let seed = i * 2654435761
      for (let b = 0; b < 32; b++) {
        seed = (seed * 1103515245 + 12345) % 2147483648
        pubkey[b] = seed & 0xff
      }
      const derived = addressFromPublicKey(pubkey)
      expect(derived).toHaveLength(NIMIQ_ADDRESS_LENGTH)
      expect(isValidNimiqAddress(derived)).toBe(true)
    }
  })
})

describe('nimiqCheckDigits / ibanCheck', () => {
  it('reproduces the check digits of a known address', () => {
    expect(nimiqCheckDigits(REAL_ADDRESS.slice(4))).toBe('59')
  })

  it('produces two digits for any 32-char body', () => {
    const body = REAL_ADDRESS.slice(4)
    expect(nimiqCheckDigits(body)).toMatch(/^\d{2}$/)
  })

  it('ibanCheck stays within mod-97 range', () => {
    for (const s of ['NQ00', 'ABC', '7VFNKLU86GK2DHMQYEK0Q6R1512X7HGENQ00']) {
      const v = ibanCheck(s)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(97)
    }
  })

  it('alphabet is 32 distinct chars', () => {
    expect(NIMIQ_BASE32_ALPHABET).toHaveLength(32)
    expect(new Set(NIMIQ_BASE32_ALPHABET).size).toBe(32)
  })
})
