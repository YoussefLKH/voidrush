import * as PIXI from 'pixi.js';
import { settings } from './settings';

// ─── Config ───────────────────────────────────────────────────────────────────

export type EnemyType = 'dart' | 'chaser' | 'bomb';

interface EnemyCfg {
  radius: number; speed: number; color: number; sides: number; hp: number;
}

export const BOMB_BLAST_RADIUS = 130;

const CONFIGS: Record<EnemyType, EnemyCfg> = {
  // Red dart — screams straight toward where the player WAS at spawn, very fast, 1 HP
  dart:   { radius: 7,  speed: 360, color: 0xff2244, sides: 3, hp: 1 },
  // Orange chaser — slow but continuously tracks the player, 1 HP
  chaser: { radius: 14, speed: 95,  color: 0xff8800, sides: 5, hp: 1 },
  // Purple bomb — mine with a 5-second countdown, explodes if not shot, 1 HP
  bomb:   { radius: 20, speed: 38,  color: 0xaa00ff, sides: 8, hp: 1 },
};

// ─── Enemy ────────────────────────────────────────────────────────────────────

export class Enemy {
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  color:  number;
  hp:     number;
  maxHp:  number;

  /** The position/culling container added to the layer. */
  gfx: PIXI.Container;
  /** Inner graphics for drawing + tinting (rotates independently so bomb text stays upright). */
  private inner: PIXI.Graphics;
  /** Countdown text for bomb type only. */
  private bombText: PIXI.Text | null = null;
  /** Countdown ring for bomb (redrawn each frame). */
  private bombRing: PIXI.Graphics | null = null;
  /** Pulsing blast-radius indicator circle. */
  private bombRadiusGfx: PIXI.Graphics | null = null;

  readonly type:     EnemyType;
  readonly isBomb:   boolean;
  readonly isChaser: boolean;

  bombTimer    = 0;  // only used for bomb
  private rot:      number;
  private rotSpeed: number;
  private flashTimer = 0;

