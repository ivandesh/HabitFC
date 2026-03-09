// Synthesized sound effects — Web Audio API, no external files

let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function noise(ac: AudioContext, secs: number) {
  const n = Math.floor(ac.sampleRate * secs)
  const buf = ac.createBuffer(1, n, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
  return buf
}

function vol(ac: AudioContext): GainNode {
  const g = ac.createGain()
  g.gain.value = 0
  return g
}

// ─── Habit complete: retro power-up sweep → bright ding ──────────────────────
// Triangle wave swoops from 200 → 880 Hz (feels like grabbing a collectible),
// then a two-note "ding" rings out.
export function playHabitComplete() {
  try {
    const ac = getCtx()
    const t = ac.currentTime

    // Swooping glide
    const sweep = ac.createOscillator()
    const sg = vol(ac)
    sweep.connect(sg); sg.connect(ac.destination)
    sweep.type = 'triangle'
    sweep.frequency.setValueAtTime(200, t)
    sweep.frequency.exponentialRampToValueAtTime(880, t + 0.11)
    sg.gain.setValueAtTime(0, t)
    sg.gain.linearRampToValueAtTime(0.28, t + 0.01)
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.17)
    sweep.start(t); sweep.stop(t + 0.2)

    // E6 ding
    const ding = ac.createOscillator()
    const dg = vol(ac)
    ding.connect(dg); dg.connect(ac.destination)
    ding.type = 'sine'
    ding.frequency.value = 1318.5
    dg.gain.setValueAtTime(0, t + 0.09)
    dg.gain.linearRampToValueAtTime(0.22, t + 0.1)
    dg.gain.exponentialRampToValueAtTime(0.001, t + 0.55)
    ding.start(t + 0.09); ding.stop(t + 0.6)

    // G6 harmony, slightly behind
    const ding2 = ac.createOscillator()
    const dg2 = vol(ac)
    ding2.connect(dg2); dg2.connect(ac.destination)
    ding2.type = 'sine'
    ding2.frequency.value = 1567.98
    dg2.gain.setValueAtTime(0, t + 0.14)
    dg2.gain.linearRampToValueAtTime(0.13, t + 0.15)
    dg2.gain.exponentialRampToValueAtTime(0.001, t + 0.48)
    ding2.start(t + 0.14); ding2.stop(t + 0.52)
  } catch { /* audio blocked */ }
}

// ─── Pack open: tension noise → bass thud → sparkle shower ───────────────────
// 1. Bandpass noise sweeps upward (building tension)
// 2. Deep sine impact at ~120 Hz drops to 35 Hz (satisfying thud)
// 3. Sparkle sine cascade fires off (payoff)
export function playPackOpen() {
  try {
    const ac = getCtx()
    const t = ac.currentTime

    // 1. Tension noise sweep
    const ns = ac.createBufferSource()
    ns.buffer = noise(ac, 0.42)
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'; bp.Q.value = 1.2
    bp.frequency.setValueAtTime(200, t)
    bp.frequency.exponentialRampToValueAtTime(3200, t + 0.36)
    const ng = vol(ac)
    ns.connect(bp); bp.connect(ng); ng.connect(ac.destination)
    ng.gain.setValueAtTime(0, t)
    ng.gain.linearRampToValueAtTime(0.35, t + 0.3)
    ng.gain.linearRampToValueAtTime(0, t + 0.4)
    ns.start(t); ns.stop(t + 0.45)

    // 2a. Bass thud (sine pitch drop)
    const thud = ac.createOscillator()
    const tg = vol(ac)
    thud.connect(tg); tg.connect(ac.destination)
    thud.type = 'sine'
    thud.frequency.setValueAtTime(120, t + 0.33)
    thud.frequency.exponentialRampToValueAtTime(35, t + 0.62)
    tg.gain.setValueAtTime(0, t + 0.33)
    tg.gain.linearRampToValueAtTime(0.75, t + 0.345)
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.66)
    thud.start(t + 0.33); thud.stop(t + 0.7)

    // 2b. Noise punch layered on the thud
    const punch = ac.createBufferSource()
    punch.buffer = noise(ac, 0.07)
    const plp = ac.createBiquadFilter()
    plp.type = 'lowpass'; plp.frequency.value = 650
    const pg = vol(ac)
    punch.connect(plp); plp.connect(pg); pg.connect(ac.destination)
    pg.gain.setValueAtTime(0, t + 0.33)
    pg.gain.linearRampToValueAtTime(0.38, t + 0.337)
    pg.gain.exponentialRampToValueAtTime(0.001, t + 0.43)
    punch.start(t + 0.33); punch.stop(t + 0.44)

    // 3. Second rumble burst — reinforces the shake feeling
    const ns2 = ac.createBufferSource()
    ns2.buffer = noise(ac, 0.25)
    const bp2 = ac.createBiquadFilter()
    bp2.type = 'bandpass'; bp2.Q.value = 1.5
    bp2.frequency.setValueAtTime(800, t + 0.38)
    bp2.frequency.exponentialRampToValueAtTime(200, t + 0.62)
    const ng2 = vol(ac)
    ns2.connect(bp2); bp2.connect(ng2); ng2.connect(ac.destination)
    ng2.gain.setValueAtTime(0, t + 0.38)
    ng2.gain.linearRampToValueAtTime(0.22, t + 0.43)
    ng2.gain.exponentialRampToValueAtTime(0.001, t + 0.65)
    ns2.start(t + 0.38); ns2.stop(t + 0.68)
  } catch { /* audio blocked */ }
}

