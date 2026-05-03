import * as PIXI from 'pixi.js';

// ─── Player Bullet System ─────────────────────────────────────────────────────

interface Bullet {
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  gfx: PIXI.Graphics;
  life: number;
}

const SPEED     = 680;
const RADIUS    = 4;
const LIFETIME  = 2.4;
const FIRE_RATE = 0.10; // 100 ms between shots — fast and snappy

export class BulletSystem {
  private layer:   PIXI.Container;
  private bullets: Bullet[] = [];
  private cooldown = 0;

  constructor(layer: PIXI.Container) {
    this.layer = layer;
  }

  // ── Fire toward a target point ────────────────────────────────────────────
  tryFire(fromX: number, fromY: number, toX: number, toY: number): boolean {
    if (this.cooldown > 0) return false;
    this.cooldown = FIRE_RATE;
    const dx  = toX - fromX;
    const dy  = toY - fromY;
    const len = Math.hypot(dx, dy) || 1;
    return this.spawnBullet(fromX, fromY, (dx / len) * SPEED, (dy / len) * SPEED);
  }

  // ── Fire along a pre-computed angle (WASD facing direction) ──────────────
  tryFireAngle(fromX: number, fromY: number, angle: number): boolean {
    if (this.cooldown > 0) return false;
    this.cooldown = FIRE_RATE;
    return this.spawnBullet(fromX, fromY, Math.cos(angle) * SPEED, Math.sin(angle) * SPEED);
  }

  private spawnBullet(x: number, y: number, vx: number, vy: number): boolean {
    const gfx = new PIXI.Graphics();
    this.drawBullet(gfx);
    gfx.position.set(x, y);
    this.layer.addChild(gfx);
    this.bullets.push({ x, y, vx, vy, radius: RADIUS, gfx, life: 0 });
    return true;
  }

  private drawBullet(g: PIXI.Graphics): void {
    g.beginFill(0x00ffff, 0.25); g.drawCircle(0, 0, RADIUS * 2.8); g.endFill();
    g.beginFill(0xffffff, 1);    g.drawCircle(0, 0, RADIUS);        g.endFill();
    g.lineStyle(1, 0x00ffff, 0.8); g.drawCircle(0, 0, RADIUS + 1.5); g.lineStyle(0);
  }

  // ── Update ────────────────────────────────────────────────────────────────
  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);

    const W = window.innerWidth;
    const H = window.innerHeight;

    this.bullets = this.bullets.filter((b) => {
      b.x    += b.vx * dt;
      b.y    += b.vy * dt;
      b.life += dt;
      b.gfx.position.set(b.x, b.y);
      b.gfx.alpha = Math.min(1, (LIFETIME - b.life) * 4);

      const alive = b.life < LIFETIME && b.x > -30 && b.x < W + 30 && b.y > -30 && b.y < H + 30;
      if (!alive) { this.layer.removeChild(b.gfx); b.gfx.destroy(); }
      return alive;
    });
  }

  // ── Collision ─────────────────────────────────────────────────────────────
  /** Returns true and removes the bullet if any bullet hits the circle (cx, cy, cr). */
  checkHit(cx: number, cy: number, cr: number): boolean {
    let hit = false;
    this.bullets = this.bullets.filter((b) => {
      const collides = Math.hypot(b.x - cx, b.y - cy) < cr + b.radius;
      if (collides) { this.layer.removeChild(b.gfx); b.gfx.destroy(); hit = true; }
      return !collides;
    });
    return hit;
  }

  reset(): void {
    for (const b of this.bullets) { this.layer.removeChild(b.gfx); b.gfx.destroy(); }
    this.bullets  = [];
    this.cooldown = 0;
  }
}
