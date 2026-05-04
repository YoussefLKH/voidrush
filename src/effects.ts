import * as PIXI from 'pixi.js';

// ─── Visual Effects Manager ───────────────────────────────────────────────────

export class EffectsManager {
  private app:   PIXI.Application;
  private layer: PIXI.Container; // dedicated fx layer (above game, below UI)

  private shakeMag   = 0;
  private shakeTimer = 0;

  constructor(app: PIXI.Application, layer: PIXI.Container) {
    this.app   = app;
    this.layer = layer;
  }

  // ── Screen shake ──────────────────────────────────────────────────────────
  shake(magnitude: number, duration: number): void {
    this.shakeMag   = Math.max(this.shakeMag, magnitude);
    this.shakeTimer = Math.max(this.shakeTimer, duration);
  }

  // ── Level-up radial shockwave ─────────────────────────────────────────────
  levelUpEffect(): void {
    const W = this.app.screen.width;
    const H = this.app.screen.height;

    // Gold screen flash
    const flash = new PIXI.Graphics();
    flash.beginFill(0xffcc00, 0.30); flash.drawRect(0, 0, W, H); flash.endFill();
    this.layer.addChild(flash);

    // Expanding shockwave ring
    const ring = new PIXI.Graphics();
    ring.position.set(W / 2, H / 2);
    this.layer.addChild(ring);

    // Star flare particles
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      this.spawnParticle(W / 2, H / 2, Math.cos(a) * (80 + Math.random() * 80), Math.sin(a) * (80 + Math.random() * 80), 0xffcc00, 3, 0.6);
    }