// ─── Card slide: soft airy swish ─────────────────────────────────────────────
// Broadband noise through a highpass — clean and unobtrusive.
export function playCardSlide() {
  try {
    const ac = getCtx()
    const t = ac.currentTime

    const swish = ac.createBufferSource()
    swish.buffer = noise(ac, 0.14)
    const hp = ac.createBiquadFilter()
    hp.type = 'highpass'; hp.frequency.value = 3000
    const g = vol(ac)
    swish.connect(hp); hp.connect(g); g.connect(ac.destination)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.1, t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13)
    swish.start(t); swish.stop(t + 0.15)
  } catch { /* audio blocked */ }
}

// ─── Card flip reveal: rarity-dependent ──────────────────────────────────────
// common    → quiet high-freq flip (nothing special, keeps it understated)
// rare      → FM bell: metallic crystal ping with shimmer tail
// epic      → power chord stab: three sawtooth notes through soft saturation
// legendary → orchestral reveal: bass note + warm chord + sparkle cascade
export function playCardFlip(rarity: 'common' | 'rare' | 'epic' | 'legendary' = 'common') {
  try {
    const ac = getCtx()
    const t = ac.currentTime

    // ── Common: understated flip ──────────────────────────────
    if (rarity === 'common') {
      const n = ac.createBufferSource()
      n.buffer = noise(ac, 0.06)
      const hp = ac.createBiquadFilter()
      hp.type = 'highpass'; hp.frequency.value = 5000
      const ng = vol(ac)
      n.connect(hp); hp.connect(ng); ng.connect(ac.destination)
      ng.gain.setValueAtTime(0, t)
      ng.gain.linearRampToValueAtTime(0.07, t + 0.004)
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
      n.start(t); n.stop(t + 0.07)
      return
    }

    // ── Rare: FM crystal bell ─────────────────────────────────
    // Carrier 1047 Hz (C6), modulated by ~3665 Hz with a decaying index.
    // High mod index at attack = metallic brightness; index decays → pure tone.
    if (rarity === 'rare') {
      const modFreq = 1047 * 3.5
      const mod = ac.createOscillator()
      const modGain = ac.createGain()
      mod.frequency.value = modFreq
      modGain.gain.setValueAtTime(900, t)
      modGain.gain.exponentialRampToValueAtTime(30, t + 0.08)
      modGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
      mod.connect(modGain)

      const carrier = ac.createOscillator()
      const carrierGain = vol(ac)
      carrier.frequency.value = 1047
      modGain.connect(carrier.frequency)
      carrier.connect(carrierGain); carrierGain.connect(ac.destination)
      carrierGain.gain.setValueAtTime(0, t)
      carrierGain.gain.linearRampToValueAtTime(0.22, t + 0.01)
      carrierGain.gain.exponentialRampToValueAtTime(0.001, t + 0.65)

      mod.start(t); mod.stop(t + 0.7)
      carrier.start(t); carrier.stop(t + 0.7)
      return
    }

    // ── Epic: power chord stab ────────────────────────────────
    // E4 / B4 / E5 as sawtooth waves through a soft waveshaper — gritty and punchy.
    if (rarity === 'epic') {
      const shaper = ac.createWaveShaper()
      const curve = new Float32Array(256)
      for (let i = 0; i < 256; i++) {
        const x = (i * 2) / 256 - 1
        curve[i] = x / (1 + Math.abs(x) * 2.5)  // soft saturation
      }
      shaper.curve = curve
      const masterGain = ac.createGain()
      masterGain.gain.value = 0.7
      shaper.connect(masterGain); masterGain.connect(ac.destination)

      const chordFreqs = [329.63, 493.88, 659.26] // E4, B4, E5
      chordFreqs.forEach((freq, i) => {
        const osc = ac.createOscillator()
        const og = vol(ac)
        osc.connect(og); og.connect(shaper)
        osc.type = 'sawtooth'
        osc.frequency.value = freq
        og.gain.setValueAtTime(0, t)
        og.gain.linearRampToValueAtTime(0.18 - i * 0.02, t + 0.012)
        og.gain.exponentialRampToValueAtTime(0.001, t + 0.38 - i * 0.02)
        osc.start(t); osc.stop(t + 0.45)
      })
      return
    }

    // ── Legendary: orchestral reveal ──────────────────────────
    // 1. Deep bass foundation (E2)
    // 2. Warm E major chord (E4 G#4 B4 E5 G#5)
    // 3. Sparkle cascade (six sine waves firing in sequence)
    if (rarity === 'legendary') {
      // Bass
      const bass = ac.createOscillator()
      const bg = vol(ac)
      bass.connect(bg); bg.connect(ac.destination)
      bass.type = 'triangle'
      bass.frequency.value = 82.4 // E2
      bg.gain.setValueAtTime(0, t)
      bg.gain.linearRampToValueAtTime(0.55, t + 0.02)
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.85)
      bass.start(t); bass.stop(t + 0.9)

      // Warm chord
      const chordFreqs = [329.63, 415.3, 493.88, 659.26, 830.61] // E4 G#4 B4 E5 G#5
      chordFreqs.forEach((freq, i) => {
        const osc = ac.createOscillator()
        const og = vol(ac)
        osc.connect(og); og.connect(ac.destination)
        osc.type = i < 2 ? 'triangle' : 'sine'
        osc.frequency.value = freq
        og.gain.setValueAtTime(0, t)
        og.gain.linearRampToValueAtTime(Math.max(0.04, 0.16 - i * 0.025), t + 0.015)
        og.gain.exponentialRampToValueAtTime(0.001, t + 0.9 - i * 0.05)
        osc.start(t); osc.stop(t + 0.95)
      })

      // Sparkle cascade
      const sparkFreqs = [1319, 1568, 2093, 2637, 3136, 4186]
      sparkFreqs.forEach((f, i) => {
        const osc = ac.createOscillator()
        const og = vol(ac)
        osc.connect(og); og.connect(ac.destination)
        osc.type = 'sine'
        osc.frequency.value = f
        const s = t + 0.02 + i * 0.035
        og.gain.setValueAtTime(0, s)
        og.gain.linearRampToValueAtTime(Math.max(0.02, 0.11 - i * 0.012), s + 0.01)
        og.gain.exponentialRampToValueAtTime(0.001, s + 0.55 - i * 0.02)
        osc.start(s); osc.stop(s + 0.6)
      })
    }
  } catch { /* audio blocked */ }
}

