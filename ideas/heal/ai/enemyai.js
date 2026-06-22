// ai/enemyai.js — Hostile strategy (the threats closing on the party).
//
// Answers, for one enemy each turn: which hero it commits to (`target`) and how far it may
// travel (`budget`). The enemy's goal IS its target's hex, so the animated enemy phase in
// index.js feeds `target` straight to Movement.walkToward, then resolves the attack if the
// target is in reach. Reads live game globals (`party`, `healer`); no per-enemy strategy
// state beyond `enemy.targetId` and `enemy.speed`, so the methods are static.
class EnemyAI {
    // Each enemy commits to a target party member (telegraphed); only re-picks when its
    // target is no longer a valid, living hero. Falls to the healer when the party is down.
    static target(enemy) {
        const living = party.filter(p => p.alive && !p.gone);
        let target = living.find(p => p.id === enemy.targetId);
        if (!target) {
            target = nearest(enemy, living);
            enemy.targetId = target ? target.id : null;
        }
        return target ?? healer;
    }

    // Movement speed is rolled per enemy at spawn (DYNAMICS: varied speeds), so it is the
    // enemy's per-turn budget directly.
    static budget(enemy) {
        return enemy.speed;
    }
}
