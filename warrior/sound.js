// sound.js — Combat audio for Warrior
//
// Square wave, short decay, monophonic.
// 8 pentatonic notes: low 4 for enemy-hits-player, high 4 for player-hits-enemy.

import { Rando } from './rando.js';

const PENTATONIC = [0, 2, 4, 7, 9];
const BASE_FREQ = 55; // A1
const VOLUME = 0.08;
const NOTE_DUR = 0.10; // 100ms
const KILL_DUR = 0.20; // 200ms

function buildScale(count) {
    const freqs = [];
    for (let i = 0; i < count; i++) {
        const octave = Math.floor(i / PENTATONIC.length);
        const degree = i % PENTATONIC.length;
        const semitones = octave * 12 + PENTATONIC[degree];
        freqs.push(BASE_FREQ * Math.pow(2, semitones / 12));
    }
    return freqs;
}

const SCALE = buildScale(8);
const LOW = SCALE.slice(0, 4);   // enemy hits player
const HIGH = SCALE.slice(4, 8);  // player hits enemy

export class Sound {
    constructor() {
        this.ctx = null;
        this.osc = null;
        this.gain = null;
        this.muted = false;
    }

    init() {
        if (this.ctx) return;
        this.ctx = new AudioContext();
    }

    voice(freq, duration) {
        if (!this.ctx || this.muted) return;
        if (this.osc) {
            this.osc.stop();
            this.osc.disconnect();
            this.gain.disconnect();
        }
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
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

    // Light footstep tick on player move
    tick() {
        this.voice(BASE_FREQ * 4, 0.02);
    }

    // Enemy hits player — random low note
    hitPlayer() {
        this.voice(Rando.choice(LOW), NOTE_DUR);
    }

    // Player hits enemy — random high note
    hitEnemy() {
        this.voice(Rando.choice(HIGH), NOTE_DUR);
    }

    // Enemy destroyed — hit note + delayed kill confirmation
    killEnemy() {
        if (!this.ctx || this.muted) return;
        const t = this.ctx.currentTime;
        this.scheduleNote(Rando.choice(HIGH), t, NOTE_DUR);
        this.scheduleNote(Rando.choice(HIGH), t + NOTE_DUR + 0.02, KILL_DUR);
    }

    // Victory fanfare — 5 player-attack notes, last one 3x duration
    // scale multiplies all durations (2 for double-length)
    victory(scale = 1) {
        if (!this.ctx || this.muted) return;
        const notes = [];
        for (let i = 0; i < 5; i++) notes.push(Rando.choice(HIGH));
        let t = this.ctx.currentTime;
        const gap = (NOTE_DUR + 0.02) * scale;
        for (let i = 0; i < 5; i++) {
            const dur = (i === 4 ? NOTE_DUR * 3 : NOTE_DUR) * scale;
            this.scheduleNote(notes[i], t, dur);
            t += gap;
        }
    }

    scheduleNote(freq, startTime, duration) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        gain.gain.setValueAtTime(VOLUME, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
    }
}
