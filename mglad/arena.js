// arena.js — Arena management: roster, buy phase, promote/demote, standings

class Arena {
    constructor(renderer) {
        this.renderer = renderer;
        this.guys = [];
        this.minPop = -10;
        this.maxPop = 50;
        this.multPop = 2;
        this.popReward = POP_REWARD;
        this.ptCost = PT_COST;
        this.basePoints = 30;
        this.baseVar = 6;
        this.combat = new Combat();
    }

    newGuy(g) {
        g.randGuy(ARCHETYPES, this.basePoints, this.baseVar);
        g.state = GUY_OK;
        g.pop = Math.floor((R(this.minPop, this.maxPop) + R(this.minPop, this.maxPop)) / 3);
        g.gold = R(0, this.ptCost);
    }

    async genList(player) {
        this.guys = [];
        for (let i = 0; i < ROSTER_SIZE; i++) this.guys.push(new Guy());
        Object.assign(this.guys[ROSTER_SIZE - 1], player);

        for (const g of this.guys)
            if (!g.state || !g.name) this.newGuy(g);

        const pg = this.guys[ROSTER_SIZE - 1];
        pg.human = true;
        pg.showAtt = '';
        pg.state = GUY_OK;

        // Sort by popularity descending
        this.guys.sort((a, b) => b.pop - a.pop);

        // Show roster
        await this.showRoster2('Arena Roster');
    }

    selectCombatants() {
        const human = this.guys.find(g => g.human);
        const ai = this.guys.filter(g => !g.human);
        // Shuffle AI roster
        for (let i = ai.length - 1; i > 0; i--) {
            const j = R(0, i);
            [ai[i], ai[j]] = [ai[j], ai[i]];
        }
        return ai.slice(0, NUM_GUYS - 1).concat(human);
    }

    async doArena() {
        for (const g of this.guys) {
            if (g.human) {
                const status = await this.doBuy(g);
                if (status !== AR_OK) return status;
            }
        }
        const combatants = this.selectCombatants();
        await this.combat.doCombat(this.renderer, combatants, this.multPop);
        await this.restoreGuys(combatants);
        combatants.sort((a, b) => b.pop - a.pop);
        this.guys.sort((a, b) => b.pop - a.pop);
        await this.showStandings(combatants);
        return await this.promoteGuys();
    }

    // ---- Buy phase ----

    async doBuy(guy) {
        const overlay = document.getElementById('overlay');
        document.getElementById('game-container').classList.add('hidden');

        const BASE_STATS = ['skill', 'str', 'health'];
        const ALL_STATS  = ['skill', 'str', 'health', 'weapon', 'armor'];
        const WPN_ONLY   = ['weapon'];
        const ARM_ONLY   = ['armor'];

        const options = [
            { label: 'Train in Gym',              cost:    0, pts:  1, key: 't', stats: BASE_STATS },
            { label: 'Extensive Training',         cost:  200, pts:  3, key: 'e', stats: BASE_STATS },
            { label: 'Outpatient Bioengineering',  cost:  300, pts:  4, key: 'o', stats: ALL_STATS },
            { label: 'Bioweapon Specialist',       cost:  200, pts:  3, key: 'b', stats: WPN_ONLY },
            { label: 'Armor Engineering',          cost:  200, pts:  3, key: 'a', stats: ARM_ONLY },
            { label: 'Minor Bioengineering',       cost:  500, pts:  7, key: 'n', stats: ALL_STATS },
            { label: 'Major Bioengineering',       cost:  800, pts: 11, key: 'm', stats: ALL_STATS },
            { label: 'Buy Passage',                cost: 1000, pts:  0, key: 'p', passage: true },
            { label: 'Quit',                       cost:    0, pts:  0, key: 'q', quit: true },
        ];

        let sel = 0;

        const render = () => {
            overlay.classList.remove('hidden');
            overlay.innerHTML = `<div class="overlay-panel" style="display:flex;gap:24px">` +
                `<div>${this._statHTML(guy)}</div>` +
                `<div><h2>Prepare for Combat</h2>` +
                `<div style="margin-bottom:8px;color:var(--gold)">Credits: ${guy.gold}C</div>` +
                options.map((o, i) => {
                    const avail = o.quit || o.cost <= guy.gold;
                    const cls = !avail ? 'menu-item disabled' :
                                i === sel ? 'menu-item selected' : 'menu-item';
                    const costStr = o.quit ? '' : (o.cost === 0 ? 'FREE' : `${o.cost}C`);
                    return `<div class="${cls}" data-idx="${i}">` +
                        `<span>${o.label}</span>` +
                        `<span class="cost">${costStr}</span></div>`;
                }).join('') +
                `<div class="hint" style="margin-top:12px">W/X or arrows to navigate, Enter to select</div>` +
                `</div></div>`;
        };

        render();

        while (true) {
            const ev = await input.waitKey();
            const k = ev.key.toLowerCase();

            if (k === 'arrowup' || k === 'w') {
                for (let j = 1; j < options.length; j++) {
                    const idx = (sel - j + options.length) % options.length;
                    const oo = options[idx];
                    if (oo.quit || oo.cost <= guy.gold) { sel = idx; break; }
                }
                render(); continue;
            }
            if (k === 'arrowdown' || k === 'x') {
                for (let j = 1; j < options.length; j++) {
                    const idx = (sel + j) % options.length;
                    const oo = options[idx];
                    if (oo.quit || oo.cost <= guy.gold) { sel = idx; break; }
                }
                render(); continue;
            }

            let picked = -1;
            if (k === 'enter' || k === ' ') picked = sel;
            else {
                for (let i = 0; i < options.length; i++)
                    if (options[i].key === k) { picked = i; break; }
            }
            if (picked < 0) continue;
            const o = options[picked];
            if (!o.quit && o.cost > guy.gold) continue;

            if (o.quit) { overlay.classList.add('hidden'); return AR_QUIT; }
            if (o.passage) { guy.gold -= 1000; overlay.classList.add('hidden'); return AR_PASSAGE; }

            guy.gold -= o.cost;
            guy.pts += o.pts;
            await this.buyStats(guy, o.stats);
            overlay.classList.add('hidden');
            return AR_OK;
        }
    }

