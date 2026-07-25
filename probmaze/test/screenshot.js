"use strict";

// Browser verification: loads index.html headlessly, plays real turns through
// the UI (Roll button clicks + canvas clicks on highlighted targets), fails on
// any page error, and saves screenshots next to this script for eyeballing.
//
// Requires puppeteer on the module path, e.g.:
//   NODE_PATH=/work/yuwakisaweb/ideas/alienbadlands/node_modules node test/screenshot.js
const fs = require("fs");
const os = require("os");
const path = require("path");
const puppeteer = require("puppeteer");

// Use any cached headless shell rather than demanding puppeteer's pinned
// version (this sandbox can't always download a new one).
function findChrome() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const base = path.join(os.homedir(), ".cache", "puppeteer", "chrome-headless-shell");
  try {
    for (const ver of fs.readdirSync(base)) {
      const p = path.join(base, ver, "chrome-headless-shell-linux64", "chrome-headless-shell");
      if (fs.existsSync(p)) return p;
    }
  } catch (e) { /* fall through to puppeteer's default resolution */ }
  return undefined;
}

const PAGE_URL = "file://" + path.join(__dirname, "..", "index.html");
const SHOT_START = path.join(__dirname, "screenshot.png");
const SHOT_MID = path.join(__dirname, "screenshot-midgame.png");
const MAX_TURNS = 60;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const errors = [];
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1240, height: 720 });
  page.on("pageerror", err => errors.push("pageerror: " + err.message));
  page.on("console", msg => {
    if (msg.type() === "error") errors.push("console: " + msg.text());
  });

  await page.goto(PAGE_URL);
  await sleep(200);
  await page.screenshot({ path: SHOT_START });

  let turns = 0;
  for (; turns < MAX_TURNS; turns++) {
    const phase = await page.evaluate(() => run.phase);
    if (phase === "won") break;
    if (phase === "idle") {
      await page.click("#roll");
      await sleep(650); // roll flicker is 8 x 60ms
      continue;
    }
    // phase "move": click the target that gains the most ground toward the exit
    const target = await page.evaluate(() => {
      const rect = document.getElementById("board").getBoundingClientRect();
      const end = run.maze.nodes[run.maze.end];
      const moves = usableMoves(run).map(m => run.maze.nodes[m.other]);
      moves.sort((p, q) => Math.hypot(p.x - end.x, p.y - end.y) - Math.hypot(q.x - end.x, q.y - end.y));
      return { x: rect.left + moves[0].x, y: rect.top + moves[0].y };
    });
    await page.mouse.click(target.x, target.y);
    await sleep(50);
    if (turns === 6) await page.screenshot({ path: SHOT_MID });
  }

  const state = await page.evaluate(() => ({
    phase: run.phase,
    rolls: run.rolls,
    current: run.current,
    start: run.maze.start,
    par: run.maze.par,
    rollsShown: document.getElementById("rolls").textContent,
    message: document.getElementById("message").textContent,
  }));
  if (state.phase !== "won") await page.screenshot({ path: SHOT_MID });
  await browser.close();

  let failures = 0;
  function check(label, ok) {
    if (!ok) failures += 1;
    console.log((ok ? "ok   " : "FAIL ") + label);
  }
  check("no page errors" + (errors.length ? ": " + errors.join(" | ") : ""), errors.length === 0);
  check("rolled at least once (rolls " + state.rolls + ")", state.rolls > 0);
  check("moved off the start node", state.current !== state.start);
  check("rolls counter in DOM matches state", state.rollsShown === String(state.rolls));
  check("message shown: \"" + state.message + "\"", state.message.length > 0);
  console.log((state.phase === "won" ? "won in " : "still playing after ") +
    state.rolls + " rolls (par " + state.par + "), screenshots saved");
  process.exit(failures ? 1 : 0);
})();