  constructor(
    type: EnemyType,
    x: number, y: number,
    vx: number, vy: number,
    layer: PIXI.Container,
    speedMult: number,
    levelMult: number,
  ) {
    const cfg  = CONFIGS[type];
    this.type  = type;
    this.isBomb   = type === 'bomb';
    this.isChaser = type === 'chaser';

    this.x     = x; this.y = y;
    // Darts use fixed direction; chasers/bombs will override each frame
    this.vx    = vx * speedMult * levelMult;
    this.vy    = vy * speedMult * levelMult;
    this.radius = cfg.radius;
    this.color  = cfg.color;
    this.hp     = cfg.hp;
    this.maxHp  = cfg.hp;
    this.rot      = Math.random() * Math.PI * 2;
    this.rotSpeed = this.isBomb ? 0.6 : (Math.random() - 0.5) * 3.5;

    if (this.isBomb) {
      this.bombTimer = 5.0;
      this.vx = vx * speedMult * Math.min(levelMult, 1.8); // cap bomb speed growth
      this.vy = vy * speedMult * Math.min(levelMult, 1.8);
    }

    // Build container
    this.gfx   = new PIXI.Container();
    this.inner = new PIXI.Graphics();
    this.gfx.addChild(this.inner);

    if (this.isBomb) {
      // Radius indicator sits behind everything else
      this.bombRadiusGfx = new PIXI.Graphics();
      this.gfx.addChildAt(this.bombRadiusGfx, 0);

      this.bombRing = new PIXI.Graphics();
      this.gfx.addChild(this.bombRing);

      this.bombText = new PIXI.Text('5', {
        fontFamily: 'Orbitron, sans-serif',
        fontSize:   12,
        fontWeight: 'bold',
        fill:       0xffffff,
      });
      this.bombText.anchor.set(0.5);
      this.gfx.addChild(this.bombText);
    }

    this.draw(cfg);
    this.gfx.position.set(x, y);
    layer.addChild(this.gfx);
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  private draw(cfg: EnemyCfg): void {
    this.inner.clear();
    if (this.isBomb) {
      this.drawBomb(cfg);
    } else {
      this.drawStandard(cfg);
    }
  }

  private drawStandard(cfg: EnemyCfg): void {
    const g = this.inner;
    g.beginFill(cfg.color, 0.07); g.drawCircle(0, 0, cfg.radius * 2.2); g.endFill();
    g.beginFill(cfg.color, 0.13); g.drawCircle(0, 0, cfg.radius * 1.55); g.endFill();
    g.lineStyle(1.5, cfg.color, 1);
    g.beginFill(cfg.color, 0.22);
    g.drawPolygon(this.poly(cfg.radius, cfg.sides));
    g.endFill();
    g.lineStyle(0);
    g.beginFill(cfg.color, 0.92); g.drawCircle(0, 0, cfg.radius * 0.28); g.endFill();
  }

  private drawBomb(cfg: EnemyCfg): void {
    const g = this.inner;
    const r = cfg.radius;
    const c = cfg.color;

    // Outer glow
    g.beginFill(c, 0.08); g.drawCircle(0, 0, r * 2.1); g.endFill();
    g.beginFill(c, 0.16); g.drawCircle(0, 0, r * 1.5); g.endFill();

    // Dark body
    g.lineStyle(2, c, 0.9);
    g.beginFill(0x0a0014, 0.95); g.drawCircle(0, 0, r); g.endFill();

    // Spikes (8 protrusions)
    g.lineStyle(0);
    g.beginFill(c, 0.88);
    for (let i = 0; i < 8; i++) {
      const a   = (i / 8) * Math.PI * 2;
      const tip = r + 7;
      const ox  = Math.cos(a) * tip, oy = Math.sin(a) * tip;
      const la  = a - 0.28, ra = a + 0.28;
      const lx  = Math.cos(la) * r * 0.86, ly = Math.sin(la) * r * 0.86;
      const rx2 = Math.cos(ra) * r * 0.86, ry2 = Math.sin(ra) * r * 0.86;
      g.drawPolygon([lx, ly, ox, oy, rx2, ry2]);
    }
    g.endFill();

    // Inner circle
    g.beginFill(c, 0.20); g.drawCircle(0, 0, r * 0.48); g.endFill();
  }

  private poly(r: number, sides: number): number[] {
    const pts: number[] = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
      pts.push(Math.cos(a) * r, Math.sin(a) * r);
    }
    return pts;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(dt: number, px = 0, py = 0): void {
    // Chasers continuously re-aim at player
    if (this.isChaser) {
      const dx = px - this.x, dy = py - this.y;
      const len = Math.hypot(dx, dy) || 1;
      const spd = CONFIGS.chaser.speed * settings.speedMult;
      this.vx = (dx / len) * spd;
      this.vy = (dy / len) * spd;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Inner graphics spins; container stays upright so bomb text is readable
    this.rot += this.rotSpeed * dt;
    this.inner.rotation = this.rot;
    this.gfx.position.set(this.x, this.y);

    // Hit flash
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.inner.tint = 0xffffff;
    } else {
      this.inner.tint = 0xffffff;
    }

    // Bomb countdown + blast-radius indicator
    if (this.isBomb) {
      if (this.bombTimer > 0) {
        this.bombTimer -= dt;

        const secs = Math.max(0, Math.ceil(this.bombTimer));
        if (this.bombText) this.bombText.text = String(secs);

        // Flash red in final 1.5 seconds
        if (this.bombTimer < 1.5) {
          const fl = Math.abs(Math.sin(this.bombTimer * 14));
          this.inner.tint = fl > 0.5 ? 0xff4444 : 0xffffff;
          if (this.bombText) (this.bombText.style as any).fill = fl > 0.5 ? '#ff4444' : '#ffffff';
        }

        // Countdown arc ring
        if (this.bombRing) {
          this.bombRing.clear();
          const ratio = Math.max(0, this.bombTimer / 5.0);
          const col   = this.bombTimer < 1.5 ? 0xff4444 : 0xaa00ff;
          this.bombRing.lineStyle(2, col, 0.8);
          this.bombRing.arc(0, 0, this.radius + 4, -Math.PI / 2,
            -Math.PI / 2 + ratio * Math.PI * 2);
        }
      }

      // Blast-radius indicator — pulses brighter as timer counts down
      if (this.bombRadiusGfx) {
        this.bombRadiusGfx.clear();
        const t       = Math.max(0, this.bombTimer);
        const danger  = t < 1.5;
        const alpha   = danger
          ? 0.22 + Math.abs(Math.sin(t * 14)) * 0.38   // rapid flash near detonation
          : 0.06 + ((5 - t) / 5) * 0.16;               // gradually brightens as timer drops
        this.bombRadiusGfx.lineStyle(1.2, 0xff3344, alpha);
        this.bombRadiusGfx.drawCircle(0, 0, BOMB_BLAST_RADIUS);
        // Very faint fill so the danger zone is visible
        this.bombRadiusGfx.beginFill(0xff3344, alpha * 0.12);
        this.bombRadiusGfx.drawCircle(0, 0, BOMB_BLAST_RADIUS);
        this.bombRadiusGfx.endFill();
      }
    }
  }

  isReadyToExplode(): boolean { return this.isBomb && this.bombTimer <= 0; }

  takeDamage(amount: number): void {
    this.hp -= amount;
    this.flashTimer = 0.08;
  }

  isDead(): boolean { return this.hp <= 0; }

  destroy(layer: PIXI.Container): void {
    layer.removeChild(this.gfx);
    this.gfx.destroy({ children: true });
  }
}

// ─── EnemyManager ─────────────────────────────────────────────────────────────

export class EnemyManager {
  private app:     PIXI.Application;
  private layer:   PIXI.Container;
  private _enemies: Enemy[] = [];

