// sound.js — Monophonic pentatonic synth for DEFRAG.
//
// Square wave, short decay, one voice — each new note kills the last.
// Pitch maps to seek distance (track delta), not absolute row.

const PENTATONIC = [0, 2, 4, 7, 9];
const BASE_FREQ = 220; // A3
const VOLUME = 0.08;

function buildScale(steps) {
  const freqs = [];
  for (let i = 0; i < steps; i++) {
    const octave = Math.floor(i / PENTATONIC.length);
    const degree = i % PENTATONIC.length;
    const semitones = octave * 12 + PENTATONIC[degree];
    freqs.push(BASE_FREQ * Math.pow(2, semitones / 12));
  }
  return freqs;
}

export class Sound {
  constructor(rows) {
    this.ctx = null;
    this.osc = null;
    this.gain = null;
    this.lastRow = 0;
    this.muted = false;
    this.freqs = buildScale(rows);
  }

  // Must be called from a user gesture (click) to unlock audio.
  init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
  }

  // Start a new oscillator, killing the previous one (monophonic).
  voice(duration) {
    if (this.osc) {
      this.osc.stop();
      this.osc.disconnect();
      this.gain.disconnect();
    }
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
    this.osc = osc;
    this.gain = gain;
    return { osc, gain };
  }

  play(row) {
    if (!this.ctx || this.muted) return;
    const delta = Math.abs(row - this.lastRow);
    this.lastRow = row;
    const freq = this.freqs[delta] || this.freqs[this.freqs.length - 1];
    const t = this.ctx.currentTime;
    const { osc, gain } = this.voice(0.06);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(VOLUME, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  }

  archive() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const hi = this.freqs[0] * Math.pow(2, -2 / 12);
    const lo = this.freqs[0] * Math.pow(2, -4 / 12);
    const { osc, gain } = this.voice(0.30);
    // be-de-be-de-boo
    osc.frequency.setValueAtTime(hi, t);
    osc.frequency.setValueAtTime(lo, t + 0.05);
    osc.frequency.setValueAtTime(hi, t + 0.10);
    osc.frequency.setValueAtTime(lo, t + 0.15);
    osc.frequency.setValueAtTime(lo * 0.75, t + 0.20);
    gain.gain.setValueAtTime(VOLUME, t);
    gain.gain.setValueAtTime(VOLUME, t + 0.20);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
  }
}
