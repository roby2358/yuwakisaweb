# SHIP: Thing Factory

Audited 2026-11-17 at f65efa8.

Audited from the code and docs only. This session did no play in a browser (the author
does browser testing), so every item that needs real play is marked `unverified` and says
what would check it.

## Verdict

| Tier | Ready? | Open items (this tier and below) |
|---|---|---|
| T1 Jam-plus | no | 16 |
| T2 Solid hobby | no | 70 |
| T3 Commercial-grade | no | 85 |

**Cut line:** T2 Solid hobby

## Decisions

- **Devices:** desktop only (mouse and keyboard). Phones and tablets get the sorry screen (D-41).
- **Telemetry:** direction chosen, details `open`. Log basically every action to Cloudflare D1 behind a small Worker at ttdat.yuwakisa.com. The schema, privacy notice, opt-in or out, retention and portal CORS still need brainstorming (idea telemetry-v54s).
- **Languages:** English only. The string table should still be made ready for more (LOC-2).
- **Hosting:** the game moves to its own repo and is served at https://ttdat.yuwakisa.com on Cloudflare. Also on itch.io and Newgrounds.
- **Monetization:** none; the game is free.
- **AI disclosure (draft):**
  > Built with AI, start to finish, and that's the point. The code, the design docs, the
  > board art and the bleeps were all made in conversation with Claude (Anthropic) in
  > Claude Code, one human steering and a lot of machine building. Nothing is a generated
  > image or a sample: the art is drawn by code on a canvas and the sound is synthesized
  > live. System fonts only; no third-party code.
- **Newgrounds and AI-made games:** `open` (X-1).

## Targets

| Target | URL | Frame size | Commit live | Date | How to deploy |
|---|---|---|---|---|---|
| Own site | https://ttdat.yuwakisa.com (planned) | n/a | — | — | `just deploy` (own-deploy-kfi7) |
| itch.io | — | 1280x720, fullscreen on | — | — | upload the `just ship` zip (ship-bundle-wyxt) |
| Newgrounds | — | 1280x720, fullscreen on | — | — | upload the `just ship` zip |
| Old copy | yuwakisa.com/thingthatdoesathing/ | n/a | f65efa8 (deploys with yuwakisaweb) | — | retire or redirect after the move (X-2) |

## Blocking the cut line

Open T1 and T2 items, ordered by how many first-time players each one loses. "you" means
it needs the author: it gets no pjpd task.

