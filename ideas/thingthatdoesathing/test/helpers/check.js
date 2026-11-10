// test/helpers/check.js — the tiny assertion harness every test file uses.
//
//   const { check, done } = require('../helpers/check');
//   check('label', condition);
//   done();   // prints the tally and exits 1 if anything failed
'use strict';

let failures = 0;

function check(label, cond) {
    if (cond) { console.log('  ok   ' + label); return; }
    console.log('  FAIL ' + label);
    failures++;
}

function done() {
    process.exit(failures === 0 ? 0 : 1);
}

module.exports = { check, done };
