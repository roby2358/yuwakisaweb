// guy.js — Gladiator class: stats, combat mechanics, display

// ---- stat helpers ----

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
                    { g.skill += sign; pts -= STAT_COST.skill; }
                break;
            case 2:
                if (pts >= STAT_COST.health && (sign > 0 || g.health > 0))
                    { g.health += sign; pts -= STAT_COST.health; }
                break;
            case 3:
                if (pts >= STAT_COST.str && (sign > 0 || g.str > 0))
                    { g.str += sign; pts -= STAT_COST.str; }
                break;
            case 4:
                if (pts >= STAT_COST.weapon && (sign > 0 || g.weapon > 0))
                    { g.weapon += sign; pts -= STAT_COST.weapon; }
                break;
            case 5:
                if (pts >= STAT_COST.armor && (sign > 0 || g.armor > 0))
                    { g.armor += sign; pts -= STAT_COST.armor; }
                break;
        }
    }
}

// ---- showBar helper ----

function showBar(screen, x, y, size, max, val, att1, att2) {
    if (max <= 0) max = 1;
    let n = Math.floor((val * size + Math.floor(max / 2)) / max);
    n = clamp(n, 0, size);
    for (let i = 0; i < n; i++)      screen.plot(x+i, y, BLOCK, att1);
    for (let i = n; i < size; i++)    screen.plot(x+i, y, LTBLOCK, att2);
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
        this.pop = 0; this.gold = 100;
        this.time = 0;
        this.human = false;
        this.state = GUY_OK;
        this.ch = '?'; this.at = 15;
        this.target = null;
        this.base = null;
        this.showAtt = null; // non-null for human player
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
        return s <= 10 ? 10 : s < 30 ? s : 30;
    }

    advanceTime(ticks) {
        const slow = ATT_SLOW - Math.floor(ATT_SLOW * this.att / (this.att0 || 1));
        this.time += ticks * (this.speed + slow);
        return this.time;
    }

    // ---- generation ----

    randGuy(archetypes, points, variance) {
        const base = archetypes[R(0, archetypes.length - 1)];
        this.base = base;
        this.name = base.name;
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

    // ---- display ----

    show(map) {
        if (this.state) map.plot(this.x, this.y, this.ch, this.at);
        else this.blank(map);
    }
    blank(map) { map.showCell(this.x, this.y); }

    async showHit(map) {
        sound.play(300, 100);
        map.plot(this.x, this.y, '*', 4 | BACKGR);
        await delay(100);
        this.show(map);
    }

    async showBlink(map) {
        sound.play(Math.floor(20 * this.att / (this.att0||1) + 180), 200);
        map.plot(this.x, this.y, BLOCK, 12 | BACKGR);
        await delay(200);
        this.show(map);
    }

    async showAttackAnim(map) {
        sound.play(Math.floor(40 * this.att / (this.att0||1) + 200), 80);
        const blink = (this.at & 0xF0) === 4*16
            ? (this.at & 0x0F) | (7 << 4)
            : (this.at & 0x0F) | (4 << 4);
        map.plot(this.x, this.y, this.ch, blink);
        await delay(80);
        this.show(map);
    }

    async showRest(map) {
        map.plot(this.x, this.y, BLOCK, this.at);
        await delay(150);
        this.show(map);
    }

    async showKill(map) {
        sound.play(75, 400);
        for (let i = 0; i < 3; i++) {
            map.plot(this.x, this.y, '\u263C', 4 | BACKGR); await delay(60);
            map.plot(this.x, this.y, '*', 4 | BACKGR);      await delay(60);
        }
    }

    // ---- stat panels ----

    showStats(screen, x, y, bd) {
        if (bd && bd !== BD_NONE)
            screen.box(bd, x, y, x+17, y+9, BACKGR);
        let r = y;
        screen.putStr(x, r++, this.name.padEnd(18).slice(0,18), 14|BACKGR);
        screen.putStr(x, r++, 'Skill:'.padStart(7) + String(this.skill).padStart(3) + 'Weapon'.padStart(8), 15|BACKGR);
        const wpn = (this.weapon >= 0 ? '+' : '') + this.weapon;
        screen.putStr(x, r++, 'Str:'.padStart(7) + String(this.str).padStart(3) + wpn.padStart(8), 15|BACKGR);
        screen.putStr(x, r++, 'Speed:'.padStart(7) + String(this.speed).padStart(3) + 'Armor'.padStart(8), 15|BACKGR);
        screen.putStr(x, r++, 'Health:'.padStart(7) + String(this.health).padStart(3) + String(this.armor).padStart(8), 15|BACKGR);
        const info = `(${lpad(this.calcPoints(),4)} ${lpad(this.att,4)} ${lpad(this.att0,4)})`;
        screen.putStr(x, r++, info.padEnd(18).slice(0,18), 15|BACKGR);
        screen.putStr(x, r++, 'health/attack:'.padEnd(18).slice(0,18), 15|BACKGR);
        this.showBarRow(screen, x, r++);
        screen.putStr(x, r++, 'Popularity'.padEnd(10) + 'Gold'.padStart(8), BACKGR);
        screen.putStr(x, r++, String(this.pop).padEnd(10) + String(this.gold).padStart(8), BACKGR);
    }

    blankStats(screen, x, y, bd) {
        if (bd && bd !== BD_NONE)
            screen.box(bd | BD_FILL, x, y, x+17, y+9, BACKGR);
    }

    showBarRow(screen, x, y) {
        showBar(screen, x,   y, 4,  this.health0||1, this.health, 4, 1);
        showBar(screen, x+4, y, 14, this.att0||1,    this.att,   14, 1);
    }

    // ---- combat mechanics ----

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

    async attack(map, def) {
        await this.showAttackAnim(map);
        const ra = R(1,6) + R(0, this.att) + this.weapon;
        const rd = R(1,6) + Math.floor(R(0, def.att) / 2) + def.armor;

        const detail = `[${6+this.att+this.weapon}:${6+def.att+def.armor}] ${ra}-${rd} (${ra-rd+this.str})`;
        if (this.showAtt !== null) this.showAtt = detail;
        else if (def.showAtt !== null) def.showAtt = detail;

        if (ra >= rd) {
            const dmg = Math.floor((ra - rd) / 2) + this.str + this.weapon - def.armor;
            await def.hit(map, dmg);
        } else {
            this.att += ra - rd + this.str - 1;
            this.att = clamp(this.att, 1, this.att0);
            await this.showBlink(map);
        }
        await delay(200);
        if (this.att < 1) this.att = 1;
        def.rest(GUY_DEFEND);
    }

    async hit(map, dmg) {
        await this.showHit(map);
        if (dmg < 0) return;
        this.att -= dmg;
        while (this.att < 1) {
            if (this.health > 0) this.health--;
            this.att += R(1, (this.health0 + this.health) || 1);
            await this.showHit(map);
        }
        if (this.att > this.att0) this.att = this.att0;
        if (!this.health) await this.kill(map);
    }

    async kill(map) {
        this.state = GUY_DEAD;
        this.health = 0;
        this.att = 0;
        if (!map.check(this.x, this.y, FL_BLOOD)) {
            map.set(this.x, this.y, T_BLOOD);
            map.showCell(this.x, this.y);
        }
        await this.showKill(map);
        this.blank(map);
    }

    restore() {
        this.health = this.health0;
        this.att = this.att0 = this.calcAtt();
    }
}

