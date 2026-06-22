// ai/enemyai.js — Hostile strategy (the threats closing on the party).
//
// Answers, for one enemy each turn: which hero it commits to (`target`) and how far it may
// travel (`budget`). The enemy's goal IS its target's hex, so the animated enemy phase in
// GameEngine feeds `target` straight to Movement.walkToward, then resolves the attack if the
// target is in reach. `target` takes the live GameState explicitly (reads `state.party /
// healer` and `state.nearest`); no per-enemy strategy state beyond `enemy.targetId` and
// `enemy.speed`, so the methods are static.
class EnemyAI {
    // Each enemy commits to a target party member (telegraphed) and pursues to the end. An
    // un-committed enemy stays dormant until a hero comes within AGGRO_RANGE — so distant
    // warbands hold their turf instead of all rushing at once. Returns null when nothing is
    // close enough to provoke it (the enemy phase then leaves it standing). Falls to the
    // healer only when the party is down.
    static target(enemy, state) {
        const living = state.party.filter(p => p.alive && !p.gone);
        const committed = living.find(p => p.id === enemy.targetId);
        if (committed) return committed;

        const prey = state.nearest(enemy, living) ?? (state.healer.alive ? state.healer : null);
        if (!prey) return null;
        if (new Hex(enemy.q, enemy.r).distance(prey) > AGGRO_RANGE) return null;
        enemy.targetId = prey.id;
        return prey;
    }

    // Movement speed is rolled per enemy at spawn (DYNAMICS: varied speeds), so it is the
    // enemy's per-turn budget directly.
    static budget(enemy) {
        return enemy.speed;
    }
}
