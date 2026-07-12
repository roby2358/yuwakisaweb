'use strict';

// Headless test runner: loads the classic-script files into one VM context
// (no DOM needed — the engine and state modules are DOM-free) and runs tests.

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var context = vm.createContext({ console: console });

['../js/artifacts.js', '../js/state.js', '../js/engine.js', 'tests.js'].forEach(function (rel) {
  var file = path.join(__dirname, rel);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
});

var results = vm.runInContext('GameTests.run()', context);
var failed = 0;
results.forEach(function (r) {
  if (!r.ok) failed += 1;
  console.log((r.ok ? 'PASS' : 'FAIL') + ' — ' + r.label);
});
console.log((results.length - failed) + ' / ' + results.length + ' passed');
process.exit(failed === 0 ? 0 : 1);
