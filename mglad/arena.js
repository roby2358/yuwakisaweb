// arena.js — Arena management: roster, buy phase, promote/demote, standings

class Arena {
    constructor(screen) {
        this.screen = screen;
        this.guys = [];
        this.minPop = -5;
        this.maxPop = 25;
        this.multPop = 2;
        this.popReward = POP_REWARD;
        this.ptCost = PT_COST;
        this.basePoints = 30;
        this.baseVar = 6;
        this.combat = new Combat();
    }

    setPop(mn, mx, mul) { this.minPop = mn; this.maxPop = mx; this.multPop = mul; }

    // ---- roster generation ----

    newGuy(g) {
        g.randGuy(ARCHETYPES, this.basePoints, this.baseVar);
        g.ch = g.name[0];
        g.at = R(8, 15) + R(0, 7) * 16;
        g.state = GUY_OK;
        g.pop = Math.floor((R(this.minPop, this.maxPop) + R(this.minPop, this.maxPop)) / 3);
        g.gold = R(0, this.ptCost);
    }

    async genList(player) {
        // create 8-slot roster, player at end
        this.guys = [];
        for (let i = 0; i < NUM_GUYS; i++) this.guys.push(new Guy());
        // copy player into last slot
        Object.assign(this.guys[NUM_GUYS - 1], player);

        // fill empty slots
        for (const g of this.guys)
            if (!g.state || !g.name) this.newGuy(g);

        // ensure player slot is correct
        const pg = this.guys[NUM_GUYS - 1];
        pg.human = true;
        pg.showAtt = '';
        pg.state = GUY_OK;

        // show roster
        this.screen.screenFade();
        this.screen.box(BD_OUT | BD_FILL, 21, 8, 59, 17, BACKGR);
        showRoster2(this.screen, this.guys, 22, 9);
        await this.screen.waitKey();
    }

    // ---- main arena loop ----

    async doArena() {
        const screen = this.screen;

        // buy phase for human players
        for (const g of this.guys) {
            if (g.human) {
                const status = await this.doBuy(g);
                if (status !== AR_OK) return status;
            }
        }

        // combat
        await this.combat.doCombat(screen, this.guys, this.multPop);

        // restore guys between fights
        await this.restoreGuys();

        // standings
        await this.showStandings();

        // promote / demote
        return await this.promoteGuys();
    }

    // ---- buy phase ----

    async doBuy(guy) {
        const screen = this.screen;
        screen.screenFade();

        guy.showStats(screen, 10, 5, BD_OUT);

        const options = [
            { label: 'Train in Gym             FREE', cost:    0, pts: 1, key:'t' },
            { label: 'Extensive Training        200', cost:  200, pts: 2, key:'e' },
            { label: 'Hire a Trainer            300', cost:  300, pts: 3, key:'h' },
            { label: 'Outpatient Bioengineering 500', cost:  500, pts: 5, key:'o' },
            { label: 'Minor Bioengineering      800', cost:  800, pts: 9, key:'n' },
            { label: 'Major Bioengineering     1200', cost: 1200, pts:14, key:'m' },
            { label: 'Buy Passage             1000', cost: 1000, pts: 0, key:'p', passage:true },
            { label: 'Quit',                          cost:    0, pts: 0, key:'q', quit:true },
        ];

        // draw menu
        const mx = 41, my = 5;
        screen.box(BD_OUT | BD_FILL, mx, my, 75, my + options.length + 1, BACKGR);
        let sel = 0;

        const drawMenu = () => {
            for (let i = 0; i < options.length; i++) {
                const o = options[i];
                const avail = o.quit || o.cost <= guy.gold;
                const hi = i === sel;
                const attr = !avail ? (8 | BACKGR) : hi ? (15 | (2 << 4)) : (BACKGR);
                screen.putStr(mx + 1, my + 1 + i, o.label.padEnd(33).slice(0, 33), attr);
            }
        };

        drawMenu();

        while (true) {
            const ev = await screen.waitKey();
            const k = ev.key.toLowerCase();

            if (k === 'arrowup' || k === 'w') {
                for (let j = 1; j < options.length; j++) {
                    const idx = (sel - j + options.length) % options.length;
                    if (options[idx].quit || options[idx].cost <= guy.gold) { sel = idx; break; }
                }
                drawMenu(); continue;
            }
            if (k === 'arrowdown' || k === 'x') {
                for (let j = 1; j < options.length; j++) {
                    const idx = (sel + j) % options.length;
                    if (options[idx].quit || options[idx].cost <= guy.gold) { sel = idx; break; }
                }
                drawMenu(); continue;
            }

            // direct key selection
            let picked = -1;
            if (k === 'enter' || k === ' ') picked = sel;
            else {
                for (let i = 0; i < options.length; i++)
                    if (options[i].key === k) { picked = i; break; }
            }

            if (picked < 0) continue;
            const o = options[picked];
            if (!o.quit && o.cost > guy.gold) continue;

            if (o.quit) return AR_QUIT;
            if (o.passage) { guy.gold -= 1000; return AR_PASSAGE; }

            // buy upgrade
            guy.gold -= o.cost;
            await this.buyStats(guy, o.pts);
            return AR_OK;
        }
    }

