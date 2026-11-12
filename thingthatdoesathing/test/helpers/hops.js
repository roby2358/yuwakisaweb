// test/helpers/hops.js — replay a tick's events hop by hop (D-38).
//
// `hopOverlap(before, events)` rebuilds where every piece stands after each hop from the
// pre-tick positions (`before`: Map id → {q, r}) and the tick's move/end events, and returns
// the first hop at which two pieces share a hex ({ hop, key, ids }), or null if none ever do.
// A piece is off the board from its end's hop on; a shot's first `over` hexes pass over and
// don't count. Crates spawned this tick appear after the last hop and aren't checked here.
'use strict';

const END_TYPES = new Set(['sink', 'deliver', 'splat']);

function tracksOf(before, events) {
    const tracks = new Map([...before].map(([id, at]) => [id, { pts: [at], hop: 0, over: 0, endHop: Infinity }]));
    for (const e of events) {
        const t = tracks.get(e.id);
        if (!t) continue;
        if (e.type === 'move') Object.assign(t, { pts: [...Array(e.hop).fill(t.pts[0]), ...e.path], hop: e.hop, over: e.over });
        if (END_TYPES.has(e.type)) t.endHop = e.hop;
    }
    return tracks;
}

function hopOverlap(before, events) {
    const tracks = tracksOf(before, events);
    const last = Math.max(0, ...[...tracks.values()].map(t => t.pts.length - 1));
    for (let k = 0; k <= last; k++) {
        const at = new Map();
        for (const [id, t] of tracks) {
            if (k >= t.endHop || (k >= t.hop && k < t.hop + t.over)) continue;
            const p = t.pts[Math.min(k, t.pts.length - 1)];
            const key = p.q + ',' + p.r;
            if (at.has(key)) return { hop: k, key, ids: [at.get(key), id] };
            at.set(key, id);
        }
    }
    return null;
}

module.exports = { hopOverlap };
