const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
for (const file of [
    'artifacts.js', 'rando.js', 'hex.js', 'piece.js',
    'domain.js', 'board.js', 'gamestate.js', 'gameengine.js'
]) {
    vm.runInThisContext(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file });
}

function createGame(seed) {
    const state = new GameState();
    const engine = new GameEngine(state);
    engine.newGame(seed);
    return { state, engine };
}

function testDomainOntology() {
    const { ResourceStock, Caravan, Market, Raider } = GameDomain;
    const { state, engine } = createGame(12345);
    assert.ok(engine.board instanceof Board);
    assert.equal(engine.board.hexes, state.hexes);
    assert.ok(state.caravan instanceof Caravan);
    assert.ok(state.caravan.cargo instanceof ResourceStock);
    assert.ok(state.crownMarket instanceof Market);
    assert.equal(state.crownMarket.isCrownMarket, true);
    assert.equal(state.tradingPosts.length, GameArtifacts.TRADING_POST_COUNT);
    assert.equal(state.tradingPosts.every(market => market instanceof Market && !market.isCrownMarket), true);
    assert.equal(state.raiders.every(raider => raider instanceof Raider), true);
    assert.equal(state.outcome, null);
    assert.equal('player' in state || 'target' in state || 'enemies' in state || 'cargo' in state, false);
}

function testGeneratedGame() {
    const { state, engine } = createGame(12345);
    assert.equal(engine.board.hasPath(state.caravan, state.crownMarket), true);
    assert.equal(state.tradingPosts.every(market => engine.board.hasPath(state.caravan, market)), true);
    assert.deepEqual(
        Object.fromEntries(Object.values(GameArtifacts.RESOURCE).map(resource => [resource, state.caravan.cargo.amount(resource)])),
        GameArtifacts.STARTING_CARGO
    );
    assert.ok(state.raiders.length >= 4);
}

function testMovementAndReproducibility() {
    const first = createGame(999);
    const second = createGame(999);
    const signature = game => JSON.stringify({
        caravan: game.state.caravan.key(),
        crownMarket: game.state.crownMarket.key(),
        tradingPosts: game.state.tradingPosts.map(market => market.key()),
        raiders: game.state.raiders.map(raider => raider.key())
    });
    assert.equal(signature(first), signature(second));

    const destinationKey = first.engine.computeReachable().keys().next().value;
    const destination = Hex.fromKey(destinationKey);
    const caravan = first.state.caravan;
    const result = first.engine.moveCaravan(destination.q, destination.r);
    assert.equal(result.ok, true);
    assert.equal(first.state.caravan, caravan);
    assert.equal(caravan.isAt(destination.q, destination.r), true);
}

function testResourceStock() {
    const stock = new GameDomain.ResourceStock({ provisions: 2, timber: 1, ore: 1, coin: 0 });
    assert.equal(stock.canAfford({ timber: 1, ore: 1 }), true);
    assert.equal(stock.spend({ timber: 1, ore: 1 }), true);
    assert.equal(stock.spend({ timber: 1 }), false);
    stock.gain({ coin: 3 });
    assert.equal(stock.amount(GameArtifacts.RESOURCE.COIN), 3);
}

function testTradeLoop() {
    const { state, engine } = createGame(23456);
    state.caravan.moveTo(state.tradingPosts[0].q, state.tradingPosts[0].r);
    state.caravan.cargo.gain({ timber: 1, ore: 1 });
    state.unrest = 2;
    const contract = engine.fulfillContract();
    assert.equal(contract.ok, true);
    assert.equal(state.influence, GameArtifacts.CONTRACT_INFLUENCE);
    assert.equal(state.unrest, 1);
    const provisionsBefore = state.caravan.cargo.provisions;
    assert.equal(engine.buySupplies().ok, true);
    assert.equal(state.caravan.cargo.provisions, provisionsBefore + GameArtifacts.SUPPLY_REWARD.provisions);
}

function testForceTradeoff() {
    const { state, engine } = createGame(34567);
    const neighbor = new Hex(state.caravan.q, state.caravan.r).neighbors().find(position => {
        const hex = state.hexes.get(position.key());
        return hex && engine.board.isPassable(hex);
    });
    state.raiders = [new GameDomain.Raider(999, neighbor.q, neighbor.r)];
    state.caravan.cargo.gain({ ore: 1 });
    const coinBefore = state.caravan.cargo.coin;
    const result = engine.useForceAgainstRaider(neighbor.q, neighbor.r);
    assert.equal(result.ok, true);
    assert.equal(state.raiders.length, 0);
    assert.equal(state.caravan.cargo.ore, 0);
    assert.equal(state.caravan.cargo.coin, coinBefore + GameArtifacts.FORCE_REWARD.coin);
    assert.equal(state.unrest, 1);
}

function testEnemyPhase() {
    const { state, engine } = createGame(67890);
    const turnBefore = state.turn;
    assert.equal(engine.endTurn().ok, true);
    assert.equal(state.turn, turnBefore + 1);
    assert.equal(state.raiders.every(raider => raider instanceof GameDomain.Raider), true);
}

function testOutcome() {
    const victory = createGame(45678);
    victory.state.caravan.moveTo(victory.state.crownMarket.q, victory.state.crownMarket.r);
    victory.state.influence = GameArtifacts.VICTORY_INFLUENCE;
    victory.engine.checkVictory();
    assert.equal(victory.state.outcome, GameArtifacts.OUTCOME.VICTORY);

    const defeat = createGame(56789);
    defeat.state.unrest = GameArtifacts.MAX_UNREST;
    defeat.engine.checkDefeat();
    assert.equal(defeat.state.outcome, GameArtifacts.OUTCOME.DEFEAT);
}

testDomainOntology();
testGeneratedGame();
testMovementAndReproducibility();
testResourceStock();
testTradeLoop();
testForceTradeoff();
testEnemyPhase();
testOutcome();
console.log('Game engine tests passed.');
