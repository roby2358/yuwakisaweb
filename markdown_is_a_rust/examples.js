// examples.js — featured programs, ordered simplest -> most involved.
// Accepted programs run; rejected ones demonstrate a specific checker diagnostic.

(function (global) {
  'use strict';

  var EXAMPLES = [
    {
      name: 'arithmetic',
      note: 'Accepted — immutable bindings, operators, print.',
      code:
'# main\n' +
'* let x\n' +
'  * + `2` `3`\n' +
'* let y\n' +
'  * * x `4`\n' +
'* print y\n'
    },
    {
      name: 'factorial',
      note: 'Accepted — repetition is recursion; the base case stops it.',
      code:
'# fn factorial\n' +
'* params\n' +
'  * i64 n\n' +
'* returns i64\n' +
'* if\n' +
'  * <= n `1`\n' +
'  * `1`\n' +
'  * * n\n' +
'    * factorial\n' +
'      * - n `1`\n' +
'\n' +
'# main\n' +
'* print\n' +
'  * factorial `5`\n'
    },
    {
      name: 'accepted borrow',
      note: 'Accepted — v is mutated BEFORE it is borrowed, so no borrow is live.',
      code:
'# main\n' +
'* let mut v\n' +
'  * vec `1` `2` `3`\n' +
'* push v `4`\n' +
'* let r\n' +
'  * & v\n' +
'* print r\n'
    },
    {
      name: 'borrow conflict (litmus)',
      note: 'REJECTED — v is mutated by push while r still borrows it.',
      code:
'# main\n' +
'* let mut v\n' +
'  * vec `1` `2` `3`\n' +
'* let r\n' +
'  * & v\n' +
'* push v `4`\n' +
'* print r\n'
    },
    {
      name: 'use after move',
      note: 'REJECTED — take consumes s by value; s cannot be used afterward.',
      code:
'# fn take\n' +
'* params\n' +
'  * String s\n' +
'* print s\n' +
'\n' +
'# main\n' +
'* let s\n' +
'  * `"hello"`\n' +
'* take s\n' +
'* print s\n'
    },
    {
      name: 'mutate immutable',
      note: 'REJECTED — v is not declared mut, so it cannot be pushed to.',
      code:
'# main\n' +
'* let v\n' +
'  * vec `1` `2` `3`\n' +
'* push v `4`\n'
    },
    {
      name: 'dangling reference',
      note: 'REJECTED — dangle returns a reference to its own local x.',
      code:
'# fn dangle\n' +
'* returns & i64\n' +
'* let x\n' +
'  * `5`\n' +
'* & x\n' +
'\n' +
'# main\n' +
'* print\n' +
'  * dangle\n'
    },
    {
      name: 'struct (fields)',
      note: 'Accepted — build a Point, read its Copy fields with the `.` operator. Fields share a type via `i64 x y`.',
      code:
'# struct Point\n' +
'* i64 x y\n' +
'\n' +
'# main\n' +
'* let p\n' +
'  * Point `2` `3`\n' +
'* print\n' +
'  * +\n' +
'    * . p x\n' +
'    * . p y\n'
    },
    {
      name: 'partial move',
      note: 'REJECTED — moving the String field out of p leaves p.name moved; reading it again is use-after-move.',
      code:
'# struct User\n' +
'* String name\n' +
'* i64 age\n' +
'\n' +
'# main\n' +
'* let u\n' +
'  * User `"ada"` `36`\n' +
'* let n\n' +
'  * . u name\n' +
'* print\n' +
'  * . u name\n'
    },
    {
      name: 'match (Option)',
      note: 'Accepted — an exhaustive match over Option binds the Some payload.',
      code:
'# enum Option\n' +
'* Some\n' +
'  * i64\n' +
'* None\n' +
'\n' +
'# main\n' +
'* let o\n' +
'  * Some `7`\n' +
'* match o\n' +
'  * Some n\n' +
'    * print n\n' +
'  * None\n' +
'    * print `0`\n'
    },
    {
      name: 'non-exhaustive match',
      note: 'REJECTED — the match omits None and has no wildcard arm.',
      code:
'# enum Option\n' +
'* Some\n' +
'  * i64\n' +
'* None\n' +
'\n' +
'# main\n' +
'* let o\n' +
'  * Some `7`\n' +
'* match o\n' +
'  * Some n\n' +
'    * print n\n'
    }
  ];

  global.MIAR = global.MIAR || {};
  global.MIAR.EXAMPLES = EXAMPLES;
})(typeof globalThis !== 'undefined' ? globalThis : this);
