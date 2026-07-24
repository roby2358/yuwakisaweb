// Browser verification for Dustrunner: loads index.html headlessly, plays a few
// real interactions through the DOM (dismiss intro, select the player, mount toggle,
// end a few days, open the starport panel), fails on any page error, and saves
// screenshots next to this script for eyeballing.
//
// Requires puppeteer on the module path (`npm install puppeteer --no-save`).
// Run: node test/screenshot.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');

// Use any cached headless shell rather than demanding puppeteer's pinned version
// (this sandbox can't always download a new one).
function findChrome() {
    if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
    const base = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome-headless-shell');
    try {
        for (const ver of fs.readdirSync(base)) {
            const p = path.join(base, ver, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
            if (fs.existsSync(p)) return p;
        }
    } catch (e) { /* fall through to puppeteer's default resolution */ }
    return undefined;
}

const PAGE_URL = 'file://' + path.join(__dirname, '..', 'index.html');
const SHOT_MAP = path.join(__dirname, 'screenshot.png');
const SHOT_PANEL = path.join(__dirname, 'screenshot-starport.png');

async function main() {
    const browser = await puppeteer.launch({
        headless: 'shell',
        executablePath: findChrome(),
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', msg => {
        if (msg.type() === 'error') errors.push('console: ' + msg.text());
    });

    await page.goto(PAGE_URL, { waitUntil: 'load' });
    await page.waitForSelector('#intro-panel:not(.hidden)');
    await page.click('#begin-btn');

    // Player starts mounted at the starport, centered: click to select, expect
    // yellow highlights (selection state), then click the player again to deselect.
    await page.mouse.click(640, 400);
    const selected = await page.evaluate(() => !!window.ui.selection);
    if (!selected) errors.push('clicking the player did not select it');
    await page.mouse.click(640, 400);

    // Mount toggle + a few end-days through the real buttons.
    await page.click('#mount-btn');
    await page.click('#mount-btn');
    for (let i = 0; i < 5; i++) await page.click('#end-day');
    const day = await page.evaluate(() => window.ui.state.day);
    if (day !== 6) errors.push(`expected day 6 after 5 end-days, got ${day}`);

    // Autosave should exist and reload into the same day.
    const saved = await page.evaluate(() => !!localStorage.getItem('dustrunner-save'));
    if (!saved) errors.push('no autosave in localStorage');
    await page.reload({ waitUntil: 'load' });
    const day2 = await page.evaluate(() => window.ui.state.day);
    if (day2 !== 6) errors.push(`reload lost the save: day ${day2}`);
    const introAgain = await page.$eval('#intro-panel', el => !el.classList.contains('hidden'));
    if (introAgain) errors.push('intro panel reappeared on a resumed game');

    await page.screenshot({ path: SHOT_MAP });

    // Open the starport location panel via the primary action (player is on it).
    await page.evaluate(() => window.ui.primaryAction());
    await page.waitForSelector('#location-panel:not(.hidden)');
    const panelText = await page.$eval('#location-panel', el => el.textContent);
    if (!panelText.includes('Workshop')) errors.push('starport panel missing Workshop');
    if (!panelText.includes('Offworld Ticket')) errors.push('starport panel missing ticket');
    await page.screenshot({ path: SHOT_PANEL });

    await browser.close();
    if (errors.length) {
        console.error('FAILURES:');
        for (const e of errors) console.error(' - ' + e);
        process.exit(1);
    }
    console.log('browser smoke: ok — screenshots saved');
}

main().catch(e => { console.error(e); process.exit(1); });
