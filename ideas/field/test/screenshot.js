// Browser verification for the field prototype: renders index.html
// headlessly, exercises every field mode x color mode, the ball buttons,
// the randomize button, and the real export path, then saves a screenshot
// next to this script for eyeballing.
//
// Requires puppeteer on the module path. Either `npm install puppeteer`
// or point NODE_PATH at an existing install:
//   NODE_PATH=/path/to/node_modules node test/screenshot.js
'use strict';
const path = require('path');
const puppeteer = require('puppeteer');

const PAGE_URL = 'file://' + path.join(__dirname, '..', 'index.html');
const SHOT_PATH = path.join(__dirname, 'screenshot.png');
const BALLS_SHOT_PATH = path.join(__dirname, 'screenshot-balls.png');

const FIELD_MODES = ['angle', 'gradient', 'curl'];
const COLOR_MODES = ['none', 'direction', 'magnitude'];
const EXPORT_SCALE = 2;
const BALL_COUNT = 5;

async function main() {
    const browser = await puppeteer.launch({
        headless: 'shell',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewport({ width: 1500, height: 900 });
    await page.goto(PAGE_URL);
    await page.waitForSelector('#field-canvas');

    for (const mode of FIELD_MODES) {
        for (const colorMode of COLOR_MODES) {
            await page.evaluate((m, c) => {
                document.getElementById('ctl-mode').value = m;
                document.getElementById('ctl-color-mode').value = c;
            }, mode, colorMode);
            await page.click('#btn-regenerate');
        }
    }
    await page.click('#btn-randomize');

    // Drive the real export code path (minus the download click).
    const exported = await page.evaluate((scale) => {
        const params = fieldApp.scaleParams(fieldApp.readParams(), scale);
        const off = document.createElement('canvas');
        fieldApp.renderToCanvas(off, params);
        return {
            width: off.width,
            height: off.height,
            dataLength: off.toDataURL('image/png').length,
        };
    }, EXPORT_SCALE);

    // Reset to defaults, then drop balls and let them fly for a bit.
    await page.evaluate(() => {
        document.getElementById('ctl-mode').value = 'curl';
        document.getElementById('ctl-color-mode').value = 'none';
        document.getElementById('ctl-seed').value = '42';
    });
    await page.click('#btn-regenerate');

    for (let i = 0; i < BALL_COUNT; i++) {
        await page.click('#btn-drop-ball');
    }
    await new Promise((r) => setTimeout(r, 1500));

    const midFlight = await page.evaluate(() => {
        const params = fieldApp.readParams();
        return {
            count: fieldApp.getBalls().length,
            allInBounds: fieldApp.getBalls().every(
                (b) => b.x >= 0 && b.x <= params.width && b.y >= 0 && b.y <= params.height
            ),
            allFinite: fieldApp.getBalls().every(
                (b) => [b.x, b.y, b.vx, b.vy].every(Number.isFinite)
            ),
        };
    });
    await page.screenshot({ path: BALLS_SHOT_PATH });

    await page.click('#btn-remove-all');
    await new Promise((r) => setTimeout(r, 100));
    const afterRemoveAll = await page.evaluate(() => fieldApp.getBalls().length);

    // Reference screenshot with no balls, for comparison.
    await page.screenshot({ path: SHOT_PATH });
    await browser.close();

    const failures = [];
    if (errors.length > 0) failures.push(`console/page errors: ${JSON.stringify(errors)}`);
    if (exported.width !== 1200 * EXPORT_SCALE || exported.height !== 700 * EXPORT_SCALE) {
        failures.push(`export canvas is ${exported.width}x${exported.height}, expected ${1200 * EXPORT_SCALE}x${700 * EXPORT_SCALE}`);
    }
    if (exported.dataLength < 100_000) {
        failures.push(`export PNG suspiciously small: ${exported.dataLength} chars`);
    }
    if (midFlight.count !== BALL_COUNT) {
        failures.push(`expected ${BALL_COUNT} balls in flight, got ${midFlight.count}`);
    }
    if (!midFlight.allInBounds) failures.push('a ball left the canvas bounds mid-flight');
    if (!midFlight.allFinite) failures.push('a ball had a non-finite position/velocity mid-flight');
    if (afterRemoveAll !== 0) failures.push(`Remove all left ${afterRemoveAll} balls`);

    if (failures.length > 0) {
        for (const f of failures) console.log(`FAIL ${f}`);
        process.exitCode = 1;
        return;
    }
    console.log(`PASS all modes rendered without errors, export ${exported.width}x${exported.height} (${exported.dataLength} chars)`);
    console.log(`PASS ${BALL_COUNT} balls flew in bounds, Remove all cleared them`);
    console.log(`screenshots: ${SHOT_PATH}, ${BALLS_SHOT_PATH}`);
}

main();
