import { CUES, registerCueEngine, type Cue, type CueDetail } from "./cues";

/**
 * The sound engine (DESIGN.md §6) — Web Audio, no library, a lazy chunk: it loads on the first
 * enable (or at boot when the saved preference is ON) and registers itself as the cue bus's
 * engine (lib/cues.ts applies the rate limits; lib/sound.ts owns the toggle and the lifecycle).
 *
 * Master chain: HPF 70 Hz → compressor (−24 dB, 3:1) → LPF 11 kHz → master (peaks ≤ −6 dBFS).
 * Nothing sits near 15.7 kHz. Voices cap at 8; repeating cues are pitched ±4–8% at random. Every
 * cue in Part 5 is synthesized; samples (≤ 6, fetched only after enable) arrive with later parts.
 * Each cue is built against a destination node, so tests/scripts can render it offline and
 * measure its true peak.
 */
export const MIX = {
  hpfHz: 70,
  lpfHz: 11_000,
  compressor: { thresholdDb: -24, ratio: 3, kneeDb: 6, attackS: 0.003, releaseS: 0.25 },
  /** master output ceiling */
  masterPeakDb: -6,
  voices: 8,
  /** ±pitch for repeating cues: 4–8% */
  pitchMin: 0.04,
  pitchMax: 0.08,
} as const;

/** The cue sheet's peaks (dBFS, §6.4). BOOT's parts: hum −32, key ticks −30, power thunk −20. */
export const PEAK_DB = {
  ENABLE: -18,
  BOOT_HUM: -32,
  BOOT_TICK: -30,
  BOOT_THUNK: -20,
  POWER: -22,
  TEAR: -24,
  SECTION: -30,
  COMMIT: -30,
  ARCHIVE: -30,
  REPLOT: -28,
  /** A4: the carousel's whir at full speed (it follows the speed down to silence) */
  FLING: -28,
  /** A4: a slide drops into the gate */
  GATE: -22,
  /** A5: a keycap's clack at full impact (it follows the impact down) */
  KEYCAP: -20,
  /** B1: a credential card turned over */
  FLIP: -28,
  /** B1: VERIFIED or EXPIRED lands, synced to the deal */
  STAMP: -18,
} as const;

/**
 * KEYCAP (§6.4): three clacks — a thock, a bright clack, a low clunk — synthesized, not sampled;
 * one at random each time, pitched ±6%, its gain following the impact; six at once at most.
 * [tone from, to (Hz), its ms] · [the click: Hz, Q, ms] · [the body: Hz, Q, ms]
 */
export const KEYCAP_CLACKS = [
  { tone: [210, 95, 45], click: [2600, 2.2, 8], body: [900, 1.5, 30] },
  { tone: [300, 140, 30], click: [3400, 2.8, 6], body: [1400, 1.6, 22] },
  { tone: [160, 70, 55], click: [2000, 2, 9], body: [700, 1.2, 40] },
] as const;
export const KEYCAP_CUE = { pitch: 0.06, voices: 6, minIntensity: 0.2 } as const;

/** STAMP (§6.4): [Hz, Q, ms] of the slap and the stock's body, [from, to (Hz), ms] of the thump. */
export const STAMP_CUE = { slap: [1300, 0.9, 16], thump: [120, 48, 95], body: [520, 1.1, 40] } as const;
/** FLIP (§6.4): [Hz, Q, ms] of the air and the landing tick, which comes this late (s); pitched ±6%. */
export const FLIP_CUE = { air: [2600, 0.8, 70], tick: [4300, 3.5, 5], landS: 0.06, pitch: 0.06 } as const;

/** FLING (§6.4): band-passed noise whose band rises with the rail's speed; a whir rendered offline runs this long. */
export const FLING_WHIR = { loHz: 700, hiHz: 1900, q: 1.1, glideS: 0.05, offlineS: 0.3, idleStopS: 1 } as const;

/** ARCHIVE (§6.4): a note on A-minor pentatonic, 220–880 Hz, 40–120 ms (lib/archive.ts makes them). */
export const ARCHIVE_CUE = { minHz: 220, maxHz: 880, minMs: 40, maxMs: 120 } as const;

/** TEAR: the static follows the tape chunk by this much (s) — the two peaks never stack. */
const TEAR_STATIC_DELAY_S = 0.025;

/** Samples (AAC-LC .m4a, 48 kHz mono, ≤ 6, ≤ 90 KB) — none: KEYCAP's clacks are synthesized (§10 #43). */
export const SAMPLES: Record<string, string> = {};

