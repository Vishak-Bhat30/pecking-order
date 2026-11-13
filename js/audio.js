// Pecking Order — audio engine.
// Every sound here is synthesized live with the Web Audio API: no audio files, no libraries.
//
//   import audio, { SOUND_NAMES } from './audio.js';
//   audio.unlock();            // on first user gesture (also auto-installed below)
//   audio.play('rooster');     // fire-and-forget SFX, opts: { volume: 0..1, delay: seconds }
//   audio.setMood('game');     // background music: 'menu' | 'game' | 'tense' | 'victory' | 'off'
//   audio.setSfx(false); audio.setMusic(false);   // persisted in localStorage

const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;

// ---------------------------------------------------------------- mix levels
const MASTER = 0.9;        // into the compressor
const OUT_TRIM = 0.85;     // after the compressor (it adds automatic makeup gain)
const SFX_LEVEL = 1.0;
const MUSIC_LEVEL = 0.6;   // background, well under the SFX

// Per-sound loudness trims (calibrated with an offline render; see dev/audio-preview.html).
const LEVELS = {
  click: 1.35, hover: 1.9, open: 0.9, close: 1.05, error: 1.35, join: 1.15, leave: 1.25, copy: 0.62, start: 1.3,
  deal: 1.85, flip: 1.9, swap: 1.3, reveal: 1.13,
  corn: 1.4, cornMany: 0.82, spend: 0.94,
  rooster: 0.95, fox: 0.56, raccoon: 1.9, owl: 0.85, goose: 1.75,
  peck: 0.71, forage: 0.58, tribute: 1.06, raid: 2.1, pilfer: 0.72, foresight: 1.5, barnstorm: 1.7, hit: 2.3,
  challenge: 2.0, truth: 1.35, bluff: 1.8, block: 1.6, stamp: 2.0, lose: 1.5, eliminated: 0.65,
  turn: 1.0, tick: 1.45, timeout: 1.23, win: 1.0, defeat: 1.1,
};

// ---------------------------------------------------------------- state
let ctx = null, sfxBus = null, musicBus = null, moodOut = null;
let lastResume = -1e9;
let lastHover = 0;
const prefs = { sfx: loadPref('po_sfx', true), music: loadPref('po_music', true) };

function loadPref(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v === '1'; } catch { return d; } }
function savePref(k, v) { try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* private mode */ } }
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const rnd = (a, b) => a + Math.random() * (b - a);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------------- graph
function buildChain(ac) {
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4;
  comp.attack.value = 0.003; comp.release.value = 0.2;
  const master = ac.createGain(); master.gain.value = MASTER;
  const trim = ac.createGain(); trim.gain.value = OUT_TRIM;
  master.connect(comp); comp.connect(trim); trim.connect(ac.destination);
  return master;
}

const noiseCache = new WeakMap();
function noiseBuf(ac) {
  let b = noiseCache.get(ac);
  if (!b) {
    b = ac.createBuffer(1, Math.floor(ac.sampleRate * 2), ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ac, b);
  }
  return b;
}

// ---------------------------------------------------------------- primitives
// Envelope on a gain AudioParam. Percussive (attack a → exp decay d) unless `hold` is given,
// in which case it's gated: attack, optional decay to `sus`, release r starting at t+hold.
function shape(gp, o) {
  const t = o.t, a = o.a ?? 0.005, v = o.vol ?? 0.3;
  gp.setValueAtTime(0, t);
  gp.linearRampToValueAtTime(v, t + a);
  if (o.hold != null) {
    const hold = Math.max(o.hold, a + 0.002), r = o.r ?? 0.06;
    if (o.sus != null) gp.setTargetAtTime(v * o.sus, t + a, (o.d ?? 0.1) / 3);
    gp.setTargetAtTime(0, t + hold, r / 5);
    return t + hold + r + 0.02;
  }
  const d = o.d ?? 0.2;
  gp.exponentialRampToValueAtTime(0.0006, t + a + d);
  gp.linearRampToValueAtTime(0, t + a + d + 0.01);
  return t + a + d + 0.02;
}

function filt(ac, f, t) {
  const n = ac.createBiquadFilter();
  n.type = f.type || 'lowpass';
  n.frequency.setValueAtTime(f.f, t);
  if (f.f2) n.frequency.exponentialRampToValueAtTime(f.f2, t + (f.dt ?? 0.2));
  n.Q.value = f.Q ?? 0.8;
  if (f.gain != null) n.gain.value = f.gain;
  return n;
}

function toOut(ac, node, out, pan) {
  if (pan && ac.createStereoPanner) {
    const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(p); p.connect(out);
  } else node.connect(out);
}

// Oscillator voice. o: {t,f,type,f2,glide,lin,path:[[dt,f,'lin']],detune,filter,vib:{rate,depth,delay},a,d,hold,sus,r,vol,pan}
function tone(ac, out, o) {
  const t = o.t;
  const osc = ac.createOscillator();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.path) {
    for (const [dt, f, kind] of o.path) {
      if (kind === 'lin') osc.frequency.linearRampToValueAtTime(f, t + dt);
      else osc.frequency.exponentialRampToValueAtTime(f, t + dt);
    }
  } else if (o.f2) {
    const gt = t + (o.glide ?? o.hold ?? o.d ?? 0.2);
    if (o.lin) osc.frequency.linearRampToValueAtTime(o.f2, gt);
    else osc.frequency.exponentialRampToValueAtTime(o.f2, gt);
  }
  if (o.detune) osc.detune.setValueAtTime(o.detune, t);
  const g = ac.createGain();
  let head = osc;
  if (o.filter) { const fl = filt(ac, o.filter, t); osc.connect(fl); head = fl; }
  head.connect(g);
  const end = shape(g.gain, o);
  if (o.vib) {
    const l = ac.createOscillator(); l.frequency.value = o.vib.rate || 6;
    const lg = ac.createGain(); const vd = o.vib.delay || 0;
    lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + vd);
    lg.gain.linearRampToValueAtTime(o.vib.depth || 20, t + vd + 0.12);
    l.connect(lg); lg.connect(osc.detune);
    l.start(t); l.stop(end + 0.05);
  }
  toOut(ac, g, out, o.pan);
  osc.start(t); osc.stop(end + 0.05);
  return end;
}

// Filtered noise voice. Same envelope options as tone().
function nz(ac, out, o) {
  const t = o.t;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf(ac); src.loop = true;
  if (o.rate) src.playbackRate.value = o.rate;
  const g = ac.createGain();
  let head = src;
  if (o.filter) { const fl = filt(ac, o.filter, t); src.connect(fl); head = fl; }
  if (o.filter2) { const f2 = filt(ac, o.filter2, t); head.connect(f2); head = f2; }
  head.connect(g);
  const end = shape(g.gain, o);
  toOut(ac, g, out, o.pan);
  src.start(t, Math.random() * 1.5); src.stop(end + 0.05);
  return end;
}