| Id | Item | Tier | Status | Evidence | Task |
|---|---|---|---|---|---|
| WEB-1 | HTTPS at a stable URL | T1 | missing | ttdat.yuwakisa.com not set up yet | own-deploy-kfi7 |
| PORT-1 | Portal upload zip | T1 | missing | no build step; no zip | ship-bundle-wyxt |
| WEB-2 | Only the game is deployed | T1 | partial | today the whole folder ships, docs, test/ and pjpd/ included | ship-bundle-wyxt |
| SAVE-1 | Progress survives a reload | T1 | missing | nothing stored anywhere; an endless run is lost on reload | save-resume-tbe3 |
| MOB-3 | A way past the sorry screen | T1 | missing | index.js: a touch device is hard-blocked | sorry-past-zwbb |
| MOB-2 | Detect by capability | T1 | partial | displayartifacts.js:39 query lacks the `(any-pointer: fine)` check, so a tablet with a mouse is blocked | sorry-past-zwbb |
| PORT-3 | Fits the declared frame | T1 | partial | layout fills the window; 1280x720 never checked | portal-frame-aqns |
| PORT-2 | Keyboard focus in the frame | T1 | partial | the intro click focuses the frame; no "click to resume" after focus is lost | portal-frame-aqns |
| PORT-7 | Honest device flags | T1 | missing | no listings yet | listing-r8fn |
| INP-1 | Game keys vs browser keys | T1 | partial | gameui.js:1543-1552: Ctrl+D also removes a Thing; Space and Enter preventDefault even with modifiers held | key-mods-dsxi |
| AUD-2 | Mute, one action away, persisted | T1 | missing | no mute | mute-button-twa8 |
| PRIV-1 | Telemetry decision recorded | T1 | partial | direction recorded; schema and notice open | you (telemetry-v54s) |
| ONB-1 | A stranger makes a first move unaided | T1 | unverified | needs a cold play by someone new | you |
| ERR-1 | Clean console on a normal run | T1 | unverified | uiboot.js plays clean on a stub DOM; needs a real-browser console check | you |
| LOAD-1 | Works on the real host from a clean profile | T1 | unverified | host not up; all paths relative and lowercase | you, after own-deploy |
| PLAY-1 | Played on the shipped build | T1 | unverified | endless: play a fresh run on each size past a few milestones | you |
| MENU-5 | Continue vs New Game | T2 | missing | no save yet | save-resume-tbe3 |
| SAVE-4 | Save format versioned | T2 | missing | no save yet | save-resume-tbe3 |
| SAVE-8 | Seed saved with the run | T2 | missing | no save yet | save-resume-tbe3 |
| ONB-4 | Rules reference on demand | T2 | partial | Help lists keys only; the rules and numbers are in the README | rules-ref-6h66 |
| ONB-8 | A rejected action says why | T2 | partial | illegal clicks and keys are silent | reject-why-23qa |
| INP-4 | Every action on screen | T2 | partial | D, B and R are keyboard-only | action-btns-pebc |
| A11Y-2 | Color is never the only signal | T2 | partial | the four crate colors differ by color only | color-shapes-r5qq |
| MOB-8 | HiDPI and zoom crisp | T2 | partial | gameui.js:420 has no devicePixelRatio | hidpi-678j |
| MOB-7 | Small desktop window | T2 | unverified | check at 1280x720 and 960x600 | portal-frame-aqns |
| ERR-3 | Visible, recoverable crash | T2 | missing | no error handlers | crash-screen-zruz |
| LOAD-3 | Updates reach players | T2 | missing | no cache-busting | ship-bundle-wyxt |
| MENU-7 | Auto-pause when hidden | T2 | partial | Go keeps ticking from setTimeout in a background tab (gameui.js:812) | hidden-pause-y9wi |
| LOAD-5 | Doesn't spin when idle | T2 | partial | redraws only on change; Go runs while hidden | hidden-pause-y9wi |
| SET-1 | Settings screen | T2 | missing | none | settings-rrcw |
| SET-2 | Fullscreen toggle | T2 | missing | none | settings-rrcw |
| SET-3 | Speed controls | T2 | missing | HOP_MS and RUN_GAP_MS are fixed | settings-rrcw |
| SET-4 | Reduced motion | T2 | missing | bursts and fades always on | settings-rrcw |
| AUD-4 | Volume control | T2 | missing | VOLUME is a constant in sound.js | settings-rrcw |
| SAVE-6 | Settings saved apart from progress | T2 | missing | nothing saved | settings-rrcw |
| ONB-9 | Hints don't nag returning players | T2 | partial | the keys legend shows after every intro | settings-rrcw |
| PORT-4 | Fullscreen in the frame | T2 | missing | no toggle | settings-rrcw |
| LEGAL-4 | Credits screen | T2 | missing | none | credits-55gy |
| LEGAL-5 | AI disclosure in game | T2 | missing | drafted above, not in game | credits-55gy |
| OPS-2 | Version visible | T2 | missing | none | credits-55gy |
| OPS-1 | Feedback channel | T2 | missing | none | credits-55gy |
| PRIV-3 | What is stored is stated | T2 | missing | none | credits-55gy |
| WEB-7 | A way back | T2 | missing | no link to yuwakisa.com | credits-55gy |
| MENU-6 | End payoff | T2 | partial | endless; milestone banners only; New Game drops the run unseen | run-stats-m6pe |
| SAVE-7 | Player can wipe data | T2 | missing | nothing to wipe yet | wipe-data-mw24 |
| WEB-3 | Title, description, favicon | T2 | done | tags in index.html (D-56) | meta-tags-dagy |
| WEB-4 | Link previews | T2 | partial | tags in; waiting on the user for og.png (1200x630, repo root) | meta-tags-dagy |
| WEB-6 | One-paragraph pitch | T2 | missing | intro text is close but not written as a pitch | listing-r8fn |
| PORT-8 | Listing complete | T2 | missing | no listings | listing-r8fn |
| PORT-9 | Portal AI disclosure field | T2 | missing | no listings | listing-r8fn |
| LOC-2 | Strings in one table | T2 | missing | text spread over index.html, THING_LOOK, gameui.js | string-table-c2cy |
| LOC-3 | No concatenated sentences | T2 | partial | some card and banner text is built with + | string-table-c2cy |
| LEGAL-7 | Repo license decided | T2 | partial | MIT in yuwakisaweb/LICENSE; the new repo needs its own | own-deploy-kfi7 |
| OPS-3 | Tagged, repeatable deploy | T2 | missing | no deploy steps for the new host | own-deploy-kfi7 |
| OPS-4 | Patch path known | T2 | partial | no save versioning yet; no deploy recipe | own-deploy-kfi7 |
| X-2 | Retire the old yuwakisa.com copy | T2 | missing | two live copies after the move | own-deploy-kfi7 |
| ONB-7 | Consequences previewed | T2 | partial | legal hexes and facing shown; no path preview or undo, and remove/blast/Bomb are instant | design call: idea undo-preview-k9rq |
| WEB-5 | Capsule and screenshots | T2 | missing | none; must come from real play | you |
| X-1 | Newgrounds accepts an AI-made game | T2 | unverified | Newgrounds' art rules keep AI art out of the Art Portal, and since March 2024 players can report mostly-AI content; no rule found for games | you: check Newgrounds' current game rules |
| AUD-6 | Sound levels balanced | T2 | unverified | needs a listen | you |
| LOAD-4 | Frame rate on a modest laptop | T2 | unverified | huge board, Go on, busiest moment | you |
| LOAD-8 | Chrome and Firefox | T2 | unverified | play once in each | you |
| A11Y-1 | Text readable | T2 | unverified | body 14px, labels 13px (index.css:25, 65); contrast not measured | you |
| TXT-2 | One name for each thing | T2 | unverified | needs a read across UI, help and README | you |
| TXT-3 | Proofread | T2 | unverified | needs a read of every screen | you |
| LOC-5 | Layout survives longer text | T2 | unverified | needs a padded-strings look | you |
| LEGAL-6 | Name is its own | T2 | unverified | search "Thing Factory" on itch.io, Newgrounds and the web | you |
| PLAY-2 | Reload at awkward moments | T2 | unverified | after save-resume lands | you |
| PLAY-3 | Someone else played it | T2 | unverified | a friend, unhelped | you |
| PORT-10 | Tested on the live draft page | T2 | unverified | after the listings exist | you |

