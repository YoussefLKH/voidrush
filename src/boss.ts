import * as PIXI from 'pixi.js';

// ─── Boss Projectile ──────────────────────────────────────────────────────────

interface BossProj {
  x: number; y: number; vx: number; vy: number; radius: number; gfx: PIXI.Graphics;
}

// ─── Abstract Base ────────────────────────────────────────────────────────────

export abstract class BossBase {
  protected app:       PIXI.Application;
  protected bossLayer: PIXI.Container;
  protected projLayer: PIXI.Container;

  x  = 0; y = 0;
  hp = 0; maxHp = 0;
  protected gfx:   PIXI.Container;
  protected projs: BossProj[] = [];

  abstract readonly name:   string;
  abstract readonly color:  number;
  abstract readonly radius: number;

  constructor(app: PIXI.Application, bossLayer: PIXI.Container, projLayer: PIXI.Container) {
    this.app       = app;
    this.bossLayer = bossLayer;
    this.projLayer = projLayer;
    this.gfx       = new PIXI.Container();
    bossLayer.addChild(this.gfx);
  }

  abstract update(dt: number, px: number, py: number): void;
  abstract buildGraphics(): void;

  takeDamage(n: number): void { this.hp = Math.max(0, this.hp - n); }
  isDead():     boolean       { return this.hp <= 0; }
  getHpRatio(): number        { return this.maxHp > 0 ? this.hp / this.maxHp : 0; }

  processBullets(checkHit: (x: number, y: number, r: number) => boolean): boolean {
    if (checkHit(this.x, this.y, this.radius)) {
      this.takeDamage(1);
      return true;
    }
    return false;
  }

  bodyCollidesWithPlayer(px: number, py: number, pr: number): boolean {
    return Math.hypot(this.x - px, this.y - py) < this.radius + pr - 2;
  }

  projHitsPlayer(px: number, py: number, pr: number): boolean {
    return this.projs.some((p) => Math.hypot(p.x - px, p.y - py) < p.radius + pr - 2);
  }

  updateProjs(dt: number): void {
    const W = this.app.screen.width  + 60;
    const H = this.app.screen.height + 60;
    this.projs = this.projs.filter((p) => {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.gfx.position.set(p.x, p.y);
      const alive = p.x > -60 && p.x < W && p.y > -60 && p.y < H;
      if (!alive) { this.projLayer.removeChild(p.gfx); p.gfx.destroy(); }
      return alive;
    });
  }

  protected spawnProj(x: number, y: number, vx: number, vy: number, color: number, r = 6): void {
    const g = new PIXI.Graphics();
    g.beginFill(color, 0.3); g.drawCircle(0, 0, r * 2.2); g.endFill();
    g.beginFill(color, 0.9); g.drawCircle(0, 0, r);        g.endFill();
    g.position.set(x, y);
    this.projLayer.addChild(g);
    this.projs.push({ x, y, vx, vy, radius: r, gfx: g });
  }

  /** Remove all projectiles within radius of (cx, cy) — used by shield burst. */
  clearProjsInRadius(cx: number, cy: number, r: number): void {
    this.projs = this.projs.filter((p) => {
      const hit = Math.hypot(p.x - cx, p.y - cy) < r;
      if (hit) { this.projLayer.removeChild(p.gfx); p.gfx.destroy(); }
      return !hit;
    });
  }