export const dbToGain = (db: number): number => 10 ** (db / 20);
export const gainToDb = (g: number): number => (g > 0 ? 20 * Math.log10(g) : Number.NEGATIVE_INFINITY);

type Ctx = BaseAudioContext;
type Out = AudioNode;

/** ±4–8% at random, either way (repeating cues never sound like a loop). */
export function pitchJitter(random: () => number = Math.random): number {
  const amount = MIX.pitchMin + random() * (MIX.pitchMax - MIX.pitchMin);
  return 1 + (random() < 0.5 ? -amount : amount);
}

/**
 * Band-passed noise with its envelope baked in, normalised so its peak is exactly 1: played at a
 * gain of the cue sheet's level, a burst peaks at that level by construction (a BiquadFilterNode on
 * live noise throws most of the energy away, so its peak would be 10–20 dB under the sheet).
 * Seeded noise, an RBJ band-pass, a linear attack and an exponential decay to −80 dB. Cached per
 * context and shape; repeats vary by playbackRate (the pitch jitter).
 */
const burstCache = new WeakMap<Ctx, Map<string, AudioBuffer>>();
export function burstSamples(sampleRate: number, hz: number, q: number, ms: number, seed = 0x5eed): Float32Array<ArrayBuffer> {
  const n = Math.max(8, Math.round((ms / 1000) * sampleRate));
  const out = new Float32Array(new ArrayBuffer(n * 4));
  const w0 = (2 * Math.PI * hz) / sampleRate;
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  const b0 = alpha / a0;
  const b2 = -alpha / a0;
  const a1 = (-2 * Math.cos(w0)) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  let state = seed >>> 0;
  const attack = Math.max(1, Math.round(n / 4) > 96 ? 96 : Math.round(n / 4));
  const decay = Math.log(1e-4) / Math.max(1, n - attack);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const x = (state / 4294967296) * 2 - 1;
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    const env = i < attack ? i / attack : Math.exp(decay * (i - attack));
    out[i] = y * env;
    peak = Math.max(peak, Math.abs(out[i] ?? 0));
  }
  if (peak > 0) for (let i = 0; i < n; i++) out[i] = (out[i] ?? 0) / peak;
  return out;
}

function burstBuffer(ctx: Ctx, hz: number, q: number, ms: number): AudioBuffer {
  let byShape = burstCache.get(ctx);
  if (!byShape) burstCache.set(ctx, (byShape = new Map()));
  const key = `${hz}|${q}|${ms}`;
  let buf = byShape.get(key);
  if (!buf) {
    const data = burstSamples(ctx.sampleRate, hz, q, ms);
    buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
    buf.copyToChannel(data, 0);
    byShape.set(key, buf);
  }
  return buf;
}

/** A gain envelope: 0 → peak in `attack`, exponential decay to silence by `end`. */
function envelope(ctx: Ctx, out: Out, at: number, peakDb: number, attack: number, end: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(dbToGain(peakDb), at + attack);
  g.gain.exponentialRampToValueAtTime(1e-4, at + end);
  g.gain.setValueAtTime(0, at + end + 0.001);
  g.connect(out);
  return g;
}

/** Band-passed noise burst (ticks, clicks, static), peaking at `peakDb`. */
function burst(ctx: Ctx, out: Out, at: number, { hz, q, ms, peakDb, rate = 1 }: { hz: number; q: number; ms: number; peakDb: number; rate?: number }): number {
  const src = ctx.createBufferSource();
  src.buffer = burstBuffer(ctx, hz, q, ms);
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = dbToGain(peakDb);
  src.connect(g).connect(out);
  src.start(at);
  return ms / 1000 / rate;
}

/** A sine (or other) tone with a pitch glide: thunks, sweeps, blips. */
function tone(ctx: Ctx, out: Out, at: number, { from, to, ms, peakDb, type = "sine", attack = 0.004 }: { from: number; to: number; ms: number; peakDb: number; type?: OscillatorType; attack?: number }): number {
  const osc = ctx.createOscillator();
  osc.type = type;
  const end = ms / 1000;
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + end);
  osc.connect(envelope(ctx, out, at, peakDb, attack, end));
  osc.start(at);
  osc.stop(at + end + 0.01);
  return end;
}