## By area

### MENU

| Id | Item | Tier | Status | Evidence | Task |
|---|---|---|---|---|---|
| MENU-1 | Title screen | T1 | done | index.html `#intro-panel`: the name, the goal and a board picker; the pick starts the game and the fanfare (audio gesture) | |
| MENU-2 | End states | T1 | n/a | endless by design: no win, no loss (CLAUDE.md) | |
| MENU-3 | Restart without reload | T1 | done | New Game → `startGame` (gameui.js:393) resets the pick, selection, animation, Go timer and zoom | |
| MENU-4 | Pause | T2 | n/a | turn-based; Go/Pause is the clock and Help holds it | |
| MENU-5 | Continue vs New Game | T2 | missing | see above | save-resume-tbe3 |
| MENU-6 | End payoff | T2 | partial | see above | run-stats-m6pe |
| MENU-7 | Auto-pause when hidden | T2 | partial | see above | hidden-pause-y9wi |

### SAVE

Endless and played over many sittings, so SAVE-1 is T1. In a portal frame SAVE-2 and SAVE-5
are T1 as well.

| Id | Item | Tier | Status | Evidence | Task |
|---|---|---|---|---|---|
| SAVE-1 | Survives reload | T1 | missing | see above | save-resume-tbe3 |
| SAVE-2 | Storage failure survivable | T1 | n/a | nothing stored yet; save-resume and mute must meet it | save-resume-tbe3 |
| SAVE-3 | Corrupt save doesn't brick | T1 | n/a | nothing stored yet | save-resume-tbe3 |
| SAVE-4 | Versioned | T2 | missing | | save-resume-tbe3 |
| SAVE-5 | Namespaced keys | T1 | n/a | nothing stored yet | save-resume-tbe3 |
| SAVE-6 | Settings apart | T2 | missing | | settings-rrcw |
| SAVE-7 | Wipe data | T2 | missing | | wipe-data-mw24 |
| SAVE-8 | Seed saved | T2 | missing | | save-resume-tbe3 |
| SAVE-9 | Export/import | T3 | missing | | |
| SAVE-10 | Multi-tab safety | T3 | missing | | |