  destroy(): void {
    this.bossLayer.removeChild(this.gfx); this.gfx.destroy();
    for (const p of this.projs) { this.projLayer.removeChild(p.gfx); p.gfx.destroy(); }
    this.projs = [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BOSS 1 — THE NEBULA  (Level 5)
//
// Core: slow elliptical orbit · rotating 6-way / 8-way bullet volleys
// Unique ability — STELLAR BURST:
//   Every 5-6 s, fires 2 large glowing orbs that drift slowly across the arena.
//   After 2 s each orb detonates into a 12-way radial ring of projectiles.
//   In phase 2 (HP ≤ 50%) burst fires 3 orbs instead of 2, cooldown drops to 4 s.
//
// RANDOMISED: spawn edge, orbit centre, orbit radii, orbit speed, shot rotation.
// ─────────────────────────────────────────────────────────────────────────────

interface BurstOrb {
  x: number; y: number; vx: number; vy: number;
  timer: number;
  dead:  boolean;
  t:     number;
  gfx:   PIXI.Graphics;
}

export class BossNebula extends BossBase {
  readonly name   = 'THE NEBULA';
  readonly color  = 0xcc44ff;
  readonly radius = 44;

  // One-shot fly-in flag
  private inFlyIn    = true;
  // Orbit state
  private orbitAngle: number;
  private readonly orbitCX:  number;
  private readonly orbitCY:  number;
  private readonly orbitRX:  number;
  private readonly orbitRY:  number;
  private readonly orbitSpd: number;
  // Fly-in target (top of orbit ellipse)
  private readonly flyTargetX: number;
  private readonly flyTargetY: number;

  private shotTimer  = 0;
  private shotRot    = 0;
  private ringAngle  = 0;
  private glowPulse  = 0;

  // Stellar Burst ability
  private burstTimer = 5.0;
  private burstOrbs: BurstOrb[] = [];

  constructor(app: PIXI.Application, bossLayer: PIXI.Container, projLayer: PIXI.Container) {
    super(app, bossLayer, projLayer);
    this.hp    = 20;
    this.maxHp = 20;

    const W = app.screen.width, H = app.screen.height;

    // Randomised orbit parameters
    this.orbitCX  = W * (0.36 + Math.random() * 0.28);
    this.orbitCY  = H * (0.38 + Math.random() * 0.18);
    this.orbitRX  = W * (0.20 + Math.random() * 0.12);
    this.orbitRY  = H * (0.16 + Math.random() * 0.09);
    this.orbitSpd = 0.30 + Math.random() * 0.10;
    // Start orbit at a random angle so first few seconds look different each run
    this.orbitAngle = Math.random() * Math.PI * 2;

    // Fly-in target = top of orbit ellipse
    this.flyTargetX = this.orbitCX + Math.cos(this.orbitAngle) * this.orbitRX;
    this.flyTargetY = this.orbitCY + Math.sin(this.orbitAngle) * this.orbitRY;

    // Random spawn edge: 0=top, 1=left, 2=right
    const side = Math.floor(Math.random() * 3);
    if (side === 1) {
      this.x = -90;
      this.y = H * (0.2 + Math.random() * 0.3);
    } else if (side === 2) {
      this.x = W + 90;
      this.y = H * (0.2 + Math.random() * 0.3);
    } else {
      this.x = W * (0.2 + Math.random() * 0.6);
      this.y = -90;
    }

    this.buildGraphics();
  }

  buildGraphics(): void {
    this.gfx.removeChildren();
    const g = new PIXI.Graphics();
    g.beginFill(this.color, 0.05); g.drawCircle(0, 0, this.radius * 2.6); g.endFill();
    g.beginFill(this.color, 0.10); g.drawCircle(0, 0, this.radius * 1.8); g.endFill();
    g.lineStyle(1.5, this.color, 0.55);
    g.drawEllipse(0, 0, this.radius * 1.3, this.radius * 0.55);
    g.lineStyle(0);
    g.beginFill(this.color, 0.85); g.drawCircle(0, 0, this.radius); g.endFill();
    g.beginFill(0xffffff, 0.25);   g.drawCircle(-8, -10, 12);                   g.endFill();
    g.beginFill(0x220033, 0.6);    g.drawCircle(0, 0, this.radius * 0.45);      g.endFill();
    g.beginFill(this.color, 1);    g.drawCircle(0, 0, 8);                        g.endFill();
    this.gfx.addChild(g);
    this.gfx.position.set(this.x, this.y);
  }

  update(dt: number, px: number, py: number): void {
    // ── Fly-in (moves toward orbit entry point) ───────────────────────────
    if (this.inFlyIn) {
      const dx  = this.flyTargetX - this.x;
      const dy  = this.flyTargetY - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 6) {
        this.inFlyIn = false;
        this.x = this.flyTargetX;
        this.y = this.flyTargetY;
      } else {
        const spd = 260;
        this.x += (dx / dist) * spd * dt;
        this.y += (dy / dist) * spd * dt;
      }
      this.gfx.position.set(this.x, this.y);
      return;
    }

    // ── Orbit ──────────────────────────────────────────────────────────────
    const phase2   = this.hp <= this.maxHp * 0.5;
    const orbitSpd = phase2 ? this.orbitSpd * 1.72 : this.orbitSpd;
    this.orbitAngle += orbitSpd * dt;
    this.x = this.orbitCX + Math.cos(this.orbitAngle) * this.orbitRX;
    this.y = this.orbitCY + Math.sin(this.orbitAngle) * this.orbitRY;

    this.ringAngle += 1.5 * dt;
    this.glowPulse += dt;
    const g = this.gfx.getChildAt(0) as PIXI.Graphics;
    g.alpha = 0.88 + Math.sin(this.glowPulse * 3) * 0.12;
    this.gfx.position.set(this.x, this.y);
    this.gfx.rotation = this.ringAngle;

    // ── Regular volley ──────────────────────────────────────────────────────
    const interval = phase2 ? 1.0 : 1.6;
    this.shotTimer += dt;
    if (this.shotTimer >= interval) {
      this.shotTimer = 0;
      this.fireVolley(phase2);
    }

    // ── Stellar Burst ability ───────────────────────────────────────────────
    this.burstTimer -= dt;
    if (this.burstTimer <= 0) {
      this.burstTimer = phase2 ? 4.0 : 5.5;
      this.fireStellarBurst(px, py, phase2 ? 3 : 2);
    }

    this.updateBurstOrbs(dt, px, py);
    this.updateProjs(dt);
  }

  private fireVolley(phase2: boolean): void {
    const count = phase2 ? 8 : 6;
    const speed = 160;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + this.shotRot;
      this.spawnProj(this.x, this.y, Math.cos(a) * speed, Math.sin(a) * speed, this.color, 6);
    }
    this.shotRot += Math.PI / (count / 2);
  }

  private fireStellarBurst(px: number, py: number, count: number): void {
    const baseAngle = Math.atan2(py - this.y, px - this.x);
    const spread    = (Math.PI * 2) / count;
    for (let i = 0; i < count; i++) {
      const a   = baseAngle + i * spread + (Math.random() - 0.5) * 0.4;
      const spd = 55 + Math.random() * 25;
      const orb: BurstOrb = {
        x: this.x, y: this.y,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        timer: 2.2, dead: false, t: 0,
        gfx: new PIXI.Graphics(),
      };
      orb.gfx.beginFill(this.color, 0.12); orb.gfx.drawCircle(0, 0, 32); orb.gfx.endFill();
      orb.gfx.beginFill(this.color, 0.45); orb.gfx.drawCircle(0, 0, 16); orb.gfx.endFill();
      orb.gfx.beginFill(this.color, 1.00); orb.gfx.drawCircle(0, 0,  7); orb.gfx.endFill();
      orb.gfx.beginFill(0xffffff, 0.55);   orb.gfx.drawCircle(-3, -3, 3); orb.gfx.endFill();
      orb.gfx.position.set(this.x, this.y);
      this.projLayer.addChild(orb.gfx);
      this.burstOrbs.push(orb);
    }
  }

  private updateBurstOrbs(dt: number, _px: number, _py: number): void {
    for (const orb of this.burstOrbs) {
      if (orb.dead) continue;
      orb.x += orb.vx * dt; orb.y += orb.vy * dt;
      orb.timer -= dt; orb.t += dt;
      const frac  = Math.max(0, orb.timer / 2.2);
      const pulse = 0.7 + Math.abs(Math.sin(orb.t * 7)) * 0.3;
      orb.gfx.position.set(orb.x, orb.y);
      orb.gfx.alpha    = 0.6 + pulse * 0.4;
      orb.gfx.scale.set(0.7 + (1 - frac) * 0.8 + Math.sin(orb.t * 7) * 0.06);
      if (orb.timer <= 0) {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          this.spawnProj(orb.x, orb.y, Math.cos(a) * 145, Math.sin(a) * 145, this.color, 5);
        }
        this.projLayer.removeChild(orb.gfx); orb.gfx.destroy(); orb.dead = true;
      }
    }
    this.burstOrbs = this.burstOrbs.filter((o) => !o.dead);
  }