// A "voiced" cartoon animal call: two detuned oscillators → formant bandpasses → rasp AM → syllable gate.
// segs: [{t, dur, f0, f1 | pts:[[dt,f]...], v}] (times relative to t0)
function formantVoice(ac, out, t0, segs, o = {}) {
  const last = segs[segs.length - 1];
  const end = t0 + last.t + last.dur + 0.08;
  const o1 = ac.createOscillator(); o1.type = o.type1 || 'sawtooth';
  const o2 = ac.createOscillator(); o2.type = o.type2 || 'square';
  o2.detune.value = o.det ?? 10;
  const mix = ac.createGain();
  const g1 = ac.createGain(); g1.gain.value = o.mix1 ?? 0.6; o1.connect(g1); g1.connect(mix);
  const g2 = ac.createGain(); g2.gain.value = o.mix2 ?? 0.4; o2.connect(g2); g2.connect(mix);

  for (const p of [o1.frequency, o2.frequency]) {
    p.setValueAtTime(segs[0].f0, t0);
    for (const s of segs) {
      const ts = t0 + s.t;
      p.linearRampToValueAtTime(s.f0, ts);
      const pts = s.pts || [[s.dur, s.f1 ?? s.f0]];
      for (const [dt, f] of pts) p.exponentialRampToValueAtTime(f, ts + dt);
    }
  }
  const nodes = [o1, o2];
  if (o.vib) {
    const l = ac.createOscillator(); l.frequency.value = o.vib.rate || 6;
    const lg = ac.createGain();
    lg.gain.setValueAtTime(0, t0); lg.gain.setValueAtTime(0, t0 + o.vib.at);
    lg.gain.linearRampToValueAtTime(o.vib.depth || 30, t0 + o.vib.at + 0.12);
    l.connect(lg); lg.connect(o1.detune); lg.connect(o2.detune);
    nodes.push(l);
  }

  const sum = ac.createGain();
  for (const [f, Q, gv] of (o.formants || [[1000, 4, 1]])) {
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = Q;
    const gg = ac.createGain(); gg.gain.value = gv;
    mix.connect(bp); bp.connect(gg); gg.connect(sum);
  }
  if (o.dry) {
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.lp || 3000;
    const gd = ac.createGain(); gd.gain.value = o.dry;
    mix.connect(lp); lp.connect(gd); gd.connect(sum);
  }
  if (o.noise) {
    const ns = ac.createBufferSource(); ns.buffer = noiseBuf(ac); ns.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = o.noise.f; bp.Q.value = o.noise.Q ?? 1;
    const ng = ac.createGain(); ng.gain.value = o.noise.vol;
    ns.connect(bp); bp.connect(ng); ng.connect(sum);
    nodes.push(ns);
  }
  let pre = sum;
  if (o.rasp) {
    const rasp = ac.createGain(); rasp.gain.value = 1 - o.rasp.depth;
    const l = ac.createOscillator(); l.frequency.value = o.rasp.rate;
    const lg = ac.createGain(); lg.gain.value = o.rasp.depth;
    l.connect(lg); lg.connect(rasp.gain);
    sum.connect(rasp); pre = rasp; nodes.push(l);
  }
  const gate = ac.createGain();
  const vol = o.vol ?? 0.5;
  gate.gain.setValueAtTime(0, t0);
  for (const s of segs) {
    const ts = t0 + s.t, te = ts + s.dur, v = vol * (s.v ?? 1);
    const att = Math.min(o.att ?? 0.012, s.dur * 0.3), rel = Math.min(o.rel ?? 0.05, s.dur * 0.3);
    gate.gain.setValueAtTime(0, ts);
    gate.gain.linearRampToValueAtTime(v, ts + att);
    gate.gain.linearRampToValueAtTime(v * (s.tail ?? 0.85), te - rel);
    gate.gain.linearRampToValueAtTime(0, te);
  }
  pre.connect(gate);
  toOut(ac, gate, out, o.pan);
  for (const n of nodes) { n.start(t0); n.stop(end + 0.05); }
  return end;
}

// ---- small instruments
const plink = (ac, out, t, f, vol = 0.4, pan = 0) => {
  tone(ac, out, { t, f, f2: f * 0.97, glide: 0.1, a: 0.002, d: 0.13, vol, pan });
  tone(ac, out, { t, f: f * 2.01, type: 'triangle', a: 0.001, d: 0.05, vol: vol * 0.25, pan });
  return t + 0.16;
};
const fwip = (ac, out, t, vol = 0.5, pan = 0) => {
  nz(ac, out, { t, filter: { type: 'bandpass', f: 3200, f2: 900, dt: 0.06, Q: 1.1 }, a: 0.003, d: 0.06, vol, pan });
  tone(ac, out, { t: t + 0.02, f: 190, f2: 90, a: 0.002, d: 0.05, vol: vol * 0.35, pan });
  return t + 0.1;
};
const thud = (ac, out, t, vol = 0.6, f = 110, d = 0.2) => {
  tone(ac, out, { t, f, f2: f * 0.45, glide: d * 0.8, a: 0.002, d, vol });
  nz(ac, out, { t, filter: { type: 'lowpass', f: 420 }, a: 0.002, d: 0.07, vol: vol * 0.5 });
  return t + d + 0.05;
};
const tick = (ac, out, t, vol = 0.3, f = 1700) => {
  tone(ac, out, { t, f, f2: f * 0.88, glide: 0.03, type: 'sine', a: 0.001, d: 0.035, vol });
  nz(ac, out, { t, filter: { type: 'bandpass', f: 3200, Q: 3 }, a: 0.001, d: 0.015, vol: vol * 0.5 });
  return t + 0.06;
};
const bell = (ac, out, t, f, vol = 0.3, d = 0.8, pan = 0) => {
  tone(ac, out, { t, f, a: 0.003, d, vol, pan });
  tone(ac, out, { t, f: f * 2.76, a: 0.002, d: d * 0.45, vol: vol * 0.28, pan });
  tone(ac, out, { t, f: f * 5.4, a: 0.001, d: d * 0.22, vol: vol * 0.1, pan });
  return t + d + 0.05;
};
const pluck = (ac, out, t, f, vol = 0.08, dec = 0.32, bright = 7, pan = 0) =>
  tone(ac, out, {
    t, f: f * 1.012, f2: f, glide: 0.03, type: 'sawtooth', a: 0.003, d: dec, vol, pan,
    filter: { type: 'lowpass', f: Math.min(f * bright, 12000), f2: Math.max(f * 1.3, 180), dt: dec * 0.6, Q: 2.5 },
  });
const pizz = (ac, out, t, f, vol = 0.1, dec = 0.16, pan = 0) =>
  tone(ac, out, { t, f, type: 'triangle', a: 0.003, d: dec, vol, pan, filter: { type: 'lowpass', f: 2200, Q: 1 } });
