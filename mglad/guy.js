// guy.js — Gladiator class: stats, combat mechanics, display helpers

// ---- Stat helpers ----

function calcPointsOf(g) {
    return g.skill * STAT_COST.skill + g.str * STAT_COST.str +
           g.health * STAT_COST.health + g.weapon * STAT_COST.weapon +
           g.armor * STAT_COST.armor;
}

function scale128(x, n) { return Math.floor((x * n + 64) / 128); }

function scaleStats(dst, base, factor) {
    dst.skill  = scale128(base.skill,  factor);
    dst.str    = scale128(base.str,    factor);
    dst.health = scale128(base.health, factor);
    dst.weapon = scale128(base.weapon, factor);
    dst.armor  = scale128(base.armor,  factor);
    if (dst.health <= 0) dst.health = 1;
}

function modifyStats(g, pts) {
    const sign = pts < 0 ? -1 : 1;
    pts = Math.abs(pts);
    let safety = 300;
    while (pts > 0 && --safety > 0) {
        const maxR = (pts > 1) ? (sign > 0 ? 5 : 3) : 2;
        const r = R(1, maxR);
        switch (r) {
            case 1:
                if (pts >= STAT_COST.skill && (sign > 0 || g.skill > 0))
                    { g.skill += sign; pts -= STAT_COST.skill; } break;
            case 2:
                if (pts >= STAT_COST.health && (sign > 0 || g.health > 0))
                    { g.health += sign; pts -= STAT_COST.health; } break;
            case 3:
                if (pts >= STAT_COST.str && (sign > 0 || g.str > 0))
                    { g.str += sign; pts -= STAT_COST.str; } break;
            case 4:
                if (pts >= STAT_COST.weapon && (sign > 0 || g.weapon > 0))
                    { g.weapon += sign; pts -= STAT_COST.weapon; } break;
            case 5:
                if (pts >= STAT_COST.armor && (sign > 0 || g.armor > 0))
                    { g.armor += sign; pts -= STAT_COST.armor; } break;
        }
    }
}

// ---- Guy class ----

class Guy {
    constructor() {
        this.x = 0; this.y = 0;
        this.name = '';
        this.skill = 6; this.str = 2;
        this.health = 2; this.health0 = 2;
        this.weapon = 0; this.armor = 0;
        this.att = 0; this.att0 = 0;
        this.speed = 30;
        this.pop = 0; this.gold = 100; this.pts = 0;
        this.time = 0;
        this.human = false;
        this.state = GUY_OK;
        this.target = null;
        this.base = null;
        this.showAtt = null;
        // Sprite info
        this.spriteRow = 0;   // archetype index → row in monsters.png
        this.spriteCol = 0;   // random variation
        this.color = PALETTE[15]; // display color
        this.colorIdx = 15;
        this.att0 = this.att = this.calcAtt();
    }

    set(name, skill, str, health, weapon, armor) {
        this.name = name;
        this.skill = skill; this.str = str;
        this.health0 = this.health = health;
        this.weapon = weapon; this.armor = armor;
        this.att0 = this.att = this.calcAtt();
        this.speed = this.calcSpeed();
    }

    calcAtt()    { return this.skill + this.str; }
    calcAttStr() { return Math.floor((this.att0 + 7 + this.weapon + this.armor) / 2); }
    calcPoints() { return calcPointsOf(this); }
    calcSpeed()  {
        const s = Math.floor(60 * this.calcPoints() / (this.skill * this.str || 1));
        return s <= 10 ? 10 : s < 40 ? s : 40;
    }

    advanceTime(ticks) {
        const slow = ATT_SLOW - Math.floor(ATT_SLOW * this.att / (this.att0 || 1));
        this.time += ticks * (this.speed + slow);
        return this.time;
    }

    // ---- Generation ----

    randGuy(archetypes, points, variance) {
        const idx = R(0, archetypes.length - 1);
        const base = archetypes[idx];
        this.base = base;
        this.name = base.name;
        this.spriteRow = base.sprite;
        this.spriteCol = R(0, SPRITE_COLS - 1);
        const fg = R(8, 15);
        this.colorIdx = fg;
        this.color = PALETTE[fg];

        const sp = points > variance * 3 ? points - variance * 3 : 5;
        scaleStats(this, base, sp);
        this.skill  += R(0, Math.floor(variance / STAT_COST.skill));
        this.str    += R(0, Math.floor(variance / STAT_COST.str));
        this.health += R(0, Math.floor(variance / STAT_COST.health));
        this.weapon += R(0, Math.floor(variance / STAT_COST.weapon));
        this.armor  += R(0, Math.floor(variance / STAT_COST.armor));
        if (this.skill  <= 0) this.skill  = 2;
        if (this.str    <= 0) this.str    = 2;
        if (this.health <= 0) this.health = 2;
        this.health0 = this.health;
        this.att0 = this.att = this.calcAtt();
        this.speed = this.calcSpeed();
    }

    // ---- Display on hex map ----