  override projHitsPlayer(px: number, py: number, pr: number): boolean {
    if (super.projHitsPlayer(px, py, pr)) return true;
    return this.burstOrbs.some((o) => !o.dead && Math.hypot(o.x - px, o.y - py) < 16 + pr);
  }

  override destroy(): void {
    for (const o of this.burstOrbs) {
      if (!o.dead) { this.projLayer.removeChild(o.gfx); o.gfx.destroy(); }
    }
    this.burstOrbs = [];
    super.destroy();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BOSS 2 — THE STAMPEDE  (Level 10)
// Idle drift + spread shots → countdown ring 3-2-1 → charge → recover · 20 HP
//
// RANDOMISED: spawn edge (top/left/right), idle drift centre, recovery position.
// ─────────────────────────────────────────────────────────────────────────────

export class BossStampede extends BossBase {
  readonly name   = 'THE STAMPEDE';
  readonly color  = 0xff3300;
  readonly radius = 38;

  private state: 'flying-in' | 'idle' | 'countdown' | 'charging' | 'recovering' = 'flying-in';
  private stateTimer  = 0;
  private countdown   = 3;
  private chargeVx    = 0;
  private chargeVy    = 0;
  private spreadTimer = 0;
  private countdownText!: PIXI.Text;
  private countdownRingAngle = 0;
  private pulseT = 0;

  // Randomised targets
  private readonly idleTargetX: number;
  private readonly idleTargetY: number;
  private recoveryX: number;
  private recoveryY: number;

  constructor(app: PIXI.Application, bossLayer: PIXI.Container, projLayer: PIXI.Container) {
    super(app, bossLayer, projLayer);
    this.hp    = 20;
    this.maxHp = 20;

    const W = app.screen.width, H = app.screen.height;

    // Randomised idle zone (upper half of arena)
    this.idleTargetX = W * (0.28 + Math.random() * 0.44);
    this.idleTargetY = H * (0.15 + Math.random() * 0.18);
    this.recoveryX   = this.idleTargetX;
    this.recoveryY   = this.idleTargetY;

    // Random spawn edge: 0=top, 1=left, 2=right
    const side = Math.floor(Math.random() * 3);
    if (side === 1) {
      this.x = -90;
      this.y = H * (0.15 + Math.random() * 0.25);
    } else if (side === 2) {
      this.x = W + 90;
      this.y = H * (0.15 + Math.random() * 0.25);
    } else {
      this.x = W * (0.2 + Math.random() * 0.6);
      this.y = -90;
    }

    this.buildGraphics();
  }

  buildGraphics(): void {
    this.gfx.removeChildren();
    const g = new PIXI.Graphics();
    g.beginFill(this.color, 0.07); g.drawCircle(0, 0, this.radius * 2.2); g.endFill();
    g.beginFill(this.color, 0.14); g.drawCircle(0, 0, this.radius * 1.5); g.endFill();
    g.lineStyle(2, this.color, 1);
    g.beginFill(0x1a0500, 0.95);
    const pts: number[] = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const r = this.radius * (i % 2 === 0 ? 1 : 0.75);
      pts.push(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.drawPolygon(pts); g.endFill();
    g.lineStyle(0);
    g.beginFill(this.color, 1); g.drawCircle(0, 0, 10); g.endFill();
    g.beginFill(0xff8800, 0.8); g.drawCircle(0, 0,  5); g.endFill();
    this.gfx.addChild(g);

    this.countdownText = new PIXI.Text('', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: 36, fontWeight: 'bold', fill: 0xffffff,
      dropShadow: true, dropShadowColor: this.color, dropShadowBlur: 18, dropShadowDistance: 0,
    });
    this.countdownText.anchor.set(0.5);
    this.countdownText.position.set(0, -65);
    this.countdownText.visible = false;
    this.gfx.addChild(this.countdownText);
    this.gfx.position.set(this.x, this.y);
  }

  update(dt: number, px: number, py: number): void {
    const W = this.app.screen.width, H = this.app.screen.height;
    this.pulseT += dt;

    switch (this.state) {
      case 'flying-in': {
        const dx = this.idleTargetX - this.x, dy = this.idleTargetY - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 6) {
          this.x = this.idleTargetX; this.y = this.idleTargetY;
          this.state = 'idle'; this.stateTimer = 0;
        } else {
          const spd = 240;
          this.x += (dx / dist) * spd * dt;
          this.y += (dy / dist) * spd * dt;
        }
        break;
      }
      case 'idle': {
        // Drift around idle zone with a sine wave
        this.x += Math.sin(this.pulseT * 0.7) * 45 * dt;
        this.x = Math.max(this.radius + 20, Math.min(W - this.radius - 20, this.x));
        this.spreadTimer += dt;
        if (this.spreadTimer >= 2.2) { this.spreadTimer = 0; this.fireSpread(px, py); }
        this.stateTimer += dt;
        if (this.stateTimer >= 3.5) {
          this.stateTimer = 0; this.countdown = 3;
          this.countdownText.text    = '3';
          this.countdownText.visible = true;
          this.state = 'countdown';
        }
        break;
      }
      case 'countdown': {
        this.stateTimer += dt;
        this.countdownRingAngle += dt * 5;
        this.countdownText.text = String(this.countdown);
        this.countdownText.scale.set(0.9 + Math.sin(this.pulseT * 10) * 0.1);
        if (this.stateTimer >= 1) {
          this.stateTimer = 0; this.countdown--;
          if (this.countdown <= 0) {
            this.countdownText.visible = false;
            const dx = px - this.x, dy = py - this.y, len = Math.hypot(dx, dy) || 1;
            const spd = this.hp < this.maxHp * 0.4 ? 1100 : 820;
            this.chargeVx = (dx / len) * spd; this.chargeVy = (dy / len) * spd;
            this.state = 'charging';
          }
        }
        break;
      }
      case 'charging': {
        this.x += this.chargeVx * dt;
        this.y += this.chargeVy * dt;
        if (this.x < -this.radius || this.x > W + this.radius ||
            this.y < -this.radius || this.y > H + this.radius) {
          // Clamp back and pick a new random recovery position
          this.x = Math.max(this.radius + 40, Math.min(W - this.radius - 40, this.x));
          this.y = Math.max(this.radius + 40, Math.min(H - this.radius - 40, this.y));
          this.recoveryX = W * (0.25 + Math.random() * 0.50);
          this.recoveryY = H * (0.14 + Math.random() * 0.20);
          this.state = 'recovering'; this.stateTimer = 0;
        }
        break;
      }
      case 'recovering': {
        const dx = this.recoveryX - this.x, dy = this.recoveryY - this.y;
        const len = Math.hypot(dx, dy) || 1;
        this.x += (dx / len) * 160 * dt; this.y += (dy / len) * 160 * dt;
        this.stateTimer += dt;
        if (this.stateTimer >= 1.6) { this.state = 'idle'; this.stateTimer = 0; this.spreadTimer = 0; }
        break;
      }
    }

    this.gfx.position.set(this.x, this.y);
    this.gfx.rotation += dt * (this.state === 'charging' ? 4 : 0.8);

    const ringGfx = this.gfx.getChildAt(0) as PIXI.Graphics;
    if (this.state === 'countdown') {
      ringGfx.clear(); this.redrawBody(ringGfx, true);
    } else if (this.state === 'charging') {
      ringGfx.tint = 0xff8800;
    } else {
      ringGfx.tint = 0xffffff;
    }

    this.updateProjs(dt);
  }

  isCharging(): boolean { return this.state === 'charging'; }

  private fireSpread(px: number, py: number): void {
    const dx = px - this.x, dy = py - this.y, len = Math.hypot(dx, dy) || 1;
    const base = Math.atan2(dy, dx);
    for (let i = -1; i <= 1; i++) {
      const a = base + i * 0.35;
      this.spawnProj(this.x, this.y, Math.cos(a) * 175, Math.sin(a) * 175, this.color, 7);
    }
  }

  private redrawBody(g: PIXI.Graphics, withRing: boolean): void {
    g.clear();
    g.beginFill(this.color, 0.07); g.drawCircle(0, 0, this.radius * 2.2); g.endFill();
    g.beginFill(this.color, 0.14); g.drawCircle(0, 0, this.radius * 1.5); g.endFill();
    if (withRing) {
      const frac = 1 - (this.stateTimer % 1);
      g.lineStyle(3, 0xffffff, 0.8);
      g.arc(0, 0, this.radius * 1.3, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      g.lineStyle(0);
    }
    g.lineStyle(2, this.color, 1);
    g.beginFill(0x1a0500, 0.95);
    const pts: number[] = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const r = this.radius * (i % 2 === 0 ? 1 : 0.75);
      pts.push(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.drawPolygon(pts); g.endFill();
    g.lineStyle(0);
    g.beginFill(this.color, 1); g.drawCircle(0, 0, 10); g.endFill();
    g.beginFill(0xff8800, 0.8); g.drawCircle(0, 0,  5); g.endFill();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BOSS 3 — THE SCHISM  (Level 15)
// Phase 1: single large orb (20→12 HP)
// Phase 2: splits into 3 hunting fragments (12→4 HP)
// Phase 3: reassembles red-rage form (4→0 HP)
//
// RANDOMISED: spawn edge, orbit centre offset, starting orbit angle, phase3 speed.
// ─────────────────────────────────────────────────────────────────────────────

interface SchismFragment {
  x: number; y: number; vx: number; vy: number;
  alive: boolean; radius: number; gfx: PIXI.Graphics; shotTimer: number;
  beamAngle: number;
  beamGfx: PIXI.Graphics;
}

export class BossSchism extends BossBase {
  readonly name   = 'THE SCHISM';
  readonly color  = 0xeeeeff;
  readonly radius = 52;

  phase = 1;
  private shotTimer  = 0;
  private orbitAngle: number;
  private pulseT     = 0;
  private fragments:  SchismFragment[] = [];
  private phaseText!: PIXI.Text;
  private p3Radius  = 58;
  private p3ShotRot = 0;

  // Rotating beam (Phase 1)
  private beamAngle = 0;
  private beamGfx: PIXI.Graphics | null = null;

  // Randomised orbit params
  private readonly orbitOffX: number;
  private readonly orbitOffY: number;
  private readonly p1OrbitSpd: number;
  private readonly p3OrbitSpd: number;

  constructor(app: PIXI.Application, bossLayer: PIXI.Container, projLayer: PIXI.Container) {
    super(app, bossLayer, projLayer);
    this.hp    = 20;
    this.maxHp = 20;

    const W = app.screen.width, H = app.screen.height;

    // Randomised orbit centre offset from screen centre
    this.orbitOffX  = W * (Math.random() * 0.16 - 0.08);
    this.orbitOffY  = H * (Math.random() * 0.08 - 0.04);
    this.p1OrbitSpd = 0.22 + Math.random() * 0.06;
    this.p3OrbitSpd = 0.52 + Math.random() * 0.14;
    // Random starting angle so orbit path looks different each time
    this.orbitAngle = Math.random() * Math.PI * 2;

    // Random spawn edge
    const side = Math.floor(Math.random() * 3);
    if (side === 1) {
      this.x = -90;
      this.y = H * (0.25 + Math.random() * 0.20);
    } else if (side === 2) {
      this.x = W + 90;
      this.y = H * (0.25 + Math.random() * 0.20);
    } else {
      this.x = W * (0.2 + Math.random() * 0.6);
      this.y = -90;
    }

    this.buildGraphics();
  }

  buildGraphics(): void {
    this.gfx.removeChildren();
    const g = new PIXI.Graphics();
    this.drawPhase1Body(g);
    this.gfx.addChild(g);

    this.phaseText = new PIXI.Text('', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: 13, fill: 0xaaaaff, letterSpacing: 3,
    });
    this.phaseText.anchor.set(0.5);
    this.phaseText.position.set(0, -72);
    this.gfx.addChild(this.phaseText);
    this.gfx.position.set(this.x, this.y);

    // Phase 1 beam graphics (lives on projLayer, drawn each frame)
    this.beamGfx = new PIXI.Graphics();
    this.projLayer.addChild(this.beamGfx);
  }

  private drawPhase1Body(g: PIXI.Graphics): void {
    g.clear();
    g.beginFill(this.color, 0.06); g.drawCircle(0, 0, this.radius * 2.3); g.endFill();
    g.beginFill(this.color, 0.12); g.drawCircle(0, 0, this.radius * 1.6); g.endFill();
    g.lineStyle(2, this.color, 0.9);
    g.beginFill(0x0a0a1a, 0.92); g.drawCircle(0, 0, this.radius); g.endFill();
    g.lineStyle(1, this.color, 0.6);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.moveTo(0, 0); g.lineTo(Math.cos(a) * this.radius * 0.9, Math.sin(a) * this.radius * 0.9);
    }
    g.lineStyle(0);
    g.beginFill(this.color, 0.95); g.drawCircle(0, 0, 14); g.endFill();
    g.beginFill(0x0a0a1a, 0.9);   g.drawCircle(0, 0,  7); g.endFill();
  }

  update(dt: number, px: number, py: number): void {
    const W = this.app.screen.width, H = this.app.screen.height;
    this.pulseT += dt;

    switch (this.phase) {
      case 1: {
        // Fly in toward orbit centre first
        const orbitCX = W / 2 + this.orbitOffX;
        const orbitCY = H / 2 + this.orbitOffY;
        const flyTargetY = orbitCY + Math.sin(this.orbitAngle) * H * 0.18;
        const flyTargetX = orbitCX + Math.cos(this.orbitAngle) * W * 0.22;
        if (Math.hypot(this.x - flyTargetX, this.y - flyTargetY) > 8) {
          const dx = flyTargetX - this.x, dy = flyTargetY - this.y;
          const dist = Math.hypot(dx, dy);
          this.x += (dx / dist) * 160 * dt;
          this.y += (dy / dist) * 160 * dt;
          this.gfx.position.set(this.x, this.y);
          return;
        }
        this.orbitAngle += this.p1OrbitSpd * dt;
        this.x = orbitCX + Math.cos(this.orbitAngle) * W * 0.22;
        this.y = orbitCY + Math.sin(this.orbitAngle) * H * 0.18;
        this.gfx.position.set(this.x, this.y);
        this.gfx.rotation += dt * 0.4;
        const g = this.gfx.getChildAt(0) as PIXI.Graphics;
        g.alpha = 0.82 + Math.sin(this.pulseT * 2.5) * 0.18;
        this.shotTimer += dt;
        if (this.shotTimer >= 2.2) { this.shotTimer = 0; this.fireNWay(8, 0, 145); }
        // Rotating laser beam — sweeps clockwise, forces player to dodge laterally
        this.beamAngle += 1.1 * dt;
        if (this.beamGfx) this.drawBeam(this.beamGfx, this.x, this.y, this.beamAngle, 700, 0xeeeeff);
        if (this.hp <= 12) this.transitionToPhase2();
        break;
      }
      case 2: {
        let allDead = true;
        for (const f of this.fragments) {
          if (!f.alive) continue;
          allDead = false;
          const dx = px - f.x, dy = py - f.y, len = Math.hypot(dx, dy) || 1;
          f.vx += (dx / len) * 80 * dt;
          f.vy += (dy / len) * 80 * dt;
          const spd = Math.hypot(f.vx, f.vy);
          if (spd > 200) { f.vx = (f.vx / spd) * 200; f.vy = (f.vy / spd) * 200; }
          f.x += f.vx * dt; f.y += f.vy * dt;
          f.x = Math.max(f.radius + 10, Math.min(W - f.radius - 10, f.x));
          f.y = Math.max(f.radius + 10, Math.min(H - f.radius - 10, f.y));
          f.gfx.position.set(f.x, f.y);
          f.gfx.rotation += dt * 1.8;
          f.gfx.alpha = 0.85 + Math.sin(this.pulseT * 4) * 0.15;
          // Each fragment has its own rotating beam
          f.beamAngle += 1.4 * dt;
          this.drawBeam(f.beamGfx, f.x, f.y, f.beamAngle, 500, 0x44ddff);
          f.shotTimer += dt;
          if (f.shotTimer >= 1.8) {
            f.shotTimer = 0;
            const a = Math.atan2(py - f.y, px - f.x);
            this.spawnProj(f.x, f.y, Math.cos(a) * 165, Math.sin(a) * 165, 0x44ddff, 5);
            this.spawnProj(f.x, f.y, Math.cos(a + Math.PI) * 165, Math.sin(a + Math.PI) * 165, 0x44ddff, 5);
          }
        }
        if (allDead) this.transitionToPhase3();
        break;
      }
      case 3: {
        const orbitCX = W / 2 + this.orbitOffX;
        const orbitCY = H / 2 + this.orbitOffY;
        this.orbitAngle += this.p3OrbitSpd * dt;
        this.x = orbitCX + Math.cos(this.orbitAngle) * W * 0.18;
        this.y = orbitCY + Math.sin(this.orbitAngle) * H * 0.15;
        this.gfx.position.set(this.x, this.y);
        this.gfx.rotation += dt * 1.2;
        const g = this.gfx.getChildAt(0) as PIXI.Graphics;
        g.alpha = 0.75 + Math.abs(Math.sin(this.pulseT * 5)) * 0.25;
        this.shotTimer  += dt;
        this.p3ShotRot  += dt * 1.1;
        if (this.shotTimer >= 1.5) { this.shotTimer = 0; this.fireNWay(12, this.p3ShotRot, 175); }
        break;
      }
    }

    this.updateProjs(dt);
  }

  override processBullets(checkHit: (x: number, y: number, r: number) => boolean): boolean {
    if (this.phase === 2) {
      for (const f of this.fragments) {
        if (!f.alive) continue;
        if (checkHit(f.x, f.y, f.radius)) {
          f.alive = false; f.gfx.visible = false;
          this.takeDamage(1);
          if (this.fragments.every((fr) => !fr.alive)) {
            if (this.hp > 4) this.hp = 4;
            this.transitionToPhase3();
          }
          return true;
        }
      }
      return false;
    }
    return super.processBullets(checkHit);
  }

  override bodyCollidesWithPlayer(px: number, py: number, pr: number): boolean {
    if (this.phase === 2) return false;
    return super.bodyCollidesWithPlayer(px, py, pr);
  }

  override projHitsPlayer(px: number, py: number, pr: number): boolean {
    if (super.projHitsPlayer(px, py, pr)) return true;
    // Phase 1 rotating beam
    if (this.phase === 1 && this.beamGfx) {
      if (this.beamHitsPoint(this.x, this.y, this.beamAngle, 700, px, py)) return true;
    }
    if (this.phase === 2) {
      // Fragment body collision
      if (this.fragments.some((f) => f.alive && Math.hypot(f.x - px, f.y - py) < f.radius + pr - 2)) return true;
      // Fragment rotating beams
      for (const f of this.fragments) {
        if (!f.alive) continue;
        if (this.beamHitsPoint(f.x, f.y, f.beamAngle, 500, px, py)) return true;
      }
    }
    return false;
  }

  /** Draw a multi-layer glowing beam line from (bx,by) outward along angle. */
  private drawBeam(g: PIXI.Graphics, bx: number, by: number, angle: number, length: number, color: number): void {
    g.clear();
    const ex = bx + Math.cos(angle) * length;
    const ey = by + Math.sin(angle) * length;
    // Wide outer glow
    g.lineStyle(14, color, 0.07);
    g.moveTo(bx, by); g.lineTo(ex, ey);
    // Mid glow
    g.lineStyle(7, color, 0.22);
    g.moveTo(bx, by); g.lineTo(ex, ey);
    // Color core
    g.lineStyle(4, color, 0.70);
    g.moveTo(bx, by); g.lineTo(ex, ey);
    // White-hot centre
    g.lineStyle(1.5, 0xffffff, 0.95);
    g.moveTo(bx, by); g.lineTo(ex, ey);
  }

  /** Perpendicular distance from (px,py) to beam ray from (bx,by) at angle, clamped to length. */
  private beamHitsPoint(bx: number, by: number, angle: number, length: number, px: number, py: number): boolean {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const ex = px - bx, ey = py - by;
    const t = Math.max(0, Math.min(length, ex * dx + ey * dy));
    return Math.hypot(px - (bx + dx * t), py - (by + dy * t)) < 20;
  }

  private transitionToPhase2(): void {
    this.phase = 2;
    // Clean up Phase 1 rotating beam
    if (this.beamGfx) {
      this.projLayer.removeChild(this.beamGfx);
      this.beamGfx.destroy();
      this.beamGfx = null;
    }
    this.gfx.visible = false;
    const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
    this.fragments = angles.map((a, idx) => {
      const fx = this.x + Math.cos(a) * 80;
      const fy = this.y + Math.sin(a) * 80;
      const r  = 22;
      const g  = new PIXI.Graphics();
      g.beginFill(0x44ddff, 0.15); g.drawCircle(0, 0, r * 1.8); g.endFill();
      g.lineStyle(2, 0x44ddff, 0.9);
      g.beginFill(0x001122, 0.95);
      const pts: number[] = [];
      for (let i = 0; i < 6; i++) {
        const pa = (i / 6) * Math.PI * 2;
        pts.push(Math.cos(pa) * r, Math.sin(pa) * r);
      }
      g.drawPolygon(pts); g.endFill();
      g.lineStyle(0);
      g.beginFill(0x44ddff, 0.95); g.drawCircle(0, 0, 6); g.endFill();
      g.position.set(fx, fy);
      this.bossLayer.addChild(g);
      // Each fragment gets its own beam, staggered so they're never in sync
      const fragBeam = new PIXI.Graphics();
      this.projLayer.addChild(fragBeam);
      return { x: fx, y: fy, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80,
               alive: true, radius: r, gfx: g, shotTimer: Math.random() * 1.5,
               beamAngle: a + (idx * Math.PI * 2) / 3,
               beamGfx: fragBeam };
    });
  }

  private transitionToPhase3(): void {
    this.phase = 3;
    for (const f of this.fragments) {
      // Clean up fragment beam
      if (f.beamGfx) { this.projLayer.removeChild(f.beamGfx); f.beamGfx.destroy(); }
      this.bossLayer.removeChild(f.gfx); f.gfx.destroy();
    }
    this.fragments = [];
    this.gfx.visible = true;
    const g = this.gfx.getChildAt(0) as PIXI.Graphics;
    g.clear();
    const r = this.p3Radius;
    g.beginFill(0xff0022, 0.08); g.drawCircle(0, 0, r * 2.4); g.endFill();
    g.beginFill(0xff0022, 0.18); g.drawCircle(0, 0, r * 1.65); g.endFill();
    g.lineStyle(2.5, 0xff0022, 1);
    g.beginFill(0x1a0000, 0.95); g.drawCircle(0, 0, r); g.endFill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.lineStyle(1.5, 0xff0022, 0.7);
      g.moveTo(0, 0); g.lineTo(Math.cos(a) * r * 0.88, Math.sin(a) * r * 0.88);
    }
    g.lineStyle(0);
    g.beginFill(0xff0022, 1); g.drawCircle(0, 0, 16); g.endFill();
    g.beginFill(0xffffff, 0.7); g.drawCircle(0, 0,  6); g.endFill();
  }

  private fireNWay(n: number, rotOffset: number, speed: number): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rotOffset;
      this.spawnProj(this.x, this.y, Math.cos(a) * speed, Math.sin(a) * speed,
        this.phase === 3 ? 0xff2244 : this.color, this.phase === 3 ? 7 : 6);
    }
  }

  override destroy(): void {
    // Clean up phase 1 beam if still active
    if (this.beamGfx) {
      this.projLayer.removeChild(this.beamGfx);
      this.beamGfx.destroy();
      this.beamGfx = null;
    }
    for (const f of this.fragments) {
      if (f.beamGfx) { this.projLayer.removeChild(f.beamGfx); f.beamGfx.destroy(); }
      this.bossLayer.removeChild(f.gfx); f.gfx.destroy();
    }
    this.fragments = [];
    super.destroy();
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createBoss(
  level: number,
  app:   PIXI.Application,
  bossLayer: PIXI.Container,
  projLayer: PIXI.Container,
): BossBase {
  if (level >= 15) return new BossSchism(app,   bossLayer, projLayer);
  if (level >= 10) return new BossStampede(app, bossLayer, projLayer);
  return new BossNebula(app, bossLayer, projLayer);
}
