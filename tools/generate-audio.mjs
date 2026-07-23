import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const RATE = 22050
const OUT_DIR = fileURLToPath(new URL('../packages/client/public/audio/', import.meta.url))

const TAU = Math.PI * 2

function createRng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const sine = phase => Math.sin(TAU * phase)
const square = phase => (phase % 1 < 0.5 ? 1 : -1)
const saw = phase => 2 * (phase % 1) - 1

function render(durationSeconds, fill) {
  const samples = new Float64Array(Math.floor(RATE * durationSeconds))
  fill(samples)
  return samples
}

function tone(samples, { from, to = from, start = 0, duration, wave = sine, gain = 0.5, attack = 0.005, decay = 0.08 }) {
  const startIndex = Math.floor(start * RATE)
  const count = Math.floor(duration * RATE)
  let phase = 0
  for (let i = 0; i < count && startIndex + i < samples.length; i++) {
    const t = i / count
    const freq = from + (to - from) * t
    phase += freq / RATE
    const attackEnv = Math.min(1, i / Math.max(1, attack * RATE))
    const decayEnv = Math.exp(-t * (duration / decay))
    samples[startIndex + i] += wave(phase) * gain * attackEnv * decayEnv
  }
}

function noise(samples, { start = 0, duration, gain = 0.4, decay = 0.05, rng }) {
  const startIndex = Math.floor(start * RATE)
  const count = Math.floor(duration * RATE)
  for (let i = 0; i < count && startIndex + i < samples.length; i++) {
    const t = i / count
    samples[startIndex + i] += (rng() * 2 - 1) * gain * Math.exp(-t * (duration / decay))
  }
}

function toWav(samples) {
  let peak = 0
  for (const value of samples) peak = Math.max(peak, Math.abs(value))
  const scale = peak > 0 ? 0.85 / peak : 1
  const data = Buffer.alloc(samples.length * 2)
  samples.forEach((value, index) => data.writeInt16LE(Math.round(value * scale * 32767), index * 2))
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(RATE, 24)
  header.writeUInt32LE(RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

const NOTE = {
  A2: 110, C3: 130.81, D3: 146.83, E3: 164.81, G3: 196,
  A3: 220, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392,
  A4: 440, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5
}

function battleLoop() {
  const beat = 60 / 132
  const bars = 8
  const duration = bars * 4 * beat
  const rng = createRng(7)
  const bassLine = [NOTE.A2, NOTE.A2, NOTE.C3, NOTE.A2, NOTE.D3, NOTE.D3, NOTE.C3, NOTE.G3]
  const arpNotes = [NOTE.A4, NOTE.C5, NOTE.E5, NOTE.G5, NOTE.E5, NOTE.C5]
  return render(duration, samples => {
    for (let step = 0; step < bars * 4; step++) {
      const start = step * beat
      const bass = bassLine[Math.floor(step / 2) % bassLine.length]
      tone(samples, { from: bass, start, duration: beat * 0.9, wave: square, gain: 0.16, decay: 0.5 })
      noise(samples, { start: start + beat / 2, duration: 0.03, gain: 0.1, decay: 0.02, rng })
      for (let sub = 0; sub < 2; sub++) {
        const arp = arpNotes[(step * 2 + sub) % arpNotes.length]
        tone(samples, { from: arp, start: start + sub * beat * 0.5, duration: beat * 0.45, wave: saw, gain: 0.09, decay: 0.2 })
      }
    }
  })
}

function calmLoop() {
  const beat = 60 / 76
  const bars = 4
  const duration = bars * 4 * beat
  const chords = [
    [NOTE.A3, NOTE.C4, NOTE.E4],
    [NOTE.G3, NOTE.C4, NOTE.E4],
    [NOTE.A3, NOTE.D4, NOTE.G4],
    [NOTE.G3, NOTE.C4, NOTE.D4]
  ]
  return render(duration, samples => {
    chords.forEach((chord, bar) => {
      const start = bar * 4 * beat
      for (const freq of chord) {
        tone(samples, { from: freq, start, duration: 4 * beat, gain: 0.1, attack: 0.4, decay: 2.5 })
      }
      const twinkle = [NOTE.E5, NOTE.C5, NOTE.G4, NOTE.C5]
      tone(samples, { from: twinkle[bar % twinkle.length], start: start + 2 * beat, duration: beat, gain: 0.06, attack: 0.05, decay: 0.6 })
    })
  })
}

const rng = createRng(42)
const sounds = {
  'shoot.wav': render(0.12, s => tone(s, { from: 880, to: 330, duration: 0.1, wave: square, gain: 0.4, decay: 0.04 })),
  'enemy-hit.wav': render(0.1, s => noise(s, { duration: 0.08, gain: 0.5, decay: 0.03, rng })),
  'enemy-down.wav': render(0.28, s => {
    tone(s, { from: 320, to: 70, duration: 0.24, wave: saw, gain: 0.4, decay: 0.1 })
    noise(s, { start: 0.02, duration: 0.12, gain: 0.2, decay: 0.05, rng })
  }),
  'orb.wav': render(0.16, s => tone(s, { from: 660, to: 1050, duration: 0.13, gain: 0.35, decay: 0.06 })),
  'level-up.wav': render(0.5, s => {
    ;[NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((freq, i) => tone(s, { from: freq, start: i * 0.09, duration: 0.18, gain: 0.3, decay: 0.12 }))
  }),
  'player-down.wav': render(0.5, s => tone(s, { from: 130, to: 36, duration: 0.45, gain: 0.5, decay: 0.3 })),
  'shop-open.wav': render(0.35, s => {
    tone(s, { from: NOTE.G4, start: 0, duration: 0.15, gain: 0.3, decay: 0.1 })
    tone(s, { from: NOTE.C5, start: 0.12, duration: 0.2, gain: 0.3, decay: 0.12 })
  }),
  'gear-pick.wav': render(0.3, s => {
    tone(s, { from: NOTE.E5, start: 0, duration: 0.1, gain: 0.3, decay: 0.06 })
    tone(s, { from: NOTE.A5, start: 0.08, duration: 0.18, gain: 0.3, decay: 0.1 })
  }),
  'countdown-tick.wav': render(0.07, s => tone(s, { from: 1000, duration: 0.05, wave: square, gain: 0.25, decay: 0.02 })),
  'wave-start.wav': render(0.45, s => {
    tone(s, { from: 220, to: 880, duration: 0.25, wave: saw, gain: 0.25, decay: 0.2 })
    ;[NOTE.A4, NOTE.E5].forEach(freq => tone(s, { from: freq, start: 0.24, duration: 0.2, gain: 0.28, decay: 0.12 }))
  }),
  'run-over.wav': render(0.9, s => {
    ;[NOTE.E4, NOTE.D4, NOTE.A3].forEach((freq, i) => tone(s, { from: freq, start: i * 0.22, duration: 0.4, gain: 0.32, decay: 0.3 }))
  }),
  'music-battle.wav': battleLoop(),
  'music-calm.wav': calmLoop()
}

mkdirSync(OUT_DIR, { recursive: true })
for (const [name, samples] of Object.entries(sounds)) {
  const wav = toWav(samples)
  writeFileSync(`${OUT_DIR}${name}`, wav)
  console.log(`${name} ${(wav.length / 1024).toFixed(0)}kB`)
}
