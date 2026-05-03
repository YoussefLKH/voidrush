# Void Rush — Build Prompt & Workflow Plan

## Project Location
`C:\Users\youss\OneDrive\Desktop\voidrush`

## Stack
- **Frontend:** TypeScript + PixiJS v7 + Vite
- **Backend:** Node.js + Express (port 4000)
- **Database:** `server/scores.json` (flat file, no DB setup needed)
- **Bundler:** Vite (frontend dev server on port 3000, proxies /api to 4000)

---

## Workflow: Build Order (Day by Day)

### Day 1 — Core Engine
**Goal: player is on screen, moves, enemies spawn, collision kills you**

Steps:
1. `npm install` — install all deps:
   - `pixi.js@7`, `vite`, `typescript`
   - `express` (server)
2. Wire up `src/main.ts` → create PixiJS `Application`, append canvas to `#game-container`
3. `src/game.ts` — state machine: `menu | playing | dead`, `requestAnimationFrame` loop with delta time
4. `src/player.ts` — glowing triangle ship, mouse/keyboard movement, bounds clamping
5. `src/enemies.ts` — spawn from random edges, move toward player, 3 types (small/fast, medium, large/slow)
6. Collision detection — circle-based, trigger `dead` state on hit
7. Score counter — increments every second while `playing`

**End of Day 1 checkpoint:** You can move a ship, enemies chase you, dying works, score ticks up.

---

### Day 2 — Juice & Feel
**Goal: game feels alive — particles, power-ups, tweens, HUD**

Steps:
1. `src/particles.ts` — object pool, burst explosion on death, thruster trail behind ship
2. `src/powerups.ts` — two types:
   - **Speed boost** (blue orb) — 5s duration
   - **Shield** (yellow ring) — absorbs 1 hit
   - Pulse tween using PixiJS ticker
   - Random spawn every 8–12 seconds
3. `src/ui.ts`:
   - Score display (top-right, PixiJS Text)
   - Game over screen (fade in, shows final score, name input field)
   - Leaderboard modal (fetches from API, top 10 list)
4. Tweening — death screen fade, enemy ease-in on spawn, power-up pulse
5. Difficulty scaling — enemy speed + spawn rate increases every 15 seconds

**End of Day 2 checkpoint:** Full game loop works. Particles explode. Power-ups drop. UI is functional.

---

### Day 3 — Backend, Polish, Done
**Goal: leaderboard works, game is responsive, ship-ready**

Steps:
1. `server/index.js` — complete the Express API:
   - `GET /api/leaderboard` — read `scores.json`, return top 10 sorted by score
   - `POST /api/scores` — append `{ name, score, date }` to `scores.json`
2. `src/api.ts` — wire fetch calls to the API
3. `src/ui.ts` — leaderboard modal pulls real data, shows name + score + rank
4. Responsive canvas — resize listener, scale canvas to window size
5. Texture atlas — pack all sprites into one spritesheet (use PixiJS Spritesheet or a simple atlas)
6. Final polish:
   - Screen shake on death
   - Enemy variety (color-coded by type)
   - Start screen with "Press Space to Play"
   - High score persisted in localStorage

**End of Day 3 checkpoint:** Full game. Leaderboard works. Responsive. Ready to show on a resume.

---

## File Map (what each file does)
```
src/main.ts       — PixiJS app init, asset loading, game bootstrap
src/game.ts       — game loop (rAF + delta), state machine
src/player.ts     — ship sprite, movement, shield, speed boost
src/enemies.ts    — enemy spawner, 3 types, difficulty scaling
src/powerups.ts   — drop system, pickup detection, tween pulse
src/particles.ts  — object pool, burst emitter, thruster trail
src/ui.ts         — HUD, game over screen, leaderboard modal
src/api.ts        — fetch wrapper for POST/GET leaderboard
server/index.js   — Express API (port 4000)
server/scores.json — flat file leaderboard storage
public/index.html  — HTML shell
public/style.css   — base styles (black bg, no overflow)
```

---

## Rules for the Build
- No scope creep — shapes only for enemies (no external art assets needed to start)
- Keep it all in these files — no new files unless absolutely necessary
- Each day ends with a working, testable checkpoint
- Backend stays dead simple — JSON file, no database setup

---

## How to Start Each Session
1. Read this file
2. Check which Day checkpoint was last completed
3. Pick up at the next step in the list
4. Run `npm install` first if deps aren't installed yet
