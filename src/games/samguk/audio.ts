import { getPrefs, onPrefsChange } from '../../shared/prefs';
import { audioContext } from '../../shared/sound';
import { ROOT_NS, readJSON, writeJSON } from '../../shared/storage';
import type { UnitKind } from './engine/units';

/**
 * 천하삼분 소리 — 배경음악과 효과음을 WebAudio로 모두 합성한다(오디오 파일 없음, 오프라인 동작).
 * 악기: 고쟁(Karplus-Strong 현 뜯기), 적(笛), 이호(二胡), 현악 지속음, 대고·당고·박판·요발·징.
 * 선율은 오음 음계(궁·상·각·치·우)로 새로 지었다.
 */

export type Track = 'title' | 'map' | 'battle';

interface AudioPrefs {
  music: boolean;
  /** 음악 크기 0~1 */
  volume: number;
}

const KEY = `${ROOT_NS}:samguk:audio`;
let prefs: AudioPrefs = { music: true, volume: 0.6, ...readJSON<Partial<AudioPrefs>>(KEY, {}) };
let soundOn = getPrefs().sound;
const listeners = new Set<() => void>();

export function audioPrefs(): AudioPrefs { return prefs; }
export function setAudioPrefs(patch: Partial<AudioPrefs>) {
  prefs = { ...prefs, ...patch };
  writeJSON(KEY, prefs);
  applyVolume();
  listeners.forEach((fn) => fn());
}
export function onAudioPrefs(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/* ───────── 오디오 그래프 ───────── */

interface Graph {
  ac: AudioContext;
  /** 배경음악(덕킹 대상) */
  mbus: GainNode;
  duck: GainNode;
  mvol: GainNode;
  /** 효과음·짧은 연주 */
  sbus: GainNode;
  noise: AudioBuffer;
}

let G: Graph | null = null;

function impulse(ac: AudioContext, sec: number): AudioBuffer {
  const len = Math.floor(ac.sampleRate * sec);
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  return buf;
}

function graph(): Graph | null {
  if (G) return G;
  const ac = audioContext();
  if (!ac) return null;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 4;
  comp.connect(ac.destination);
  const verb = ac.createConvolver();
  verb.buffer = impulse(ac, 2.6);
  const wet = ac.createGain();
  wet.gain.value = 0.32;
  verb.connect(wet).connect(comp);

  const mbus = ac.createGain();
  const duck = ac.createGain();
  const mvol = ac.createGain();
  mbus.connect(duck).connect(mvol);
  mvol.connect(comp);
  mvol.connect(verb);

  const sbus = ac.createGain();
  sbus.gain.value = 0.85;
  sbus.connect(comp);
  const ssend = ac.createGain();
  ssend.gain.value = 0.4;
  sbus.connect(ssend).connect(verb);

  const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  G = { ac, mbus, duck, mvol, sbus, noise };
  applyVolume();
  return G;
}

const musicOn = () => soundOn && prefs.music && prefs.volume > 0;

function applyVolume() {
  if (!G) return;
  const t = G.ac.currentTime;
  G.mvol.gain.cancelScheduledValues(t);
  G.mvol.gain.setTargetAtTime(musicOn() ? prefs.volume * 0.9 : 0, t, 0.08);
}

onPrefsChange((p) => { soundOn = p.sound; applyVolume(); });

/* 브라우저는 사용자가 한 번 누르기 전에는 소리를 막는다 — 첫 입력에서 깨운다 */
if (typeof window !== 'undefined') {
  const wake = () => { const g = graph(); if (g && g.ac.state === 'suspended') void g.ac.resume(); };
  window.addEventListener('pointerdown', wake, { capture: true });
  window.addEventListener('keydown', wake, { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (!G) return;
    if (document.hidden) void G.ac.suspend();
    else void G.ac.resume();
  });
}

/* ───────── 음 높이 ───────── */

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midi(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** 오음 음계에서 root부터 n칸 위 음 */
function degree(scale: number[], root: number, n: number): number {
  const notes: number[] = [];
  for (let m = 24; m < 108; m++) if (scale.includes(m % 12)) notes.push(m);
  const i = notes.indexOf(root);
  return notes[Math.max(0, Math.min(notes.length - 1, (i < 0 ? 0 : i) + n))];
}

/* ───────── 악기 ───────── */

type Bus = GainNode;

function env(g: Graph, t: number, peak: number, attack: number, hold: number, release: number): GainNode {
  const a = g.ac.createGain();
  a.gain.setValueAtTime(0.0001, t);
  a.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  a.gain.setValueAtTime(Math.max(0.0002, peak), t + attack + hold);
  a.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  return a;
}

function noiseSrc(g: Graph, t: number, dur: number): AudioBufferSourceNode {
  const n = g.ac.createBufferSource();
  n.buffer = g.noise;
  n.loop = true;
  n.start(t, Math.random() * 0.5);
  n.stop(t + dur + 0.05);
  return n;
}

function filt(g: Graph, type: BiquadFilterType, freq: number, q = 0.8): BiquadFilterNode {
  const f = g.ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

/** 걸러 낸 잡음 한 번 — 바람·물·불·발소리의 재료 */
function hiss(g: Graph, bus: Bus, t: number, o: { type: BiquadFilterType; f: number; f2?: number; q?: number; vel: number; attack?: number; dur: number }) {
  const n = noiseSrc(g, t, o.dur + (o.attack ?? 0.005));
  const f = filt(g, o.type, o.f, o.q ?? 0.8);
  if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + (o.attack ?? 0.005) + o.dur);
  n.connect(f).connect(env(g, t, o.vel, o.attack ?? 0.005, 0, o.dur)).connect(bus);
}

const ksCache = new Map<number, AudioBuffer>();
/** Karplus-Strong 현 — 주기 N 표본마다 평균을 내며 줄어드는 잡음 */
function ksBuffer(ac: AudioContext, N: number): AudioBuffer {
  let buf = ksCache.get(N);
  if (buf) return buf;
  const sr = ac.sampleRate;
  const len = Math.floor(sr * 2.4);
  buf = ac.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  let prev = 0, mean = 0;
  for (let i = 0; i < N; i++) { prev += 0.55 * (Math.random() * 2 - 1 - prev); d[i] = prev; mean += prev; }
  mean /= N;
  let peak = 0;
  for (let i = 0; i < N; i++) { d[i] -= mean; peak = Math.max(peak, Math.abs(d[i])); }
  for (let i = 0; i < N; i++) d[i] /= peak || 1;
  const rho = Math.pow(0.001, N / (sr * 2.6));
  for (let i = N; i < len; i++) d[i] = rho * 0.5 * (d[i - N] + (i - N - 1 >= 0 ? d[i - N - 1] : 0));
  ksCache.set(N, buf);
  return buf;
}

/** 고쟁·비파 — 뜯는 현. 긴 음은 농현(揉弦)으로 떨린다 */
function pluck(g: Graph, bus: Bus, t: number, m: number, dur: number, vel: number) {
  const f = hz(m);
  const sr = g.ac.sampleRate;
  const N = Math.max(2, Math.round(sr / f - 0.5));
  const src = g.ac.createBufferSource();
  src.buffer = ksBuffer(g.ac, N);
  const rate = f / (sr / (N + 0.5));
  src.playbackRate.setValueAtTime(rate, t);
  if (dur > 1) {
    const lfo = g.ac.createOscillator();
    lfo.frequency.value = 5.4;
    const depth = g.ac.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(rate * 0.006, t + 0.45);
    lfo.connect(depth).connect(src.playbackRate);
    lfo.start(t + 0.2);
    lfo.stop(t + dur + 1);
  }
  const tone = filt(g, 'lowpass', Math.min(9000, f * 9), 0.5);
  const ring = Math.min(2.3, dur + 1.4);
  const a = g.ac.createGain();
  a.gain.setValueAtTime(vel, t);
  a.gain.exponentialRampToValueAtTime(0.0001, t + ring);
  src.connect(tone).connect(a).connect(bus);
  src.start(t);
  src.stop(t + ring + 0.05);
}

/** 적(笛) — 숨소리 섞인 대나무 피리, 음 머리를 살짝 끌어 올린다 */
function flute(g: Graph, bus: Bus, t: number, m: number, dur: number, vel: number) {
  const f = hz(m);
  const o = g.ac.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f * 0.955, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
  const o2 = g.ac.createOscillator();
  o2.type = 'triangle';
  o2.frequency.setValueAtTime(f * 2 * 0.955, t);
  o2.frequency.exponentialRampToValueAtTime(f * 2, t + 0.07);
  const lfo = g.ac.createOscillator();
  lfo.frequency.value = 5.2;
  const depth = g.ac.createGain();
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(dur > 0.5 ? f * 0.007 : 0, t + 0.4);
  lfo.connect(depth);
  depth.connect(o.frequency);
  const h2 = g.ac.createGain();
  h2.gain.value = 0.13;
  const amp = env(g, t, vel, 0.05, Math.max(0, dur - 0.1), 0.16);
  o.connect(amp);
  o2.connect(h2).connect(amp);
  amp.connect(bus);
  hiss(g, bus, t, { type: 'bandpass', f: f * 2.2, q: 2, vel: vel * 0.16, attack: 0.03, dur: dur * 0.9 + 0.1 });
  const end = t + dur + 0.3;
  [o, o2, lfo].forEach((x) => { x.start(t); x.stop(end); });
}

let erhuLast = 0;
let erhuAt = 0;
/** 이호(二胡) — 활로 켜는 두 줄 현. 이어지는 음은 미끄러져 넘어간다 */
function erhu(g: Graph, bus: Bus, t: number, m: number, dur: number, vel: number) {
  const f = hz(m);
  const o = g.ac.createOscillator();
  o.type = 'sawtooth';
  const slide = erhuLast && Math.abs(Math.log2(f / erhuLast)) < 0.6 && t - erhuAt < 1.2;
  o.frequency.setValueAtTime(slide ? erhuLast : f * 0.985, t);
  o.frequency.exponentialRampToValueAtTime(f, t + (slide ? 0.09 : 0.05));
  erhuLast = f;
  erhuAt = t + dur;
  const lfo = g.ac.createOscillator();
  lfo.frequency.value = 6.1;
  const depth = g.ac.createGain();
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(dur > 0.4 ? f * 0.011 : f * 0.003, t + 0.35);
  lfo.connect(depth).connect(o.frequency);
  const lp = filt(g, 'lowpass', 2300, 0.9);
  const hp = filt(g, 'highpass', 260, 0.7);
  const body = filt(g, 'peaking', 950, 1.2);
  body.gain.value = 5;
  const amp = env(g, t, vel, 0.08, Math.max(0, dur - 0.1), 0.18);
  o.connect(hp).connect(body).connect(lp).connect(amp).connect(bus);
  const end = t + dur + 0.3;
  o.start(t); o.stop(end); lfo.start(t); lfo.stop(end);
}

/** 현악 지속음 — 화음 바닥을 깐다 */
function pad(g: Graph, bus: Bus, t: number, m: number, dur: number, vel: number) {
  const f = hz(m);
  const lp = filt(g, 'lowpass', 780, 0.6);
  const amp = env(g, t, vel, 0.55, Math.max(0, dur - 0.55), 0.9);
  for (const det of [0.9965, 1.0035]) {
    const o = g.ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f * det;
    o.connect(lp);
    o.start(t);
    o.stop(t + dur + 1);
  }
  lp.connect(amp).connect(bus);
}

/** 대고(大鼓) — 낮게 울리는 북 */
function drum(g: Graph, bus: Bus, t: number, vel: number, low = 1) {
  const o = g.ac.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(98 * low, t);
  o.frequency.exponentialRampToValueAtTime(44 * low, t + 0.32);
  o.connect(env(g, t, vel, 0.004, 0, 0.55)).connect(bus);
  o.start(t); o.stop(t + 0.62);
  hiss(g, bus, t, { type: 'lowpass', f: 900, vel: vel * 0.45, dur: 0.09 });
}

/** 당고(堂鼓) — 높고 짧은 북 */
function tang(g: Graph, bus: Bus, t: number, vel: number) {
  const o = g.ac.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(190, t);
  o.frequency.exponentialRampToValueAtTime(120, t + 0.14);
  o.connect(env(g, t, vel, 0.003, 0, 0.2)).connect(bus);
  o.start(t); o.stop(t + 0.25);
  hiss(g, bus, t, { type: 'bandpass', f: 1900, q: 1.2, vel: vel * 0.4, dur: 0.05 });
}

/** 박판(拍板)·목어 — 딱 하고 끊는 나무 소리 */
function block(g: Graph, bus: Bus, t: number, vel: number, f = 1150) {
  for (const [ff, v] of [[f, 1], [f * 1.48, 0.45]] as const) {
    const o = g.ac.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(ff, t);
    o.frequency.exponentialRampToValueAtTime(ff * 0.9, t + 0.06);
    o.connect(env(g, t, vel * v, 0.002, 0, 0.07)).connect(bus);
    o.start(t); o.stop(t + 0.1);
  }
}

/** 요발(鐃鈸) */
function cymbal(g: Graph, bus: Bus, t: number, vel: number, dur = 0.9) {
  hiss(g, bus, t, { type: 'highpass', f: 4200, vel, dur });
  hiss(g, bus, t, { type: 'bandpass', f: 7600, q: 3, vel: vel * 0.6, dur: dur * 0.7 });
}

/** 대라(大鑼) — 징. 비조화 배음이 길게 운다 */
function gong(g: Graph, bus: Bus, t: number, vel: number, base = 92) {
  const parts: [number, number, number][] = [[1, 1, 3.6], [1.52, 0.55, 2.8], [2.21, 0.42, 2.2], [2.96, 0.26, 1.6], [3.78, 0.16, 1.2], [5.1, 0.08, 0.8]];
  for (const [r, a, d] of parts) {
    const o = g.ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(base * r * 1.015, t);
    o.frequency.exponentialRampToValueAtTime(base * r, t + 0.6);
    o.connect(env(g, t, vel * a, 0.015, 0, d)).connect(bus);
    o.start(t); o.stop(t + d + 0.1);
  }
  hiss(g, bus, t, { type: 'lowpass', f: 1400, vel: vel * 0.3, dur: 0.35 });
}

/** 소라(小鑼) — 경극 징. 치고 나면 음이 살짝 올라간다 */
function smallGong(g: Graph, bus: Bus, t: number, vel: number) {
  for (const [r, a] of [[1, 1], [1.62, 0.4], [2.4, 0.25]] as const) {
    const o = g.ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(620 * r * 0.93, t);
    o.frequency.exponentialRampToValueAtTime(620 * r * 1.04, t + 0.28);
    o.connect(env(g, t, vel * a, 0.004, 0, 1.1)).connect(bus);
    o.start(t); o.stop(t + 1.2);
  }
}

/* ───────── 곡 ───────── */

type Inst = typeof pluck;

interface Ev { at: number; len: number; m: number }
/** "A4 - B4 . | ..." — 한 칸이 8분음표, '-'는 앞 음을 늘이고 '.'은 쉼표 */
function parse(src: string): Map<number, Ev> {
  const out = new Map<number, Ev>();
  let i = 0;
  let last: Ev | null = null;
  for (const tok of src.split(/\s+/).filter((x) => x && x !== '|')) {
    if (tok === '-') { if (last) last.len++; }
    else if (tok === '.') last = null;
    else { last = { at: i, len: 1, m: midi(tok) }; out.set(i, last); }
    i++;
  }
  return out;
}

interface Part { inst: Inst; notes: Map<number, Ev>; vel: number; shift?: number }
interface Section { bars: number; parts: Part[]; roots: number[] }
interface PlayCtx { g: Graph; bus: Bus; t: number; spb: number; step: number; bar: number; beat: number; sec: number; root: number; loop: number; last: boolean }
interface TrackDef { bpm: number; scale: number[]; sections: Section[]; comp: (c: PlayCtx) => void }

const roots = (s: string) => s.split(/\s+/).filter(Boolean).map(midi);

/* 표제 — 「천하삼분」 D 궁조, 느리고 웅장하게 */
const D_GONG = [2, 4, 6, 9, 11];
const TITLE: TrackDef = {
  bpm: 64,
  scale: D_GONG,
  sections: [{
    bars: 8,
    roots: roots('D3 D3 B2 A2 B2 B2 A2 D3'),
    parts: [{
      inst: flute, vel: 0.16,
      notes: parse(`A4 - - B4 A4 F#4 E4 - | D4 - - - . E4 F#4 A4 | B4 - A4 B4 D5 - B4 A4 | F#4 - - - - - . . |
                    D5 - - E5 D5 B4 A4 - | B4 - A4 F#4 E4 - D4 E4 | F#4 - A4 - E4 - F#4 E4 | D4 - - - - - . . |`),
    }],
  }],
  comp: (c) => {
    const { g, bus, t, spb, beat, bar, root } = c;
    const arp = [0, 3, 5, 6, 7, 6, 5, 3];
    pluck(g, bus, t, degree(D_GONG, root, arp[beat]), spb * 2, beat === 0 ? 0.11 : 0.065);
    if (beat === 0) {
      pad(g, bus, t, root, spb * 8, 0.035);
      pad(g, bus, t, degree(D_GONG, root, 3), spb * 8, 0.025);
      drum(g, bus, t, bar % 2 === 0 ? 0.22 : 0.12);
    }
    if (bar === 0 && beat === 0) gong(g, bus, t, c.loop === 0 ? 0.18 : 0.12);
    if (bar === 7 && (beat === 4 || beat === 6 || beat === 7)) drum(g, bus, t, 0.1 + beat * 0.012);
  },
};

/* 지도 — 「강산」 G 궁조, 고쟁 선율과 적 선율이 번갈아 */
const G_GONG = [7, 9, 11, 2, 4];
const MAP: TrackDef = {
  bpm: 78,
  scale: G_GONG,
  sections: [
    {
      bars: 8,
      roots: roots('G2 G2 E2 D3 E2 D3 A2 G2'),
      parts: [{
        inst: pluck, vel: 0.36,
        notes: parse(`D5 - E5 D5 B4 - A4 B4 | G4 - - - A4 - B4 - | D5 - B4 A4 G4 - E4 G4 | A4 - - - - - . . |
                      B4 - D5 - E5 - D5 B4 | A4 - G4 A4 B4 - D5 - | E5 - D5 B4 A4 - B4 A4 | G4 - - - - - . . |`),
      }],
    },
    {
      bars: 8,
      roots: roots('E2 D3 E2 E2 D3 D3 A2 G2'),
      parts: [{
        inst: flute, vel: 0.2,
        notes: parse(`G5 - - E5 D5 - E5 G5 | A5 - G5 E5 D5 - - . | E5 - D5 B4 A4 - B4 D5 | E5 - - - - - . . |
                      D5 - E5 G5 A5 - G5 E5 | D5 - B4 - A4 - G4 A4 | B4 - D5 - A4 - B4 A4 | G4 - - - - - . . |`),
      }, {
        inst: pluck, vel: 0.14, shift: -12,
        notes: parse(`. . . . . . . . | . . . . A4 - - . | . . . . . . . . | B4 - D5 - E5 - . . |
                      . . . . . . . . | . . . . . . . . | . . . . . . . . | . . . . . . . . |`),
      }],
    },
  ],
  comp: (c) => {
    const { g, bus, t, spb, beat, bar, root } = c;
    if (beat % 2 === 0) {
      const arp = [0, 3, 5, 3];
      pluck(g, bus, t, degree(G_GONG, root, arp[beat / 2]), spb * 2, beat === 0 ? 0.14 : 0.1);
    }
    if (beat === 0) {
      pad(g, bus, t, root + 12, spb * 8, 0.04);
      pad(g, bus, t, degree(G_GONG, root + 12, 3), spb * 8, 0.03);
    }
    if (beat === 0 || beat === 5) tang(g, bus, t, beat === 0 ? 0.09 : 0.05);
    if (bar % 4 === 3 && beat === 6) block(g, bus, t, 0.08);
  },
};

/* 전투 — 「출진」 A 우조, 북이 몰아치고 이호가 이끈다 */
const A_YU = [9, 0, 2, 4, 7];
const BATTLE: TrackDef = {
  bpm: 116,
  scale: A_YU,
  sections: [
    {
      bars: 8,
      roots: roots('A2 A2 C3 E2 A2 A2 G2 A2'),
      parts: [{
        inst: erhu, vel: 0.15,
        notes: parse(`A4 - - C5 D5 - E5 - | D5 C5 A4 - G4 - A4 - | C5 - D5 E5 G5 - E5 D5 | E5 - - - - - . . |
                      A5 - G5 E5 D5 - E5 G5 | E5 - D5 C5 A4 - - . | G4 - A4 C5 D5 - C5 A4 | A4 - - - - - . . |`),
      }],
    },
    {
      bars: 8,
      roots: roots('C3 A2 C3 G2 A2 E2 G2 A2'),
      parts: [{
        inst: erhu, vel: 0.15,
        notes: parse(`E5 E5 G5 - A5 - G5 E5 | D5 - E5 - C5 - A4 - | E5 E5 G5 - A5 - C6 A5 | G5 - - - E5 - . . |
                      A5 - C6 - A5 G5 E5 D5 | E5 - G5 E5 D5 C5 A4 C5 | D5 - E5 - G5 - E5 D5 | A4 - - - - - . . |`),
      }, {
        inst: flute, vel: 0.06, shift: 12,
        notes: parse(`. . . . . . . . | . . . . . . . . | E5 E5 G5 - A5 - C6 A5 | G5 - - - E5 - . . |
                      . . . . . . . . | . . . . . . . . | D5 - E5 - G5 - E5 D5 | A4 - - - - - . . |`),
      }],
    },
  ],
  comp: (c) => {
    const { g, bus, t, spb, beat, bar, root, sec } = c;
    const ost = [0, 0, 3, 0, 1, 0, 2, 3];
    pluck(g, bus, t, degree(A_YU, root, ost[beat]), spb, beat % 4 === 0 ? 0.12 : 0.08);
    if (beat === 0) pad(g, bus, t, root, spb * 8, 0.03);
    const big: Record<number, number> = { 0: 1, 3: 0.55, 4: 0.85, 6: 0.6 };
    if (big[beat]) drum(g, bus, t, 0.3 * big[beat]);
    if (beat === 2 || beat === 6) tang(g, bus, t, 0.1);
    if (sec === 1 && beat === 7) { tang(g, bus, t, 0.08); tang(g, bus, t + spb / 2, 0.1); }
    if (bar === 7 && beat >= 4) { tang(g, bus, t, 0.12); tang(g, bus, t + spb / 2, 0.14); }
    if (bar === 0 && beat === 0) cymbal(g, bus, t, 0.1, 1.2);
    if (bar === 0 && beat === 0 && sec === 0) gong(g, bus, t, 0.14, 80);
    if (bar === 4 && beat === 0) block(g, bus, t, 0.06, 900);
  },
};

const TRACKS: Record<Track, TrackDef> = { title: TITLE, map: MAP, battle: BATTLE };

/* ───────── 박자 맞춤 재생기 ───────── */

let want: Track | null = null;
let cur: Track | null = null;
let step = 0;
let secIdx = 0;
let loop = 0;
let nextAt = 0;
let pauseUntil = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const LOOK = 0.45;

function tick() {
  const g = graph();
  if (!g || g.ac.state !== 'running') return;
  const now = g.ac.currentTime;
  if (!musicOn() || !want) { cur = null; return; }
  if (now < pauseUntil) return;
  if (cur !== want) {
    cur = want; step = 0; secIdx = 0; loop = 0;
    nextAt = now + 0.12;
    g.duck.gain.cancelScheduledValues(now);
    g.duck.gain.setValueAtTime(1, now);
  }
  if (nextAt < now - 0.25) nextAt = now + 0.05;
  const T = TRACKS[cur];
  const spb = 60 / T.bpm / 2;
  while (nextAt < now + LOOK) {
    const sec = T.sections[secIdx];
    const bar = Math.floor(step / 8);
    const c: PlayCtx = { g, bus: g.mbus, t: nextAt, spb, step, bar, beat: step % 8, sec: secIdx, root: sec.roots[bar], loop, last: bar === sec.bars - 1 };
    for (const p of sec.parts) {
      const ev = p.notes.get(step);
      if (ev) p.inst(g, g.mbus, nextAt, ev.m + (p.shift ?? 0), ev.len * spb, p.vel);
    }
    T.comp(c);
    step++;
    nextAt += spb;
    if (step >= sec.bars * 8) {
      step = 0;
      secIdx = (secIdx + 1) % T.sections.length;
      if (secIdx === 0) loop++;
    }
  }
}

/** 지금 흘러야 할 곡(없으면 멈춤) */
export function playMusic(track: Track | null) {
  want = track;
  if (!track && G) {
    const now = G.ac.currentTime;
    G.duck.gain.cancelScheduledValues(now);
    G.duck.gain.setTargetAtTime(0, now, 0.15);
    cur = null;
  }
  if (!timer && typeof window !== 'undefined') timer = setInterval(tick, 120);
  tick();
}

/** 짧은 연주가 끝날 때까지 배경음악을 낮추고 멈춘다 */
function hold(g: Graph, sec: number) {
  const now = g.ac.currentTime;
  pauseUntil = now + sec;
  g.duck.gain.cancelScheduledValues(now);
  g.duck.gain.setTargetAtTime(0, now, 0.12);
  cur = null;
}

/* ───────── 효과음 ───────── */

function withSfx(fn: (g: Graph, t: number) => void) {
  return (delay = 0) => {
    if (!soundOn) return;
    const g = graph();
    if (!g) return;
    if (g.ac.state === 'suspended') void g.ac.resume();
    fn(g, g.ac.currentTime + 0.01 + delay);
  };
}

function phrase(g: Graph, bus: Bus, t: number, inst: Inst, src: string, spb: number, vel: number) {
  for (const ev of parse(src).values()) inst(g, bus, t + ev.at * spb, ev.m, ev.len * spb, vel);
}

export const sg = {
  /** 명령이 받아들여짐 — 고쟁 두 음 */
  ok: withSfx((g, t) => { pluck(g, g.sbus, t, midi('D5'), 0.3, 0.16); pluck(g, g.sbus, t + 0.07, midi('A5'), 0.4, 0.14); }),
  /** 명령이 막힘 — 낮게 둔한 현 */
  fail: withSfx((g, t) => { pluck(g, g.sbus, t, midi('E3'), 0.2, 0.2); block(g, g.sbus, t + 0.02, 0.06, 500); }),
  tap: withSfx((g, t) => block(g, g.sbus, t, 0.06, 1300)),
  /** 달이 넘어감 — 박판 두 번 */
  turn: withSfx((g, t) => { block(g, g.sbus, t, 0.12); block(g, g.sbus, t + 0.13, 0.1, 1050); }),
  /** 역사 사건 — 소라와 고쟁 오름 */
  event: withSfx((g, t) => {
    if (musicOn() && want) hold(g, 2.4);
    smallGong(g, g.sbus, t, 0.12);
    phrase(g, g.sbus, t + 0.25, pluck, 'D4 F#4 A4 B4 D5 - - -', 0.11, 0.12);
  }),
  /** 칼과 창이 부딪침 */
  clash: withSfx((g, t) => {
    hiss(g, g.sbus, t, { type: 'bandpass', f: 3200, q: 1.6, vel: 0.22, dur: 0.12 });
    for (const [f, d] of [[1830, 0.16], [2710, 0.12], [3950, 0.09]] as const) {
      const o = g.ac.createOscillator();
      o.type = 'square';
      o.frequency.value = f * (0.97 + Math.random() * 0.06);
      o.connect(filt(g, 'highpass', 1200)).connect(env(g, t, 0.035, 0.002, 0, d)).connect(g.sbus);
      o.start(t); o.stop(t + d + 0.05);
    }
    drum(g, g.sbus, t + 0.01, 0.12, 1.4);
    hiss(g, g.sbus, t + 0.09, { type: 'bandpass', f: 2600, q: 1.4, vel: 0.12, dur: 0.08 });
  }),
  /** 전법 — 북 두 번에 칼바람 */
  tactic: withSfx((g, t) => {
    drum(g, g.sbus, t, 0.3, 0.9);
    drum(g, g.sbus, t + 0.12, 0.26, 1.1);
    hiss(g, g.sbus, t + 0.05, { type: 'bandpass', f: 1200, f2: 4200, q: 1.2, vel: 0.16, attack: 0.08, dur: 0.3 });
    for (const d of [0.22, 0.3]) {
      hiss(g, g.sbus, t + d, { type: 'bandpass', f: 3000, q: 1.8, vel: 0.2, dur: 0.1 });
      const o = g.ac.createOscillator();
      o.type = 'square';
      o.frequency.value = 2000 + Math.random() * 900;
      o.connect(filt(g, 'highpass', 1400)).connect(env(g, t + d, 0.04, 0.002, 0, 0.14)).connect(g.sbus);
      o.start(t + d); o.stop(t + d + 0.18);
    }
  }),
  /** 필살 — 징과 함께 큰 북 */
  crit: withSfx((g, t) => {
    gong(g, g.sbus, t, 0.22, 110);
    smallGong(g, g.sbus, t + 0.05, 0.12);
    [0, 0.1, 0.2].forEach((d, i) => drum(g, g.sbus, t + d, 0.24 + i * 0.05, 0.8));
    cymbal(g, g.sbus, t + 0.3, 0.12, 1.1);
  }),
  /** 화살 일제 사격 — 휙휙 날아가 박힌다 */
  volley: withSfx((g, t) => {
    for (let i = 0; i < 5; i++) {
      const d = t + i * 0.035 + Math.random() * 0.02;
      hiss(g, g.sbus, d, { type: 'bandpass', f: 4200, f2: 1300, q: 3, vel: 0.22, attack: 0.02, dur: 0.24 });
      hiss(g, g.sbus, d + 0.3, { type: 'lowpass', f: 700, vel: 0.14, dur: 0.05 });
    }
  }),
  /** 성벽·성문을 친다 */
  siege: withSfx((g, t) => {
    drum(g, g.sbus, t, 0.32, 0.7);
    hiss(g, g.sbus, t, { type: 'lowpass', f: 420, vel: 0.3, dur: 0.38 });
    block(g, g.sbus, t + 0.01, 0.05, 420);
  }),
  /** 성벽·성문이 무너짐, 부대 붕괴 */
  breach: withSfx((g, t) => {
    hiss(g, g.sbus, t, { type: 'lowpass', f: 380, f2: 120, vel: 0.36, attack: 0.03, dur: 1.3 });
    for (let i = 0; i < 4; i++) drum(g, g.sbus, t + i * 0.13 + Math.random() * 0.05, 0.22 - i * 0.03, 0.6);
    cymbal(g, g.sbus, t + 0.05, 0.05, 0.8);
  }),
  /** 화계 — 불이 붙어 타닥타닥 번진다 */
  fire: withSfx((g, t) => {
    hiss(g, g.sbus, t, { type: 'lowpass', f: 400, f2: 2200, vel: 0.2, attack: 0.25, dur: 0.9 });
    for (let i = 0; i < 16; i++) {
      hiss(g, g.sbus, t + 0.1 + Math.random() * 1.0, { type: 'bandpass', f: 1500 + Math.random() * 2500, q: 4, vel: 0.06 + Math.random() * 0.06, dur: 0.02 });
    }
  }),
  /** 수공 — 둑이 터져 물이 쏟아진다 */
  flood: withSfx((g, t) => {
    hiss(g, g.sbus, t, { type: 'lowpass', f: 180, f2: 1400, vel: 0.32, attack: 0.5, dur: 1.6 });
    hiss(g, g.sbus, t + 0.3, { type: 'bandpass', f: 900, f2: 300, q: 0.7, vel: 0.14, attack: 0.3, dur: 1.4 });
    drum(g, g.sbus, t, 0.2, 0.5);
  }),
  /** 혼란 — 흔들리며 가라앉는 소리 */
  confuse: withSfx((g, t) => {
    const o = g.ac.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(300, t + 0.7);
    const lfo = g.ac.createOscillator();
    lfo.frequency.value = 9;
    const d = g.ac.createGain();
    d.gain.value = 60;
    lfo.connect(d).connect(o.frequency);
    o.connect(env(g, t, 0.07, 0.03, 0.3, 0.4)).connect(g.sbus);
    o.start(t); o.stop(t + 0.8); lfo.start(t); lfo.stop(t + 0.8);
  }),
  /** 일기토 — 징 한 번에 칼이 세 번 부딪친다 */
  duel: withSfx((g, t) => {
    smallGong(g, g.sbus, t, 0.14);
    [0.35, 0.62, 0.8].forEach((d) => {
      hiss(g, g.sbus, t + d, { type: 'bandpass', f: 3400, q: 2, vel: 0.2, dur: 0.1 });
      const o = g.ac.createOscillator();
      o.type = 'square';
      o.frequency.value = 2200 + Math.random() * 600;
      o.connect(filt(g, 'highpass', 1500)).connect(env(g, t + d, 0.04, 0.002, 0, 0.18)).connect(g.sbus);
      o.start(t + d); o.stop(t + d + 0.22);
    });
  }),
  /** 원군 도착 — 뿔나팔 */
  horn: withSfx((g, t) => {
    for (const [m, at, len] of [['A2', 0, 0.5], ['E3', 0.55, 0.9]] as const) {
      const o = g.ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(hz(midi(m)) * 0.94, t + at);
      o.frequency.exponentialRampToValueAtTime(hz(midi(m)), t + at + 0.12);
      const lp = filt(g, 'lowpass', 300, 1.5);
      lp.frequency.setValueAtTime(300, t + at);
      lp.frequency.linearRampToValueAtTime(1400, t + at + 0.25);
      o.connect(lp).connect(env(g, t + at, 0.12, 0.12, len - 0.2, 0.3)).connect(g.sbus);
      o.start(t + at); o.stop(t + at + len + 0.35);
    }
  }),
  /** 부대 이동 — 병종마다 다른 발소리 */
  march: (kind: UnitKind = '보병') => withSfx((g, t) => {
    if (kind === '기병') {
      for (let i = 0; i < 6; i++) {
        const at = t + Math.floor(i / 3) * 0.24 + (i % 3) * 0.06;
        hiss(g, g.sbus, at, { type: 'lowpass', f: 600, vel: 0.22, dur: 0.05 });
        block(g, g.sbus, at, 0.05, 380);
      }
    } else if (kind === '수군') {
      for (let i = 0; i < 2; i++) hiss(g, g.sbus, t + i * 0.32, { type: 'bandpass', f: 500, f2: 1600, q: 0.8, vel: 0.24, attack: 0.08, dur: 0.25 });
    } else if (kind === '공성') {
      hiss(g, g.sbus, t, { type: 'lowpass', f: 160, vel: 0.4, attack: 0.1, dur: 0.6 });
      [0.1, 0.35].forEach((d) => block(g, g.sbus, t + d, 0.05, 260));
    } else {
      for (let i = 0; i < 4; i++) hiss(g, g.sbus, t + i * 0.1, { type: 'lowpass', f: 420, vel: 0.2, dur: 0.06 });
      hiss(g, g.sbus, t + 0.05, { type: 'highpass', f: 5000, vel: 0.02, dur: 0.25 });
    }
  })(),
  /** 출진 — 징과 북이 점점 빨라진다 */
  battleStart: withSfx((g, t) => {
    hold(g, 2.6);
    gong(g, g.sbus, t, 0.3, 78);
    [0.5, 0.95, 1.3, 1.55, 1.75, 1.9, 2.02].forEach((d, i) => drum(g, g.sbus, t + d, 0.18 + i * 0.03));
    cymbal(g, g.sbus, t + 2.15, 0.12, 1);
  }),
  /** 승전 — 북과 징 위로 적이 높이 오른다 */
  victory: withSfx((g, t) => {
    hold(g, 6);
    gong(g, g.sbus, t, 0.18, 98);
    [0, 0.2, 0.4, 0.5, 0.6].forEach((d, i) => drum(g, g.sbus, t + d, 0.16 + i * 0.03));
    phrase(g, g.sbus, t + 0.6, flute, 'D5 E5 F#5 A5 - B5 A5 - D6 - - - - - - -', 0.17, 0.15);
    phrase(g, g.sbus, t + 0.6, pluck, 'D4 . A4 . D4 . B3 . A3 . . . D4 - - -', 0.17, 0.12);
    cymbal(g, g.sbus, t + 0.6 + 8 * 0.17, 0.12, 1.4);
  }),
  /** 패전 — 이호가 낮게 내려앉는다 */
  defeat: withSfx((g, t) => {
    hold(g, 6);
    gong(g, g.sbus, t, 0.16, 70);
    phrase(g, g.sbus, t + 0.4, erhu, 'E4 - D4 C4 A3 - - - G3 - - A3 - - - -', 0.26, 0.16);
    pad(g, g.sbus, t + 0.4, midi('A2'), 3.6, 0.04);
  }),
};

/** 전투 기록 한 줄로 효과음을 고른다 */
export function battleCue(line: string): (() => void) | null {
  if (/무너졌다!|무너졌다\.|달아났다|본진을 점령/.test(line)) return () => sg.breach();
  if (/화계|불길/.test(line)) return /실패/.test(line) ? null : () => sg.fire();
  if (/둑|물이 차오른|물길/.test(line)) return /열리지 않았다/.test(line) ? null : () => sg.flood();
  if (/혼란/.test(line)) return /않았다/.test(line) ? null : () => sg.confuse();
  if (/원군.*도착했다/.test(line)) return () => sg.horn();
  if (/막혔다/.test(line)) return null;
  if (/필살/.test(line)) return null;
  if (/의 \S+! → .*: 전법 −/.test(line)) return () => sg.tactic();
  if (/: 전법 −/.test(line)) return null;
  if (/일기토|베었|사로잡/.test(line)) return null;
  if (/: 사격 −/.test(line)) return () => sg.volley();
  if (/: 공격 −/.test(line)) return () => sg.clash();
  if (/ → [^:]+: −\d/.test(line)) return () => sg.siege();
  return null;
}
