// combat.js — Combat system: fight loop, AI, rewards

function killPop(killer, target) {
    if (killer.pop <= 0) return 3;
    if (target.pop > 3 * killer.pop) return 3;
    if (target.pop > 2 * killer.pop) return 2;
    return 1;
}

class Combat {
    constructor() {
        this.map = null;
        this.renderer = null;
        this.guys = null;
        this.rounds = 0;
    }

    // ---- Target highlight (stat2 panel + counter outline) ----

    highlightTarget(g, target) {
        if (g.target && g.target.highlighted) {
            g.target.highlighted = false;
            g.target.show(this.renderer, this.map);
        }
        g.target = target;
        target.highlighted = true;
        renderStatPanel(document.getElementById('stat2'), target, '#ff2200');
    }

    clearHighlight(g) {
        if (g.target && g.target.highlighted) {
            g.target.highlighted = false;
            renderStatPanel(document.getElementById('stat2'), null);
        }
    }

    // ---- Shared combat actions ----

    moveGuy(g, x, y) {
        g.blank(this.renderer, this.map);
        g.x = x; g.y = y;
        g.show(this.renderer, this.map);
    }

    handleKill(g, gIdx, targIdx) {
        this.clearHighlight(g);
        g.kills += killPop(g, g.target);
        rankGuy(this.guys, gIdx, targIdx);
        this.rounds = 0;
    }

    // ---- Fight setup and loop ----

    async doCombat(renderer, guys, multPop) {
        this.renderer = renderer;
        this.guys = guys;
        for (const g of guys) g.kills = 0;
        this.genMap();
        this.placeGuys();
        await this.doFight();
        await this.doReward(multPop);
        this.guys = null;
    }

    genMap() {
        this.map = new HexMap(MAP_W, MAP_H);
        switch (R(1, 4)) {
            case 1: forestMap(this.map); break;
            case 2: arenaMap(this.map);  break;
            case 3: ruinsMap(this.map);  break;
            case 4: rockyMap(this.map);  break;
        }
    }

    placeGuys() {
        for (const g of this.guys) {
            const p = this.map.rndRevcent(FL_NOMOVE);
            g.x = p.x; g.y = p.y;
            g.time = 0;
        }
    }

    async doFight() {
        const renderer = this.renderer;
        const guys = this.guys;

        // Show game container, hide overlay
        document.getElementById('game-container').classList.remove('hidden');
        document.getElementById('overlay').classList.add('hidden');

        renderer.drawMap(this.map);
        showAllGuys(guys, renderer, this.map);

        const attInfo = document.getElementById('attack-info');
        const rosterEl = document.getElementById('roster');
        const timerEl = document.getElementById('kill-timer');

        renderStatPanel(document.getElementById('stat1'), null);
        renderStatPanel(document.getElementById('stat2'), null);
        guys.forEach(g => g.highlighted = false);

        this.rounds = 0;

        while (numAlive(guys) > 1 && this.rounds < KILL_TIMEOUT) {
            renderRoster(rosterEl, guys);

            const t = minTime(guys);
            this.rounds += t;

            for (let i = 0; i < guys.length; i++) {
                if (guys[i].human)
                    await this.moveHuman(i, t);
                else
                    await this.moveComputer(i, t);
            }

            // Update attack info for human
            const human = guys.find(g => g.human);
            if (human && human.target)
                renderAttackInfo(attInfo, human, human.target);

            // Kill timer
            const remaining = KILL_TIMEOUT - this.rounds;
            timerEl.textContent = `Kill timer: ${remaining}`;
            timerEl.className = remaining < 300 ? 'warning' : '';
        }

        if (this.rounds >= KILL_TIMEOUT) {
            const overlay = document.getElementById('overlay');
            overlay.classList.remove('hidden');
            overlay.innerHTML =
                `<div class="overlay-panel">` +
                `<h2 style="color:var(--danger)">Kill timer expired. All die!</h2>` +
                `<div class="hint">Press any key</div></div>`;
            await input.waitKey();
            overlay.classList.add('hidden');
            await killAllGuys(guys, renderer, this.map);
        }

        timerEl.textContent = '';
    }

    // ---- Human turn ----