// ---- Guy-list utility functions (operate on an array of Guy) ----

function guyAt(guys, x, y) {
    for (let i = 0; i < guys.length; i++)
        if (guys[i].state && guys[i].x === x && guys[i].y === y) return i;
    return -1;
}

function guyAdjacent(guys, map, x, y) {
    for (let i = 0; i < guys.length; i++)
        if (guys[i].state && map.adjacent(guys[i].x, guys[i].y, x, y)
            && (guys[i].x !== x || guys[i].y !== y)) return i;
    return -1;
}

function guyClosest(guys, map, x, y) {
    let best = -1, bestD = 1000;
    for (let i = 0; i < guys.length; i++) {
        if (!guys[i].state || (guys[i].x === x && guys[i].y === y)) continue;
        const d = map.range(x, y, guys[i].x, guys[i].y);
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

function showAllGuys(guys, map) {
    for (const g of guys) g.show(map);
}

function killAllGuys(guys, map) {
    for (const g of guys) if (g.state) g.kill(map);
}

function showRoster(screen, guys, x, y) {
    for (const g of guys) {
        const clr = g.state ? BACKGR : (4 | BACKGR);
        screen.putStr(x, y, g.name.slice(0,11).padEnd(11), clr);
        screen.plot(x+13, y, g.ch, g.at);
        screen.putStr(x+15, y, String(g.calcAttStr()).padStart(3), clr);
        showBar(screen, x+20, y, 4, g.health0||1, g.health, 4, 1);
        showBar(screen, x+24, y, 14, g.att0||1, g.att, 14, 1);
        y++;
    }
}

function showRoster2(screen, guys, x, y) {
    for (const g of guys) {
        const clr = g.state ? BACKGR : (4 | BACKGR);
        screen.putStr(x, y, g.name.slice(0,11).padEnd(11), clr);
        screen.plot(x+13, y, g.ch, g.at);
        const info = `${lpad(g.calcAttStr(),3)} (${lpad(g.calcPoints(),3)}) p${lpad(g.pop,3)}, ${lpad(g.gold,5)}C`;
        screen.putStr(x+15, y++, info, clr);
    }
}

// ---- attack bar (shown during human combat) ----

function attackBar(screen, g1, g2, x, y) {
    const mx = Math.max(g1.att0, g2.att0) || 1;
    const info = `${g1.name} ${g1.showAtt || ''}`;
    screen.putStr(x, y++, info.slice(0,28).padEnd(28), 14|BACKGR);
    showBar(screen, x, y, 4, g1.health0||1, g1.health, 4, 1);
    showBar(screen, x+4, y++, 14, mx, g1.att, 14, 1);
    showBar(screen, x, y, 4, g2.health0||1, g2.health, 4, 1);
    showBar(screen, x+4, y++, 14, mx, g2.att, 9, 1);
    screen.putStr(x, y++, g2.name.padEnd(18).slice(0,18), 14|BACKGR);
}

function checkShowAttack(screen, g1, g2) {
    if (g1.showAtt !== null) {
        attackBar(screen, g1, g2, 51, 12);
        g1.showStats(screen, 41, 1, BD_NONE);
        g2.showStats(screen, 61, 1, BD_NONE);
    } else if (g2.showAtt !== null) {
        attackBar(screen, g2, g1, 51, 12);
        g2.showStats(screen, 41, 1, BD_NONE);
        g1.showStats(screen, 61, 1, BD_NONE);
    }
}
