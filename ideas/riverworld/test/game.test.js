const test = require('node:test');
const assert = require('node:assert');
const { loadLogic, calmGame, freeStones, TEST_LEADER } = require('./helpers');

function fresh(seed) {
  const ctx = loadLogic();
  const S = calmGame(ctx, seed);
  return { ctx, S, Game: ctx.Game, Data: ctx.Data, Hex: ctx.Hex };
}

function teleport(Game, unit, c, r) {
  unit.c = c; unit.r = r;
  Game.updateFog();
}

function fakeSlaver(S, c, r, hp, atk) {
  const s = {
    id: S.nextId++, side: 'slaver', hero: null, name: 'Test Slaver', glyph: '🗡️',
    c, r, hp, maxHp: hp, atk, mp: 2, mpLeft: 2, sight: 5, acted: false,
    hunger: 0, aboard: false, buzz: false, home: null, captain: false, gang: false, targetId: null,
  };
  S.units.push(s);
  return s;
}

test('the leader carries the entered name; the role stays keyed to the hero id', () => {
  const { Game, Data } = fresh(4);
  const leader = Game.byHero('burton');
  assert.strictEqual(leader.name, TEST_LEADER);
  assert.strictEqual(leader.sight, Data.HEROES.burton.sight, 'explorer sight intact under any name');
});

test('a party fed at the gong resets hunger and gains grail goods', () => {
  const { S, Game } = fresh(5);
  const burton = Game.byHero('burton');
  const stone = freeStones({}, S)[0];
  teleport(Game, burton, stone.c, stone.r);
  burton.hunger = 10;
  S.gongIn = 1;
  const before = Object.values(S.inventory.items).reduce((a, b) => a + b, 0);
  Game.endTurn();
  assert.strictEqual(burton.hunger, 0, 'the gong feeds');
  const after = Object.values(S.inventory.items).reduce((a, b) => a + b, 0);
  assert.ok(after > before, 'the grail yields something');
});

test('missing the gong means hunger keeps climbing, then starvation bites', () => {
  const { S, Game } = fresh(6);
  const burton = Game.byHero('burton');
  teleport(Game, burton, burton.c, burton.r - 3); // away from any stone
  burton.hunger = S.gongIn = 999; // no gong soon
  S.gongIn = 5;
  burton.hunger = 23;
  const hpBefore = burton.hp;
  Game.endTurn(); // hunger -> 24: starving
  assert.strictEqual(burton.hp, hpBefore - 1);
});

test('combat kills, counters, and Cyrano is never touched', () => {
  const { S, Game, Data } = fresh(7);
  const burton = Game.byHero('burton');
  const foe = fakeSlaver(S, burton.c, burton.r - 1, 10, 3);
  Game.attack(burton.id, foe.id);
  assert.strictEqual(foe.hp, 10 - burton.atk);
  assert.strictEqual(burton.hp, Data.HEROES.burton.hp - 2, 'counter = atk-1, min 1');

  const cyrano = { ...burton, id: S.nextId++, hero: 'cyrano', name: 'Cyrano', atk: 3, hp: 6, maxHp: 6, acted: false };
  S.units.push(cyrano);
  const hpBefore = cyrano.hp;
  Game.attack(cyrano.id, foe.id);
  assert.strictEqual(cyrano.hp, hpBefore, 'the fencer takes no counter');
});

test('killing a captain frees the stone and yields the hoard', () => {
  const ctx = loadLogic();
  const Game = ctx.Game;
  const S = Game.newGame(3, TEST_LEADER);
  const slaverStone = S.stones.find(st => S.tiles[st.r][st.c].stone.slaver);
  assert.ok(slaverStone, 'seed 3 has a slaver stone');
  const tile = S.tiles[slaverStone.r][slaverStone.c];
  const captain = Game.byId(tile.stone.captainId);
  captain.hp = 1;
  const burton = Game.byHero('burton');
  const spot = ctx.Hex.neighbors(captain.c, captain.r).find(n => !Game.occupant(n.c, n.r));
  teleport(Game, burton, spot.c, spot.r);
  const before = Object.values(S.inventory.items).reduce((a, b) => a + b, 0);
  Game.attack(burton.id, captain.id);
  assert.strictEqual(tile.stone.slaver, false, 'the stone is free');
  assert.ok(tile.stone.rich, 'and stays rich');
  const after = Object.values(S.inventory.items).reduce((a, b) => a + b, 0);
  assert.strictEqual(after, before + 3, 'three grail goods from the hoard');
});

test('the Suicide Express costs half the hoard — and never ends the run', () => {
  const { S, Game } = fresh(9);
  S.inventory.items.ration = 4;
  Game.suicide();
  assert.strictEqual(S.deaths, 1);
  assert.strictEqual(S.inventory.items.ration, 2, 'half the hoard left behind');
  const burton = Game.byHero('burton');
  assert.strictEqual(burton.hp, burton.maxHp, 'fresh body');
  assert.strictEqual(burton.hunger, 0);
  for (let i = 0; i < 5; i++) Game.suicide();
  assert.strictEqual(S.deaths, 6);
  assert.strictEqual(S.over, null, 'the River always gives Burton back');
});

