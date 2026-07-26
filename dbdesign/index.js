// HUG OF DEATH — bootstrap and game loop.

(() => {
  const S = Content.SIM;
  const $ = id => document.getElementById(id);
  let state = Engine.createState((Date.now() ^ (Math.random() * 1e9)) | 0);
  let speed = 1;          // 0 pause, 1, 2, 4
  let memosMuted = false;
  let pausedForModal = false;
  let speedBeforeModal = 1;
  let acc = 0;
  let lastFrame = performance.now();
  let ended = false;

  function setSpeed(s, fromModal) {
    speed = s;
    if (!fromModal) speedBeforeModal = s;
    document.querySelectorAll('.speed').forEach(b => {
      b.classList.toggle('sel', Number(b.dataset.speed) === s);
    });
  }

  // A modal freezes the sim and restores whatever speed was running before it.
  // UI.showModal decides what is on screen; this decides whether time passes.
  function pauseForModal() {
    pausedForModal = true;
    setSpeed(0, true);
  }

  function resumeAfterModal() {
    pausedForModal = false;
    setSpeed(speedBeforeModal, true);
  }

  function drainInsights() {
    if (pausedForModal || ended) { if (ended) state.newInsights.length = 0; return; }
    const key = state.newInsights.shift();
    if (!key) return;
    pauseForModal();
    UI.showInsight(key, () => {
      resumeAfterModal();
      drainInsights(); // several can queue up in one tick
    });
  }

  function drainEvents() {
    let key;
    while ((key = state.newEvents.shift())) UI.toast(key);
  }

  function drainMemos() {
    let m;
    while ((m = state.newMemos.shift())) {
      if (memosMuted || ended) continue;
      UI.memo(m);
    }
  }

  function restart() {
    state = Engine.createState((Date.now() ^ (Math.random() * 1e9)) | 0);
    ended = false;
    UI.clearMemos();
    UI.closeGuru();
    UI.hideModal();
    resumeAfterModal();
    setSpeed(1);
  }

  function frame(now) {
    const dtFrame = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    if (!ended && !pausedForModal && speed > 0) {
      acc += dtFrame * speed;
      let guard = 0;
      while (acc >= S.DT && guard++ < 80) {
        Engine.tick(state);
        acc -= S.DT;
      }
    }
    drainEvents();
    drainMemos();
    drainInsights();
    UI.render(state, dtFrame, !ended && !pausedForModal && speed > 0);
    if (state.outcome && !ended) {
      ended = true;
      UI.showEnd(state, restart);
    }
    requestAnimationFrame(frame);
  }

  UI.init(
    key => {
      const res = Engine.buy(state, key);
      if (!res.ok && res.msg) console.log(res.msg);
    },
    key => {
      const res = Engine.scaleDown(state, key);
      if (!res.ok && res.msg) console.log(res.msg);
    });

  // debug/test hook (used by test/screenshot.js)
  window.HUG = { getState: () => state, cheat: n => { state.cash += n; } };

  // intro: start paused until the player accepts the pager
  pauseForModal();
  UI.showModal('intro');
  $('intro-ok').addEventListener('click', () => {
    UI.hideModal();
    resumeAfterModal();
    setSpeed(1);
  });

  document.querySelectorAll('.speed').forEach(b => {
    b.addEventListener('click', () => {
      if (pausedForModal || ended) return;
      setSpeed(Number(b.dataset.speed));
    });
  });

  $('btn-guru').addEventListener('click', () => UI.toggleGuru(state));
  $('guru-close').addEventListener('click', () => UI.closeGuru());

  $('btn-memos').addEventListener('click', e => {
    memosMuted = !memosMuted;
    e.currentTarget.textContent = memosMuted ? '🔇' : '📣';
    e.currentTarget.title = memosMuted ? 'Unmute management' : 'Mute management';
    if (memosMuted) UI.clearMemos();
  });

  $('btn-insights').addEventListener('click', () => {
    if (ended) return;
    if (pausedForModal) return;
    pauseForModal();
    UI.showDrawer(state, resumeAfterModal);
  });

  window.addEventListener('keydown', e => {
    if (e.key === ' ' && !pausedForModal && !ended) {
      e.preventDefault();
      setSpeed(speed === 0 ? speedBeforeModal || 1 : 0);
    }
  });

  requestAnimationFrame(frame);
})();