    async buyStats(guy, pts) {
        const screen = this.screen;
        const statNames = [
            { label: 'Improve Skill',    field: 'skill',  cost: STAT_COST.skill,  key: 's' },
            { label: 'Improve Strength', field: 'str',    cost: STAT_COST.str,    key: 't' },
            { label: 'Improve Health',   field: 'health', cost: STAT_COST.health, key: 'h' },
        ];

        let sel = 0;

        while (pts > 0) {
            guy.showStats(screen, 10, 5, BD_OUT);

            const mx = 41, my = 4;
            screen.box(BD_OUT | BD_FILL, mx, my, 75, my + statNames.length + 2, BACKGR);
            screen.putStr(mx + 1, my, `Points left: ${pts}`, 14 | BACKGR);

            for (let i = 0; i < statNames.length; i++) {
                const s = statNames[i];
                const avail = pts >= s.cost;
                const hi = i === sel;
                const attr = !avail ? (8 | BACKGR) : hi ? (15 | (2 << 4)) : (BACKGR);
                screen.putStr(mx + 1, my + 1 + i, s.label.padEnd(33).slice(0, 33), attr);
            }

            const ev = await screen.waitKey();
            const k = ev.key.toLowerCase();

            if (k === 'arrowup' || k === 'w') {
                for (let j = 1; j < statNames.length; j++) {
                    const idx = (sel - j + statNames.length) % statNames.length;
                    if (pts >= statNames[idx].cost) { sel = idx; break; }
                }
                continue;
            }
            if (k === 'arrowdown' || k === 'x') {
                for (let j = 1; j < statNames.length; j++) {
                    const idx = (sel + j) % statNames.length;
                    if (pts >= statNames[idx].cost) { sel = idx; break; }
                }
                continue;
            }
            if (k === 'escape') break;

            let picked = -1;
            if (k === 'enter' || k === ' ') picked = sel;
            else {
                for (let i = 0; i < statNames.length; i++)
                    if (statNames[i].key === k) { picked = i; break; }
            }

            if (picked < 0) continue;
            const s = statNames[picked];
            if (pts < s.cost) continue;

            guy[s.field]++;
            pts -= s.cost;
        }

        guy.health0 = guy.health;
        guy.att = guy.att0 = guy.calcAtt();
        guy.speed = guy.calcSpeed();
    }

    // ---- between-fight stat adjustment ----

    async restoreGuys() {
        for (const g of this.guys) {
            g.state = GUY_OK;
            g.health = g.health0;

            if (g.base) {
                const pts0 = g.calcPoints();
                const pts = pts0 + Math.floor(g.gold / this.ptCost) - Math.floor(pts0 / 20);
                scaleStats(g, g.base, Math.floor(pts0 * 9 / 10));
                modifyStats(g, pts - g.calcPoints());
                g.gold = g.gold % PT_COST;
            } else if (!g.human) {
                modifyStats(g, -Math.floor(g.calcPoints() / 20));
            }

            g.health0 = g.health;
            g.restore();
        }
    }

    // ---- promote / demote ----

    async promoteGuys() {
        const screen = this.screen;

        // check #1 ranked
        if (this.guys[0].pop >= this.maxPop) {
            if (this.guys[0].human) return AR_PROMOTE;
            screen.box(BD_OUT | BD_FILL, 41, 5, 78, 9, BACKGR);
            screen.putStr(45, 6, this.guys[0].name, 15 | BACKGR);
            screen.putStr(45, 7, 'has advanced to the next tier.', 14 | BACKGR);
            await screen.waitKey();
            advanceGuys(this.guys, 0);
            this.newGuy(this.guys[this.guys.length - 1]);
        }

        // check all for demotion
        for (let i = 0; i < this.guys.length; i++) {
            if (this.guys[i].pop <= this.minPop) {
                if (this.guys[i].human) return AR_DEMOTE;
                screen.box(BD_OUT | BD_FILL, 41, 5, 78, 9, BACKGR);
                screen.putStr(45, 6, this.guys[i].name, 15 | BACKGR);
                screen.putStr(45, 7, 'is being sent back.', 14 | BACKGR);
                await screen.waitKey();
                advanceGuys(this.guys, i);
                this.newGuy(this.guys[this.guys.length - 1]);
                i--; // re-check this index
            }
        }

        return AR_OK;
    }

    // ---- standings display ----

    async showStandings() {
        const screen = this.screen;
        screen.screenFade();
        screen.box(BD_OUT | BD_FILL, 1, 16, 78, 24, BACKGR);
        this.showPyramid();
        showRoster2(screen, this.guys, 41, 16);
        await screen.waitKey();
    }

    showPyramid() {
        const screen = this.screen;
        const g = this.guys;
        const W = screen.x2 - screen.x1;

        const place = (col, n, y, guy) => {
            const x = Math.floor(n * W / col) + screen.x1;
            const nm = guy.name;
            screen.putStr(x - Math.floor(nm.length / 2), y, nm, guy.at);
            const pop = `II ${lpad(guy.pop, 3)} II`;
            screen.putStr(x - Math.floor(pop.length / 2), y + 1, pop, guy.at);
        };

        let y = 1, i = 0;
        if (g[i]) { place(2, 1, y, g[i]); i++; y += 2; }
        if (g[i]) { place(3, 2, y, g[i]); i++; y++; }
        if (g[i]) { place(3, 1, y, g[i]); i++; y += 3; }
        if (g[i]) { place(6, 1, y, g[i]); i++; y++; }
        if (g[i]) { place(6, 2, y, g[i]); i++; y++; }
        if (g[i]) { place(6, 3, y, g[i]); i++; y++; }
        if (g[i]) { place(6, 4, y, g[i]); i++; y++; }
        if (g[i]) { place(6, 5, y, g[i]); i++; }
    }
}
