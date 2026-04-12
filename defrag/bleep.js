// bleep.js — Monophonic pentatonic bleeps for DEFRAG.
//
// 16 rows mapped to a pentatonic scale spanning ~3 octaves.
// Square wave, short decay, one voice — each new note kills the last.

export class Bleep {
  constructor(rows) {
    this.ctx = null;
    this.osc = null;
    this.gain = null;
    this.lastRow = 0;

    // Build a pentatonic scale for seek distances 0..rows-1.
    // 0 tracks = lowest note, max tracks = highest note.
    // Pentatonic intervals in semitones: 0, 2, 4, 7, 9, then +12 per octave.
    const pentatonic = [0, 2, 4, 7, 9];
    const baseFreq = 220; // A3
    this.freqs = [];
    for (let i = 0; i < rows; i++) {
      const octave = Math.floor(i / pentatonic.length);
      const degree = i % pentatonic.length;
      const semitones = octave * 12 + pentatonic[degree];
      this.freqs.push(baseFreq * Math.pow(2, semitones / 12));
    }
  }

  // Must be called from a user gesture (click) to unlock audio.
  init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
  }

  play(row) {
    if (!this.ctx) return;
    const delta = Math.abs(row - this.lastRow);
    this.lastRow = row;
    const freq = this.freqs[delta] || this.freqs[this.freqs.length - 1];

    // Kill previous note — monophonic.
    if (this.osc) {
      this.osc.stop();
      this.osc.disconnect();
      this.gain.disconnect();
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);

    this.osc = osc;
    this.gain = gain;
  }

  archive() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const hi = this.freqs[0] * Math.pow(2, -2 / 12);  // 1 pentatonic step down
    const lo = this.freqs[0] * Math.pow(2, -4 / 12);  // 2 pentatonic steps down

    if (this.osc) {
      this.osc.stop();
      this.osc.disconnect();
      this.gain.disconnect();
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    // be-de-be-de-boo
    osc.frequency.setValueAtTime(hi, t);
    osc.frequency.setValueAtTime(lo, t + 0.05);
    osc.frequency.setValueAtTime(hi, t + 0.10);
    osc.frequency.setValueAtTime(lo, t + 0.15);
    osc.frequency.setValueAtTime(lo * 0.75, t + 0.20);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.setValueAtTime(0.08, t + 0.20);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(t + 0.30);

    this.osc = osc;
    this.gain = gain;
  }
}
