// WebAudio synth sounds only, no audio files. One AudioContext, created
// on the first user gesture; mute silences everything. Classic mode uses
// plain square blips, pro mode richer zaps and noise.
let ctx = null;
let muted = false;

export function setMuted(m) {
  muted = m;
}

export function isMuted() {
  return muted;
}

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  } catch (e) {
    ctx = null;
  }
}

function tone(freq, dur, type, vol, slideTo) {
  if (!ctx || muted) return;
  try {
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  } catch (e) {
    // Audio is decoration; never break the game.
  }
}

function noise(dur, vol, lowpass) {
  if (!ctx || muted) return;
  try {
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    let node = src;
    if (lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      src.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(ctx.destination);
    src.start(t0);
  } catch (e) {
    // Audio is decoration; never break the game.
  }
}

export function sfxShoot(mode) {
  if (mode === 'pro') tone(720, 0.09, 'sawtooth', 0.12, 180);
  else tone(440, 0.07, 'square', 0.08, 220);
}

export function sfxEnemyShoot(mode) {
  if (mode === 'pro') tone(300, 0.08, 'sawtooth', 0.06, 120);
  else tone(220, 0.06, 'square', 0.05, 140);
}

export function sfxHit() {
  tone(140, 0.08, 'square', 0.1, 70);
}

export function sfxExplode(mode) {
  noise(0.35, 0.22, mode === 'pro' ? 2400 : 1200);
  tone(90, 0.3, 'sine', 0.16, 40);
}

export function sfxBigExplode() {
  noise(0.6, 0.3, 1600);
  tone(70, 0.5, 'sine', 0.2, 30);
}

export function sfxPowerup() {
  // Rising arpeggio.
  [523, 659, 784, 1047].forEach((f, i) => {
    setTimeout(() => tone(f, 0.12, 'square', 0.09), i * 70);
  });
}

export function sfxBaseAlarm() {
  // Two-tone siren, twice.
  tone(660, 0.16, 'square', 0.12);
  setTimeout(() => tone(440, 0.16, 'square', 0.12), 180);
  setTimeout(() => tone(660, 0.16, 'square', 0.12), 360);
  setTimeout(() => tone(440, 0.2, 'square', 0.12), 540);
}

export function sfxLevelClear() {
  [523, 659, 784, 1047, 1319].forEach((f, i) => {
    setTimeout(() => tone(f, 0.14, 'square', 0.09), i * 90);
  });
}

export function sfxGameOver() {
  [392, 330, 262, 196].forEach((f, i) => {
    setTimeout(() => tone(f, 0.22, 'triangle', 0.12), i * 160);
  });
}

export function sfxBossWarn() {
  tone(110, 0.5, 'sawtooth', 0.14, 55);
  setTimeout(() => tone(110, 0.5, 'sawtooth', 0.14, 55), 520);
}