const bassNote = (ac, out, t, f, vol = 0.12, dec = 0.35) => {
  tone(ac, out, { t, f, type: 'triangle', a: 0.006, d: dec, vol, filter: { type: 'lowpass', f: 700 } });
  tone(ac, out, { t, f, a: 0.006, d: dec * 0.9, vol: vol * 0.6 });
  return t + dec;
};
const brass = (ac, out, t, f, dur, vol = 0.12, pan = 0) => {
  const o = {
    t, a: 0.035, hold: dur, r: 0.09, vol, pan, vib: { rate: 5.5, depth: 9, delay: 0.15 },
    filter: { type: 'lowpass', f: 600, f2: 2600, dt: 0.06, Q: 1.2 },
  };
  tone(ac, out, { ...o, f, type: 'sawtooth', detune: -6 });
  return tone(ac, out, { ...o, f, type: 'sawtooth', detune: 7 });
};
const shaker = (ac, out, t, vol = 0.03) =>
  nz(ac, out, { t, filter: { type: 'highpass', f: 6500 }, a: 0.006, d: 0.035, vol });
const snap = (ac, out, t, vol = 0.05) =>
  nz(ac, out, { t, filter: { type: 'bandpass', f: 2100, Q: 1.6 }, a: 0.001, d: 0.03, vol });
const timpani = (ac, out, t, vol = 0.6, f = 98) => {
  tone(ac, out, { t, f, f2: f * 0.58, glide: 0.5, a: 0.004, d: 0.9, vol });
  tone(ac, out, { t, f: f * 1.5, f2: f * 0.9, glide: 0.4, a: 0.004, d: 0.4, vol: vol * 0.3 });
  nz(ac, out, { t, filter: { type: 'lowpass', f: 320 }, a: 0.002, d: 0.2, vol: vol * 0.45 });
  return t + 1;
};

// ---- animal calls
const crow = (ac, out, t, vol = 0.55, k = 1) => formantVoice(ac, out, t, [
  { t: 0, dur: 0.10, f0: 560 * k, f1: 760 * k },
  { t: 0.13, dur: 0.08, f0: 700 * k, f1: 640 * k },
  { t: 0.25, dur: 0.15, f0: 820 * k, f1: 930 * k },
  { t: 0.44, dur: 0.11, f0: 880 * k, f1: 780 * k },
  { t: 0.59, dur: 0.68, f0: 960 * k, pts: [[0.08, 1040 * k], [0.42, 1000 * k], [0.68, 640 * k]], tail: 0.6 },
], {
  vol, det: 12, formants: [[1150, 4, 1], [2500, 6, 0.55], [3600, 8, 0.25]], dry: 0.15,
  rasp: { rate: 38, depth: 0.22 }, vib: { rate: 7, depth: 45, at: 0.75 }, noise: { f: 2800, Q: 1.5, vol: 0.07 },
});

const honk = (ac, out, t, vol = 0.6, k = 1) => formantVoice(ac, out, t, [
  { t: 0, dur: 0.24, f0: 290 * k, pts: [[0.06, 370 * k], [0.24, 330 * k]] },
  { t: 0.31, dur: 0.28, f0: 310 * k, pts: [[0.06, 405 * k], [0.28, 345 * k]] },
], {
  vol, det: 18, formants: [[950, 3, 1], [2100, 5, 0.6], [3200, 7, 0.3]], dry: 0.25, lp: 2500,
  rasp: { rate: 55, depth: 0.3 }, noise: { f: 1600, Q: 1, vol: 0.12 }, att: 0.015, rel: 0.04,
});

const cluck = (ac, out, t, vol = 0.5) => formantVoice(ac, out, t, [
  { t: 0, dur: 0.05, f0: 470, f1: 400, v: 0.55 },
  { t: 0.08, dur: 0.22, f0: 620, pts: [[0.05, 980], [0.22, 700]] },
], { vol, det: 9, formants: [[1300, 4, 1], [2800, 6, 0.5]], dry: 0.2, rasp: { rate: 45, depth: 0.25 } });