/**
 * The cues, built against `out` from time `at`. Returns the length in seconds (0 for a stub: SHELL,
 * TRANSMIT and HALT are named here and arrive with their parts). FLING is a
 * continuous voice in the engine (Engine.whir); built here it's its loudest stretch, for the peak
 * measurement.
 */
export function buildCue(ctx: Ctx, out: Out, cue: Cue, detail: CueDetail, at: number): number {
  const rate = cue === "COMMIT" || cue === "SECTION" || cue === "TEAR" || (cue === "BOOT" && detail.variant === "tick") ? pitchJitter() : 1;
  switch (cue) {
    case "ENABLE": {
      // relay clunk + a 300 ms hum swell
      tone(ctx, out, at, { from: 140, to: 55, ms: 70, peakDb: PEAK_DB.ENABLE });
      burst(ctx, out, at, { hz: 2400, q: 3, ms: 8, peakDb: PEAK_DB.ENABLE - 4 });
      tone(ctx, out, at + 0.02, { from: 120, to: 120, ms: 300, peakDb: PEAK_DB.ENABLE - 10, attack: 0.15 });
      return 0.32;
    }
    case "BOOT": {
      if (detail.variant === "tick") return burst(ctx, out, at, { hz: 4200, q: 4, ms: 5, peakDb: PEAK_DB.BOOT_TICK, rate });
      if (detail.variant === "thunk") return tone(ctx, out, at, { from: 90, to: 38, ms: 180, peakDb: PEAK_DB.BOOT_THUNK });
      return 0; // the hum is a held voice (Engine.hum)
    }
    case "POWER": {
      // a synth sweep + click: rising for ON, falling for OFF; the theme switch is OFF then ON in 600 ms
      const off = detail.variant === "off";
      tone(ctx, out, at, { from: off ? 900 : 180, to: off ? 120 : 1200, ms: off ? 400 : 520, peakDb: PEAK_DB.POWER - 2, type: "triangle", attack: 0.03 });
      burst(ctx, out, at + (off ? 0.4 : 0), { hz: 1800, q: 2, ms: 10, peakDb: PEAK_DB.POWER });
      return off ? 0.42 : 0.53;
    }
    case "TEAR": {
      // a tape chunk, then 120 ms of static 25 ms behind it: by then the chunk has decayed below a
      // tenth, so the two peaks never stack over the sheet's level (whatever the pitch jitter)
      tone(ctx, out, at, { from: 320 * rate, to: 70, ms: 90, peakDb: PEAK_DB.TEAR - 2, type: "sawtooth" });
      burst(ctx, out, at + TEAR_STATIC_DELAY_S, { hz: 3800, q: 0.7, ms: 120, peakDb: PEAK_DB.TEAR, rate });
      return TEAR_STATIC_DELAY_S + 0.12;
    }
    case "SECTION":
      // a relay click
      burst(ctx, out, at, { hz: 1900, q: 5, ms: 6, peakDb: PEAK_DB.SECTION, rate });
      tone(ctx, out, at, { from: 160, to: 80, ms: 25, peakDb: PEAK_DB.SECTION - 6 });
      return 0.03;
    case "COMMIT":
      // 4 ms of noise band-passed at 3.2 kHz
      return burst(ctx, out, at, { hz: 3200, q: 6, ms: 4, peakDb: PEAK_DB.COMMIT, rate });
    case "ARCHIVE": {
      // a sine blip: the focused record's year as a note, its citations as the length (§6.4)
      const hz = Math.min(ARCHIVE_CUE.maxHz, Math.max(ARCHIVE_CUE.minHz, detail.hz ?? 440));
      const ms = Math.min(ARCHIVE_CUE.maxMs, Math.max(ARCHIVE_CUE.minMs, detail.ms ?? ARCHIVE_CUE.minMs));
      return tone(ctx, out, at, { from: hz, to: hz, ms, peakDb: PEAK_DB.ARCHIVE, attack: 0.003 });
    }
    case "GATE": {
      // a slide drops into the projector's gate: the frame's thump, the plastic's click, a rattle
      tone(ctx, out, at, { from: 110, to: 46, ms: 120, peakDb: PEAK_DB.GATE - 1 });
      burst(ctx, out, at, { hz: 1700, q: 2.5, ms: 14, peakDb: PEAK_DB.GATE });
      return Math.max(0.12, burst(ctx, out, at + 0.018, { hz: 900, q: 1.2, ms: 46, peakDb: PEAK_DB.GATE - 12 }) + 0.018);
    }
    case "FLING":
      return whirSegment(ctx, out, at, Math.min(1, Math.max(0, detail.intensity ?? 1)));
    case "STAMP": {
      // a rubber stamp on card stock: the slap of the face, the thump of the handle behind it
      // (rising as the slap decays, so the two never stack), the stock's body under both
      burst(ctx, out, at, { hz: STAMP_CUE.slap[0], q: STAMP_CUE.slap[1], ms: STAMP_CUE.slap[2], peakDb: PEAK_DB.STAMP });
      tone(ctx, out, at, { from: STAMP_CUE.thump[0], to: STAMP_CUE.thump[1], ms: STAMP_CUE.thump[2], peakDb: PEAK_DB.STAMP - 1 });
      return Math.max(STAMP_CUE.thump[2] / 1000, burst(ctx, out, at + 0.01, { hz: STAMP_CUE.body[0], q: STAMP_CUE.body[1], ms: STAMP_CUE.body[2], peakDb: PEAK_DB.STAMP - 12 }) + 0.01);
    }
    case "FLIP": {
      // a card flicked over: air past its edge (a band of noise, pitched ±6%), and the tick of it landing
      const p = 1 + (Math.random() * 2 - 1) * FLIP_CUE.pitch;
      burst(ctx, out, at, { hz: FLIP_CUE.air[0], q: FLIP_CUE.air[1], ms: FLIP_CUE.air[2], peakDb: PEAK_DB.FLIP - 2, rate: p });
      return Math.max(FLIP_CUE.air[2] / 1000 / p, burst(ctx, out, at + FLIP_CUE.landS, { hz: FLIP_CUE.tick[0], q: FLIP_CUE.tick[1], ms: FLIP_CUE.tick[2], peakDb: PEAK_DB.FLIP, rate: p }) + FLIP_CUE.landS);
    }
    case "KEYCAP": {
      // one of three clacks, pitched ±6%, as loud as the impact (never quite silent)
      const k = Math.min(1, Math.max(KEYCAP_CUE.minIntensity, detail.intensity ?? 1));
      const db = PEAK_DB.KEYCAP + 20 * Math.log10(k);
      const c = KEYCAP_CLACKS[Math.floor(Math.random() * KEYCAP_CLACKS.length)] ?? KEYCAP_CLACKS[0];
      const p = 1 + (Math.random() * 2 - 1) * KEYCAP_CUE.pitch;
      burst(ctx, out, at, { hz: c.click[0], q: c.click[1], ms: c.click[2], peakDb: db, rate: p });
      tone(ctx, out, at, { from: c.tone[0] * p, to: c.tone[1] * p, ms: c.tone[2], peakDb: db - 4 });
      return Math.max(c.tone[2] / 1000, burst(ctx, out, at + 0.004, { hz: c.body[0], q: c.body[1], ms: c.body[2], peakDb: db - 10, rate: p }) + 0.004);
    }
    case "REPLOT": {
      // a plotter's servo: a sweep up and back as the pen carriage crosses, a stepper's grit under it,
      // and the carriage settling with a click
      tone(ctx, out, at, { from: 180, to: 540, ms: 220, peakDb: PEAK_DB.REPLOT - 2, type: "triangle", attack: 0.02 });
      tone(ctx, out, at + 0.2, { from: 540, to: 260, ms: 140, peakDb: PEAK_DB.REPLOT - 6, type: "triangle", attack: 0.01 });
      burst(ctx, out, at, { hz: 1400, q: 1.6, ms: 300, peakDb: PEAK_DB.REPLOT - 10 });
      burst(ctx, out, at + 0.34, { hz: 2600, q: 4, ms: 6, peakDb: PEAK_DB.REPLOT });
      return 0.36;
    }
    default:
      return 0;
  }
}

