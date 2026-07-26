// Print the component observability probes as text, for eyeballing the panels
// without a browser. Useful whenever you change what a component reports.
//
//   node test/probes.js            # all components, mid-game SaaS board
//   node test/probes.js sql cache  # only these
//   node test/probes.js --profile iot

'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..');
const ctx = vm.createContext({});
for (const f of ['format.js', 'flourish.js', 'content.js', 'memos.js', 'engine.js', 'guru.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
// ui.js only touches the DOM inside functions, so it loads fine headless
vm.runInContext('var document = undefined, window = undefined;', ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'ui.js'), 'utf8'), ctx, { filename: 'ui.js' });

const argv = process.argv.slice(2);
const profileAt = argv.indexOf('--profile');
const profile = profileAt >= 0 ? argv[profileAt + 1] : 'saas';
const wanted = argv.filter((a, i) =>
  !a.startsWith('--') && !(profileAt >= 0 && i === profileAt + 1));

// A built-out mid-game board: enough architecture that every probe has content.
const board = vm.runInContext(`
  (() => {
    const s = Engine.createState(11);
    Engine.applyProfile(s, ${JSON.stringify(profile)});
    s.cash = 1e6;
    Engine.buy(s, 'indexes'); Engine.buy(s, 'pooler');
    for (let i = 0; i < 4; i++) Engine.buy(s, 'tier');
    Engine.buy(s, 'shard'); s.migration = null;
    Engine.buy(s, 'shard'); s.migration = null;
    Engine.buy(s, 'replica');
    Engine.buy(s, 'cache'); Engine.buy(s, 'cache'); Engine.buy(s, 'cache');
    Engine.buy(s, 'kv'); Engine.buy(s, 'warehouse'); Engine.buy(s, 'queue');
    s.users = 300000;
    for (let i = 0; i < 80; i++) Engine.tick(s);
    const keys = ${JSON.stringify(wanted)};
    const use = keys.length ? keys : Object.keys(UI.probes);
    return use.map(k => ({ key: k, data: UI.probes[k](s, s.report) }));
  })()
`, ctx);

const wrap = (text, width, indent) => {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > width) { lines.push(line.trim()); line = w; }
    else line += ' ' + w;
  }
  if (line.trim()) lines.push(line.trim());
  return lines.map(l => indent + l).join('\n');
};

console.log('workload profile: ' + profile + '\n');
for (const { key, data } of board) {
  console.log('┌─ ' + data.title + '  [' + key + ']');
  console.log('│  ' + data.sub);
  for (const [label, rows] of data.secs) {
    console.log('│');
    console.log('│  ' + label);
    for (const [k, v] of rows) {
      console.log('│    ' + k.padEnd(26) + String(v).padStart(18));
    }
  }
  console.log('│');
  console.log(wrap(data.note, 72, '│  '));
  console.log('└' + '─'.repeat(74) + '\n');
}
