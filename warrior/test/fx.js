// Checks fx.js token-slide and float bookkeeping. Run: node test/fx.js
'use strict';

const assert = require('node:assert/strict');
const { load } = require('./load.js');
const { Fx, SLIDE_MS, FLOAT_MS } = load(['fx.js'], ['Fx', 'SLIDE_MS', 'FLOAT_MS']);

const MAX_JUMP = 100;
const a = { x: 0, y: 0 }, b = { x: 40, y: 0 }, far = { x: 500, y: 0 };
const at = (pos, want) => assert.deepEqual({ x: pos.x, y: pos.y }, want);

// A token first seen simply appears.
let fx = new Fx();
const tok = {};
fx.beginFrame(0);
at(fx.tokenPos(tok, a, MAX_JUMP), a);
assert.equal(fx.busy, false);

// Moved since last frame: it starts at the old spot and is busy.
fx.beginFrame(10);
at(fx.tokenPos(tok, b, MAX_JUMP), a);
assert.equal(fx.busy, true);

// Mid-slide it is between the two, past halfway (ease-out).
fx.beginFrame(10 + SLIDE_MS / 2);
const mid = fx.tokenPos(tok, b, MAX_JUMP);
assert.ok(mid.x > 20 && mid.x < 40);

// After the slide it rests on the target and stops being busy.
fx.beginFrame(10 + SLIDE_MS + 1);
at(fx.tokenPos(tok, b, MAX_JUMP), b);
assert.equal(fx.busy, false);

// A jump beyond maxJump does not slide.
fx.beginFrame(200);
at(fx.tokenPos(tok, far, MAX_JUMP), far);
assert.equal(fx.busy, false);

// A token skipped for a frame (out of sight) reappears without sliding.
fx.beginFrame(300);
fx.beginFrame(310);
at(fx.tokenPos(tok, a, MAX_JUMP), a);
assert.equal(fx.busy, false);

// Floats live for FLOAT_MS, then drop out.
fx = new Fx();
fx.floatText(1, 2, '-5', '#fff', 0, 0);
fx.beginFrame(FLOAT_MS / 2);
assert.equal(fx.liveFloats().length, 1);
assert.equal(fx.liveFloats()[0].t, 0.5);
assert.equal(fx.busy, true);
fx.beginFrame(FLOAT_MS);
assert.equal(fx.liveFloats().length, 0);
assert.equal(fx.busy, false);

console.log('fx ok');
