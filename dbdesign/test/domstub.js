// A DOM small enough to boot HUG OF DEATH headlessly.
//
// ui.js is the biggest file in the project and was previously only syntax-
// checked, because it needs a document. This is just enough document to run it
// for real: element lookup by id, classList, style, innerHTML (ids inside it
// are registered, which is how the shop wires its buttons), events, and a
// canvas 2d context that accepts every call and draws nothing.
//
// It is deliberately crude. It is not a browser and will not catch a layout
// bug — it catches the things a refactor breaks: a renamed function, a missing
// element, a handler wired to an id that no longer exists, an undefined read
// on the render path.
//
//   const dom = makeDom(htmlText);   // seeds every id="..." found in the html
//   vm.runInContext(..., ctx);       // with dom.document / dom.window in scope
//   dom.frame();                     // run one requestAnimationFrame tick

'use strict';

function makeClassList(el) {
  const set = new Set();
  return {
    add: (...c) => c.forEach(x => set.add(x)),
    remove: (...c) => c.forEach(x => set.delete(x)),
    contains: c => set.has(c),
    toggle: (c, force) => {
      const on = force === undefined ? !set.has(c) : !!force;
      if (on) set.add(c); else set.delete(c);
      return on;
    },
    get size() { return set.size; },
  };
}

function makeDom(html) {
  const byId = new Map();
  const byClass = new Map();     // className -> [elements]
  const listeners = [];
  const frames = [];
  const timers = [];

  function register(el) {
    if (el.id) byId.set(el.id, el);
    for (const c of String(el.className || '').split(/\s+/).filter(Boolean)) {
      if (!byClass.has(c)) byClass.set(c, []);
      byClass.get(c).push(el);
    }
    return el;
  }

  function makeElement(tag) {
    const el = {
      tagName: tag, id: '', className: '', textContent: '', title: '',
      disabled: false, style: {}, children: [], parent: null,
      value: '', dataset: {},
      clientWidth: 960, clientHeight: 540, offsetWidth: 260, offsetHeight: 320,
      width: 960, height: 540,
      appendChild(child) { child.parent = el; el.children.push(child); register(child); return child; },
      remove() {
        if (!el.parent) return;
        el.parent.children = el.parent.children.filter(c => c !== el);
      },
      addEventListener(type, fn) { listeners.push({ el, type, fn }); },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: el.clientWidth, height: el.clientHeight }),
      querySelector: sel => findIn(el, sel),
      querySelectorAll: sel => findAllIn(el, sel),
      getContext: () => ctx2d,
      get firstElementChild() { return el.children[0] || null; },
      get innerHTML() { return el._html || ''; },
      // markup is not parsed, but any id in it becomes findable — that is how
      // buildShop/memo/guru wire handlers to elements they just wrote
      set innerHTML(v) {
        el._html = String(v);
        if (v === '') { el.children = []; return; }
        for (const m of String(v).matchAll(/id="([^"]+)"/g)) {
          byId.set(m[1], register(makeElement('div')));
          byId.get(m[1]).id = m[1];
        }
        for (const m of String(v).matchAll(/class="([^"]+)"/g)) {
          const child = makeElement('div');
          child.className = m[1];
          child.parent = el;
          el.children.push(child);
          register(child);
        }
      },
    };
    Object.defineProperty(el, 'classList', { value: makeClassList(el) });
    return el;
  }

  const findAllIn = (root, sel) => {
    const name = sel.replace(/^[.#]/, '');
    if (sel.startsWith('#')) return byId.has(name) ? [byId.get(name)] : [];
    const own = root.children.filter(c => String(c.className).split(/\s+/).includes(name));
    return own.length ? own : (byClass.get(name) || []);
  };
  const findIn = (root, sel) => findAllIn(root, sel)[0] || makeElement('div');

  // accepts every canvas call, records nothing
  const ctx2d = new Proxy({}, {
    get: (target, prop) => (prop in target ? target[prop] : () => undefined),
    set: (target, prop, value) => { target[prop] = value; return true; },
  });

  // Seed one element per tag that carries an id, keeping its starting classes —
  // several panels ship with class="hidden" and the code toggles from there, so
  // dropping the initial class inverts every open/close in the app.
  for (const m of String(html).matchAll(/<(\w+)([^>]*)>/g)) {
    const attrs = m[2];
    const id = /id="([^"]+)"/.exec(attrs);
    if (!id) continue;
    const el = makeElement(m[1]);
    el.id = id[1];
    const cls = /class="([^"]+)"/.exec(attrs);
    if (cls) {
      el.className = cls[1];
      for (const c of cls[1].split(/\s+/).filter(Boolean)) el.classList.add(c);
    }
    register(el);
  }
  // the speed buttons are found by class and read data-speed
  for (const speed of [0, 1, 2, 4]) {
    const b = makeElement('button');
    b.className = 'speed';
    b.dataset.speed = String(speed);
    register(b);
  }

  const document = {
    getElementById: id => byId.get(id) || null,
    createElement: makeElement,
    querySelector: sel => findAllIn({ children: [] }, sel)[0] || null,
    querySelectorAll: sel => findAllIn({ children: [] }, sel),
    addEventListener: (type, fn) => listeners.push({ el: null, type, fn }),
  };

  const window = {
    devicePixelRatio: 2,
    addEventListener: (type, fn) => listeners.push({ el: null, type, fn }),
    requestAnimationFrame: fn => { frames.push(fn); return frames.length; },
  };

  return {
    document, window, byId,
    requestAnimationFrame: window.requestAnimationFrame,
    setTimeout: (fn, ms) => { timers.push(fn); return timers.length; },
    performance: { now: () => makeDom.clock },
    // fire the pending animation frame callback(s), advancing the fake clock
    frame(ms) {
      makeDom.clock += ms;
      const due = frames.splice(0, frames.length);
      for (const fn of due) fn(makeDom.clock);
      return due.length;
    },
    // click / dispatch by element id
    fire(id, type) {
      const el = byId.get(id);
      if (!el) throw new Error('no element #' + id);
      const hits = listeners.filter(l => l.el === el && l.type === type);
      if (!hits.length) throw new Error('no ' + type + ' handler on #' + id);
      for (const h of hits) h.fn({ currentTarget: el, clientX: 0, clientY: 0, preventDefault() {} });
      return hits.length;
    },
    // dispatch to whatever registered on the element, e.g. scene mousemove
    fireAt(id, type, x, y) {
      const el = byId.get(id);
      for (const h of listeners.filter(l => l.el === el && l.type === type)) {
        h.fn({ currentTarget: el, clientX: x, clientY: y, preventDefault() {} });
      }
    },
    timers,
  };
}
makeDom.clock = 1000;

module.exports = { makeDom };