/**
 * Web Audio's DynamicsCompressor adds an automatic makeup gain (the spec: (1 / curve(0 dBFS))^0.6
 * — +9.6 dB at −24 dB, 3:1). A running engine sits released between cues, so every cue would play
 * ~10 dB over the sheet; the chain trims it back, leaving the compressor transparent below its
 * threshold and taming only what's above it.
 */
export function compressorMakeup({ thresholdDb, ratio }: { thresholdDb: number; ratio: number }): number {
  const atFullScaleDb = thresholdDb + (0 - thresholdDb) / ratio;
  return (1 / dbToGain(atFullScaleDb)) ** 0.6;
}

/** A looping noise buffer (seeded), the whir's source: white noise the band-pass shapes. */
const noiseCache = new WeakMap<Ctx, AudioBuffer>();
function noiseBuffer(ctx: Ctx): AudioBuffer {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    const n = Math.round(ctx.sampleRate * 0.5);
    buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = new Float32Array(new ArrayBuffer(n * 4));
    let seed = 0x1f1e5;
    for (let i = 0; i < n; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      d[i] = (seed / 0xffffffff) * 2 - 1;
    }
    buf.copyToChannel(d, 0);
    noiseCache.set(ctx, buf);
  }
  return buf;
}

/** The whir's voice: noise → band-pass (its centre rises with speed) → gain. */
function whirVoice(ctx: Ctx, out: Out, at: number): { src: AudioBufferSourceNode; band: BiquadFilterNode; gain: GainNode } {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = FLING_WHIR.q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, at);
  src.connect(band).connect(gain).connect(out);
  src.start(at);
  return { src, band, gain };
}

