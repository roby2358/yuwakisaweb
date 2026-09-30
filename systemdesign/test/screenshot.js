// LOAD BEARING — browser verification. Loads index.html in a real headless
// Chrome, plays a run through the guru's own advice, and saves screenshots at
// the moments worth eyeballing. Fails on any page error.
//
// The headless smoke test proves the UI does not throw. This proves it renders:
// the map, the probe, the guru panel, the field notes and the scorecard.
//
//   NODE_PATH=/work/yuwakisaweb/ideas/alienbadlands/node_modules node test/screenshot.js
//   ... --scenario feed        pick the brief instead of taking the rolled one
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');

function findChrome() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const base = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome-headless-shell');
  try {
    for (const ver of fs.readdirSync(base)) {
      const p = path.join(base, ver, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
      if (fs.existsSync(p)) return p;
    }
  } catch (e) { /* fall back to puppeteer's default */ }
  return undefined;
}

const PAGE_URL = 'file://' + path.join(__dirname, '..', 'index.html');
const shot = name => path.join(__dirname, 'screenshot-' + name + '.png');
const wait = ms => new Promise(r => setTimeout(r, ms));

async function dismissModals(page) {
  for (let i = 0; i < 40; i++) {
    const open = await page.evaluate(() => {
      const card = document.getElementById('insight-card');
      if (card && !card.classList.contains('hidden')) {
        document.getElementById('card-ok').click();
        return true;
      }
      return false;
    });
    if (!open) return;
    await wait(90);
  }
}

// Advance the simulation without waiting for wall-clock, letting the guru buy as
// it goes — the same bot test/sim.js runs, driving the real page this time.
async function playFor(page, seconds) {
  await page.evaluate(secs => {
    const s = window.LB.getState();
    const ticks = Math.round(secs / Content.SIM.DT);
    let nextBuy = s.t;
    for (let i = 0; i < ticks && !s.outcome; i++) {
      Engine.tick(s);
      if (s.t < nextBuy) continue;
      nextBuy = s.t + 1.5;
      const undo = Guru.nextUndo(s);
      if (undo) Engine.scaleDown(s, undo);
      const key = Guru.nextBuy(s);
      if (key) Engine.buy(s, key);
    }
  }, seconds);
  await wait(350);
  await dismissModals(page);
}

(async () => {
  const args = process.argv.slice(2);
  const at = args.indexOf('--scenario');
  const scenario = at >= 0 ? args[at + 1] : null;

  const errors = [];
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 940 });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(PAGE_URL, { waitUntil: 'load' });
  await wait(700);
  if (scenario) {
    await page.evaluate(key => Engine.applyScenario(window.LB.getState(), key), scenario);
    await wait(300);
  }
  await page.screenshot({ path: shot('brief') });

  await page.click('#intro-ok');
  await wait(500);
  await page.screenshot({ path: shot('design') });
  // build the opening design the guru advises, then go live
  await page.evaluate(() => {
    const s = window.LB.getState();
    while (!s.live) {
      const key = Guru.nextBuy(s);
      if (!key || !Engine.buy(s, key).ok) break;
    }
    Engine.goLive(s);
  });
  await wait(400);
  await playFor(page, 90);
  await page.screenshot({ path: shot('early') });

  await playFor(page, 150);
  // hover a box so the probe panel is in the shot
  const probeAt = await page.evaluate(() => {
    const c = document.getElementById('scene').getBoundingClientRect();
    return { x: c.left + c.width * 0.62, y: c.top + c.height * 0.5 };
  });
  await page.mouse.move(probeAt.x, probeAt.y);
  await wait(300);
  await page.screenshot({ path: shot('probe') });

  await page.click('#btn-guru');
  await wait(400);
  await page.screenshot({ path: shot('guru') });
  await page.click('#btn-guru');

  await playFor(page, 260);
  await page.screenshot({ path: shot('late') });

  await page.click('#btn-insights');
  await wait(350);
  await page.screenshot({ path: shot('cribsheet') });
  await page.click('#drawer-close');
  await wait(250);

  // force the debrief so the scorecard is always captured
  await page.evaluate(() => {
    const s = window.LB.getState();
    s.outcome = s.outcome || 'won';
  });
  await wait(700);
  await page.screenshot({ path: shot('scorecard') });

  const stats = await page.evaluate(() => {
    const s = window.LB.getState();
    return {
      scenario: s.scenario, t: s.t, served: s.report.servedRps, peak: s.peakServed,
      target: s.slo.targetRps, outcome: s.outcome,
      insights: Object.keys(s.insights).length, grade: Score.card(s).letter,
    };
  });
  await browser.close();

  console.log(stats.scenario + '  t=' + stats.t.toFixed(0) + 's  served='
    + Math.round(stats.served) + '/s  peak=' + Math.round(stats.peak)
    + ' of ' + stats.target + '  outcome=' + stats.outcome
    + '  insights=' + stats.insights + '  grade=' + stats.grade);
  if (errors.length) {
    console.log('PAGE ERRORS:\n' + errors.join('\n'));
    process.exit(1);
  }
  console.log('screenshots saved, no page errors');
})();
