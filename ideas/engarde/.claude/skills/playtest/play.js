// A CLI hand on the real game: one command per invocation, state persists in
// the browser profile's localStorage between runs. Usage:
//   node play.js boot | reroll | begin [name] | look | shot <file> | advice
//   node play.js join-club <id> | join-regiment <id> <rankIndex>
//   node play.js plan <w0> <w1> <w2> <w3>   (action or action:param, e.g. court:lady3 pref:title:0 gamble:20x5)
//   node play.js month | volunteer | affair <i> <response> | js '<expr>'
const { chromium } = require('playwright-core');
const os = require('os');
const EXE = os.homedir() + '/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell';
const PROFILE = __dirname + '/profile';
const URL = 'file:///work/yuwakisaweb/ideas/engarde/index.html';

function gazetteText(n) {
  return `(() => {
    const entries = Array.from(document.querySelectorAll('#gazette .entry')).slice(0, ${n});
    return entries.map(e => e.innerText).join('\\n---\\n');
  })()`;
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    executablePath: EXE, headless: true, viewport: { width: 1360, height: 940 },
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('dialog', d => d.accept()); // confirm() dialogs: always proceed
  await page.goto(URL);
  await page.waitForTimeout(150);

  const say = s => console.log(s);
  const bodyBrief = async () => {
    const txt = await page.evaluate(() => document.getElementById('char-panel') ?
      document.getElementById('char-panel').innerText : document.body.innerText.slice(0, 600));
    say(txt);
  };

  async function setPlan(specs) {
    for (let w = 0; w < 4; w++) {
      const spec = (specs[w] || 'idle').split(':');
      const action = spec[0] === 'pref' ? 'preferment' : spec[0];
      await page.selectOption('.week-action[data-week="' + w + '"]', action);
      await page.dispatchEvent('.week-action[data-week="' + w + '"]', 'change');
      await page.waitForTimeout(50);
      if (action === 'court') await page.selectOption('.p-lady[data-week="' + w + '"]', spec[1]);
      if (action === 'toady') await page.selectOption('.p-npc[data-week="' + w + '"]', spec[1]);
      if (action === 'preferment') await page.selectOption('.p-pref[data-week="' + w + '"]', spec.slice(1).join(':'));
      if (action === 'gamble') {
        const m = spec[1].match(/(\d+)x(\d+)/);
        await page.fill('.p-stake[data-week="' + w + '"]', m[1]);
        await page.fill('.p-bets[data-week="' + w + '"]', m[2]);
      }
      if (spec[1] !== undefined) await page.dispatchEvent('#planner', 'change');
    }
    await page.waitForTimeout(100);
  }

  if (cmd === 'boot') {
    await page.evaluate(() => { localStorage.clear(); });
    await page.reload();
    await page.waitForTimeout(150);
    say('build: ' + await page.textContent('#build-tag'));
    say(await page.evaluate(() => document.getElementById('chargen-overlay').innerText));
  } else if (cmd === 'reroll') {
    await page.click('#chargen-reroll');
    say(await page.evaluate(() => document.getElementById('chargen-overlay').innerText));
  } else if (cmd === 'begin') {
    if (args[0]) await page.fill('#chargen-name', args.join(' '));
    await page.click('#chargen-begin');
    await page.waitForTimeout(100);
    say(await page.evaluate(() => document.body.innerText.split('Live the Month')[0]));
  } else if (cmd === 'look') {
    say(await page.evaluate(() => document.body.innerText));
  } else if (cmd === 'shot') {
    await page.screenshot({ path: __dirname + '/' + (args[0] || 'shot.png'), fullPage: true });
    say('saved ' + (args[0] || 'shot.png'));
  } else if (cmd === 'advice') {
    await page.click('#ask-advice');
    await page.waitForTimeout(100);
    say(await page.evaluate(gazetteText(1)));
  } else if (cmd === 'join-club') {
    await page.selectOption('#club-select', args[0]);
    await page.click('#club-join');
    say(await page.evaluate(gazetteText(1)));
  } else if (cmd === 'join-regiment') {
    await page.selectOption('#regiment-select', args[0]);
    await page.dispatchEvent('#regiment-select', 'change');
    if (args[1] !== undefined) await page.selectOption('#rank-select', args[1]);
    await page.click('#regiment-apply');
    say(await page.evaluate(gazetteText(1)));
  } else if (cmd === 'plan') {
    for (let w = 0; w < 4; w++) {
      const spec = (args[w] || 'idle').split(':');
      const action = spec[0] === 'pref' ? 'preferment' : spec[0];
      await page.selectOption('.week-action[data-week="' + w + '"]', action);
      await page.dispatchEvent('.week-action[data-week="' + w + '"]', 'change');
      await page.waitForTimeout(50);
      if (action === 'court') await page.selectOption('.p-lady[data-week="' + w + '"]', spec[1]);
      if (action === 'toady') await page.selectOption('.p-npc[data-week="' + w + '"]', spec[1]);
      if (action === 'preferment') await page.selectOption('.p-pref[data-week="' + w + '"]', spec.slice(1).join(':'));
      if (action === 'gamble') {
        const m = spec[1].match(/(\d+)x(\d+)/);
        await page.fill('.p-stake[data-week="' + w + '"]', m[1]);
        await page.fill('.p-bets[data-week="' + w + '"]', m[2]);
      }
      if (spec[1] !== undefined) await page.dispatchEvent('#planner', 'change');
    }
    await page.waitForTimeout(100);
    say('--- STATUS FORECAST ---');
    say(await page.evaluate(() => document.getElementById('status-panel').innerText));
    say('--- LEDGER FORECAST ---');
    say(await page.evaluate(() => document.getElementById('ledger-panel').innerText));
  } else if (cmd === 'month') {
    if (args.length > 0) {
      await setPlan(args);
      console.log('--- forecast: ' + (await page.evaluate(() => document.getElementById('status-panel').innerText)).split('\n').filter(l => l.indexOf('If all') >= 0 || l.indexOf('+') >= 0).join(' · '));
      console.log('--- ledger: ' + (await page.evaluate(() => document.getElementById('ledger-panel').innerText)).split('\n').slice(-4).join(' '));
    }
    await page.click('#live-month');
    await page.waitForTimeout(200);
    const dead = await page.evaluate(() => game.character.dead);
    const camp = await page.evaluate(() => !document.getElementById('campaign-overlay').classList.contains('hidden'));
    if (camp) {
      say('=== CAMPAIGN ===');
      say(await page.evaluate(() => document.getElementById('campaign-overlay').innerText));
      await page.click('#campaign-return');
      await page.waitForTimeout(100);
    }
    say(await page.evaluate(gazetteText(2)));
    say('--- errors: ' + (await page.evaluate(() => document.getElementById('plan-errors').innerText) || 'none'));
    if (dead) say('*** YOU ARE DEAD ***');
  } else if (cmd === 'volunteer') {
    await page.click('#volunteer');
    await page.waitForTimeout(200);
    say(await page.evaluate(() => document.getElementById('campaign-overlay').innerText));
    await page.click('#campaign-return');
  } else if (cmd === 'affair') {
    await page.click('[data-affair="' + args[0] + '"][data-response="' + args[1] + '"]');
    await page.waitForTimeout(100);
    say(await page.evaluate(gazetteText(1)));
  } else if (cmd === 'js') {
    say(JSON.stringify(await page.evaluate(args.join(' ')), null, 1));
  } else {
    say('unknown command: ' + cmd);
  }

  if (errors.length > 0) say('!!! ' + errors.join('\n!!! '));
  await ctx.close();
}

main().catch(e => { console.error('DRIVER FAILURE', e.message); process.exit(1); });
