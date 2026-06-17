// campaign.js — Persistent campaign state: hero, tracks, arc goals, saves.

import { DEFAULT_HERO_ATTRS, TRACKS, SAVE_KEY, START_DOWNTIME } from './config.js';
import { rollStarterPowers } from './powers.js';

const makeEmptyTracks = () => {
    const tracks = {};
    for (const name of TRACKS) tracks[name] = { rank: 0, xp: 0 };
    return tracks;
};

const STARTER_ARCS = [
    { id: 'mentor',   name: 'Find your missing mentor',  progress: 0, done: false },
    { id: 'rival',    name: 'Expose the Crimson Mayor',  progress: 0, done: false },
    { id: 'mastery',  name: 'Master your powers',        progress: 0, done: false }
];

export const newCampaign = (heroName = 'Nova') => ({
    heroName,
    attrs: { ...DEFAULT_HERO_ATTRS },
    powers: rollStarterPowers(),
    tracks: makeEmptyTracks(),
    arcs: STARTER_ARCS.map(a => ({ ...a })),
    downtime: START_DOWNTIME,
    missionCount: 0,
    log: []
});

export const saveCampaign = (state) => {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
        return true;
    } catch (err) {
        console.error('save failed', err);
        return false;
    }
};

export const loadCampaign = () => {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (err) {
        console.error('load failed', err);
        return null;
    }
};

export const addXp = (state, trackName, amount) => {
    const track = state.tracks?.[trackName];
    if (!track) return;
    track.xp += amount;
    while (track.xp >= 10) {
        track.xp -= 10;
        track.rank += 1;
    }
    if (track.xp < 0 && track.rank > 0) {
        track.xp = 0;
    }
};
