# TANK PRO BATTLE

[![make.fun](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/claymoreth/tank-neon-battle/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/claymoreth/tank-neon-battle/reward.svg)](https://make.fun/bounty/best-game-01)

Battle City 2026 — drive a tank, blast waves of enemy tanks, and defend the
golden EAGLE base at the bottom of the map. If the EAGLE falls, the game is
over. Entry for [make.fun best-game-01](https://make.fun/bounty/best-game-01).

## How to play

- **Goal:** destroy every enemy tank in the wave. Clear the level to advance.
  Every 5th level (5, 10, 15) a giant boss tank appears — beat it for 5000 points.
- **Lose:** the EAGLE base is destroyed, or both players run out of lives.
- **Maps:** brick walls break under fire, steel walls do not, grass hides your
  tank, water blocks tanks (but not bullets), ice is slippery.
- **Power-ups** drop from flashing red tanks: STAR (faster, stronger bullets),
  HELMET (invincible 5 s), GRENADE (every enemy on screen explodes), SHOVEL
  (the base ring turns to steel for 20 s), LIFE (+1 life).
- **Modes:** CLASSIC (old-school mode, classic tanks) or PRO (menacing mode,
  modern tanks, fiercer enemies, bullet trails, explosion particles,
  screen shake, richer synth sounds).
- **Players:** play alone (1P) or together (2P) defending the same base.

## Controls

| | Move | Fire |
|---|---|---|
| Player 1 | WASD | SPACE |
| Player 2 | Arrow keys | ENTER |

- **P** pause / resume, **M** mute, **R** restart (on the game over screen),
  **ESC** menu (on the game over screen).
- On the title screen: click the buttons, or press **1** / **2** for players,
  **C** classic, **O** pro, **ENTER** to start.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no network, all art and
sound are generated in code.

## License

MIT — see LICENSE.
