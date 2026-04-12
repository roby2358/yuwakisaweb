// sound.js — Combat audio for Warrior
//
// 12.5% pulse wave + noise burst for hits, square wave for ticks/fanfares.
// 8 pentatonic notes: low 4 for enemy-hits-player, high 4 for player-hits-enemy.

import { Rando } from './rando.js';

const PENTATONIC = [0, 2, 4, 7, 9];
const BASE_FREQ = 64;
const FANFARE_FREQ = 220; // A3 — original pitch for victory flourishes
const VOLUME = 0.08;
const NOISE_VOLUME = 0.06;
const NOTE_DUR = 0.10; // 100ms
const KILL_DUR = 0.20; // 200ms
const PULSE_HARMONICS = 32; // harmonics for 12.5% pulse wave

// Fourier coefficients for a 12.5% duty cycle pulse wave
function buildPulseCoeffs(n) {
    const real = new Float32Array(n + 1);
    const imag = new Float32Array(n + 1);
    const duty = 0.125;
    for (let k = 1; k <= n; k++) {
        imag[k] = 2 * Math.sin(Math.PI * k * duty) / (Math.PI * k);
    }
    return { real, imag };
}

function buildScale(base, count) {
    const freqs = [];
    for (let i = 0; i < count; i++) {
        const octave = Math.floor(i / PENTATONIC.length);
        const degree = i % PENTATONIC.length;
        const semitones = octave * 12 + PENTATONIC[degree];
        freqs.push(base * Math.pow(2, semitones / 12));
    }
    return freqs;
}

const SCALE = buildScale(BASE_FREQ, 8);
const LOW = SCALE.slice(0, 4);    // enemy hits player
const HIGH = SCALE.slice(4, 8);   // player hits enemy
const FANFARE = buildScale(FANFARE_FREQ, 8).slice(4, 8); // victory flourish

export class Sound {
    constructor() {
        this.ctx = null;
        this.osc = null;
        this.gain = null;
        this.noiseBuffer = null;
        this.pulseWave = null;
        this.muted = false;
    }

    init() {
        if (this.ctx) return;
        this.ctx = new AudioContext();
        // Build 12.5% pulse periodic wave
        const { real, imag } = buildPulseCoeffs(PULSE_HARMONICS);
        this.pulseWave = this.ctx.createPeriodicWave(real, imag);
        // Pre-generate 1 second of white noise
        const sr = this.ctx.sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, sr, sr);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < sr; i++) data[i] = Math.random() * 2 - 1;
    }

    voice(freq, duration, pulse = false) {
        if (!this.ctx || this.muted) return;
        if (this.osc) {
            this.osc.stop();
            this.osc.disconnect();
            this.gain.disconnect();
        }
        const osc = this.ctx.createOscillator();
        if (pulse) osc.setPeriodicWave(this.pulseWave);
        else osc.type = 'square';
        osc.frequency.value = freq;
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        const t = this.ctx.currentTime;
        gain.gain.setValueAtTime(VOLUME, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.start();
        osc.stop(t + duration);
        this.osc = osc;
        this.gain = gain;
    }

    // Short noise burst layered under hit sounds
    noiseBurst(startTime, duration) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const gain = this.ctx.createGain();
        src.connect(gain);
        gain.connect(this.ctx.destination);
        gain.gain.setValueAtTime(NOISE_VOLUME, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        src.start(startTime);
        src.stop(startTime + duration);
    }

    // Light footstep tick on player move
    tick() {
        this.voice(BASE_FREQ * 4, 0.02);
    }

    // Enemy hits player — random low pulse note + noise
    hitPlayer() {
        if (!this.ctx || this.muted) return;
        this.voice(Rando.choice(LOW), NOTE_DUR, true);
        this.noiseBurst(this.ctx.currentTime, NOTE_DUR * 0.6);
    }

    // Player hits enemy — random high pulse note + noise
    hitEnemy() {
        if (!this.ctx || this.muted) return;
        this.voice(Rando.choice(HIGH), NOTE_DUR, true);
        this.noiseBurst(this.ctx.currentTime, NOTE_DUR * 0.6);
    }

    // Enemy destroyed — pulse hit + noise, then delayed kill confirmation
    killEnemy() {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime;
        this.scheduleNote(Rando.choice(HIGH), t, NOTE_DUR, true);
        this.noiseBurst(t, NOTE_DUR * 0.6);
        this.scheduleNote(Rando.choice(HIGH), t + NOTE_DUR + 0.02, KILL_DUR, true);
    }

    // Victory fanfare — 5 player-attack notes, last one 3x duration
    // scale multiplies all durations (2 for double-length)
    victory(scale = 1) {
        if (!this.ctx || this.muted) return;
        const notes = [];
        for (let i = 0; i < 5; i++) notes.push(Rando.choice(FANFARE));
        let t = this.ctx.currentTime;
        const gap = (NOTE_DUR + 0.02) * scale;
        for (let i = 0; i < 5; i++) {
            const dur = (i === 4 ? NOTE_DUR * 3 : NOTE_DUR) * scale;
            this.scheduleNote(notes[i], t, dur);
            t += gap;
        }
    }

    scheduleNote(freq, startTime, duration, pulse = false) {
        const osc = this.ctx.createOscillator();
        if (pulse) osc.setPeriodicWave(this.pulseWave);
        else osc.type = 'square';
        osc.frequency.value = freq;
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        gain.gain.setValueAtTime(VOLUME, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
    }
}
