// R-19: after newGame, player and target are Pieces labeled 'P' / '★' with color null;
// engine.board is a Board wrapping the same Map as state.hexes; a move mutates the
// existing player Piece in place.
'use strict';
const { newGame } = require('../helpers/load');
const { check, done } = require('../helpers/check');

const { g, state, engine } = newGame(12345);
check("player is a Piece labeled 'P' with color null",
    state.player instanceof g.Piece && state.player.label === 'P' && state.player.color === null);
check("target is a Piece labeled '★' with color null",
    state.target instanceof g.Piece && state.target.label === '★' && state.target.color === null);
check('engine.board is a Board', engine.board instanceof g.Board);
check('board wraps the same Map as state.hexes', engine.board.hexes === state.hexes);

const player = state.player;
const [key] = engine.computeReachable().keys();
const { q, r } = g.Hex.fromKey(key);
engine.movePlayer(q, r);
check('moving mutates the same player Piece in place', state.player === player && player.isAt(q, r));

engine.newGame(54321);
check('board is rebuilt with the new map', engine.board.hexes === state.hexes);
done();