    async moveHuman(n, tt) {
        const g = this.guys[n];
        if (!g.state) return;
        g.time -= tt;
        if (g.time > 0) return;

        const renderer = this.renderer;
        renderStatPanel(document.getElementById('stat1'), g);
        if (g.target && g.target.highlighted)
            renderStatPanel(document.getElementById('stat2'), g.target, '#ff2200');

        input.flush();
        const ev = await input.waitKey();
        const key = ev.key;

        if (ev.debug) {
            if (key === 'k') await killAllGuys(this.guys, renderer, this.map);
            if (key === 'm') { renderer.drawMap(this.map); showAllGuys(this.guys, renderer, this.map); }
            return;
        }

        const dir = KEY_DIR[key];

        if (dir === 6) {
            await g.showRest(renderer, this.map);
            g.rest(g.state = GUY_REST);
            return;
        }

        if (key === 'Escape') return;
        if (dir === undefined || dir < 0 || dir > 5) return;

        const pos = this.map.closein(dir, g.x, g.y);
        const targ = guyAt(this.guys, pos.x, pos.y);

        // Attack adjacent target
        if (targ > -1 && targ !== n) {
            this.highlightTarget(g, this.guys[targ]);
            await g.attack(renderer, this.map, g.target);
            g.rest(g.state = GUY_ATTACK);
            if (!g.target.health)
                this.handleKill(g, n < targ ? n : this.guys.indexOf(g), this.guys.indexOf(g.target));
            return;
        }

        // Move to empty hex
        if (pos.x !== g.x || pos.y !== g.y) {
            this.moveGuy(g, pos.x, pos.y);
            g.rest(g.state = GUY_MOVE);
        }
    }

    // ---- AI turn ----

    async moveComputer(n, tt) {
        const g = this.guys[n];
        if (!g.state) return;
        g.time -= tt;
        if (g.time > 0) return;

        const renderer = this.renderer;
        const adjIdx = guyAdjacent(this.guys, g.x, g.y);

        // No adjacent target — pathfind toward closest
        if (adjIdx === -1) {
            const ci = guyClosest(this.guys, g.x, g.y);
            if (ci !== -1) {
                g.target = this.guys[ci];
                const occupied = (x, y) => guyAt(this.guys, x, y) !== -1;
                const step = this.map.bfsStep(g.x, g.y, g.target.x, g.target.y, occupied);
                if (step && (step.x !== g.x || step.y !== g.y))
                    this.moveGuy(g, step.x, step.y);
                g.rest(g.state = GUY_MOVE);
            }
            await delay(30);
            return;
        }

        // Adjacent target found
        g.target = this.guys[adjIdx];
        const ra = g.att + g.weapon;
        const rd = g.target.att + g.target.armor;

        // Rest if fatigued and outmatched
        if (g.att < g.att0 && ra < rd - 1 && g.att * 5 < g.att0 * 4) {
            await g.showRest(renderer, this.map);
            g.rest(g.state = GUY_REST);
        // Shift position if roll is unfavorable
        } else if (R(0, ra) < R(0, rd)) {
            const dir = this.map.delta(g.x, g.y, g.target.x, g.target.y);
            const positions = this.map.getShiftPositions(g.x, g.y, dir);
            g.blank(renderer, this.map);
            for (const p of positions) {
                if (guyAt(this.guys, p.x, p.y) === -1) {
                    g.x = p.x; g.y = p.y;
                    break;
                }
            }
            g.show(renderer, this.map);
            g.rest(g.state = GUY_MOVE);
        // Attack
        } else {
            await g.attack(renderer, this.map, g.target);
            g.rest(g.state = GUY_ATTACK);
            if (!g.target.health)
                this.handleKill(g, this.guys.indexOf(g), this.guys.indexOf(g.target));
        }

        await delay(30);
    }

    // ---- Post-fight rewards ----

    async doReward(mult) {
        const overlay = document.getElementById('overlay');
        let place = 4;
        for (const g of this.guys) {
            const popBefore = g.pop;
            const placePop = (place--) * mult;
            const kPop = g.kills || 0;
            g.pop += kPop + placePop;
            let earned = 0;
            if (g.pop > 0)
                earned = Math.floor(Math.sqrt(g.pop) * POP_REWARD);
            g.gold += earned;
            if (!g.human && g.gold < PT_COST) g.gold += PT_COST;

            if (g.human) {
                const lines = [];
                if (kPop) lines.push(`<div class="reward-stat">Kills: +${kPop}</div>`);
                const sign = placePop >= 0 ? '+' : '';
                lines.push(`<div class="reward-stat">Placement: ${sign}${placePop}</div>`);
                overlay.classList.remove('hidden');
                overlay.innerHTML =
                    `<div class="overlay-panel reward-panel">` +
                    `<div class="reward-name" style="color:${g.color}">${g.name}</div>` +
                    lines.join('') +
                    `<div class="reward-stat" style="border-top:1px solid var(--panel-border);padding-top:4px">` +
                    `Popularity: ${popBefore} → ${g.pop}</div>` +
                    `<div class="reward-stat" style="color:var(--gold)">Credits earned: ${earned}C</div>` +
                    `<div class="reward-stat">Current credits: ${g.gold}C</div>` +
                    `<div class="hint">Press any key</div></div>`;
                await input.waitKey();
                overlay.classList.add('hidden');
            }
        }
    }
}
