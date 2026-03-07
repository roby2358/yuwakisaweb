// main.js — Monster Gladiators entry point

async function main() {
    const canvas = document.getElementById('map-canvas');
    const renderer = new HexRenderer(canvas);
    const overlay = document.getElementById('overlay');

    // Init sound on first interaction
    document.addEventListener('click', () => sound.init(), { once: true });
    document.addEventListener('keydown', () => sound.init(), { once: true });

    // Loading screen
    overlay.classList.remove('hidden');
    overlay.innerHTML = `<div class="overlay-panel"><h2>Loading sprites...</h2></div>`;
    await renderer.loadSprites();

    // Title screen
    overlay.innerHTML =
        `<div class="overlay-panel">` +
        `<h1>MONSTER GLADIATORS</h1>` +
        `<div class="subtitle">Press any key to begin</div>` +
        `<div style="color:var(--text-dim);font-size:12px;line-height:1.8;margin-top:12px">` +
        `<div>Q &nbsp; E &nbsp;&nbsp; — move NW / NE</div>` +
        `<div>A S D &nbsp; — move W / rest / E</div>` +
        `<div>Z &nbsp; C &nbsp;&nbsp; — move SW / SE</div>` +
        `<div style="margin-top:6px">W / X — menu up / down</div>` +
        `<div>\` prefix for debug keys (\`k = kill all)</div>` +
        `</div></div>`;
    await input.waitKey();

    // Player setup
    const player = new Guy();
    player.set('Guy1', 5, 5, 5, 0, 0);
    player.human = true;
    player.showAtt = '';
    player.spriteRow = 0;
    player.spriteCol = 0;
    player.color = PALETTE[15];
    player.colorIdx = 15;

    // Create arena and generate roster
    const arena = new Arena(renderer);
    await arena.genList(player);

    // Main loop
    let result = AR_OK;
    while (result === AR_OK) {
        result = await arena.doArena();
    }

    // End message
    overlay.classList.remove('hidden');
    document.getElementById('game-container').classList.add('hidden');
    let msg = '';
    switch (result) {
        case AR_PROMOTE: msg = 'You made it to the next tier!'; break;
        case AR_DEMOTE:  msg = 'You have been sent back.'; break;
        case AR_QUIT:    msg = 'Thanks for playing!'; break;
    }
    overlay.innerHTML =
        `<div class="overlay-panel">` +
        `<h1>MONSTER GLADIATORS</h1>` +
        `<div style="color:var(--accent);font-size:18px;text-align:center;margin:16px 0">${msg}</div>` +
        `<div class="hint">Press any key to play again</div></div>`;
    await input.waitKey();
    location.reload();
}

main().catch(e => {
    console.error('MGLAD error:', e);
    document.getElementById('overlay').innerHTML =
        `<div class="overlay-panel"><h2 style="color:var(--danger)">Error</h2>` +
        `<div>${e.message}</div></div>`;
});