// ─── Achievement unlock: triumphant fanfare ───────────────────────────────────
// Rising arpeggio C5→E5→G5, then a warm chord bloom + sparkle.
export function playAchievementUnlock() {
  try {
    const ac = getCtx()
    const t = ac.currentTime

    // Rising arpeggio
    const arpeggioFreqs = [523.25, 659.26, 783.99] // C5, E5, G5
    arpeggioFreqs.forEach((freq, i) => {
      const osc = ac.createOscillator()
      const og = vol(ac)
      osc.connect(og); og.connect(ac.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const s = t + i * 0.1
      og.gain.setValueAtTime(0, s)
      og.gain.linearRampToValueAtTime(0.2, s + 0.01)
      og.gain.exponentialRampToValueAtTime(0.001, s + 0.35)
      osc.start(s); osc.stop(s + 0.4)
    })

    // Warm chord bloom at the end of the arpeggio
    const chordFreqs = [523.25, 659.26, 783.99, 1046.5] // C5 E5 G5 C6
    chordFreqs.forEach((freq, i) => {
      const osc = ac.createOscillator()
      const og = vol(ac)
      osc.connect(og); og.connect(ac.destination)
      osc.type = i < 2 ? 'triangle' : 'sine'
      osc.frequency.value = freq
      const s = t + 0.28
      og.gain.setValueAtTime(0, s)
      og.gain.linearRampToValueAtTime(0.12 - i * 0.02, s + 0.02)
      og.gain.exponentialRampToValueAtTime(0.001, s + 0.8)
      osc.start(s); osc.stop(s + 0.85)
    })

    // Short sparkle
    const sparkFreqs = [2093, 2637, 3136]
    sparkFreqs.forEach((f, i) => {
      const osc = ac.createOscillator()
      const og = vol(ac)
      osc.connect(og); og.connect(ac.destination)
      osc.type = 'sine'
      osc.frequency.value = f
      const s = t + 0.3 + i * 0.04
      og.gain.setValueAtTime(0, s)
      og.gain.linearRampToValueAtTime(0.07, s + 0.008)
      og.gain.exponentialRampToValueAtTime(0.001, s + 0.3)
      osc.start(s); osc.stop(s + 0.35)
    })
  } catch { /* audio blocked */ }
}
