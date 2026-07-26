// Browser verification for HUG OF DEATH: loads index.html headlessly, plays the
// opening (buy indexes + pooler), fast-forwards the sim via the HUG debug hook,
// builds out late-game architecture, and saves screenshots for eyeballing.
// Fails on any page error.
//
// Requires puppeteer on the module path, e.g.:
//   NODE_PATH=/work/yuwakisaweb/ideas/alienbadlands/node_modules node test/screenshot.js
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

async function dismissModals(page) {
  for (let i = 0; i < 20; i++) {
    const open = await page.evaluate(() => {
      const ok = document.getElementById('card-ok');
      const card = document.getElementById('insight-card');
      if (card && !card.classList.contains('hidden')) { ok.click(); return true; }
      return false;
    });
    if (!open) break;
    await new Promise(r => setTimeout(r, 120));
  }
}

async function fastForward(page, seconds) {
  await page.evaluate(secs => {
    const s = window.HUG.getState();
    const ticks = Math.round(secs / Content.SIM.DT);
    for (let i = 0; i < ticks; i++) Engine.tick(s);
  }, seconds);
  await new Promise(r => setTimeout(r, 300));
  await dismissModals(page);
}

(async () => {
  const errors = [];
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 860 });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(PAGE_URL, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(__dirname, 'screenshot-intro.png') });
  await page.click('#intro-ok');
  await new Promise(r => setTimeout(r, 1200));

  // opening moves a real player makes
  await page.click('#buy-indexes');
  await fastForward(page, 40);
  await page.click('#buy-pooler');
  await new Promise(r => setTimeout(r, 800));
  await dismissModals(page);
  await page.screenshot({ path: path.join(__dirname, 'screenshot-early.png') });

  // mid/late game: cheat cash, build everything sensible, fast-forward
  await page.evaluate(() => window.HUG.cheat(5000000));
  const buys = ['cache', 'cache', 'cache', 'cache', 'kv', 'kv', 'kv',
    'tier', 'tier', 'tier', 'tier', 'tier', 'replica', 'warehouse', 'queue',
    'shard', 'shard', 'shard'];
  for (const b of buys) {
    await page.evaluate(k => Engine.buy(window.HUG.getState(), k), b);
  }
  await fastForward(page, 200);
  await fastForward(page, 200);
  await dismissModals(page);
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(__dirname, 'screenshot-late.png') });

  // the crib sheet drawer
  await page.click('#btn-insights');
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(__dirname, 'screenshot-insights.png') });

  const stats = await page.evaluate(() => {
    const s = window.HUG.getState();
    return {
      t: s.t, served: s.report.servedRps, outcome: s.outcome,
      insights: Object.keys(s.insights).length,
    };
  });
  await browser.close();

  console.log('sim t=' + stats.t.toFixed(0) + 's served=' + stats.served.toFixed(0) +
    ' rps outcome=' + stats.outcome + ' insights=' + stats.insights);
  if (errors.length) {
    console.log('PAGE ERRORS:\n' + errors.join('\n'));
    process.exit(1);
  }
  console.log('screenshots saved, no page errors');
})();