test('famine weakens but never kills: HP floors at 1, MP and ATK drop', () => {
  const { S, Game, Data } = fresh(14);
  const burton = Game.byHero('burton');
  teleport(Game, burton, burton.c, burton.r - 3); // away from any stone
  S.gongIn = 500;
  burton.hunger = Data.CONFIG.STARVE_AT + 1;
  burton.hp = 2;
  Game.endTurn();
  assert.strictEqual(burton.hp, 1, 'famine drains');
  Game.endTurn();
  Game.endTurn();
  assert.strictEqual(burton.hp, 1, '…but only to the floor — never death');
  assert.strictEqual(Game.famished(burton), true);
  assert.strictEqual(burton.mpLeft, burton.mp - Data.CONFIG.FAMISH_MP, 'famished crawl');
  assert.strictEqual(Game.atkOf(burton), Math.max(1, burton.atk - Data.CONFIG.FAMISH_ATK), 'famished swing');
  S.inventory.items.ration = 1;
  Game.useItem('ration', burton.id);
  assert.strictEqual(Game.famished(burton), false, 'one meal restores everything');
});

test('serialize/load round-trips the pilgrimage into a fresh context', () => {
  const { S, Game } = fresh(15);
  const burton = Game.byHero('burton');
  S.inventory.items.ration = 3;
  Game.endTurn();
  const json = Game.serialize();

  const ctx2 = loadLogic();
  const S2 = ctx2.Game.load(json);
  assert.strictEqual(S2.turn, S.turn);
  assert.strictEqual(S2.deaths, S.deaths);
  assert.strictEqual(S2.inventory.items.ration, 3);
  const b2 = ctx2.Game.byHero('burton');
  assert.strictEqual(b2.name, TEST_LEADER, 'the chosen name survives the save');
  assert.strictEqual(b2.c, burton.c);
  assert.strictEqual(b2.r, burton.r);
  assert.ok(S2.visible.size > 0, 'fog recomputed on load');
  ctx2.Game.endTurn(); // and the loaded river keeps flowing
  assert.strictEqual(S2.turn, S.turn + 1);
});

test('rations reset hunger anywhere — the endgame currency works', () => {
  const { S, Game } = fresh(10);
  const burton = Game.byHero('burton');
  burton.hunger = 20;
  S.inventory.items.ration = 1;
  assert.strictEqual(Game.useItem('ration', burton.id), true);
  assert.strictEqual(burton.hunger, 0);
  assert.strictEqual(S.inventory.items.ration, 0);
  assert.strictEqual(Game.useItem('ration', burton.id), false, 'cannot eat what you lack');
});

test('gather + build raft + board: four bamboo become a road', () => {
  const { S, Game, Hex, Data } = fresh(11);
  const burton = Game.byHero('burton');
  // Put Burton on a bank hex beside water and force bamboo under his feet.
  const bank = findBankHex(S, Hex);
  teleport(Game, burton, bank.c, bank.r);
  S.tiles[bank.r][bank.c].terrain = 'bamboo';
  S.inventory.bamboo = Data.CONFIG.RAFT_BAMBOO - 1;
  assert.strictEqual(Game.gather(burton.id), true);
  assert.strictEqual(S.inventory.bamboo, Data.CONFIG.RAFT_BAMBOO);
  assert.strictEqual(S.tiles[bank.r][bank.c].terrain, 'grass', 'bamboo is spent from the map');
  burton.acted = false;
  assert.strictEqual(Game.buildRaft(burton.id), true);
  assert.ok(S.raft, 'a raft floats');
  assert.strictEqual(Game.boardRaft(burton.id), true);
  assert.strictEqual(burton.aboard, true);
  assert.strictEqual(S.raft.aboard.length, 1);
  assert.strictEqual(S.raft.aboard[0], burton.id);
});

test('the raft drifts downriver without Sam aboard', () => {
  const { S, Game, Hex } = fresh(12);
  const bank = findBankHex(S, Hex);
  const water = Hex.neighbors(bank.c, bank.r).find(n => S.tiles[n.r] && S.tiles[n.r][n.c].terrain === 'water');
  S.raft = { c: water.c, r: water.r, aboard: [], mpLeft: 0 };
  const rBefore = S.raft.r;
  Game.endTurn();
  assert.ok(S.raft.r >= rBefore, 'never drifts upriver');
});

test('press-gangs spawn once a stretch has fed you past the free meals', () => {
  const ctx = loadLogic();
  const Game = ctx.Game;
  const S = Game.newGame(3, TEST_LEADER);
  const stone = S.stones[0]; // free start stone
  const stretch = ctx.MapGen.stretchOf(stone.r);
  const burton = Game.byHero('burton');
  teleport(Game, burton, stone.c, stone.r);
  // Park every slaver far away so the enemy phase can't reach the test.
  for (const u of Game.slaverUnits()) { u.c = 1; u.r = 1; u.home = { c: 1, r: 1 }; }
  S.mealsInStretch[stretch] = ctx.Data.CONFIG.FREE_MEALS; // next meal tips it
  const gangsBefore = Game.slaverUnits().filter(u => u.gang).length;
  S.gongIn = 1;
  Game.endTurn();
  const gangsAfter = Game.slaverUnits().filter(u => u.gang).length;
  assert.ok(gangsAfter > gangsBefore, 'the state noticed all that eating');
});

function findBankHex(S, Hex) {
  for (let r = S.tiles.length - 2; r > 0; r--) {
    for (let c = 1; c < S.tiles[0].length - 1; c++) {
      if (S.tiles[r][c].terrain !== 'grass' && S.tiles[r][c].terrain !== 'bamboo') continue;
      const wet = Hex.neighbors(c, r).some(n => S.tiles[n.r] && S.tiles[n.r][n.c] && S.tiles[n.r][n.c].terrain === 'water');
      if (wet) return { c, r };
    }
  }
  throw new Error('no bank hex found');
}