### AUD

| Id | Item | Tier | Status | Evidence | Task |
|---|---|---|---|---|---|
| AUD-1 | Audio from a gesture | T1 | done | sound.js creates the AudioContext on the first cue, inside a click or keypress | |
| AUD-2 | Mute | T1 | missing | | mute-button-twa8 |
| AUD-3 | Has sound | T2 | done | sound.js cues on place, wait, splat, milestone | |
| AUD-4 | Volume | T2 | missing | | settings-rrcw |
| AUD-5 | Not sound alone | T2 | done | every cue pairs with an animation or banner | |
| AUD-6 | Levels balanced | T2 | unverified | | you |
| AUD-7 | Music loops | T2 | n/a | no music | |

### SET

| Id | Item | Tier | Status | Evidence | Task |
|---|---|---|---|---|---|
| SET-1 | Settings screen | T2 | missing | | settings-rrcw |
| SET-2 | Fullscreen | T2 | missing | | settings-rrcw |
| SET-3 | Speed | T2 | missing | | settings-rrcw |
| SET-4 | Reduced motion | T2 | missing | | settings-rrcw |
| SET-5 | Remapping | T3 | missing | | |
| SET-6 | UI scale | T3 | missing | the map has 1/2/∞ zoom; the HUD text doesn't scale | |

### ONB

| Id | Item | Tier | Status | Evidence | Task |
|---|---|---|---|---|---|
| ONB-1 | First move unaided | T1 | unverified | | you |
| ONB-2 | Goal stated | T1 | done | intro: get crates to the target, 10, 20, 50, 100…; nothing to lose | |
| ONB-3 | Controls in game | T2 | done | the keys legend shows after the first pick and from Help | |
| ONB-4 | Rules reference | T2 | partial | | rules-ref-6h66 |
| ONB-5 | Teach by doing | T2 | done | cards unlock one step per milestone (UNLOCKS, D-30) | |
| ONB-6 | Inspectable | T2 | done | the hover bar names terrain, Thing and piece | |
| ONB-7 | Consequences previewed | T2 | partial | | idea undo-preview-k9rq |
| ONB-8 | Rejection says why | T2 | partial | | reject-why-23qa |
| ONB-9 | Hints don't nag | T2 | partial | | settings-rrcw |
| ONB-10 | Soft first loss | T3 | done | no loss state | |

### MOB

