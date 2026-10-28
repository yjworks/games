import { getPrefs, onPrefsChange } from './prefs';

/* WebAudio로 짧은 효과음만 합성한다. 오디오 파일이 없으니 오프라인에서도 그대로 동작한다. */
let ctx: AudioContext | null = null;
let enabled = getPrefs().sound;
onPrefsChange((p) => { enabled = p.sound; });

export function setSoundEnabled(on: boolean) { enabled = on; }
export function isSoundEnabled() { return enabled; }

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** 게임이 직접 음을 합성할 때 쓰는 공용 AudioContext (없으면 null) */
export function audioContext(): AudioContext | null {
  return ensureCtx();
}

interface BlipOpts {
  freq: number;
  dur: number;
  gain?: number;
  type?: OscillatorType;
  /** 끝 주파수 비율 (1이면 고정) */
  slide?: number;
  delay?: number;
}

export function blip({ freq, dur, gain = 0.15, type = 'sine', slide = 0.6, delay = 0 }: BlipOpts) {
  if (!enabled) return;
  const ac = ensureCtx();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide !== 1) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t0 + dur);
  amp.gain.setValueAtTime(gain, t0);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}

function chord(freqs: number[], dur: number, gap: number, gain = 0.16) {
  freqs.forEach((f, i) => blip({ freq: f, dur, gain, slide: 1, delay: i * gap }));
}

/** 게임 공통 효과음 모음 */
export const sfx = {
  tap: () => blip({ freq: 420, dur: 0.05, gain: 0.1, type: 'triangle' }),
  place: () => blip({ freq: 320, dur: 0.08, gain: 0.16, type: 'triangle' }),
  capture: () => blip({ freq: 180, dur: 0.14, gain: 0.18, type: 'square' }),
  move: () => blip({ freq: 260, dur: 0.05, gain: 0.08, type: 'square', slide: 1 }),
  rotate: () => blip({ freq: 520, dur: 0.05, gain: 0.09, type: 'square', slide: 1.1 }),
  drop: () => blip({ freq: 140, dur: 0.1, gain: 0.16, type: 'sawtooth' }),
  lineClear: () => chord([660, 880], 0.12, 0.06, 0.14),
  tetris: () => chord([660, 880, 1170], 0.16, 0.07, 0.16),
  levelUp: () => chord([523, 659, 784], 0.14, 0.08, 0.14),
  alert: () => blip({ freq: 700, dur: 0.16, gain: 0.12, type: 'sawtooth' }),
  undo: () => blip({ freq: 180, dur: 0.1, gain: 0.12 }),
  win: () => chord([523, 659, 784, 1046], 0.2, 0.11, 0.17),
  lose: () => chord([392, 330, 262], 0.22, 0.12, 0.15),
};
