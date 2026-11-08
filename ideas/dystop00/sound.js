// sound.js — GameSound
//
// Client-only bleeps and boops, adapted from ../../warrior/sound.js: a 12.5% duty-cycle
// pulse wave over a pentatonic scale. Every cue is a phrase — a list of pitches played
// as evenly spaced 100ms notes — so the cues differ only in which notes they pick.
//
// The AudioContext is created lazily on the first cue so it lands inside a user gesture
// (click/keypress), which is what browsers require. Randomization uses Math.random, NOT
// Rando: the seeded stream belongs to the engine and audio must not perturb it.
const GameSound = (function () {
    const PENTATONIC = [0, 2, 4, 7, 9];
    const BASE_FREQ = 128;
    const VOLUME = 0.08;
    const NOTE_DUR = 0.10;   // 100ms
    const GAP = 0.02;        // silence between notes of a phrase
    const PULSE_HARMONICS = 32;
    const CLICK_DUR = 0.03;     // one floppy-head step, seconds
    const CLICK_GAIN = 0.12;

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
            freqs.push(base * Math.pow(2, (octave * 12 + PENTATONIC[degree]) / 12));
        }
        return freqs;
    }

    const SCALE = buildScale(BASE_FREQ, 12);
    const LOW = buildScale(BASE_FREQ / 2, 5);
    const STEP_NOTE = SCALE[2];        // fixed footstep pitch
    const BLEEP = SCALE.slice(4, 8);   // high end of the scale — end-of-turn pair
    const FANFARE = SCALE.slice(2, 12); // wider range for the flourish

    // Draw `count` pitches at random from a pool, repeats allowed.
    function randomNotes(pool, count) {
        return Array.from({ length: count },
            () => pool[Math.floor(Math.random() * pool.length)]);
    }

    class GameSound {
        constructor() {
            this.ctx = null;
            this.pulseWave = null;
        }

        // Lazy init on the first cue, inside whatever gesture triggered it.
        ensureCtx() {
            if (this.ctx) {
                if (this.ctx.state === 'suspended') this.ctx.resume();
                return;
            }
            this.ctx = new AudioContext();
            const { real, imag } = buildPulseCoeffs(PULSE_HARMONICS);
            this.pulseWave = this.ctx.createPeriodicWave(real, imag);
        }

        scheduleNote(freq, startTime) {
            const osc = this.ctx.createOscillator();
            osc.setPeriodicWave(this.pulseWave);
            osc.frequency.value = freq;
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            gain.gain.setValueAtTime(VOLUME, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + NOTE_DUR);
            osc.start(startTime);
            osc.stop(startTime + NOTE_DUR);
        }

        // The one playback primitive: a list of pitches as evenly spaced 100ms notes.
        phrase(freqs) {
            this.ensureCtx();
            const t = this.ctx.currentTime;
            freqs.forEach((freq, i) => this.scheduleNote(freq, t + i * (NOTE_DUR + GAP)));
        }

        // A burst of filtered noise: the floppy drive's head stepping.
        click(at) {
            this.ensureCtx();
            const len = Math.floor(this.ctx.sampleRate * CLICK_DUR);
            const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            const filt = this.ctx.createBiquadFilter();
            filt.type = 'bandpass';
            filt.frequency.value = 900 + Math.random() * 600;
            const gain = this.ctx.createGain();
            gain.gain.value = CLICK_GAIN;
            src.connect(filt); filt.connect(gain); gain.connect(this.ctx.destination);
            src.start(this.ctx.currentTime + at);
        }

        // ---- Cues ----
        step() { this.phrase([STEP_NOTE]); }                    // one boop per move click
        endTurn() { this.phrase(randomNotes(BLEEP, 2)); }        // bleep bloop
        fanfare() { this.phrase(randomNotes(FANFARE, 5)); }      // game start
        drive() {                                                // disk seek chatter
            this.ensureCtx();
            let t = 0;
            for (let i = 0; i < 14; i++) { t += 0.04 + Math.random() * 0.09; this.click(t); }
        }
        plant() { this.phrase([SCALE[3], SCALE[5], SCALE[8]]); } // transmitter on air
        retrieve() { this.phrase([SCALE[8], SCALE[5]]); }
        wake(n) {                                                // rising arpeggio, longer for bigger wakes
            const len = Math.max(1, Math.min(8, Math.ceil(n / 6)));
            this.phrase(SCALE.slice(12 - len));
        }
        fade(n) {                                                // falling notes: the Wake losing ground
            const len = Math.max(1, Math.min(4, Math.ceil(n / 6)));
            this.phrase(SCALE.slice(2, 2 + len).reverse());
        }
        alarm() { this.phrase([SCALE[9], SCALE[6], SCALE[9], SCALE[6]]); }   // a Sweeper deployed
        smash() { this.phrase([LOW[2], LOW[0]]); }               // a rig destroyed
        victory() { this.phrase([...SCALE.slice(5, 12), SCALE[11], SCALE[11]]); }
        defeat() { this.phrase([SCALE[4], SCALE[3], SCALE[2], LOW[4], LOW[2], LOW[0]]); }
    }

    return GameSound;
})();
