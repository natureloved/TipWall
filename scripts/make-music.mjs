// Synthesizes a warm, upbeat ambient bed for the demo video (original,
// royalty-free by construction). Output: 16-bit stereo WAV.
// Usage: node scripts/make-music.mjs <out.wav> <seconds>
import { writeFileSync } from 'node:fs'

const OUT = process.argv[2] || 'music.wav'
const SECONDS = Number(process.argv[3] || 78)
const SR = 44100
const BPM = 88
const BEAT = 60 / BPM

// F — Am — C — G, two bars (8 beats) per chord.
const CHORDS = [
  { pad: [174.61, 220.0, 261.63], bass: 87.31 },  // F
  { pad: [220.0, 261.63, 329.63], bass: 110.0 },  // Am
  { pad: [261.63, 329.63, 392.0], bass: 130.81 }, // C
  { pad: [196.0, 246.94, 293.66], bass: 98.0 },   // G
]
const CHORD_BEATS = 8

const N = Math.floor(SECONDS * SR)
const L = new Float64Array(N)
const R = new Float64Array(N)

const TWO_PI = Math.PI * 2

function addTone(buf, startS, durS, freq, amp, { attack = 0.01, release = 0.05, detune = 0 } = {}) {
  const start = Math.floor(startS * SR)
  const len = Math.floor(durS * SR)
  const f = freq * (1 + detune)
  for (let i = 0; i < len && start + i < N; i++) {
    const t = i / SR
    let env = 1
    if (t < attack) env = t / attack
    else if (t > durS - release) env = Math.max(0, (durS - t) / release)
    buf[start + i] += Math.sin(TWO_PI * f * t) * amp * env
  }
}

function addPluck(buf, startS, freq, amp) {
  const start = Math.floor(startS * SR)
  const durS = 0.9
  const len = Math.floor(durS * SR)
  for (let i = 0; i < len && start + i < N; i++) {
    const t = i / SR
    const env = Math.exp(-t * 6) * Math.min(1, t / 0.004)
    // fundamental + a whisper of 2nd harmonic for body
    buf[start + i] += (Math.sin(TWO_PI * freq * t) + 0.3 * Math.sin(TWO_PI * freq * 2 * t)) * amp * env
  }
}

let seed = 42
const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32 - 0.5

function addShaker(buf, startS, amp) {
  const start = Math.floor(startS * SR)
  const len = Math.floor(0.07 * SR)
  let hp = 0
  for (let i = 0; i < len && start + i < N; i++) {
    const t = i / SR
    const n = rand()
    hp = 0.7 * hp + n // crude high-pass-ish colored noise
    buf[start + i] += (n - hp * 0.5) * amp * Math.exp(-t * 60)
  }
}

const totalBeats = Math.ceil(SECONDS / BEAT)
for (let beat = 0; beat < totalBeats; beat++) {
  const tBeat = beat * BEAT
  const chord = CHORDS[Math.floor(beat / CHORD_BEATS) % CHORDS.length]

  // Pad: sustain each chord for its full 8 beats, retriggered at chord start.
  if (beat % CHORD_BEATS === 0) {
    const dur = CHORD_BEATS * BEAT + 0.4
    for (const f of chord.pad) {
      addTone(L, tBeat, dur, f, 0.045, { attack: 1.2, release: 1.2, detune: +0.0011 })
      addTone(R, tBeat, dur, f, 0.045, { attack: 1.2, release: 1.2, detune: -0.0011 })
      // airy octave above, quieter
      addTone(L, tBeat, dur, f * 2, 0.012, { attack: 1.6, release: 1.4, detune: -0.0008 })
      addTone(R, tBeat, dur, f * 2, 0.012, { attack: 1.6, release: 1.4, detune: +0.0008 })
    }
  }

  // Bass: root on beats 1 and 3 of each bar (4/4).
  if (beat % 2 === 0) {
    addTone(L, tBeat, BEAT * 1.6, chord.bass, 0.10, { attack: 0.015, release: 0.35 })
    addTone(R, tBeat, BEAT * 1.6, chord.bass, 0.10, { attack: 0.015, release: 0.35 })
  }

  // Arpeggio: gentle plucks on 8ths, cycling chord tones an octave up.
  for (let half = 0; half < 2; half++) {
    const idx = (beat * 2 + half) % chord.pad.length
    const t = tBeat + half * BEAT * 0.5
    const pan = idx / (chord.pad.length - 1) // spread across the field
    addPluck(L, t, chord.pad[idx] * 2, 0.035 * (1 - pan * 0.5))
    addPluck(R, t, chord.pad[idx] * 2, 0.035 * (0.5 + pan * 0.5))
  }

  // Soft shaker on the offbeat for momentum.
  addShaker(L, tBeat + BEAT * 0.5, 0.03)
  addShaker(R, tBeat + BEAT * 0.5, 0.03)
}

// Master fades: 1.5s in, 5s out.
const fadeIn = 1.5 * SR
const fadeOut = 5 * SR
for (let i = 0; i < N; i++) {
  let g = 1
  if (i < fadeIn) g = i / fadeIn
  if (i > N - fadeOut) g = Math.min(g, (N - i) / fadeOut)
  L[i] *= g
  R[i] *= g
}

// Normalize to a modest bed level (peak ~0.5 so voices/captions stay primary).
let peak = 0
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
const gain = peak > 0 ? 0.5 / peak : 1

// Write 16-bit stereo PCM WAV.
const dataBytes = N * 2 * 2
const buf = Buffer.alloc(44 + dataBytes)
buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataBytes, 4); buf.write('WAVE', 8)
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20)
buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28)
buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34)
buf.write('data', 36); buf.writeUInt32LE(dataBytes, 40)
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * gain * 32767))), 44 + i * 4)
  buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[i] * gain * 32767))), 44 + i * 4 + 2)
}
writeFileSync(OUT, buf)
console.log('WAV:', OUT, `${SECONDS}s`)
