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
// ─────────────────────────────────────────────────────────────────────────────

interface BurstOrb {
  x: number; y: number; vx: number; vy: number;
  timer: number;
  dead:  boolean;
  t:     number;  // local time for pulsing
  gfx:   PIXI.Graphics;
}

export class BossNebula extends BossBase {
  readonly name   = 'THE NEBULA';
  readonly color  = 0xcc44ff;
  readonly radius = 44;

  // Use a one-shot flag so fly-in never re-activates
  private inFlyIn    = true;
  private orbitAngle = -Math.PI / 2;
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
    this.x = app.screen.width  / 2;
    this.y = -80;
    this.buildGraphics();
  }

  buildGraphics(): void {
    this.gfx.removeChildren();
    const g = new PIXI.Graphics();
    // Nebula glow halos
    g.beginFill(this.color, 0.05); g.drawCircle(0, 0, this.radius * 2.6); g.endFill();
    g.beginFill(this.color, 0.10); g.drawCircle(0, 0, this.radius * 1.8); g.endFill();
    // Decorative orbital ring
    g.lineStyle(1.5, this.color, 0.55);
    g.drawEllipse(0, 0, this.radius * 1.3, this.radius * 0.55);
    g.lineStyle(0);
    // Core body
    g.beginFill(this.color, 0.85); g.drawCircle(0, 0, this.radius); g.endFill();
    // Highlight & dark pupil
    g.beginFill(0xffffff, 0.25);   g.drawCircle(-8, -10, 12);                   g.endFill();
    g.beginFill(0x220033, 0.6);    g.drawCircle(0, 0, this.radius * 0.45);      g.endFill();
    g.beginFill(this.color, 1);    g.drawCircle(0, 0, 8);                        g.endFill();
    this.gfx.addChild(g);
    this.gfx.position.set(this.x, this.y);
  }

  update(dt: number, px: number, py: number): void {
    const W = this.app.screen.width, H = this.app.screen.height;

    // ── Fly-in (one-shot — flag never resets) ──────────────────────────────
    if (this.inFlyIn) {
      this.y += 250 * dt;
      this.gfx.position.set(this.x, this.y);
      // Enter orbit once the boss has passed into the upper-third of the arena
      if (this.y >= H * 0.28) {
        this.inFlyIn = false;
        // Snap position so orbit starts exactly where fly-in left off
        this.orbitAngle = -Math.PI / 2;
        this.x = W / 2 + Math.cos(this.orbitAngle) * W * 0.28;
        this.y = H / 2 + Math.sin(this.orbitAngle) * H * 0.22;
      }
      return;
    }

    // ── Orbit ──────────────────────────────────────────────────────────────
    const phase2  = this.hp <= this.maxHp * 0.5;
    const orbitSpd = phase2 ? 0.58 : 0.34;
    this.orbitAngle += orbitSpd * dt;
    this.x = W / 2 + Math.cos(this.orbitAngle) * W * 0.28;
    this.y = H / 2 + Math.sin(this.orbitAngle) * H * 0.22;

    // Visual rotation & glow pulse
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

    // Update burst orbs
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

  // Fires `count` big slow orbs that drift then detonate in a 12-way ring
  private fireStellarBurst(px: number, py: number, count: number): void {
    const baseAngle  = Math.atan2(py - this.y, px - this.x);
    const spread     = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
      const a   = baseAngle + i * spread + (Math.random() - 0.5) * 0.4;
      const spd = 55 + Math.random() * 25;

      const orb: BurstOrb = {
        x: this.x, y: this.y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        timer: 2.2,
        dead:  false,
        t:     0,
        gfx:   new PIXI.Graphics(),
      };

      // Orb visual — large glowing ball with pulsing ring
      orb.gfx.beginFill(this.color, 0.12); orb.gfx.drawCircle(0, 0, 32); orb.gfx.endFill();
      orb.gfx.beginFill(this.color, 0.45); orb.gfx.drawCircle(0, 0, 16); orb.gfx.endFill();
      orb.gfx.beginFill(this.color, 1.00); orb.gfx.drawCircle(0, 0,  7); orb.gfx.endFill();
      orb.gfx.beginFill(0xffffff, 0.55);   orb.gfx.drawCircle(-3, -3,  3); orb.gfx.endFill();
      orb.gfx.position.set(this.x, this.y);
      this.projLayer.addChild(orb.gfx);

      this.burstOrbs.push(orb);
    }
  }

  private updateBurstOrbs(dt: number, _px: number, _py: number): void {
    for (const orb of this.burstOrbs) {
      if (orb.dead) continue;
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      orb.timer -= dt;
      orb.t     += dt;

      // Pulse & scale up as countdown nears zero
      const frac  = Math.max(0, orb.timer / 2.2);
      const pulse = 0.7 + Math.abs(Math.sin(orb.t * 7)) * 0.3;
      orb.gfx.position.set(orb.x, orb.y);
      orb.gfx.alpha    = 0.6 + pulse * 0.4;
      orb.gfx.scale.set(0.7 + (1 - frac) * 0.8 + Math.sin(orb.t * 7) * 0.06);

      if (orb.timer <= 0) {
        // Detonate — 12-way radial ring
        const burst = 12;
        for (let i = 0; i < burst; i++) {
          const a = (i / burst) * Math.PI * 2;
          this.spawnProj(orb.x, orb.y,
            Math.cos(a) * 145, Math.sin(a) * 145, this.color, 5);
        }
        this.projLayer.removeChild(orb.gfx);
        orb.gfx.destroy();
        orb.dead = true;
      }
    }
    this.burstOrbs = this.burstOrbs.filter((o) => !o.dead);
  }

  // Burst orbs also damage the player on contact
  override projHitsPlayer(px: number, py: number, pr: number): boolean {
    if (super.projHitsPlayer(px, py, pr)) return true;
    return this.burstOrbs.some(
      (o) => !o.dead && Math.hypot(o.x - px, o.y - py) < 16 + pr,
    );
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

  constructor(app: PIXI.Application, bossLayer: PIXI.Container, projLayer: PIXI.Container) {
    super(app, bossLayer, projLayer);
    this.hp    = 20;
    this.maxHp = 20;
    this.x = app.screen.width * 0.5;
    this.y = -80;
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
        this.y += 220 * dt;
        if (this.y >= H * 0.2) { this.y = H * 0.2; this.state = 'idle'; this.stateTimer = 0; }
        break;
      }
      case 'idle': {
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
          this.x = Math.max(this.radius + 40, Math.min(W - this.radius - 40, this.x));
          this.y = Math.max(this.radius + 40, Math.min(H - this.radius - 40, this.y));
          this.state = 'recovering'; this.stateTimer = 0;
        }
        break;
      }
      case 'recovering': {
        const cx = W / 2, cy = H * 0.25;
        const dx = cx - this.x, dy = cy - this.y, len = Math.hypot(dx, dy) || 1;
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
// Phase 2: splits into 3 hunting fragments (12→4 HP, fragments die on 1 shot each)
// Phase 3: reassembles red-rage form (4→0 HP)
// Total unified HP = 20
// ─────────────────────────────────────────────────────────────────────────────

interface SchismFragment {
  x: number; y: number; vx: number; vy: number;
  alive: boolean;
  radius: number;
  gfx: PIXI.Graphics;
  shotTimer: number;
}

export class BossSchism extends BossBase {
  readonly name   = 'THE SCHISM';
  readonly color  = 0xeeeeff;
  readonly radius = 52;

  phase = 1;
  private shotTimer  = 0;
  private orbitAngle = 0;
  private pulseT     = 0;
  private fragments:  SchismFragment[] = [];
  private phaseText!: PIXI.Text;
  private p3Radius  = 58;
  private p3ShotRot = 0;

  constructor(app: PIXI.Application, bossLayer: PIXI.Container, projLayer: PIXI.Container) {
    super(app, bossLayer, projLayer);
    this.hp    = 20;
    this.maxHp = 20;
    this.x = app.screen.width  / 2;
    this.y = -80;
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
        if (this.y < H * 0.42) { this.y += 150 * dt; this.gfx.position.set(this.x, this.y); return; }
        this.orbitAngle += 0.25 * dt;
        this.x = W / 2 + Math.cos(this.orbitAngle) * W * 0.22;
        this.y = H / 2 + Math.sin(this.orbitAngle) * H * 0.18;
        this.gfx.position.set(this.x, this.y);
        this.gfx.rotation += dt * 0.4;
        const g = this.gfx.getChildAt(0) as PIXI.Graphics;
        g.alpha = 0.82 + Math.sin(this.pulseT * 2.5) * 0.18;
        this.shotTimer += dt;
        if (this.shotTimer >= 2.2) { this.shotTimer = 0; this.fireNWay(8, 0, 145); }
        // Phase 1 → 2 at 60% HP taken (12 out of 20)
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
        this.orbitAngle += 0.6 * dt;
        this.x = W / 2 + Math.cos(this.orbitAngle) * W * 0.18;
        this.y = H / 2 + Math.sin(this.orbitAngle) * H * 0.15;
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

  // ── processBullets override for phase 2 fragments ─────────────────────────

  override processBullets(checkHit: (x: number, y: number, r: number) => boolean): boolean {
    if (this.phase === 2) {
      for (const f of this.fragments) {
        if (!f.alive) continue;
        if (checkHit(f.x, f.y, f.radius)) {
          f.alive = false;
          f.gfx.visible = false;
          this.takeDamage(1);
          if (this.fragments.every(fr => !fr.alive)) {
            if (this.hp > 4) this.hp = 4; // cap HP for phase 3 entry
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
    if (this.phase === 2) {
      return this.fragments.some(
        (f) => f.alive && Math.hypot(f.x - px, f.y - py) < f.radius + pr - 2,
      );
    }
    return false;
  }

  // ── Phase transitions ─────────────────────────────────────────────────────

  private transitionToPhase2(): void {
    this.phase = 2;
    this.gfx.visible = false;

    const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
    this.fragments = angles.map((a) => {
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
      return { x: fx, y: fy, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80,
               alive: true, radius: r, gfx: g, shotTimer: Math.random() * 1.5 };
    });
  }

  private transitionToPhase3(): void {
    this.phase = 3;
    for (const f of this.fragments) { this.bossLayer.removeChild(f.gfx); f.gfx.destroy(); }
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
    for (const f of this.fragments) { this.bossLayer.removeChild(f.gfx); f.gfx.destroy(); }
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
