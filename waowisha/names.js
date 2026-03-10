// names.js — Phoneme-based name generator for Waowisha

import { Rando } from './rando.js';

const ONSETS = ['b','d','f','g','h','k','l','m','n','p','r','s','t','v','w','z','th','dr','gr','qu','sh','vr'];
const NUCLEI = ['a','e','i','o','u','ae','ei','ou','ai'];
const CODAS = ['k','l','m','n','r','s','t','x','th','ne','te','re','se'];
const SUFFIXES = ['ium','ane','ite','ol','ox','ik','ar','ene','ese','ith'];

function generateWord(rng) {
    const syllables = Rando.int(1, 2, rng);
    let word = '';
    for (let i = 0; i < syllables; i++) {
        word += Rando.choice(ONSETS, rng);
        word += Rando.choice(NUCLEI, rng);
        word += Rando.choice(CODAS, rng);
    }
    if (Rando.bool(0.5, rng)) {
        word += Rando.choice(SUFFIXES, rng);
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
}

function isValid(name, used) {
    if (name.length < 4 || name.length > 12) return false;
    const prefix = name.slice(0, 3).toLowerCase();
    return !used.has(prefix);
}

export function generateGameNames(seed) {
    const rng = Rando.seeded(seed);
    const names = {};
    const usedPrefixes = new Set();

    function gen() {
        let name;
        let attempts = 0;
        do {
            name = generateWord(rng);
            attempts++;
        } while (!isValid(name, usedPrefixes) && attempts < 50);
        usedPrefixes.add(name.slice(0, 3).toLowerCase());
        return name;
    }

    function genTwo() {
        const w1 = gen();
        const w2 = gen();
        return w1 + ' ' + w2;
    }

    // Tier 0 raw resources
    const singleSlots = ['R0a', 'R0b', 'R0c', 'R0d', 'P1a', 'P1b', 'P1c', 'P1d', 'E0', 'E1', 'E2'];
    for (const slot of singleSlots) {
        names[slot] = gen();
    }

    // Tier 2 and 3 get two-word names
    const twoWordSlots = ['P2a', 'P2b', 'P2c', 'P2d', 'P3a', 'P3b', 'P3c', 'P3d'];
    for (const slot of twoWordSlots) {
        names[slot] = genTwo();
    }

    return names;
}
