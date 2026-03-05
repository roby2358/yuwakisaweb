// image.js — Monster Gladiators main entry point

async function main() {
    const canvas = document.getElementById('screen');
    const screen = new Screen(canvas);

    // init sound on first user interaction
    canvas.addEventListener('click', () => sound.init(), { once: true });
    document.addEventListener('keydown', () => sound.init(), { once: true });

    // title screen
    screen.screenFade();
    screen.putStr(28, 10, 'MONSTER GLADIATORS', 15 | BACKGR);
    screen.putStr(24, 12, 'Press any key to begin...', 14 | BACKGR);
    screen.putStr(18, 15, 'QWEASDZXC = move (S = rest)', 8 | BACKGR);
    screen.putStr(18, 16, 'Arrow keys also work for 4-dir', 8 | BACKGR);
    screen.putStr(18, 17, '` prefix for debug keys (`k = kill all)', 8 | BACKGR);
    await screen.waitKey();

    // set up player
    const player = new Guy();
    player.set('Guy1', 6, 4, 5, 0, 0);
    player.human = true;
    player.showAtt = '';
    player.ch = '0';
    player.at = 15 + 0 * 16;

    // create arena and generate roster
    const arena = new Arena(screen);
    await arena.genList(player);

    // main loop
    let result = AR_OK;
    while (result === AR_OK) {
        result = await arena.doArena();
    }

    // end message
    screen.screenFade();
    switch (result) {
        case AR_PROMOTE:
            screen.putStr(2, 20, 'You made it to the next tier!', 12 | BACKGR);
            break;
        case AR_DEMOTE:
            screen.putStr(2, 20, 'You have been sent back.', 12 | BACKGR);
            break;
        case AR_QUIT:
            screen.putStr(2, 20, 'Thanks for playing!', 12 | BACKGR);
            break;
    }
    await screen.waitKey();

    // restart option
    screen.putStr(2, 22, 'Press any key to play again...', 14 | BACKGR);
    await screen.waitKey();
    location.reload();
}

main().catch(e => console.error('MGLAD error:', e));