/** The whir's level and band at a speed (0–1): gain ∝ speed, up to the sheet's peak. */
export function whirAt(intensity: number): { gain: number; hz: number } {
  const k = Math.min(1, Math.max(0, intensity));
  return { gain: dbToGain(PEAK_DB.FLING) * k * WHIR_MAKEUP, hz: FLING_WHIR.loHz + (FLING_WHIR.hiHz - FLING_WHIR.loHz) * k };
}
/**
 * The band-pass sheds part of the noise's peak, so the whir's voice runs this much over the sheet's
 * gain for its loudest stretch to peak at the sheet's level, measured offline through the master
 * chain by scripts/boot-gate.mjs: at a 0.32 guess it peaked at −42.3 dBFS, 4.4 dB under its gain.
 */
export const WHIR_MAKEUP = 1.6;

/** FLING built offline: its loudest stretch (full speed), for the peak measurement. */
function whirSegment(ctx: Ctx, out: Out, at: number, intensity: number): number {
  const v = whirVoice(ctx, out, at);
  const { gain, hz } = whirAt(intensity);
  v.band.frequency.setValueAtTime(hz, at);
  v.gain.gain.setValueAtTime(gain, at);
  v.gain.gain.setValueAtTime(0, at + FLING_WHIR.offlineS);
  v.src.stop(at + FLING_WHIR.offlineS + 0.01);
  return FLING_WHIR.offlineS;
}

/** The master chain, into `dest`: input → HPF → compressor (makeup trimmed) → LPF → master gain (→ analyser). */
export function masterChain(ctx: Ctx, dest: AudioNode): { input: GainNode; master: GainNode } {
  const input = ctx.createGain();
  const hpf = ctx.createBiquadFilter();
  hpf.type = "highpass";
  hpf.frequency.value = MIX.hpfHz;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = MIX.compressor.thresholdDb;
  comp.ratio.value = MIX.compressor.ratio;
  comp.knee.value = MIX.compressor.kneeDb;
  comp.attack.value = MIX.compressor.attackS;
  comp.release.value = MIX.compressor.releaseS;
  const trim = ctx.createGain();
  trim.gain.value = 1 / compressorMakeup(MIX.compressor);
  const lpf = ctx.createBiquadFilter();
  lpf.type = "lowpass";
  lpf.frequency.value = MIX.lpfHz;
  const master = ctx.createGain();
  input.connect(hpf).connect(comp).connect(trim).connect(lpf).connect(master).connect(dest);
  return { input, master };
}