| Id | Item | Tier | Status | Evidence | Task |
|---|---|---|---|---|---|
| MOB-1 | Sorry screen | T1 | done | viewport meta (index.html:5); `#sorry-panel` (D-41) | |
| MOB-2 | Capability detection | T1 | partial | | sorry-past-zwbb |
| MOB-3 | Way past it | T1 | missing | | sorry-past-zwbb |
| MOB-4 | Sells the game | T2 | done | name, picture, one line, plain "needs a mouse and a keyboard" | |
| MOB-5 | Helps them come back | T2 | missing | no copy link or share | sorry-past-zwbb |
| MOB-6 | Before heavy loading | T2 | done | the whole game is about 208 KB with no assets; it boots nothing on touch | |
| MOB-7 | Small window | T2 | unverified | | portal-frame-aqns |
| MOB-8 | HiDPI / zoom | T2 | partial | | hidpi-678j |

### INP

| Id | Item | Tier | Status | Evidence | Task |
|---|---|---|---|---|---|
| INP-1 | Keys vs browser | T1 | partial | | key-mods-dsxi |
| INP-2 | Right-click and drag | T1 | done | contextmenu blocked on the canvas (gameui.js:1451); `user-select: none` | |
| INP-3 | Focus loss | T2 | done | no held keys; the drag ends on a window mouseup | |
| INP-4 | Actions on screen | T2 | partial | | action-btns-pebc |
| INP-5 | Double input safe | T2 | done | placing waits for the animation (gameui.js handleClick) | |
| INP-6 | Trackpad | T2 | done | drag pans; R turns; zoom is buttons | |
| INP-7 | Other layouts | T2 | done | letter mnemonics only, read from `e.key` | |
| INP-8 | Full keyboard | T3 | partial | Map zoom and board hexes need the mouse | |

### ERR

| Id | Item | Tier | Status | Evidence | Task |
|---|---|---|---|---|---|
| ERR-1 | Clean console | T1 | unverified | | you |
| ERR-2 | No soft-locks | T1 | done | Wait and Discard are always legal; Esc always leaves a pick mode; smoke.js plays random commands | |
| ERR-3 | Crash screen | T2 | missing | | crash-screen-zruz |
| ERR-4 | Debug off | T2 | done | no `console.*`, no cheat keys | |
| ERR-5 | Disconnect | T2 | n/a | no server yet; telemetry must fail silently (PRIV-4) | |
| ERR-6 | Long-session stability | T3 | unverified | | |
| ERR-7 | Missing capability | T3 | missing | no `<noscript>` | |

### LOAD

| Id | Item | Tier | Status | Evidence | Task |
|---|---|---|---|---|---|
| LOAD-1 | Real host, clean profile | T1 | unverified | | you |
| LOAD-2 | Something appears at once | T2 | done | tiny payload, system fonts | |
| LOAD-3 | Updates reach players | T2 | missing | | ship-bundle-wyxt |
| LOAD-4 | Frame rate | T2 | unverified | | you |
| LOAD-5 | Idle | T2 | partial | | hidden-pause-y9wi |
| LOAD-6 | No third-party hosts | T2 | done | no network requests in code; system font stack (index.css:15) | |
| LOAD-7 | Payload | T3 | done | about 208 KB of JS, HTML and CSS; no images or audio files | |
| LOAD-8 | Chrome and Firefox | T2 | unverified | | you |
| LOAD-9 | Safari | T3 | unverified | | |

### A11Y

| Id | Item | Tier | Status | Evidence | Task |
|---|---|---|---|---|---|
| A11Y-1 | Readable | T2 | unverified | | you |
| A11Y-2 | Not color alone | T2 | partial | | color-shapes-r5qq |
| A11Y-3 | No fast flashing | T2 | done | bursts are single, short fades | |
| A11Y-4 | No reaction gate | T2 | done | turn-based; Go is optional | |
| A11Y-5 | DOM labeled | T3 | partial | real `<button>`s; the card canvases have no labels | |
| A11Y-6 | Colorblind pass | T3 | unverified | | |

### TXT