    show(renderer, hexmap) {
        if (this.state) {
            renderer.drawCell(hexmap, this.x, this.y);
            renderer.drawMonster(this.x, this.y, this.spriteRow, this.spriteCol, this.color);
            if (this.human)
                renderer.drawHexOutline(this.x, this.y, '#ffffff', 2);
        } else {
            this.blank(renderer, hexmap);
        }
    }

    blank(renderer, hexmap) {
        renderer.drawCell(hexmap, this.x, this.y);
    }

    // Hit effect (type 1) shown on TARGET (this = defender)
    async showHit(renderer, hexmap) {
        sound.play(300, 100);
        this.show(renderer, hexmap);
        renderer.drawEffect(this.x, this.y, 1, R(0, EFFECT_COLS * EFFECT_ROWS_PER_TYPE - 1));
        await delay(100);
        this.show(renderer, hexmap);
    }

    // Miss effect (type 0) shown on TARGET (def = defender who was missed)
    async showMissOn(renderer, hexmap, def) {
        sound.play(Math.floor(20 * this.att / (this.att0 || 1) + 180), 200);
        def.show(renderer, hexmap);
        renderer.drawEffect(def.x, def.y, 0, R(0, EFFECT_COLS * EFFECT_ROWS_PER_TYPE - 1));
        await delay(200);
        def.show(renderer, hexmap);
    }

    // Attacker flash (before hit/miss is resolved)
    async showAttackAnim(renderer, hexmap) {
        sound.play(Math.floor(40 * this.att / (this.att0 || 1) + 200), 80);
        renderer.highlightHex(this.x, this.y, this.color, 0.5);
        await delay(80);
        this.show(renderer, hexmap);
    }

    // Rest/shield effect (type 2) shown on SELF
    async showRest(renderer, hexmap) {
        this.show(renderer, hexmap);
        renderer.drawEffect(this.x, this.y, 2, R(0, EFFECT_COLS * EFFECT_ROWS_PER_TYPE - 1));
        await delay(150);
        this.show(renderer, hexmap);
    }

    async showKill(renderer, hexmap) {
        sound.play(75, 400);
        for (let i = 0; i < 3; i++) {
            renderer.drawCell(hexmap, this.x, this.y);
            renderer.highlightHex(this.x, this.y, '#ff2200', 0.6);
            await delay(60);
            renderer.drawCell(hexmap, this.x, this.y);
            renderer.drawEffect(this.x, this.y, 1, R(0, EFFECT_COLS * EFFECT_ROWS_PER_TYPE - 1));
            await delay(60);
        }
    }

    // ---- Combat mechanics ----

    rest(st) {
        switch (st) {
            case GUY_REST:
                this.att += Math.floor((this.att0 - this.att + 1) / 2);
                this.advanceTime(2);
                break;
            case GUY_ATTACK:
                this.att--;
                this.advanceTime(2);
                break;
            case GUY_DEFEND:
                this.att--;
                break;
            case GUY_HIT:
                this.att += R(1, this.health0 || 1);
                break;
            case GUY_MOVE:
            default:
                if (this.att < this.att0 && R(0, this.skill) < this.str)
                    this.att += Math.floor((this.att0 - this.att + 1) / 3);
                this.advanceTime(1);
                break;
        }
        this.att = clamp(this.att, 1, this.att0);
    }

    async attack(renderer, hexmap, def) {
        await this.showAttackAnim(renderer, hexmap);
        const ra = R(1, 6) + R(0, this.att + this.str) + this.weapon;
        const rd = R(1, 6) + Math.floor(R(0, def.att) / 2) + def.armor;

        const detail = `[${6 + this.att + this.str + this.weapon}:${6 + def.att + def.armor}] ${ra}-${rd} (${ra - rd})`;
        if (this.showAtt !== null) this.showAtt = detail;
        else if (def.showAtt !== null) def.showAtt = detail;

        if (ra >= rd) {
            const dmg = Math.floor((ra - rd) / 2) + this.weapon - def.armor;
            await def.hit(renderer, hexmap, dmg);
        } else {
            this.att += ra - rd + this.str - 1;
            this.att = clamp(this.att, 1, this.att0);
            await this.showMissOn(renderer, hexmap, def);
        }
        await delay(200);
        if (this.att < 1) this.att = 1;
        def.rest(GUY_DEFEND);
    }

    async hit(renderer, hexmap, dmg) {
        await this.showHit(renderer, hexmap);
        if (dmg < 0) return;
        this.att -= dmg;
        while (this.att < 1) {
            if (this.health > 0) this.health--;
            this.att += R(1, (this.health0 + this.health) || 1);
            await this.showHit(renderer, hexmap);
        }
        if (this.att > this.att0) this.att = this.att0;
        if (!this.health) await this.kill(renderer, hexmap);
    }

    async kill(renderer, hexmap) {
        this.state = GUY_DEAD;
        this.health = 0;
        this.att = 0;
        if (!hexmap.check(this.x, this.y, FL_BLOOD))
            hexmap.set(this.x, this.y, T_BLOOD);
        await this.showKill(renderer, hexmap);
        this.blank(renderer, hexmap);
    }

    restore() {
        this.health = this.health0;
        this.att = this.att0 = this.calcAtt();
    }
}

// ---- Guy-list utilities ----