// ---------------------------------------------------------------- the sound table
// Each entry: (ac, out, t) => end time (absolute, seconds).
const SOUNDS = {
  // ---------- UI
  click: (ac, o, t) => {
    tone(ac, o, { t, f: 1100, f2: 900, glide: 0.03, type: 'triangle', a: 0.002, d: 0.04, vol: 0.32 });
    nz(ac, o, { t, filter: { type: 'highpass', f: 4000 }, a: 0.001, d: 0.012, vol: 0.12 });
    return t + 0.06;
  },
  hover: (ac, o, t) => tone(ac, o, { t, f: 2400, a: 0.002, d: 0.015, vol: 0.05 }),
  open: (ac, o, t) => {
    nz(ac, o, { t, filter: { type: 'bandpass', f: 400, f2: 3200, dt: 0.22, Q: 1.5 }, a: 0.09, hold: 0.18, r: 0.08, vol: 0.4 });
    tone(ac, o, { t, f: 300, f2: 720, glide: 0.2, a: 0.03, d: 0.2, vol: 0.12 });
    return t + 0.3;
  },
  close: (ac, o, t) => {
    nz(ac, o, { t, filter: { type: 'bandpass', f: 3200, f2: 400, dt: 0.22, Q: 1.5 }, a: 0.05, hold: 0.18, r: 0.08, vol: 0.4 });
    tone(ac, o, { t, f: 720, f2: 300, glide: 0.2, a: 0.02, d: 0.2, vol: 0.12 });
    return t + 0.3;
  },
  error: (ac, o, t) => {
    for (const [dt, f] of [[0, 196], [0.15, 165]]) {
      tone(ac, o, { t: t + dt, f, f2: f * 0.92, glide: 0.1, type: 'square', a: 0.004, hold: 0.09, r: 0.04, vol: 0.2, filter: { type: 'lowpass', f: 1100 } });
      tone(ac, o, { t: t + dt, f: f / 2, type: 'sawtooth', a: 0.004, hold: 0.09, r: 0.04, vol: 0.14, filter: { type: 'lowpass', f: 700 } });
    }
    return t + 0.32;
  },
  join: (ac, o, t) => { cluck(ac, o, t, 0.55); return plink(ac, o, t + 0.33, 2200, 0.2); },
  leave: (ac, o, t) => {
    tone(ac, o, { t, f: 620, f2: 190, glide: 0.26, a: 0.01, d: 0.28, vol: 0.38 });
    tone(ac, o, { t, f: 310, f2: 95, glide: 0.26, type: 'triangle', a: 0.01, d: 0.28, vol: 0.14 });
    return t + 0.32;
  },
  copy: (ac, o, t) => { bell(ac, o, t, 1568, 0.3, 0.5); return bell(ac, o, t + 0.07, 2093, 0.24, 0.55); },
  start: (ac, o, t) => {
    nz(ac, o, { t, filter: { type: 'bandpass', f: 300, f2: 5000, dt: 0.55, Q: 2 }, a: 0.5, hold: 0.55, r: 0.05, vol: 0.3 });
    tone(ac, o, { t, f: 110, f2: 440, glide: 0.55, type: 'sawtooth', a: 0.45, hold: 0.55, r: 0.05, vol: 0.1, filter: { type: 'lowpass', f: 400, f2: 3000, dt: 0.55 } });
    const c = t + 0.58;
    for (const [i, f] of [261.6, 329.6, 392, 523.3].entries()) brass(ac, o, c, f, 0.45, 0.075, (i - 1.5) * 0.3);
    bell(ac, o, c, 1046.5, 0.2, 0.8);
    thud(ac, o, c, 0.4, 90);
    return c + 0.7;
  },

  // ---------- cards
  deal: (ac, o, t) => {
    const n = 6;
    for (let i = 0; i < n; i++) fwip(ac, o, t + i * 0.075 + rnd(0, 0.012), 0.45, i % 2 ? 0.35 : -0.35);
    return t + n * 0.075 + 0.12;
  },
  flip: (ac, o, t) => {
    fwip(ac, o, t, 0.55);
    tick(ac, o, t + 0.045, 0.14, 2600);
    return t + 0.15;
  },
  swap: (ac, o, t) => {
    let tt = t, gap = 0.045;
    for (let i = 0; i < 16; i++) {
      nz(ac, o, { t: tt, filter: { type: 'bandpass', f: rnd(2200, 3200), Q: 2 }, a: 0.001, d: 0.018, vol: 0.32, pan: rnd(-0.4, 0.4) });
      tt += gap; gap = Math.max(0.018, gap * 0.92);
    }
    fwip(ac, o, tt + 0.03, 0.55);
    return tt + 0.15;
  },
  reveal: (ac, o, t) => {
    for (const [i, f] of [1760, 2217, 2637, 3136, 3520].entries())
      tone(ac, o, { t: t + i * 0.04, f, a: 0.25, hold: 0.36, r: 0.2, vol: 0.045, vib: { rate: 9, depth: 35 }, pan: (i - 2) * 0.25 });
    nz(ac, o, { t, filter: { type: 'highpass', f: 6000 }, a: 0.3, hold: 0.35, r: 0.15, vol: 0.06 });
    fwip(ac, o, t + 0.46, 0.6);
    for (const f of [523.3, 659.3, 784]) bell(ac, o, t + 0.47, f, 0.12, 0.7);
    return t + 1.2;
  },

  // ---------- corn
  corn: (ac, o, t) => plink(ac, o, t, rnd(1900, 2600), 0.45, rnd(-0.2, 0.2)),
  cornMany: (ac, o, t) => {
    const n = 3 + Math.floor(Math.random() * 4);
    let tt = t;
    for (let i = 0; i < n; i++) { plink(ac, o, tt, 1800 + i * 120 + rnd(0, 300), 0.38, rnd(-0.5, 0.5)); tt += rnd(0.06, 0.09); }
    return tt + 0.15;
  },
  spend: (ac, o, t) => {
    [2400, 2100, 1800, 1500].forEach((f, i) => plink(ac, o, t + i * 0.065, f, 0.34, (i - 1.5) * 0.2));
    const s = t + 0.32;
    thud(ac, o, s, 0.7, 90, 0.18);
    nz(ac, o, { t: s, filter: { type: 'lowpass', f: 900 }, a: 0.004, d: 0.12, vol: 0.28 });
    return s + 0.25;
  },

  // ---------- characters
  rooster: (ac, o, t) => crow(ac, o, t, 0.55),
  fox: (ac, o, t) => {
    // two sly yips
    for (const [dt, k] of [[0, 1], [0.17, 1.08]]) {
      tone(ac, o, { t: t + dt, f: 900 * k, path: [[0.04, 1650 * k], [0.12, 1100 * k]], type: 'sawtooth', a: 0.008, hold: 0.1, r: 0.03, vol: 0.32, filter: { type: 'bandpass', f: 1700, Q: 1.6 } });
      tone(ac, o, { t: t + dt, f: 900 * k, path: [[0.04, 1650 * k], [0.12, 1100 * k]], a: 0.008, hold: 0.1, r: 0.03, vol: 0.18 });
    }
    // sneaky slide
    tone(ac, o, { t: t + 0.4, f: 560, f2: 250, glide: 0.5, lin: true, type: 'triangle', a: 0.04, hold: 0.48, r: 0.08, vol: 0.28, vib: { rate: 6, depth: 35 }, filter: { type: 'lowpass', f: 1600 } });
    pizz(ac, o, t + 0.42, 196, 0.16); pizz(ac, o, t + 0.62, 185, 0.16);
    return t + 1.0;
  },
  raccoon: (ac, o, t) => {
    let tt = t;
    for (const burst of [5, 4, 5]) {
      nz(ac, o, { t: tt, filter: { type: 'bandpass', f: 1800, Q: 1 }, a: 0.005, d: 0.05, vol: 0.12 });
      for (let i = 0; i < burst; i++) {
        const f = rnd(2000, 3300);
        tone(ac, o, { t: tt, f, f2: f * 1.28, glide: 0.035, type: 'triangle', a: 0.003, d: 0.045, vol: 0.3, pan: rnd(-0.3, 0.3) });
        tone(ac, o, { t: tt, f: f / 2, f2: f * 0.62, glide: 0.035, type: 'square', a: 0.003, d: 0.03, vol: 0.05, filter: { type: 'bandpass', f: 2500, Q: 2 } });
        tt += rnd(0.045, 0.065);
      }
      tt += 0.11;
    }
    return tt;
  },
  owl: (ac, o, t) => {
    const hoo = (dt, f0, f1, dur, v) => {
      tone(ac, o, { t: t + dt, f: f0, f2: f1, glide: dur, a: 0.07, hold: dur, r: 0.14, vol: v, vib: { rate: 5, depth: 14, delay: 0.05 } });
      tone(ac, o, { t: t + dt, f: f0 * 2, f2: f1 * 2, glide: dur, type: 'triangle', a: 0.08, hold: dur, r: 0.12, vol: v * 0.12 });
      nz(ac, o, { t: t + dt, filter: { type: 'bandpass', f: f0 * 1.5, Q: 2.5 }, a: 0.05, hold: dur * 0.8, r: 0.12, vol: v * 0.35 });
    };
    hoo(0, 392, 372, 0.26, 0.42);
    hoo(0.38, 415, 392, 0.3, 0.42);
    hoo(1.0, 392, 330, 0.58, 0.46);
    return t + 1.75;
  },
  goose: (ac, o, t) => honk(ac, o, t, 0.62),

  // ---------- actions
  peck: (ac, o, t) => {
    for (const dt of [0, 0.09]) {
      tone(ac, o, { t: t + dt, f: 1300, f2: 600, glide: 0.02, a: 0.001, d: 0.025, vol: 0.35 });
      nz(ac, o, { t: t + dt, filter: { type: 'highpass', f: 2500 }, a: 0.001, d: 0.012, vol: 0.3 });
    }
    return plink(ac, o, t + 0.2, 2300, 0.42);
  },
  forage: (ac, o, t) => {
    for (let i = 0; i < 8; i++)
      nz(ac, o, { t: t + rnd(0, 0.32), filter: { type: 'bandpass', f: rnd(2800, 6000), Q: 1 }, a: 0.006, d: rnd(0.04, 0.08), vol: rnd(0.18, 0.32), pan: rnd(-0.5, 0.5) });
    plink(ac, o, t + 0.32, 2000, 0.4); plink(ac, o, t + 0.44, 2450, 0.4);
    return t + 0.62;
  },
  tribute: (ac, o, t) => {
    brass(ac, o, t, 392, 0.08, 0.13); brass(ac, o, t + 0.12, 523.3, 0.08, 0.13); brass(ac, o, t + 0.24, 659.3, 0.08, 0.13);
    brass(ac, o, t + 0.36, 784, 0.4, 0.14);
    brass(ac, o, t + 0.36, 523.3, 0.4, 0.08, -0.3); brass(ac, o, t + 0.36, 329.6, 0.4, 0.07, 0.3);
    [2000, 2300, 2650].forEach((f, i) => plink(ac, o, t + 0.72 + i * 0.08, f, 0.36, (i - 1) * 0.4));
    return t + 1.05;
  },
  raid: (ac, o, t) => {
    nz(ac, o, { t, filter: { type: 'bandpass', f: 400, f2: 4200, dt: 0.2, Q: 1.5 }, a: 0.12, hold: 0.16, r: 0.06, vol: 0.5, pan: -0.3 });
    for (const [i, dt] of [0.24, 0.31, 0.38].entries()) {
      nz(ac, o, { t: t + dt, filter: { type: 'bandpass', f: 5200, f2: 1400, dt: 0.07, Q: 3 }, a: 0.003, d: 0.08, vol: 0.62, pan: (i - 1) * 0.4 });
      tone(ac, o, { t: t + dt, f: 3200, f2: 1100, glide: 0.06, type: 'sawtooth', a: 0.002, d: 0.06, vol: 0.05 });
    }
    thud(ac, o, t + 0.26, 0.42, 130, 0.15);
    return t + 0.55;
  },
  pilfer: (ac, o, t) => {
    [293.7, 349.2, 370, 392].forEach((f, i) => pizz(ac, o, t + i * 0.13, f, 0.32, 0.12, i % 2 ? 0.3 : -0.3));
    nz(ac, o, { t: t + 0.58, filter: { type: 'bandpass', f: 800, f2: 5000, dt: 0.12, Q: 1.4 }, a: 0.02, d: 0.13, vol: 0.45 });
    plink(ac, o, t + 0.72, 2200, 0.36); plink(ac, o, t + 0.8, 2600, 0.36);
    return t + 1.0;
  },
  foresight: (ac, o, t) => {
    [1046.5, 1174.7, 1318.5, 1568, 1760, 2093, 2637].forEach((f, i) => bell(ac, o, t + i * 0.06, f, 0.13, 0.45, i % 2 ? 0.4 : -0.4));
    for (const f of [220, 261.6, 329.6, 493.9])
      tone(ac, o, { t, f, type: 'sawtooth', a: 0.45, hold: 0.9, r: 0.4, vol: 0.045, detune: rnd(-8, 8), vib: { rate: 0.6, depth: 12 }, filter: { type: 'lowpass', f: 900, Q: 0.7 } });
    nz(ac, o, { t: t + 0.1, filter: { type: 'highpass', f: 7000 }, a: 0.4, hold: 0.7, r: 0.3, vol: 0.05 });
    return t + 1.65;
  },
  barnstorm: (ac, o, t) => {
    nz(ac, o, { t, filter: { type: 'lowpass', f: 160, f2: 360, dt: 1.1, Q: 0.7 }, a: 0.7, hold: 1.3, r: 0.4, vol: 1.0 });
    nz(ac, o, { t, filter: { type: 'bandpass', f: 500, f2: 1800, dt: 1.2, Q: 0.8 }, a: 0.9, hold: 1.15, r: 0.15, vol: 0.12 });
    // galloping hooves: groups of three
    for (let g = 0; g < 4; g++) {
      const base = t + 0.1 + g * 0.28;
      [0, 0.06, 0.12].forEach((dt, i) => thud(ac, o, base + dt, 0.3 + g * 0.06 + (i === 2 ? 0.05 : 0), rnd(70, 95), 0.12));
    }
    const c = t + 1.25; // thunder crack
    nz(ac, o, { t: c, a: 0.002, d: 0.08, vol: 0.55 });
    nz(ac, o, { t: c, filter: { type: 'lowpass', f: 2600, f2: 200, dt: 0.9 }, a: 0.01, d: 1.1, vol: 0.65 });
    tone(ac, o, { t: c, f: 55, f2: 34, glide: 0.9, a: 0.005, d: 1.0, vol: 0.45 });
    return c + 1.15;
  },
  hit: (ac, o, t) => {
    thud(ac, o, t, 0.85, 150, 0.25);
    nz(ac, o, { t, filter: { type: 'bandpass', f: 1800, Q: 0.8 }, a: 0.001, d: 0.08, vol: 0.45 });
    for (let i = 0; i < 4; i++) nz(ac, o, { t: t + 0.02 + i * 0.025, filter: { type: 'bandpass', f: rnd(1500, 3500), Q: 2 }, a: 0.001, d: 0.02, vol: 0.2 });
    return t + 0.35;
  },

  // ---------- drama
  challenge: (ac, o, t) => {
    const stab = [146.8, 174.6, 220, 293.7], fin = [138.6, 164.8, 196, 277.2];
    for (const f of stab) { brass(ac, o, t, f, 0.12, 0.085); brass(ac, o, t + 0.2, f, 0.12, 0.085); }
    for (const f of fin) brass(ac, o, t + 0.42, f, 0.5, 0.095);
    tone(ac, o, { t: t + 0.42, f: 69.3, type: 'sawtooth', a: 0.02, hold: 0.5, r: 0.12, vol: 0.12, filter: { type: 'lowpass', f: 300 } });
    thud(ac, o, t, 0.3, 90, 0.12); thud(ac, o, t + 0.2, 0.3, 90, 0.12);
    timpani(ac, o, t + 0.42, 0.65, 98);
    return t + 1.15;
  },
  truth: (ac, o, t) => {
    [523.3, 659.3, 784, 1046.5].forEach((f, i) => {
      tone(ac, o, { t: t + i * 0.03, f, type: 'triangle', a: 0.005, d: 0.9, vol: 0.15, pan: (i - 1.5) * 0.25 });
      bell(ac, o, t + i * 0.03, f * 2, 0.05, 0.6);
    });
    brass(ac, o, t, 261.6, 0.35, 0.07);
    bell(ac, o, t + 0.16, 2093, 0.12, 0.7);
    return t + 1.1;
  },
  bluff: (ac, o, t) => {
    const notes = [[0, 196, 0.26], [0.32, 185, 0.26], [0.64, 174.6, 0.26], [0.96, 164.8, 0.9]];
    for (const [dt, f, dur] of notes) {
      const last = dur > 0.5;
      const opts = {
        t: t + dt, f, type: 'sawtooth', a: 0.04, hold: dur, r: 0.12, vol: 0.2,
        filter: { type: 'lowpass', f: 350, f2: 1500, dt: 0.1, Q: 4 },
        vib: last ? { rate: 5, depth: 45, delay: 0.15 } : undefined,
      };
      if (last) opts.f2 = f * 0.97, opts.glide = dur;
      tone(ac, o, opts);
      tone(ac, o, { ...opts, detune: 8, vol: 0.1 });
    }
    return t + 2.0;
  },
  block: (ac, o, t) => {
    nz(ac, o, { t, filter: { type: 'highpass', f: 3000 }, a: 0.001, d: 0.05, vol: 0.5 });
    [[520, 1.0, 0.24], [1312, 0.7, 0.16], [2093 * 1.41, 0.5, 0.1], [2960, 0.35, 0.08], [3720, 0.25, 0.06], [780, 0.6, 0.1]]
      .forEach(([f, d, v]) => tone(ac, o, { t, f, a: 0.001, d, vol: v, vib: { rate: 7, depth: 6 } }));
    thud(ac, o, t, 0.4, 140, 0.15);
    return t + 1.1;
  },
  stamp: (ac, o, t) => {
    tick(ac, o, t, 0.12, 2000);
    tone(ac, o, { t, f: 260, f2: 120, glide: 0.06, type: 'triangle', a: 0.002, d: 0.08, vol: 0.35 });
    nz(ac, o, { t, filter: { type: 'bandpass', f: 900, Q: 1 }, a: 0.001, d: 0.045, vol: 0.35 });
    thud(ac, o, t + 0.01, 0.8, 120, 0.14);
    nz(ac, o, { t: t + 0.01, filter: { type: 'lowpass', f: 500 }, a: 0.002, d: 0.05, vol: 0.5 });
    return t + 0.25;
  },
  lose: (ac, o, t) => {
    for (let i = 0; i < 5; i++) nz(ac, o, { t: t + i * 0.025, filter: { type: 'bandpass', f: rnd(1500, 3000), Q: 1.5 }, a: 0.001, d: 0.03, vol: 0.38 });
    tone(ac, o, { t, f: 120, f2: 60, glide: 0.1, type: 'square', a: 0.002, d: 0.1, vol: 0.1, filter: { type: 'lowpass', f: 900 } });
    nz(ac, o, { t: t + 0.15, filter: { type: 'lowpass', f: 2600, f2: 380, dt: 0.35 }, a: 0.06, d: 0.42, vol: 0.4 });
    return t + 0.65;
  },
  eliminated: (ac, o, t) => {
    tone(ac, o, { t, f: 1600, f2: 280, glide: 0.75, a: 0.02, hold: 0.75, r: 0.05, vol: 0.32, vib: { rate: 8, depth: 40 } });
    tone(ac, o, { t, f: 3200, f2: 560, glide: 0.75, type: 'triangle', a: 0.02, hold: 0.75, r: 0.05, vol: 0.04 });
    thud(ac, o, t + 0.8, 0.9, 90, 0.22);
    nz(ac, o, { t: t + 0.8, filter: { type: 'lowpass', f: 600 }, a: 0.002, d: 0.15, vol: 0.4 });
    return t + 1.1;
  },
  turn: (ac, o, t) => { bell(ac, o, t, 784, 0.32, 0.6, -0.15); return bell(ac, o, t + 0.14, 1046.5, 0.32, 0.9, 0.15); },
  tick: (ac, o, t) => tick(ac, o, t, 0.35),
  timeout: (ac, o, t) => {
    for (const f of [147, 151]) tone(ac, o, { t, f, type: 'square', a: 0.01, hold: 0.38, r: 0.05, vol: 0.16, filter: { type: 'lowpass', f: 1400 } });
    return t + 0.45;
  },
  win: (ac, o, t) => {
    [261.6, 329.6, 392].forEach((f, i) => brass(ac, o, t + i * 0.12, f, 0.1, 0.12));
    brass(ac, o, t + 0.36, 523.3, 0.28, 0.13);
    brass(ac, o, t + 0.7, 392, 0.1, 0.12);
    const c = t + 0.84;
    for (const [i, f] of [523.3, 392, 329.6, 261.6].entries()) brass(ac, o, c, f, 0.8, i === 0 ? 0.13 : 0.07, (i - 1.5) * 0.3);
    timpani(ac, o, c, 0.5, 98);
    nz(ac, o, { t: c, filter: { type: 'highpass', f: 5000 }, a: 0.005, d: 1.0, vol: 0.18 });
    formantVoice(ac, o, t + 1.6, [
      { t: 0, dur: 0.09, f0: 700, f1: 900 },
      { t: 0.12, dur: 0.09, f0: 860, f1: 800 },
      { t: 0.24, dur: 0.45, f0: 1100, pts: [[0.06, 1180], [0.3, 1120], [0.45, 760]], tail: 0.6 },
    ], { vol: 0.38, det: 12, formants: [[1150, 4, 1], [2500, 6, 0.55]], dry: 0.15, rasp: { rate: 38, depth: 0.2 }, vib: { rate: 7, depth: 40, at: 0.4 } });
    return t + 2.4;
  },
  defeat: (ac, o, t) => {
    [[0, 659.3, 0.3], [0.35, 587.3, 0.3], [0.7, 523.3, 0.3], [1.05, 440, 0.85]].forEach(([dt, f, h]) =>
      tone(ac, o, { t: t + dt, f, type: 'triangle', a: 0.02, hold: h, r: 0.2, vol: 0.2, vib: h > 0.5 ? { rate: 5, depth: 15, delay: 0.2 } : undefined }));
    for (const f of [220, 261.6, 329.6]) tone(ac, o, { t, f, a: 0.4, hold: 1.6, r: 0.5, vol: 0.05 });
    return t + 2.3;
  },
};