  private spawnTimer      = 0;
  private spawnInterval   = 2.0;
  private levelSpeedMult  = 1.0;
  private paused          = false;

  constructor(app: PIXI.Application, layer: PIXI.Container) {
    this.app   = app;
    this.layer = layer;
  }

  setLevel(level: number): void {
    // Cap speed at level ~13 equivalent — harder but still beatable
    this.levelSpeedMult = Math.min(2.4, 1 + (level - 1) * 0.15);
    // Never spawn faster than once every 0.55s to avoid overwhelming density
    this.spawnInterval  = Math.max(0.55, 2.0 - (level - 1) * 0.13);
  }

  setPaused(p: boolean): void { this.paused = p; }
  isPaused():  boolean        { return this.paused; }

  /** Clear enemies without resetting level settings. */
  clearAll(): void {
    for (const e of this._enemies) e.destroy(this.layer);
    this._enemies = [];
  }

  getEnemies(): Enemy[] { return this._enemies; }

  removeDeadEnemies(): void {
    this._enemies = this._enemies.filter((e) => {
      if (e.isDead()) { e.destroy(this.layer); return false; }
      return true;
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────
  update(dt: number, px: number, py: number): void {
    if (!this.paused) {
      this.spawnTimer += dt;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer -= this.spawnInterval;
        this.spawnEnemy(px, py);
        if (this.spawnInterval <= 0.75) this.spawnEnemy(px, py);
      }
    }

    const M = 160, W = this.app.screen.width, H = this.app.screen.height;

    // Move all enemies (pass player pos for chasers)
    for (const e of this._enemies) e.update(dt, px, py);

    // ── Enemy-to-enemy elastic bounce ──────────────────────────────────────
    const n = this._enemies.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = this._enemies[i], b = this._enemies[j];
        const dx   = b.x - a.x, dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minD = a.radius + b.radius;
        if (dist < minD && dist > 0.001) {
          const nx = dx / dist, ny = dy / dist;
          const ov = (minD - dist) * 0.5;
          a.x -= nx * ov; a.y -= ny * ov;
          b.x += nx * ov; b.y += ny * ov;
          const relVx = a.vx - b.vx, relVy = a.vy - b.vy;
          const dot   = relVx * nx + relVy * ny;
          if (dot > 0) {
            a.vx -= dot * nx; a.vy -= dot * ny;
            b.vx += dot * nx; b.vy += dot * ny;
          }
        }
      }
    }

    // Cull off-screen (bombs stay longer — don't cull, let them explode)
    this._enemies = this._enemies.filter((e) => {
      if (e.isBomb) return true; // bombs must explode or be shot
      const ok = e.x > -M && e.x < W + M && e.y > -M && e.y < H + M;
      if (!ok) e.destroy(this.layer);
      return ok;
    });

    // Also cull dead bombs that escaped
    this._enemies = this._enemies.filter((e) => {
      if (!e.isBomb) return true;
      const ok = e.x > -M && e.x < W + M && e.y > -M && e.y < H + M;
      if (!ok) { e.destroy(this.layer); return false; }
      return true;
    });
  }

