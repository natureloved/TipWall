// Throwaway probe: confirm the IBAN mod-97 checksum round-trips against a real
// mainnet address before committing the validator to src/.
const NIMIQ_BASE32_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVXY'

function ibanCheck(str) {
  let num = ''
  for (const ch of str) {
    const code = ch.charCodeAt(0)
    num += code >= 48 && code <= 57 ? ch : (code - 55).toString()
  }
  let remainder = 0
  for (let i = 0; i < num.length; i += 6) {
    remainder = Number(remainder + num.slice(i, i + 6)) % 97
  }
  return remainder
}

function expectedCheckDigits(base32) {
  const check = ibanCheck(base32 + 'NQ00')
  return ('0' + (98 - check)).slice(-2)
}

// Real address pulled from the live TipWall API.
const REAL = 'NQ597VFNKLU86GK2DHMQYEK0Q6R1512X7HGE'
const base32 = REAL.slice(4)
const actual = REAL.slice(2, 4)
const expected = expectedCheckDigits(base32)

console.log('address      :', REAL)
console.log('length       :', REAL.length, '(expect 36)')
console.log('base32 part  :', base32, `(len ${base32.length}, expect 32)`)
console.log('check digits :', actual, 'expected', expected)
console.log('VALID        :', actual === expected)

// Every char must be in the alphabet.
const bad = [...base32].filter(c => !NIMIQ_BASE32_ALPHABET.includes(c))
console.log('bad chars    :', bad.length === 0 ? 'none' : bad.join(','))

// Negative controls: mutate one base32 char, checksum must now fail.
let mutationsCaught = 0
for (let i = 0; i < base32.length; i++) {
  const swap = base32[i] === 'A' ? 'B' : 'A'
  const mutated = base32.slice(0, i) + swap + base32.slice(i + 1)
  if (expectedCheckDigits(mutated) !== actual) mutationsCaught++
}
console.log(`single-char mutations caught: ${mutationsCaught}/${base32.length}`)

// Negative control: wrong check digits must fail.
console.log('bad checkdigits rejected:', expectedCheckDigits(base32) !== '42')