export const SOUND_NAMES = Object.keys(SOUNDS);

// ---------------------------------------------------------------- music
// Chord tables: root = bass MIDI note, tones = mid-register voicing (4 notes, low → high).
const CH = {
  G: { root: 43, tones: [55, 59, 62, 67] }, C: { root: 48, tones: [55, 60, 64, 67] },
  D: { root: 50, tones: [54, 57, 62, 66] }, Em: { root: 40, tones: [55, 59, 64, 67] },
  Am: { root: 45, tones: [57, 60, 64, 69] }, F: { root: 41, tones: [57, 60, 65, 69] },
  E: { root: 40, tones: [56, 59, 64, 68] }, Dm: { root: 50, tones: [57, 62, 65, 69] },
  Cv: { root: 48, tones: [60, 64, 67, 72] }, Amv: { root: 45, tones: [60, 64, 69, 72] },
  Fv: { root: 41, tones: [60, 65, 69, 72] }, Gv: { root: 43, tones: [59, 62, 67, 71] },
};
const ROLL = [0, 2, 3, 1, 2, 3, 0, 3];                // banjo forward roll (indices into tones)
const G_PENTA = [67, 69, 71, 74, 76, 79, 81];
const A_MIN_PENTA = [69, 72, 74, 76, 79, 81];