  // ── Spawn ─────────────────────────────────────────────────────────────────
  private spawnEnemy(px: number, py: number): void {
    const W  = this.app.screen.width, H = this.app.screen.height;
    const r  = Math.random();
    const type: EnemyType = r < 0.48 ? 'dart' : r < 0.78 ? 'chaser' : 'bomb';
    const cfg = CONFIGS[type];
    let x: number, y: number;
    const pad = cfg.radius + 20;
    const MIN_DIST = 130; // never spawn within 130 px of the player

    if (type === 'bomb') {
      // Spawn from edge, drift slowly inward
      switch (Math.floor(Math.random() * 4)) {
        case 0: x = Math.random() * W; y = -pad;        break;
        case 1: x = Math.random() * W; y = H + pad;     break;
        case 2: x = -pad;              y = Math.random() * H; break;
        default: x = W + pad;          y = Math.random() * H; break;
      }
      // Drift toward center with some wobble
      const cx = W / 2 + (Math.random() - 0.5) * W * 0.4;
      const cy = H / 2 + (Math.random() - 0.5) * H * 0.4;
      const dx = cx - x, dy = cy - y, len = Math.hypot(dx, dy) || 1;
      this._enemies.push(new Enemy(type, x, y, (dx / len) * cfg.speed, (dy / len) * cfg.speed,
        this.layer, settings.speedMult, this.levelSpeedMult));
    } else {
      // Dart and chaser: spawn from edge, aim at player
      switch (Math.floor(Math.random() * 4)) {
        case 0: x = Math.random() * W; y = -pad;        break;
        case 1: x = Math.random() * W; y = H + pad;     break;
        case 2: x = -pad;              y = Math.random() * H; break;
        default: x = W + pad;          y = Math.random() * H; break;
      }
      const dx = px - x, dy = py - y, len = Math.hypot(dx, dy) || 1;
      // Skip if spawned too close to player (avoid instant-hits)
      if (Math.hypot(dx, dy) < MIN_DIST) return;
      this._enemies.push(new Enemy(type, x, y, (dx / len) * cfg.speed, (dy / len) * cfg.speed,
        this.layer, settings.speedMult, this.levelSpeedMult));
    }
  }

  // ── Void Storm ────────────────────────────────────────────────────────────
  triggerVoidStorm(dir: 'left' | 'right' | 'top' | 'bottom'): void {
    const W = this.app.screen.width, H = this.app.screen.height;
    const count = 14;

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const pos     = 0.08 + (i / (count - 1)) * 0.84;
        const baseSpd = (140 + Math.random() * 90) * settings.speedMult * this.levelSpeedMult;
        const wobble  = (Math.random() - 0.5) * 22;

        let x: number, y: number, vx: number, vy: number;
        switch (dir) {
          case 'left':   x = -30;     y = H * pos;  vx = baseSpd;  vy = wobble; break;
          case 'right':  x = W + 30;  y = H * pos;  vx = -baseSpd; vy = wobble; break;
          case 'top':    x = W * pos; y = -30;       vx = wobble;   vy = baseSpd; break;
          default:       x = W * pos; y = H + 30;    vx = wobble;   vy = -baseSpd; break;
        }

        const types: EnemyType[] = ['dart', 'dart', 'chaser', 'chaser', 'dart'];
        const type = types[Math.floor(Math.random() * types.length)];
        const cfg  = CONFIGS[type];
        const len  = Math.hypot(vx, vy) || 1;
        this._enemies.push(
          new Enemy(type, x, y, (vx / len) * cfg.speed, (vy / len) * cfg.speed,
            this.layer, settings.speedMult, this.levelSpeedMult),
        );
      }, i * 80);
    }
  }

  collidesWithPlayer(px: number, py: number, pr: number): boolean {
    return this._enemies.some((e) => Math.hypot(e.x - px, e.y - py) < e.radius + pr - 3);
  }

  reset(): void {
    for (const e of this._enemies) e.destroy(this.layer);
    this._enemies      = [];
    this.spawnTimer    = 0;
    this.spawnInterval = 2.0;
    this.levelSpeedMult = 1.0;
    this.paused        = false;
  }
}