    async buyStats(guy, allowedStats) {
        const overlay = document.getElementById('overlay');
        const allStatDefs = [
            { label: 'Improve Skill',    field: 'skill',  cost: STAT_COST.skill,  key: 's' },
            { label: 'Improve Strength', field: 'str',    cost: STAT_COST.str,    key: 't' },
            { label: 'Improve Health',   field: 'health', cost: STAT_COST.health, key: 'h' },
            { label: 'Improve Weapon',   field: 'weapon', cost: STAT_COST.weapon, key: 'w' },
            { label: 'Improve Armor',    field: 'armor',  cost: STAT_COST.armor,  key: 'a' },
        ];
        const statNames = allStatDefs.filter(s => allowedStats.includes(s.field));
        const doneIdx = statNames.length;

        let sel = 0;

        const render = () => {
            overlay.innerHTML = `<div class="overlay-panel" style="display:flex;gap:24px">` +
                `<div>${this._statHTML(guy)}</div>` +
                `<div><div class="points-left">Points: ${guy.pts}</div>` +
                statNames.map((s, i) => {
                    const avail = guy.pts >= s.cost;
                    const cls = !avail ? 'menu-item disabled' :
                                i === sel ? 'menu-item selected' : 'menu-item';
                    return `<div class="${cls}"><span>${s.label}</span>` +
                        `<span class="cost">${s.cost}pt</span></div>`;
                }).join('') +
                `<div class="${sel === doneIdx ? 'menu-item selected' : 'menu-item'}">` +
                `<span>Done</span></div>` +
                `<div class="hint" style="margin-top:12px">W/X to navigate, Enter to select</div>` +
                `</div></div>`;
        };

        render();

        while (true) {
            const ev = await input.waitKey();
            const k = ev.key.toLowerCase();
            const total = statNames.length + 1;

            if (k === 'arrowup' || k === 'w') {
                for (let j = 1; j < total; j++) {
                    const idx = (sel - j + total) % total;
                    if (idx === doneIdx || guy.pts >= statNames[idx].cost) { sel = idx; break; }
                }
                render(); continue;
            }
            if (k === 'arrowdown' || k === 'x') {
                for (let j = 1; j < total; j++) {
                    const idx = (sel + j) % total;
                    if (idx === doneIdx || guy.pts >= statNames[idx].cost) { sel = idx; break; }
                }
                render(); continue;
            }
            if (k === 'escape') break;

            let picked = -1;
            if (k === 'enter' || k === ' ') picked = sel;
            else if (k === 'd') picked = doneIdx;
            else {
                for (let i = 0; i < statNames.length; i++)
                    if (statNames[i].key === k) { picked = i; break; }
            }
            if (picked < 0) continue;
            if (picked === doneIdx) break;
            const s = statNames[picked];
            if (guy.pts < s.cost) continue;
            guy[s.field]++;
            guy.pts -= s.cost;
            const minCost = Math.min(...statNames.map(sn => sn.cost));
            if (guy.pts < minCost) break;
            render();
        }

        guy.health0 = guy.health;
        guy.att = guy.att0 = guy.calcAtt();
        guy.speed = guy.calcSpeed();
    }