function guyAt(guys, x, y) {
    for (let i = 0; i < guys.length; i++)
        if (guys[i].state && guys[i].x === x && guys[i].y === y) return i;
    return -1;
}

function guyAdjacent(guys, x, y) {
    for (let i = 0; i < guys.length; i++)
        if (guys[i].state && hexAdjacent(guys[i].x, guys[i].y, x, y)
            && (guys[i].x !== x || guys[i].y !== y)) return i;
    return -1;
}

function guyClosest(guys, x, y) {
    let best = -1, bestD = 1000;
    for (let i = 0; i < guys.length; i++) {
        if (!guys[i].state || (guys[i].x === x && guys[i].y === y)) continue;
        const d = hexDist(x, y, guys[i].x, guys[i].y);
        if (d < bestD) { best = i; bestD = d; }
    }
    return best;
}

function minTime(guys) {
    let t = 100000;
    for (const g of guys) if (g.state && g.time < t) t = g.time;
    return t;
}

function numAlive(guys) {
    let n = 0;
    for (const g of guys) if (g.state) n++;
    return n;
}

function rankGuy(guys, a, b) {
    if (a <= b) return;
    const g = guys.splice(a, 1)[0];
    guys.splice(b, 0, g);
}

function advanceGuys(guys, idx) {
    guys.splice(idx, 1);
    guys.push(new Guy());
}

function showAllGuys(guys, renderer, hexmap) {
    for (const g of guys) g.show(renderer, hexmap);
}

async function killAllGuys(guys, renderer, hexmap) {
    for (const g of guys) if (g.state) await g.kill(renderer, hexmap);
}

// ---- UI helpers for stat panels and roster (DOM-based) ----

function barHTML(val, max, color, width) {
    if (max <= 0) max = 1;
    const pct = clamp(val / max * 100, 0, 100);
    return `<div style="display:flex;gap:1px;height:8px;width:${width}px">` +
        `<div class="bar-health" style="width:${pct}%;background:${color}"></div>` +
        `<div class="bar-empty" style="flex:1"></div></div>`;
}

function renderStatPanel(el, g) {
    if (!g || !g.state) { el.innerHTML = ''; return; }
    el.innerHTML =
        `<div class="name" style="color:${g.color}">${g.name}</div>` +
        `<div class="stat-row"><span class="label">Skill</span><span class="value">${g.skill}</span>` +
        `<span class="label">Weapon</span><span class="value">${g.weapon >= 0 ? '+' : ''}${g.weapon}</span></div>` +
        `<div class="stat-row"><span class="label">Str</span><span class="value">${g.str}</span>` +
        `<span class="label">Armor</span><span class="value">${g.armor}</span></div>` +
        `<div class="stat-row"><span class="label">Speed</span><span class="value">${g.speed}</span>` +
        `<span class="label">Health</span><span class="value">${g.health}/${g.health0}</span></div>` +
        `<div class="stat-row"><span class="label">Pts</span><span class="value">${g.calcPoints()}</span>` +
        `<span class="label">Att</span><span class="value">${g.att}/${g.att0}</span></div>` +
        `<div class="bars" style="display:flex;gap:2px;margin-top:4px">` +
        barHTML(g.health, g.health0, '#ff4444', 40) +
        barHTML(g.att, g.att0, '#4488ff', 100) +
        `</div>` +
        `<div class="pop-row"><span>Pop: ${g.pop}</span><span>Gold: ${g.gold}</span></div>`;
}

function renderRoster(el, guys) {
    el.innerHTML = guys.map(g => {
        const dead = !g.state ? ' dead' : '';
        return `<div class="roster-row${dead}">` +
            `<div class="r-icon" style="background:${g.color}"></div>` +
            `<span class="r-name">${g.name}</span>` +
            `<span class="r-power">p${g.calcPoints()}a${g.calcAttStr()}</span>` +
            `<div class="r-bars">` +
            barHTML(g.health, g.health0 || 1, '#ff4444', 30) +
            barHTML(g.att, g.att0 || 1, '#4488ff', 80) +
            `</div></div>`;
    }).join('');
}

function renderAttackInfo(el, g1, g2) {
    if (!g1 && !g2) { el.innerHTML = ''; return; }
    const a = (g1 && g1.showAtt !== null) ? g1 : g2;
    const b = (a === g1) ? g2 : g1;
    if (!a || !b) { el.innerHTML = ''; return; }
    const mx = Math.max(a.att0, b.att0) || 1;
    el.innerHTML =
        `<div class="att-names"><span style="color:${a.color}">${a.name}</span>` +
        `<span style="color:${b.color}">${b.name}</span></div>` +
        `<div class="att-detail">${a.showAtt || ''}</div>` +
        `<div class="att-bars">` +
        `<div class="att-bar-row">` + barHTML(a.health, a.health0 || 1, '#ff4444', 30) +
        barHTML(a.att, mx, '#4488ff', 120) + `</div>` +
        `<div class="att-bar-row">` + barHTML(b.health, b.health0 || 1, '#ff4444', 30) +
        barHTML(b.att, mx, '#5599ff', 120) + `</div></div>`;
}