| Id | Item | Tier | Status | Evidence | Task |
|---|---|---|---|---|---|
| TXT-1 | No placeholders | T1 | done | grep for TODO, lorem and FIXME finds nothing; the title is "Thing Factory" | |
| TXT-2 | One name per thing | T2 | unverified | | you |
| TXT-3 | Proofread | T2 | unverified | | you |
| TXT-4 | Rule numbers match | T2 | done | the intro's 10, 20, 50, 100 match `nextMilestone`; Help has no other numbers (rules-ref will draw them from the artifacts) | |

### LOC

| Id | Item | Tier | Status | Evidence | Task |
|---|---|---|---|---|---|
| LOC-1 | Decision recorded | T2 | done | English only (Decisions) | |
| LOC-2 | String table | T2 | missing | | string-table-c2cy |
| LOC-3 | No concatenation | T2 | partial | | string-table-c2cy |
| LOC-4 | No text in images | T2 | done | no images | |
| LOC-5 | Longer text | T2 | unverified | | you |
| LOC-6 | `<html lang>` | T2 | done | `lang="en"` | |
| LOC-7…LOC-14 | Translation items | T3 | n/a | English only | |

### WEB

| Id | Item | Tier | Status | Evidence | Task |
|---|---|---|---|---|---|
| WEB-1 | HTTPS stable URL | T1 | missing | | own-deploy-kfi7 |
| WEB-2 | Only the game deployed | T1 | partial | | ship-bundle-wyxt |
| WEB-3 | Title, description, favicon | T2 | partial | | meta-tags-dagy |
| WEB-4 | Link previews | T2 | missing | | meta-tags-dagy |
| WEB-5 | Capsule and screenshots | T2 | missing | | you |
| WEB-6 | Pitch | T2 | missing | | listing-r8fn |
| WEB-7 | Way back | T2 | missing | | credits-55gy |
| WEB-8 | Clip or GIF | T3 | missing | | |
| WEB-9 | Old URLs | T3 | partial | the move leaves yuwakisa.com/thingthatdoesathing/ (X-2) | own-deploy-kfi7 |
| WEB-10 | Embedding policy | T3 | missing | | |

### LEGAL

| Id | Item | Tier | Status | Evidence | Task |
|---|---|---|---|---|---|
| LEGAL-1 | Provenance inventory | T1 | done | see Provenance | |
| LEGAL-2 | Third-party licenses | T1 | done | no third-party code, fonts or media | |
| LEGAL-3 | AI tool terms | T1 | done | Claude via Claude Code; Anthropic's terms give the user the outputs | |
| LEGAL-4 | Credits screen | T2 | missing | | credits-55gy |
| LEGAL-5 | AI disclosure | T2 | missing | | credits-55gy |
| LEGAL-6 | Name is its own | T2 | unverified | | you |
| LEGAL-7 | Repo license | T2 | partial | | own-deploy-kfi7 |
| LEGAL-8 | Content notes | T3 | n/a | cartoon splats only | |

### PRIV

| Id | Item | Tier | Status | Evidence | Task |
|---|---|---|---|---|---|
| PRIV-1 | Telemetry decision | T1 | partial | | you (telemetry-v54s) |
| PRIV-2 | No uncovered tracking | T1 | done | no scripts, beacons or fetches | |
| PRIV-3 | What's stored is stated | T2 | missing | | credits-55gy |
| PRIV-4 | Telemetry hygiene | T2 | n/a | not built; requirements are in telemetry-v54s | |
| PRIV-5 | Server data | T2 | n/a | not built; D1 telemetry will need it | |

### OPS

| Id | Item | Tier | Status | Evidence | Task |
|---|---|---|---|---|---|
| OPS-1 | Feedback channel | T2 | missing | | credits-55gy |
| OPS-2 | Version visible | T2 | missing | | credits-55gy |
| OPS-3 | Tagged deploy | T2 | missing | | own-deploy-kfi7 |
| OPS-4 | Patch path | T2 | partial | | own-deploy-kfi7 |
| OPS-5 | Changelog | T3 | partial | ARCHITECTURE_LOG.md is for developers, not players | |
| OPS-6 | Launch post | T3 | missing | | |

