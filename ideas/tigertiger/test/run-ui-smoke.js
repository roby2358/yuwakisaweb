'use strict';

// UI smoke test: loads all four scripts under a minimal DOM shim, boots the
// game, and simulates input. Catches wiring errors (missing ids, bad event
// playback, render crashes) without a browser. Run: node test/run-ui-smoke.js

var fs = require('fs');
var path = require('path');
var vm = require('vm');

function noopCtx() {
  return new Proxy({}, {
    get: function (target, prop) {
      if (prop === 'canvas') return {};
      return function () {};
    },
    set: function () { return true; }
  });
}

function makeElement(id) {
  return {
    id: id,
    style: {},
    textContent: '',
    innerHTML: '',
    className: '',
    disabled: false,
    scrollTop: 0,
    scrollHeight: 0,
    width: 0,
    height: 0,
    listeners: {},
    addEventListener: function (type, fn) { this.listeners[type] = fn; },
    getContext: noopCtx,
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 792, height: 540 }; }
  };
}

var elements = {};
var docListeners = {};
var rafQueue = [];

var documentShim = {
  getElementById: function (id) {
    if (!elements[id]) elements[id] = makeElement(id);
    return elements[id];
  },
  querySelectorAll: function () {
    return { forEach: function (fn) { fn(makeElement('nodelist-stub')); } };
  },
  addEventListener: function (type, fn) { docListeners[type] = fn; }
};

var context = vm.createContext({
  console: console,
  document: documentShim,
  performance: { now: function () { return Date.now(); } },
  requestAnimationFrame: function (fn) { rafQueue.push(fn); },
  setTimeout: function (fn) { fn(); }, // play event queues synchronously
  Math: Math
});

['../js/artifacts.js', '../js/state.js', '../js/engine.js', '../js/ui.js'].forEach(function (rel) {
  var file = path.join(__dirname, rel);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
});

var failures = 0;
function check(label, fn) {
  try {
    fn();
    console.log('PASS — ' + label);
  } catch (err) {
    failures += 1;
    console.log('FAIL — ' + label + ': ' + err.message);
  }
}

check('game boots via DOMContentLoaded', function () {
  docListeners['DOMContentLoaded']();
});

check('render loop runs 5 frames', function () {
  for (var i = 0; i < 5; i++) {
    var frame = rafQueue.shift();
    frame(Date.now());
  }
});

check('50 turns of keyboard play (moves and waits)', function () {
  var keys = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'w', 'd', ' '];
  for (var i = 0; i < 50; i++) {
    var key = keys[i % keys.length];
    docListeners['keydown']({ key: key, preventDefault: function () {} });
  }
});

check('map clicks (step, jaunte attempt, blind jaunte)', function () {
  var canvas = elements['map'];
  [[40, 470], [700, 100], [400, 300], [76, 505]].forEach(function (p) {
    canvas.listeners['click']({ clientX: p[0], clientY: p[1] });
    canvas.listeners['mousemove']({ clientX: p[0], clientY: p[1] });
  });
});

check('panel buttons respond', function () {
  elements['wait'].listeners['click']();
  elements['detonate'].listeners['click']();
  elements['begin'].listeners['click']();
});

check('render loop still alive after input', function () {
  var frame = rafQueue.shift();
  frame(Date.now());
});

console.log(failures === 0 ? 'UI smoke: all clear' : 'UI smoke: ' + failures + ' failure(s)');
process.exit(failures === 0 ? 0 : 1);