function genMenu(ac, out, t, step, bar, data, sd) {
  const PROG = ['G', 'C', 'G', 'D', 'G', 'C', 'D', 'G'];
  const ch = CH[PROG[bar % 8]], next = CH[PROG[(bar + 1) % 8]];
  if (step === 0) data.lick = bar % 8 !== 7 && Math.random() < 0.22, data.li = 2 + Math.floor(Math.random() * 3);
  if (step % 2 === 0) {
    const i = step / 2;
    let m;
    if (data.lick) { data.li = Math.max(0, Math.min(G_PENTA.length - 1, data.li + (Math.random() < 0.5 ? -1 : 1))); m = G_PENTA[data.li]; }
    else m = ch.tones[ROLL[i]];
    pluck(ac, out, t, mtof(m), i % 4 === 0 ? 0.085 : 0.06, 0.3, 7, i % 2 ? 0.25 : -0.15);
  }
  if (step === 0) bassNote(ac, out, t, mtof(ch.root), 0.16, 0.4);
  if (step === 8) bassNote(ac, out, t, mtof(ch.root + 7 > 52 ? ch.root - 5 : ch.root + 7), 0.14, 0.4);
  if (step === 12 && Math.random() < 0.45) bassNote(ac, out, t, mtof(next.root + (Math.random() < 0.5 ? -1 : 2)), 0.1, 0.25);
  if (step === 4 || step === 12)                       // muted "chick" strum on 2 and 4
    ch.tones.slice(0, 3).forEach((m, k) => tone(ac, out, { t: t + k * 0.012, f: mtof(m), type: 'square', a: 0.002, d: 0.06, vol: 0.02, filter: { type: 'bandpass', f: 1800, Q: 1 } }));
  if (step % 4 === 2) shaker(ac, out, t, 0.022);
  if (step === 14 && bar % 2 === 1) tick(ac, out, t, 0.04, 1200);
}

