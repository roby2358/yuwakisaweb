# Caravans & Conquest — Game Dynamics

## Theme

A vulnerable merchant expedition crosses a fractured frontier. Prosperity comes from exchange, but roads are unsafe and selective force is sometimes cheaper than a detour. The desired feeling is **making one more hard bargain while the map becomes more hostile**.

## Key Drivers

1. **Scarcity of agency** — movement, provisions, and cargo capacity pressure every route choice.
2. **Readable consequences** — the HUD exposes every cost; resource sites, trading posts, and raiders are visible on the map.
3. **Escalating commitment** — fighting is immediately profitable but raises unrest, increasing later raider activity.

## Key Mechanics

- Entering a resource hex harvests it once: forests provide timber, quarries ore, and gold fields coin.
- At a trading post or the Crown Market, a contract converts one timber and one ore into influence and coin; coin can instead buy provisions.
- Attacking an adjacent raider costs one ore and one provision, earns coin, and raises unrest.
- Ending a turn consumes one provision. Nearby raiders steal cargo or coin, and unrest can attract reinforcements.

## Victory and Defeat

- Win by reaching the Crown Market on the east side with 15 influence.
- Lose when ending a turn without provisions or when unrest reaches 8.

## Strategies

- **Trade route:** detour through resource sites and trading posts, avoid most raiders, and buy enough supplies for the final crossing.
- **Armed caravan:** harvest extra ore, clear direct routes, and use captured coin to resupply before unrest becomes unmanageable.
- **Mixed route:** fulfill early contracts, fight only strategically placed raiders, then race east before escalation peaks.
- **Anti-strategy — endless farming:** resource sites deplete, provisions drain each turn, and raider pressure grows.
- **Anti-strategy — kill everything:** each victory raises unrest; unchecked force causes defeat or overwhelming reinforcement.
- **Anti-strategy — trade without risk:** trading posts are spaced across the route and contracts require two terrain-bound resources.

## State Model

The authoritative state contains map hexes with `depleted`, a caravan that owns its cargo, a Crown Market, trading posts, raiders, influence, unrest, turn, movement points, phase, and one outcome value.

## Turn Algorithm

1. The caravan spends movement points, harvests entered sites, trades at markets, or uses force against adjacent raiders.
2. End turn consumes one provision.
3. Raiders move toward the caravan, adjacent raiders steal cargo, and unrest may spawn a reinforcement.
4. Restore movement points and test victory or defeat.
