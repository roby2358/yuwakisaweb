const assert = require('node:assert/strict');
const { extractTweetBodies } = require('../../markov/js/tweet-cleaner');

const sampleInput = [
    '\u202ABluesky Safety\u202C',
    '',
    '\u202A@safety.bsky.app\u202C',
    '',
    '· 5h',
    '',
    'CORRECTION: The post was made on Oct 10. Due to a backlog in cases, our mod team didn’t review and take action until Nov 11, which is when we engaged with the account owner about the reason for suspension.',
    '',
    '151',
    '',
    '121',
    '',
    '\u202AKyrie Zebul | 🔞 | NSFWish\u202C',
    '',
    '\u202A@kyriezebul.bsky.social\u202C',
    '',
    '· 5h',
    '',
    'Still kind of sus that you do this when you feel it\'s justified, but you won\'t speak about Link\'s ban or the grievances against grifters like Jesse Singal or any of the GOP White House accounts.',
    '',
    '3',
    '',
    '8',
    '',
    '\u202Adaanis\u202C',
    '',
    '\u202A@daanis.ca\u202C',
    '',
    '· 4h',
    '',
    'Link was one of the reasons I stayed in the early days.',
    '',
    'Replying to @friend about updates.'
].join('\n');

const expectedOutput = [
    'CORRECTION: The post was made on Oct 10. Due to a backlog in cases, our mod team didn’t review and take action until Nov 11, which is when we engaged with the account owner about the reason for suspension.',
    '',
    'Still kind of sus that you do this when you feel it\'s justified, but you won\'t speak about Link\'s ban or the grievances against grifters like Jesse Singal or any of the GOP White House accounts.',
    '',
    'Link was one of the reasons I stayed in the early days.',
    '',
    'Replying to @friend about updates.'
].join('\n');

const cleaned = extractTweetBodies(sampleInput);

assert.equal(
    cleaned,
    expectedOutput,
    'extractTweetBodies should remove tweet headers and keep tweet text'
);

console.log('extractTweetBodies tests passed');