function genGame(ac, out, t, step, bar, data, sd) {
  const PROG = ['Am', 'Am', 'F', 'E', 'Am', 'Dm', 'F', 'E'];
  const ch = CH[PROG[bar % 8]];
  const r = ch.root;
  const BASS = { 0: r, 4: r + 7, 8: r + 12, 12: r + 7 };          // tip-toe pizzicato walk
  if (BASS[step] != null) pizz(ac, out, t, mtof(BASS[step]), step === 0 ? 0.28 : 0.2, 0.14);
  if (step % 4 === 2 && Math.random() < 0.28) pizz(ac, out, t, mtof(A_MIN_PENTA[Math.floor(Math.random() * A_MIN_PENTA.length)]), 0.09, 0.12, rnd(-0.4, 0.4));
  if (bar % 4 === 3 && step >= 12) pizz(ac, out, t, mtof([76, 75, 74, 73][step - 12]), 0.08, 0.1, 0.3);  // sneaky chromatic slink
  if (step === 4 || step === 12) snap(ac, out, t, 0.08);
  if (step === 0 && bar % 2 === 0) tone(ac, out, { t, f: mtof(ch.tones[0]), a: 0.5, hold: sd * 24, r: 0.6, vol: 0.04, type: 'triangle' });
}

function genTense(ac, out, t, step, bar, data, sd) {
  const PROG = [33, 33, 34, 33];                      // A, A, Bb, A (bass MIDI)
  const r = PROG[bar % 4];
  if (step % 2 === 0)
    tone(ac, out, { t, f: mtof(r + 12), type: 'sawtooth', a: 0.004, d: 0.13, vol: step % 8 === 0 ? 0.13 : 0.08, filter: { type: 'lowpass', f: 750, Q: 2 } });
  const OST = [12, 19, 15, 19, 12, 19, 16, 19];         // root, 5th, b3, 5th … (an octave above the pulse)
  if (step % 2 === 0) pizz(ac, out, t, mtof(r + 24 + OST[step / 2] - 12), step % 8 === 0 ? 0.1 : 0.07, 0.1, (step / 2 % 2) ? 0.25 : -0.25);
  if (step % 4 === 0) tick(ac, out, t, 0.06, 2400);
  if (step === 0) {
    tone(ac, out, { t, f: mtof(r), a: 0.6, hold: sd * 13, r: 0.4, vol: 0.08 });
    tone(ac, out, { t, f: mtof(r + 7), type: 'sawtooth', a: 0.6, hold: sd * 13, r: 0.4, vol: 0.03, filter: { type: 'lowpass', f: 500 } });
  }
  if (step === 8 && bar % 2 === 1) tone(ac, out, { t, f: mtof(r + 36), a: 0.3, hold: sd * 6, r: 0.3, vol: 0.02, vib: { rate: 7, depth: 25 } });
}

function genVictory(ac, out, t, step, bar, data, sd) {
  if (bar === 0 && step === 0) {
    [261.6, 329.6, 392].forEach((f, i) => brass(ac, out, t + i * 0.11, f, 0.09, 0.06));
    brass(ac, out, t + 0.33, 523.3, 0.7, 0.07);
    for (const f of [261.6, 329.6, 392]) brass(ac, out, t + 0.33, f, 0.7, 0.035);
    timpani(ac, out, t + 0.33, 0.16, 98);
    return;
  }
  if (bar < 2) { if (bar === 1 && step === 8) bell(ac, out, t, 1046.5, 0.05, 1.2); return; }
  const PROG = ['Cv', 'Amv', 'Fv', 'Gv'];
  const ch = CH[PROG[(bar - 2) % 4]];
  if (step % 2 === 0) {
    const UPDOWN = [0, 1, 2, 3, 2, 1, 2, 3];
    pluck(ac, out, t, mtof(ch.tones[UPDOWN[step / 2]]), 0.05, 0.45, 4, (step / 2 % 2) ? 0.2 : -0.2);
  }
  if (step === 0) bassNote(ac, out, t, mtof(ch.root), 0.12, 0.6);
  if (step === 8) bassNote(ac, out, t, mtof(ch.root + 7), 0.08, 0.4);
  if (step === 0 && bar % 2 === 0) bell(ac, out, t, mtof(ch.tones[3] + 12), 0.035, 1.0);
}