class Engine {
  readonly ctx: AudioContext;
  private readonly input: GainNode;
  readonly analyser: AnalyserNode;
  private voices = 0;
  private keycaps = 0;
  private hum: { osc: OscillatorNode[]; gain: GainNode } | null = null;
  private whirring: (ReturnType<typeof whirVoice> & { idle: number }) | null = null;
  private readonly buf: Float32Array<ArrayBuffer>;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: "interactive" });
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.buf = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4));
    const { input, master } = masterChain(this.ctx, this.analyser);
    this.analyser.connect(this.ctx.destination);
    master.gain.value = 1;
    this.input = input;
  }

  play(cue: Cue, detail: CueDetail): void {
    if (cue === "FLING") {
      this.whir(detail.intensity ?? 0);
      return;
    }
    if (cue === "BOOT" && (detail.variant === "hum" || detail.variant === "hum-off")) {
      if (detail.variant === "hum") this.startHum();
      else this.stopHum();
      return;
    }
    if (this.voices >= MIX.voices) return; // the cap: a busy moment drops the newest voice
    if (cue === "KEYCAP" && this.keycaps >= KEYCAP_CUE.voices) return; // six clacks at once at most
    const at = this.ctx.currentTime + 0.005;
    const length = buildCue(this.ctx, this.input, cue, detail, at);
    if (length <= 0) return;
    this.voices++;
    if (cue === "KEYCAP") this.keycaps++;
    window.setTimeout(() => {
      this.voices--;
      if (cue === "KEYCAP") this.keycaps--;
    }, length * 1000 + 30);
  }

  /**
   * FLING (§6.4): one continuous voice that follows the carousel's speed — gain ∝ speed, its band
   * rising with it — gliding between the rail's updates; stopped after a second of silence.
   */
  private whir(intensity: number): void {
    const t = this.ctx.currentTime;
    if (!this.whirring) {
      if (intensity <= 0) return;
      this.whirring = { ...whirVoice(this.ctx, this.input, t), idle: 0 };
    }
    const v = this.whirring;
    const { gain, hz } = whirAt(intensity);
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setTargetAtTime(gain, t, FLING_WHIR.glideS);
    v.band.frequency.setTargetAtTime(hz, t, FLING_WHIR.glideS);
    window.clearTimeout(v.idle);
    if (intensity <= 0) {
      v.idle = window.setTimeout(() => {
        if (this.whirring !== v) return;
        this.whirring = null;
        v.src.stop();
      }, FLING_WHIR.idleStopS * 1000);
    }
  }

  /** BOOT: the 120 Hz transformer hum (2× mains), fading in over P1 — held until P3. */
  private startHum(): void {
    if (this.hum) return;
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(dbToGain(PEAK_DB.BOOT_HUM), t + 0.25);
    gain.connect(this.input);
    const osc = [120, 240].map((hz, i) => {
      const o = this.ctx.createOscillator();
      o.frequency.value = hz;
      const g = this.ctx.createGain();
      g.gain.value = i === 0 ? 1 : 0.25;
      o.connect(g).connect(gain);
      o.start(t);
      return o;
    });
    this.hum = { osc, gain };
  }

  private stopHum(): void {
    const hum = this.hum;
    if (!hum) return;
    this.hum = null;
    const t = this.ctx.currentTime;
    hum.gain.gain.cancelScheduledValues(t);
    hum.gain.gain.setTargetAtTime(0, t, 0.06);
    for (const o of hum.osc) o.stop(t + 0.4);
    this.play("BOOT", { variant: "thunk" });
  }

  /** The output level, dBFS peak of the last ~21 ms (the VU meter). */
  level(): number {
    this.analyser.getFloatTimeDomainData(this.buf);
    let peak = 0;
    for (const v of this.buf) peak = Math.max(peak, Math.abs(v));
    return gainToDb(peak);
  }

  resume(): Promise<void> {
    return this.ctx.state === "running" ? Promise.resolve() : this.ctx.resume();
  }

  suspend(): Promise<void> {
    return this.ctx.state === "running" ? this.ctx.suspend() : Promise.resolve();
  }
}

let engine: Engine | null = null;

/** The engine if it exists — never creates one (turning sound off, the VU meter). */
export const existingEngine = (): Engine | null => engine;

/** Creates the engine (once) and hands it to the cue bus. Samples would be fetched here, after enable. */
export function getEngine(): Engine {
  if (!engine) {
    engine = new Engine();
    const e = engine;
    registerCueEngine((cue, detail) => e.play(cue, detail));
    void loadSamples(e.ctx);
  }
  return engine;
}

const samples = new Map<string, AudioBuffer>();
async function loadSamples(ctx: BaseAudioContext): Promise<void> {
  for (const [name, url] of Object.entries(SAMPLES)) {
    try {
      samples.set(name, await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer()));
    } catch {
      /* a missing sample is a silent cue, never an error */
    }
  }
}

/** Every cue the sheet names; the ones this part doesn't synthesize are stubs (0 s). */
export const IMPLEMENTED: readonly Cue[] = ["ENABLE", "BOOT", "POWER", "TEAR", "SECTION", "COMMIT", "FLING", "GATE", "ARCHIVE", "REPLOT", "KEYCAP", "FLIP", "STAMP"];
export const STUBS: readonly Cue[] = CUES.filter((c) => !IMPLEMENTED.includes(c));
