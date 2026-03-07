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

        const stat1 = document.getElementById('stat1');
        const stat2 = document.getElementById('stat2');
        const attInfo = document.getElementById('attack-info');
        const rosterEl = document.getElementById('roster');
        const timerEl = document.getElementById('kill-timer');

        stat1.innerHTML = '';
        stat2.innerHTML = '';

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
            if (human && human.target) {
                renderAttackInfo(attInfo, human, human.target);
            }

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

    async moveHuman(n, tt) {
        const g = this.guys[n];
        if (!g.state) return;
        g.time -= tt;
        if (g.time > 0) return;

        const renderer = this.renderer;
        const stat1 = document.getElementById('stat1');
        renderStatPanel(stat1, g);

        input.flush();
        const ev = await input.waitKey();
        const key = ev.key;

        if (ev.debug) {
            if (key === 'k') {
                await killAllGuys(this.guys, renderer, this.map);
                return;
            }
            if (key === 'm') {
                renderer.drawMap(this.map);
                showAllGuys(this.guys, renderer, this.map);
                return;
            }
            return;
        }

        const dir = KEY_DIR[key];

        // Rest (center: S or space)
        if (dir === 6) {
            await g.showRest(renderer, this.map);
            g.rest(g.state = GUY_REST);
            return;
        }

        if (key === 'Escape') return;

        // Movement / attack (hex directions 0-5)
        if (dir !== undefined && dir >= 0 && dir <= 5) {
            const pos = this.map.closein(dir, g.x, g.y);
            const targ = guyAt(this.guys, pos.x, pos.y);

            if (targ > -1 && targ !== n) {
                g.target = this.guys[targ];
                const stat2 = document.getElementById('stat2');
                renderStatPanel(stat2, g.target);
                await g.attack(renderer, this.map, g.target);
                g.rest(g.state = GUY_ATTACK);
                if (!g.target.health) {
                    g.kills += killPop(g, g.target);
                    rankGuy(this.guys, n < targ ? n : this.guys.indexOf(g),
                            this.guys.indexOf(g.target));
                    this.rounds = 0;
                }
            } else if (pos.x !== g.x || pos.y !== g.y) {
                g.blank(renderer, this.map);
                g.x = pos.x; g.y = pos.y;
                g.show(renderer, this.map);
                g.rest(g.state = GUY_MOVE);
            }
            return;
        }
    }

    async moveComputer(n, tt) {
        const g = this.guys[n];
        if (!g.state) return;
        g.time -= tt;
        if (g.time > 0) return;

        const renderer = this.renderer;
        const targ = guyAdjacent(this.guys, g.x, g.y);

        if (targ > -1) {
            g.target = this.guys[targ];
            const ra = g.att + g.weapon;
            const rd = g.target.att + g.target.armor;

            if (g.att < g.att0 && ra < rd - 1) {
                await g.showRest(renderer, this.map);
                g.rest(g.state = GUY_REST);
            } else {
                if (R(0, ra) < R(0, rd)) {
                    // Shift position
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
                } else {
                    // Attack
                    // Update stat panel if fighting human
                    if (g.target.human) {
                        const stat2 = document.getElementById('stat2');
                        renderStatPanel(stat2, g);
                    }
                    await g.attack(renderer, this.map, g.target);
                    g.rest(g.state = GUY_ATTACK);
                    if (!g.target.health) {
                        g.kills += killPop(g, g.target);
                        rankGuy(this.guys, this.guys.indexOf(g),
                                this.guys.indexOf(g.target));
                        this.rounds = 0;
                    }
                }
            }
        } else {
            const ci = guyClosest(this.guys, g.x, g.y);
            if (ci === -1) return;
            g.target = this.guys[ci];
            const occupied = (x, y) => guyAt(this.guys, x, y) !== -1;
            const step = this.map.bfsStep(g.x, g.y, g.target.x, g.target.y, occupied);
            if (step && (step.x !== g.x || step.y !== g.y)) {
                g.blank(renderer, this.map);
                g.x = step.x; g.y = step.y;
                g.show(renderer, this.map);
            }
            g.rest(g.state = GUY_MOVE);
        }

        await delay(30);
    }

    async doReward(mult) {
        const overlay = document.getElementById('overlay');
        let place = 4;
        for (const g of this.guys) {
            const popBefore = g.pop;
            const placePop = (place--) * mult;
            const killPop = g.kills || 0;
            g.pop += killPop + placePop;
            let earned = 0;
            if (g.pop > 0)
                earned = Math.floor(Math.sqrt(g.pop) * POP_REWARD);
            g.gold += earned;
            if (!g.human && g.gold < PT_COST) g.gold += PT_COST;

            if (g.human) {
                const lines = [];
                if (killPop) lines.push(`<div class="reward-stat">Kills: +${killPop}</div>`);
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
