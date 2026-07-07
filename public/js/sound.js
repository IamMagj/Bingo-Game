// Sonidos generados con Web Audio API. No requieren archivos .mp3 externos.
// El usuario puede activarlos/desactivarlos; por defecto están activos tras la primera interacción.

let ctx = null;
let enabled = true;

function getCtx() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioCtx();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, duration, type = 'sine', gainValue = 0.15, delay = 0) {
  if (!enabled) return;
  try {
    const audio = getCtx();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = gainValue;
    osc.connect(gain).connect(audio.destination);
    const start = audio.currentTime + delay;
    gain.gain.setValueAtTime(gainValue, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  } catch (e) { /* silencioso si el navegador bloquea audio */ }
}

export function setSoundEnabled(value) { enabled = value; }
export function isSoundEnabled() { return enabled; }

export function playMixing() { tone(180, 0.25, 'sawtooth', 0.05); }
export function playDraw() {
  tone(660, 0.12, 'triangle', 0.12);
  tone(880, 0.15, 'triangle', 0.1, 0.08);
}
export function playMark() { tone(520, 0.08, 'square', 0.06); }
export function playWin() {
  [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.15, i * 0.12));
}
export function playClick() { tone(300, 0.06, 'sine', 0.08); }