    _statHTML(g) {
        return `<div class="stat-panel" style="min-width:200px">` +
            `<div class="name" style="color:${g.color}">${g.name}</div>` +
            `<div class="stat-row"><span class="label">Skill</span><span class="value">${g.skill}</span></div>` +
            `<div class="stat-row"><span class="label">Strength</span><span class="value">${g.str}</span></div>` +
            `<div class="stat-row"><span class="label">Health</span><span class="value">${g.health}</span></div>` +
            `<div class="stat-row"><span class="label">Weapon</span><span class="value">${g.weapon >= 0 ? '+' : ''}${g.weapon}</span></div>` +
            `<div class="stat-row"><span class="label">Armor</span><span class="value">${g.armor}</span></div>` +
            `<div class="stat-row"><span class="label">Speed</span><span class="value">${g.speed}</span></div>` +
            `<div class="stat-row"><span class="label">Points</span><span class="value">${g.calcPoints()}</span></div>` +
            `<div class="stat-row"><span class="label">Attack</span><span class="value">${g.att}/${g.att0}</span></div>` +
            (g.pts > 0 ? `<div class="stat-row"><span class="label">Saved Pts</span><span class="value">${g.pts}</span></div>` : ``) +
            `<div class="pop-row"><span>Pop: ${g.pop}</span><span style="color:var(--gold)">Gold: ${g.gold}C</span></div>` +
            `</div>`;
    }

    // ---- Between-fight stat adjustment ----

    async restoreGuys(combatants) {
        for (const g of combatants) {
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

    // ---- Promote / Demote ----

    async promoteGuys() {
        const overlay = document.getElementById('overlay');

        if (this.guys[0].pop >= this.maxPop) {
            if (this.guys[0].human) return AR_PROMOTE;
            overlay.classList.remove('hidden');
            overlay.innerHTML = `<div class="overlay-panel">` +
                `<div style="color:${this.guys[0].color};font-size:18px">${this.guys[0].name}</div>` +
                `<div style="color:var(--accent);margin-top:8px">has advanced to the next tier.</div>` +
                `<div class="hint">Press any key</div></div>`;
            await input.waitKey();
            overlay.classList.add('hidden');
            advanceGuys(this.guys, 0);
            this.newGuy(this.guys[this.guys.length - 1]);
        }

        for (let i = 0; i < this.guys.length; i++) {
            if (this.guys[i].pop <= this.minPop) {
                if (this.guys[i].human) return AR_DEMOTE;
                overlay.classList.remove('hidden');
                overlay.innerHTML = `<div class="overlay-panel">` +
                    `<div style="color:${this.guys[i].color};font-size:18px">${this.guys[i].name}</div>` +
                    `<div style="color:var(--danger);margin-top:8px">is being sent back.</div>` +
                    `<div class="hint">Press any key</div></div>`;
                await input.waitKey();
                overlay.classList.add('hidden');
                advanceGuys(this.guys, i);
                this.newGuy(this.guys[this.guys.length - 1]);
                i--;
            }
        }

        return AR_OK;
    }

    // ---- Standings ----

    _rosterHTML() {
        const listHTML = this.guys.map(gy =>
            `<div class="roster2-row">` +
            `<div class="r2-icon" style="background:${gy.color}"></div>` +
            `<span class="r2-name" style="${gy.human ? 'color:var(--text-bright)' : ''}">${gy.name}</span>` +
            `<span class="r2-info">${lpad(gy.pop, 3)} p${gy.calcPoints()}a${gy.calcAttStr()}</span></div>`
        ).join('');
        const human = this.guys.find(g => g.human);
        const goldLine = human ? `<div style="margin-top:12px;color:var(--gold)">You have ${human.gold}C</div>` : '';
        return listHTML + goldLine;
    }

    async showStandings(combatants) {
        document.getElementById('game-container').classList.add('hidden');
        const overlay = document.getElementById('overlay');
        overlay.classList.remove('hidden');

        const g = combatants;
        // Pyramid layout: combatants — 1, 2, 5
        const rows = [];
        if (g[0]) rows.push([g[0]]);
        if (g[1] || g[2]) rows.push([g[1], g[2]].filter(Boolean));
        const bottom = g.slice(3, 8).filter(Boolean);
        if (bottom.length) rows.push(bottom);

        const pyramidHTML = rows.map(row =>
            `<div class="pyramid-row">` +
            row.map(gy =>
                `<div class="pyramid-entry${gy.human ? ' human' : ''}">` +
                `<div class="p-name" style="color:${gy.color}">${gy.name}</div>` +
                `<div class="p-pop">Pop: ${gy.pop} p${gy.calcPoints()}a${gy.calcAttStr()}</div></div>`
            ).join('') + `</div>`
        ).join('');

        overlay.innerHTML = `<div class="overlay-panel">` +
            `<h2>Standings</h2>` +
            `<div class="pyramid">${pyramidHTML}</div>` +
            `<div style="margin-top:16px;border-top:1px solid var(--panel-border);padding-top:12px;max-height:300px;overflow-y:auto">${this._rosterHTML()}</div>` +
            `<div class="hint">Press any key</div></div>`;

        await input.waitKey();
        overlay.classList.add('hidden');
    }

    async showRoster2(title) {
        const overlay = document.getElementById('overlay');
        overlay.classList.remove('hidden');

        overlay.innerHTML = `<div class="overlay-panel">` +
            `<h2>${title}</h2>` +
            `<div style="max-height:400px;overflow-y:auto">${this._rosterHTML()}</div>` +
            `<div class="hint">Press any key</div></div>`;

        await input.waitKey();
        overlay.classList.add('hidden');
    }
}