### PLAY

| Id | Item | Tier | Status | Evidence | Task |
|---|---|---|---|---|---|
| PLAY-1 | Played on the shipped build | T1 | unverified | | you |
| PLAY-2 | Reload at awkward moments | T2 | unverified | | you |
| PLAY-3 | Someone else played | T2 | unverified | | you |
| PLAY-4 | Difficulty across seeds | T3 | done | a land path is guaranteed with the `knownGoodSeed` fallback; cc-sim checks pacing per size | |

### PORT (itch.io, Newgrounds)

Portal docs checked 2026-11-17:
- itch.io: [HTML5 zip requirements](https://itch.io/docs/creators/html5#zip-file-requirements). Forum reports put the limits at 500 MB extracted, 200 MB per file and about 1,000 files; this game is far under all three.
- Newgrounds: [games and movies submission](https://www.newgrounds.com/wiki/help-information/content-submission/games-and-movies). The zip needs index.html at its root, and the game loads in an iframe.

| Id | Item | Tier | Status | Evidence | Task |
|---|---|---|---|---|---|
| PORT-1 | Upload shape | T1 | missing | | ship-bundle-wyxt |
| PORT-2 | Keyboard focus | T1 | partial | | portal-frame-aqns |
| PORT-3 | Fits the frame | T1 | partial | | portal-frame-aqns |
| PORT-4 | Fullscreen | T2 | missing | | settings-rrcw |
| PORT-5 | Links leave the frame | T2 | n/a | no external links yet; the credits task requires `target="_blank"` | credits-55gy |
| PORT-6 | Server CORS | T2 | n/a | until telemetry exists; the D1 Worker must allow the portal CDN origins | |
| PORT-7 | Device flags | T1 | missing | | listing-r8fn |
| PORT-8 | Listing complete | T2 | missing | | listing-r8fn |
| PORT-9 | AI disclosure field | T2 | missing | | listing-r8fn |
| PORT-10 | Live draft tested | T2 | unverified | | you |

## Provenance

| Asset | Kind | Source | License / terms | In credits? |
|---|---|---|---|---|
| Game code (all .js, .html, .css) | code | written with Claude in Claude Code; hex.js, rando.js and colortheory.js come from the author's own Hex & Counters base | MIT (yuwakisaweb LICENSE) | no (credits-55gy) |
| Board, Things, crates, cards | art | drawn procedurally on a canvas by the game code | same as the code | no |
| Sound cues | audio | synthesized live with Web Audio (sound.js); no samples | same as the code | no |
| UI font | font | system font stack (system-ui, Segoe UI, Roboto) | the player's own fonts; nothing shipped | n/a |
| 🗑 on the Discard spot | emoji | the player's system emoji font | nothing shipped | n/a |

## Unverified

- **ONB-1, PLAY-3:** a cold play by someone new, without help.
- **ERR-1, LOAD-8:** a full session in Chrome and in Firefox with the console open.
- **LOAD-1, PORT-10:** after the deploy, a clean profile on ttdat.yuwakisa.com and on each portal's draft page.
- **PLAY-1:** a fresh run on each board size past a few milestones, on the shipped build.
- **PLAY-2:** after save-resume, reloads mid-animation, mid-Go and with an overlay open.
- **MOB-7, PORT-3 layout:** a look at 1280x720 and 960x600.
- **AUD-6:** a listening pass.
- **LOAD-4:** the huge board with Go running, on a modest laptop.
- **A11Y-1, TXT-2, TXT-3, LOC-5:** a read-through of every screen.
- **LEGAL-6:** a search for "Thing Factory" on itch.io, Newgrounds and the web.
- **X-1:** Newgrounds' current rules on AI-made games.
- **WEB-5:** capsule art and screenshots taken from real play (listing-r8fn lists the sizes).
