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

    const SCALE = buildScale(BASE_FREQ, 8);
    const STEP_NOTE = SCALE[2];        // fixed footstep pitch
    const BLEEP = SCALE.slice(4, 8);   // high end of the scale — end-of-turn pair
    const FANFARE = SCALE.slice(2, 8); // wider range for the 5-beat flourish

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

        // ---- Cues ----
        step() { this.phrase([STEP_NOTE]); }                    // one boop per move click
        endTurn() { this.phrase(randomNotes(BLEEP, 2)); }        // bleep bloop
        fanfare() { this.phrase(randomNotes(FANFARE, 5)); }      // game start and victory
        coin() { this.phrase([SCALE[5], SCALE[7]]); }            // ka-ching: a sale or a cache
        harvestCue() { this.phrase([SCALE[2], SCALE[3]]); }      // rising mid pair per harvest
        zap() { this.phrase([SCALE[6], SCALE[4]]); }             // your blaster
        hurt() { this.phrase([SCALE[1], SCALE[0]]); }            // low falling pair — you got hit
        doom() { this.phrase([SCALE[5], SCALE[3], SCALE[1], SCALE[0]]); }  // bike eaten / death
    }

    return GameSound;
})();