    let radius = 8, alpha = 0.85;
    const anim = (delta: number) => {
      const dt = delta / 60;
      radius  += 520 * dt;
      alpha   -= 1.4 * dt;
      flash.alpha -= 2.8 * dt;

      ring.clear();
      if (alpha > 0) {
        ring.lineStyle(3.5, 0xffcc00, alpha);
        ring.drawCircle(0, 0, radius);
      }

      if (alpha <= 0) { this.layer.removeChild(ring); ring.destroy(); this.app.ticker.remove(anim); }
      if (flash.alpha <= 0 && flash.parent) { this.layer.removeChild(flash); flash.destroy(); }
    };
    this.app.ticker.add(anim);
  }

  // ── Enemy / boss explosion ────────────────────────────────────────────────
  explosion(x: number, y: number, color: number = 0xff6600, count = 14): void {
    for (let i = 0; i < count; i++) {
      const a     = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const spd   = 55 + Math.random() * 110;
      const sz    = 2 + Math.random() * 3;
      const life  = 0.35 + Math.random() * 0.35;
      this.spawnParticle(x, y, Math.cos(a) * spd, Math.sin(a) * spd, color, sz, life);
    }
  }

  // ── Boss death — multi-wave explosion ─────────────────────────────────────
  bossExplosion(x: number, y: number, color: number): void {
    for (let wave = 0; wave < 5; wave++) {
      setTimeout(() => {
        const ox = x + (Math.random() - 0.5) * 90;
        const oy = y + (Math.random() - 0.5) * 90;
        this.explosion(ox, oy, color, 22);
        this.shake(10, 0.25);
      }, wave * 130);
    }
  }

  // ── Screen flash helpers ──────────────────────────────────────────────────
  flashRed(): void     { this.screenFlash(0xff0000, 0.30, 0.5); }
  flashGold(): void    { this.screenFlash(0xffcc00, 0.22, 0.4); }
  flashWhite(): void   { this.screenFlash(0xffffff, 0.45, 0.3); }
  flashCrimson(): void { this.screenFlash(0xff2222, 0.20, 0.8); } // void storm
  flashGreen(): void   { this.screenFlash(0x00ff88, 0.30, 0.6); } // health gain

  private screenFlash(color: number, alpha: number, duration: number): void {
    const W = this.app.screen.width;
    const H = this.app.screen.height;
    const flash = new PIXI.Graphics();
    flash.beginFill(color, alpha); flash.drawRect(0, 0, W, H); flash.endFill();
    this.layer.addChild(flash);
    const decay = alpha / duration;
    const anim  = (delta: number) => {
      flash.alpha -= (delta / 60) * decay;
      if (flash.alpha <= 0) { this.layer.removeChild(flash); flash.destroy(); this.app.ticker.remove(anim); }
    };
    this.app.ticker.add(anim);
  }

  // ── Particle helper ───────────────────────────────────────────────────────
  private spawnParticle(x: number, y: number, vx: number, vy: number, color: number, size: number, maxLife: number): void {
    let life = 0;
    const p  = new PIXI.Graphics();
    p.beginFill(color, 1); p.drawCircle(0, 0, size); p.endFill();
    p.position.set(x, y);
    this.layer.addChild(p);

    const anim = (delta: number) => {
      const dt = delta / 60;
      life += dt;
      p.x += vx * dt;
      p.y += vy * dt;
      const t = 1 - life / maxLife;
      p.alpha = t;
      p.scale.set(t * 0.8 + 0.2);
      if (life >= maxLife) { this.layer.removeChild(p); p.destroy(); this.app.ticker.remove(anim); }
    };
    this.app.ticker.add(anim);
  }

  // ── Shield burst (shield absorbs a hit → detonates outward) ─────────────
  shieldBurst(x: number, y: number): void {
    const color = 0x00ddff;

    // 28 radial particles exploding outward
    for (let i = 0; i < 28; i++) {
      const a   = (i / 28) * Math.PI * 2;
      const spd = 130 + Math.random() * 90;
      this.spawnParticle(x, y, Math.cos(a) * spd, Math.sin(a) * spd, color, 2.5 + Math.random() * 2, 0.55);
    }

    // Expanding cyan ring shockwave
    const ring  = new PIXI.Graphics();
    const ring2 = new PIXI.Graphics();
    ring.position.set(x, y);
    ring2.position.set(x, y);
    this.layer.addChild(ring);
    this.layer.addChild(ring2);

    let radius = 6, alpha = 1.0;
    const anim = (delta: number) => {
      const dt = delta / 60;
      radius  += 500 * dt;
      alpha   -= 2.8 * dt;

      ring.clear();
      ring2.clear();
      if (alpha > 0) {
        ring.lineStyle(3.5, color, alpha);
        ring.drawCircle(0, 0, radius);
        ring2.lineStyle(1.5, 0xaaffff, alpha * 0.55);
        ring2.drawCircle(0, 0, radius * 0.65);
      }
      if (alpha <= 0) {
        this.layer.removeChild(ring);  ring.destroy();
        this.layer.removeChild(ring2); ring2.destroy();
        this.app.ticker.remove(anim);
      }
    };
    this.app.ticker.add(anim);

    // Subtle cyan screen flash
    this.screenFlash(0x00ddff, 0.14, 0.28);
  }

  // ── Victory gold burst ───────────────────────────────────────────────────
  victoryBurst(): void {
    const W = this.app.screen.width, H = this.app.screen.height;
    const cx = W / 2, cy = H / 2;
    // 3 staggered waves of gold/white particles
    for (let wave = 0; wave < 3; wave++) {
      setTimeout(() => {
        for (let i = 0; i < 28; i++) {
          const a   = (i / 28) * Math.PI * 2 + Math.random() * 0.3;
          const spd = 80 + Math.random() * 200;
          const col = [0xffcc00, 0xffd700, 0xffffff, 0xffee88][Math.floor(Math.random() * 4)];
          const sz  = 2 + Math.random() * 4;
          const life = 0.6 + Math.random() * 0.7;
          this.spawnParticle(cx, cy, Math.cos(a) * spd, Math.sin(a) * spd, col, sz, life);
        }
        this.screenFlash(0xffcc00, 0.12, 0.4);
      }, wave * 220);
    }
  }

  // ── Charge trail (for Stampede boss) ─────────────────────────────────────
  spawnTrail(x: number, y: number, color: number): void {
    this.spawnParticle(x, y, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, color, 6 + Math.random() * 4, 0.3);
  }

  // ── Update: apply screen shake ────────────────────────────────────────────
  update(dt: number): void {
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const m = this.shakeMag * Math.max(0, this.shakeTimer);
      this.app.stage.x = (Math.random() - 0.5) * m * 2;
      this.app.stage.y = (Math.random() - 0.5) * m * 2;
    } else {
      this.shakeMag     = 0;
      this.app.stage.x  = 0;
      this.app.stage.y  = 0;
    }
  }
}
