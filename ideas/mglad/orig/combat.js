// combat.js — Combat system: fight loop, AI, rewards

class Combat {
    constructor() {
        this.map = null;
        this.guys = null;
        this.rounds = 0;
    }

    // ---- main entry ----

    async doCombat(screen, guys, multPop) {
        this.guys = guys;
        this.genMap(screen);
        this.placeGuys();
        await this.doFight(screen);
        await this.doReward(screen, multPop);
        this.guys = null;
    }

    // ---- map setup ----

    genMap(screen) {
        this.map = new GameMap(screen, 19, 19);
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

    // ---- fight loop ----

    async doFight(screen) {
        screen.screenFade();
        this.map.show();
        showAllGuys(this.guys, this.map);

        // blank stat panels
        this.guys[0].blankStats(screen, 41, 1, BD_IN);
        this.guys[0].blankStats(screen, 61, 1, BD_IN);

        this.rounds = 0;

        while (numAlive(this.guys) > 1 && this.rounds < KILL_TIMEOUT) {
            showRoster(screen, this.guys, 41, 16);

            const t = minTime(this.guys);
            this.rounds += t;

            for (let i = 0; i < this.guys.length; i++) {
                if (this.guys[i].human)
                    await this.moveHuman(screen, i, t);
                else
                    await this.moveComputer(screen, i, t);
            }

            // kill timer display
            screen.putStr(2, 23, `kill time: ${KILL_TIMEOUT - this.rounds}    `, BACKGR);
        }

        if (this.rounds >= KILL_TIMEOUT)
            await killAllGuys(this.guys, this.map);
    }

    // ---- human move ----

    async moveHuman(screen, n, tt) {
        const g = this.guys[n];
        if (!g.state) return;
        g.time -= tt;
        if (g.time > 0) return;

        g.showStats(screen, 41, 1, BD_IN);
        screen.flushKeys();

        const ev = await screen.waitKey();
        const key = ev.key;

        // debug prefix
        if (ev.debug) {
            if (key === 'k') {
                await killAllGuys(this.guys, this.map);
                return;
            }
            if (key === 'm') {
                this.map.show();
                showAllGuys(this.guys, this.map);
                return;
            }
            return;
        }

        // rest (center key)
        const dir = KEY_DIR[key];
        if (dir === 5) {
            await g.showRest(this.map);
            g.rest(g.state = GUY_REST);
            return;
        }

        if (key === 'Escape') return; // skip turn

        // movement / attack
        if (dir && dir >= 1 && dir <= 9 && dir !== 5) {
            const pos = this.map.closein(dir, g.x, g.y);
            const targ = guyAt(this.guys, pos.x, pos.y);

            if (targ > -1 && targ !== n) {
                // attack
                g.target = this.guys[targ];
                await g.attack(this.map, g.target);
                checkShowAttack(screen, g, g.target);
                g.rest(g.state = GUY_ATTACK);
                if (!g.target.health) {
                    g.pop++;
                    rankGuy(this.guys, n < targ ? n : this.guys.indexOf(g),
                            this.guys.indexOf(g.target));
                    this.rounds = 0;
                }
            } else {
                // move
                g.blank(this.map);
                g.x = pos.x; g.y = pos.y;
                g.show(this.map);
                g.rest(g.state = GUY_MOVE);
            }
            return;
        }
    }

    // ---- AI move ----

    async moveComputer(screen, n, tt) {
        const g = this.guys[n];
        if (!g.state) return;
        g.time -= tt;
        if (g.time > 0) return;

        const targ = guyAdjacent(this.guys, this.map, g.x, g.y);

        if (targ > -1) {
            g.target = this.guys[targ];
            const ra = g.att + g.weapon;
            const rd = g.target.att + g.target.armor;

            if (g.att < g.att0 && ra < rd - 1) {
                // rest / guard
                await g.showRest(this.map);
                g.rest(g.state = GUY_REST);
            } else {
                if (R(0, ra) < R(0, rd)) {
                    // shift position
                    const dir = this.map.delta(g.x, g.y, g.target.x, g.target.y);
                    const positions = this.map.getShiftPositions(g.x, g.y, dir);
                    g.blank(this.map);
                    for (const p of positions) {
                        if (guyAt(this.guys, p.x, p.y) === -1) {
                            g.x = p.x; g.y = p.y;
                            break;
                        }
                    }
                    g.show(this.map);
                    g.rest(g.state = GUY_MOVE);
                } else {
                    // attack
                    await g.attack(this.map, g.target);
                    checkShowAttack(screen, g, g.target);
                    g.rest(g.state = GUY_ATTACK);
                    if (!g.target.health) {
                        g.pop++;
                        rankGuy(this.guys, this.guys.indexOf(g),
                                this.guys.indexOf(g.target));
                        this.rounds = 0;
                    }
                }
            }
        } else {
            // move toward closest
            const ci = guyClosest(this.guys, this.map, g.x, g.y);
            if (ci === -1) return;
            g.target = this.guys[ci];

            const dir = this.map.delta(g.x, g.y, g.target.x, g.target.y);
            const pos = this.map.closein(dir, g.x, g.y);

            g.blank(this.map);
            g.x = pos.x; g.y = pos.y;
            g.show(this.map);
            g.rest(g.state = GUY_MOVE);
        }

        await delay(30); // brief pause for visual pacing
    }

    // ---- rewards ----

    async doReward(screen, mult) {
        let place = 4;
        for (const g of this.guys) {
            g.pop += (place--) * mult;

            let earned = 0;
            if (g.pop > 0)
                earned = Math.floor(Math.sqrt(g.pop) * POP_REWARD);
            g.gold += earned;

            if (!g.human && g.gold < PT_COST) g.gold += PT_COST;

            if (g.human) {
                const x = 41, y0 = 5;
                screen.box(BD_OUT | BD_FILL, x, y0, 78, y0 + 5, BACKGR);
                screen.putStr(45, y0 + 1, g.name, 15 | BACKGR);
                screen.putStr(45, y0 + 2, `Popularity ${lpad(g.pop, 5)} `, 14 | BACKGR);
                screen.putStr(45, y0 + 3, `Credits earned:  ${lpad(earned, 5)}C `, BACKGR);
                screen.putStr(45, y0 + 4, `Current credits: ${lpad(g.gold, 5)}C `, BACKGR);
                await screen.waitKey();
            }
        }
    }
}