const MOODS = {
  menu: { bpm: 112, level: 1.0, gen: genMenu },
  game: { bpm: 96, level: 1.0, gen: genGame },
  tense: { bpm: 120, level: 0.85, gen: genTense },
  victory: { bpm: 100, level: 0.95, gen: genVictory },
};

const mus = { want: 'off', mood: null, timer: null, next: 0, step: 0, bar: 0, data: {} };
const LOOKAHEAD = 0.12;

function musicShouldPlay() {
  return !!ctx && prefs.music && mus.want !== 'off' && MOODS[mus.want] && ctx.state === 'running'
    && !(typeof document !== 'undefined' && document.hidden);
}

function switchMood(t) {
  mus.mood = mus.want; mus.step = 0; mus.bar = 0; mus.data = {};
  moodOut.gain.cancelScheduledValues(t);
  moodOut.gain.setTargetAtTime(MOODS[mus.mood].level, t, 0.12);
}

function musicTick() {
  if (!ctx || !mus.timer) return;
  const ct = ctx.currentTime;
  if (mus.next < ct - 0.05) {                          // fell behind (tab throttled): skip ahead, don't burst
    const M = MOODS[mus.mood]; const sd = 60 / M.bpm / 4;
    while (mus.next < ct) { mus.next += sd; mus.step++; if (mus.step % 16 === 0) mus.bar++; }
  }
  while (mus.next < ct + LOOKAHEAD) {
    if (mus.want !== mus.mood && MOODS[mus.want] && mus.step % 4 === 0) switchMood(mus.next);
    const M = MOODS[mus.mood];
    const sd = 60 / M.bpm / 4;
    try { M.gen(ctx, moodOut, mus.next, mus.step % 16, mus.bar, mus.data, sd); } catch (e) { /* never break the loop */ }
    mus.next += sd; mus.step++;
    if (mus.step % 16 === 0) mus.bar++;
  }
}

function refreshMusic() {
  if (!ctx || !musicBus) return;
  const t = ctx.currentTime;
  if (musicShouldPlay()) {
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setTargetAtTime(MUSIC_LEVEL, t, 0.25);
    if (!mus.timer) {
      mus.mood = mus.want; mus.step = 0; mus.bar = 0; mus.data = {};
      mus.next = t + 0.08;
      moodOut.gain.cancelScheduledValues(t);
      moodOut.gain.setValueAtTime(MOODS[mus.mood].level, t);
      mus.timer = setInterval(musicTick, 25);
      musicTick();
    }
  } else if (mus.timer) {
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setTargetAtTime(0, t, 0.12);
    clearInterval(mus.timer); mus.timer = null; mus.mood = null;
  }
}

// ---------------------------------------------------------------- public API
function ensureContext() {
  if (ctx || !AC) return ctx;
  try {
    ctx = new AC({ latencyHint: 'interactive' });
  } catch { try { ctx = new AC(); } catch { ctx = null; return null; } }
  const master = buildChain(ctx);
  sfxBus = ctx.createGain(); sfxBus.gain.value = SFX_LEVEL; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
  moodOut = ctx.createGain(); moodOut.gain.value = 1; moodOut.connect(musicBus);
  ctx.onstatechange = refreshMusic;
  return ctx;
}

function unlock() {
  const ac = ensureContext();
  if (!ac) return;
  if (ac.state !== 'running') {
    lastResume = now();
    try {
      // iOS needs a buffer played inside the gesture
      const b = ac.createBuffer(1, 1, 22050), s = ac.createBufferSource();
      s.buffer = b; s.connect(ac.destination); s.start(0);
    } catch { /* ignore */ }
    try { const p = ac.resume(); if (p && p.then) p.then(refreshMusic, () => {}); } catch { /* ignore */ }
  }
  refreshMusic();
}

function play(name, opts = {}) {
  if (!prefs.sfx || !ctx) return;
  const fn = SOUNDS[name];
  if (!fn) return;
  // Suspended and no resume in flight → skip (otherwise sounds pile up and burst on resume).
  if (ctx.state !== 'running' && now() - lastResume > 1500) return;
  if (name === 'hover') { const n = now(); if (n - lastHover < 40) return; lastHover = n; }
  try {
    const delay = Math.max(0, +opts.delay || 0);
    const out = ctx.createGain();
    out.gain.value = Math.max(0, Math.min(1, opts.volume ?? 1)) * (LEVELS[name] ?? 1);
    out.connect(sfxBus);
    const t = ctx.currentTime + 0.005 + delay;
    const end = fn(ctx, out, t) || t + 1;
    setTimeout(() => { try { out.disconnect(); } catch { /* already gone */ } }, (end - ctx.currentTime + 0.5) * 1000);
  } catch { /* never throw from audio */ }
}

const audio = {
  unlock,
  play,
  get sfxOn() { return prefs.sfx; },
  get musicOn() { return prefs.music; },
  get mood() { return mus.want; },
  get context() { return ctx; },
  get _musicActive() { return !!mus.timer; },
  setSfx(on) { prefs.sfx = !!on; savePref('po_sfx', prefs.sfx); },
  setMusic(on) { prefs.music = !!on; savePref('po_music', prefs.music); refreshMusic(); },
  setMood(mood) {
    mus.want = MOODS[mood] ? mood : 'off';
    refreshMusic();
  },

  // ---- test hooks (offline rendering; used by dev/audio-preview.html analysis)
  _renderTo(ac, name, opts = {}) {
    const master = buildChain(ac);
    const bus = ac.createGain(); bus.gain.value = SFX_LEVEL; bus.connect(master);
    const out = ac.createGain(); out.gain.value = (opts.volume ?? 1) * (LEVELS[name] ?? 1); out.connect(bus);
    return SOUNDS[name](ac, out, 0.01 + (opts.delay || 0));
  },
  _renderMusic(ac, mood, seconds) {
    const M = MOODS[mood];
    if (!M) return 0;
    const master = buildChain(ac);
    const bus = ac.createGain(); bus.gain.value = MUSIC_LEVEL; bus.connect(master);
    const out = ac.createGain(); out.gain.value = M.level; out.connect(bus);
    const sd = 60 / M.bpm / 4, data = {};
    let t = 0.05, step = 0, bar = 0;
    while (t < seconds - 0.5) {
      M.gen(ac, out, t, step % 16, bar, data, sd);
      t += sd; step++; if (step % 16 === 0) bar++;
    }
    return seconds;
  },
  _levels: LEVELS,
};

// Auto-unlock on the first gesture. Kept installed (cheap no-op once running) so iOS/Safari
// contexts that get suspended/interrupted in the background resume on the next tap.
if (typeof document !== 'undefined') {
  const onGesture = () => { if (!ctx || ctx.state !== 'running') unlock(); };
  document.addEventListener('pointerdown', onGesture, true);
  document.addEventListener('keydown', onGesture, true);
  document.addEventListener('touchend', onGesture, true);
  document.addEventListener('visibilitychange', refreshMusic);
}

export default audio;
