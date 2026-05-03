import * as PIXI from 'pixi.js';

// ─── Background Manager — 3 procedural themes with smooth crossfade ───────────

export type ThemeId = 0 | 1 | 2; // 0 = deep space, 1 = Mars, 2 = bioluminescent forest

interface Particle {
  x: number; y: number; vx: number; vy: number;
  alpha: number; size: number; color: number;
  life: number; maxLife: number;
}

export class BackgroundManager {
  private app:   PIXI.Application;
  private layer: PIXI.Container;

  // One container per theme
  private containers: PIXI.Container[] = [];
  // Dynamic particle layer inside each container
  private dynGfx: PIXI.Graphics[] = [];
  // Particle data per theme
  private particles: Particle[][] = [[], [], []];

  private currentTheme: ThemeId = 0;
  private targetTheme:  ThemeId = 0;
  private transitioning  = false;
  private transTimer     = 0;
  private readonly TRANS_DUR = 2.2;

  constructor(app: PIXI.Application, layer: PIXI.Container) {
    this.app   = app;
    this.layer = layer;

    for (let i = 0; i < 3; i++) {
      const c = new PIXI.Container();
      c.alpha  = i === 0 ? 1 : 0;
      layer.addChild(c);
      this.containers.push(c);

      // Static art first, then dynamic gfx on top
      this.buildStatic(i as ThemeId, c);

      const dyn = new PIXI.Graphics();
      c.addChild(dyn);
      this.dynGfx.push(dyn);
    }

    this.initParticles(0);
  }

  // ── Static background art ─────────────────────────────────────────────────

  private buildStatic(id: ThemeId, c: PIXI.Container): void {
    const W = this.app.screen.width;
    const H = this.app.screen.height;
    const g = new PIXI.Graphics();

    if (id === 0) {
      // ── Deep Space ─────────────────────────────────────────────────────────
      g.beginFill(0x000008, 1); g.drawRect(0, 0, W, H); g.endFill();

      // Background nebula wisps
      g.beginFill(0x110033, 0.18); g.drawEllipse(W * 0.18, H * 0.38, 220, 100); g.endFill();
      g.beginFill(0x002244, 0.14); g.drawEllipse(W * 0.78, H * 0.65, 170, 85);  g.endFill();
      g.beginFill(0x220011, 0.10); g.drawEllipse(W * 0.55, H * 0.22, 150, 60);  g.endFill();

      // Stars — distant (many, small)
      for (let i = 0; i < 220; i++) {
        const x = Math.random() * W; const y = Math.random() * H;
        const r = Math.random() * 1.3 + 0.15;
        const bright = Math.random();
        const col = bright > 0.85 ? 0xaaddff : bright > 0.6 ? 0xddeeff : 0xffffff;
        g.beginFill(col, Math.random() * 0.55 + 0.15); g.drawCircle(x, y, r); g.endFill();
      }
      // Bright foreground stars
      for (let i = 0; i < 18; i++) {
        const x = Math.random() * W; const y = Math.random() * H;
        g.beginFill(0xffffff, 0.9); g.drawCircle(x, y, 1.4); g.endFill();
        g.beginFill(0xaaddff, 0.25); g.drawCircle(x, y, 4); g.endFill();
      }

    } else if (id === 1) {
      // ── Mars ───────────────────────────────────────────────────────────────
      g.beginFill(0x120300, 1); g.drawRect(0, 0, W, H); g.endFill();
      // Sky gradient layers
      g.beginFill(0x2a0a00, 0.55); g.drawRect(0, H * 0.45, W, H * 0.55); g.endFill();
      g.beginFill(0x3d1200, 0.30); g.drawRect(0, H * 0.65, W, H * 0.35); g.endFill();

      // Distant rock silhouettes along horizon
      g.beginFill(0x0e0400, 1);
      for (let i = 0; i < 10; i++) {
        const bx = (i / 9) * W + (Math.random() - 0.5) * 70;
        const bh = 25 + Math.random() * 65;
        const bw = 35 + Math.random() * 70;
        g.drawEllipse(bx, H - bh * 0.3, bw, bh);
      }
      g.endFill();

      // Small dim stars through the haze
      for (let i = 0; i < 70; i++) {
        const x = Math.random() * W; const y = Math.random() * H * 0.65;
        g.beginFill(0xffaa66, Math.random() * 0.18 + 0.04);
        g.drawCircle(x, y, Math.random() * 0.9 + 0.15);
        g.endFill();
      }

    } else {
      // ── Bioluminescent Forest Planet ───────────────────────────────────────
      g.beginFill(0x00060a, 1); g.drawRect(0, 0, W, H); g.endFill();
      g.beginFill(0x001508, 0.45); g.drawRect(0, H * 0.55, W, H * 0.45); g.endFill();

      // Distant tree silhouettes
      g.beginFill(0x000e08, 1);
      for (let i = 0; i < 7; i++) {
        const tx = (i / 6) * W + (Math.random() - 0.5) * 90;
        const th = 80 + Math.random() * 90;
        g.drawRect(tx - 5, H - th, 10, th);                 // trunk
        g.drawEllipse(tx, H - th, 38 + Math.random() * 30, 55 + Math.random() * 30); // canopy
      }
      g.endFill();

      // Glowing fungal caps at base
      const fc = [0x00ff88, 0x00ddcc, 0x33ffaa, 0x00aaff];
      for (let i = 0; i < 14; i++) {
        const fx = (i / 13) * W + (Math.random() - 0.5) * 40;
        const fh = 18 + Math.random() * 32;
        const col = fc[Math.floor(Math.random() * fc.length)];
        g.beginFill(col, 0.06); g.drawEllipse(fx, H - fh * 0.2, 28, fh);    g.endFill();
        g.beginFill(col, 0.15); g.drawEllipse(fx, H - fh * 0.55, 10, fh * 0.5); g.endFill();
      }

      // Faint bioluminescent stars
      for (let i = 0; i < 90; i++) {
        const x = Math.random() * W; const y = Math.random() * H * 0.65;
        const sc = fc[Math.floor(Math.random() * fc.length)];
        g.beginFill(sc, Math.random() * 0.30 + 0.05);
        g.drawCircle(x, y, Math.random() * 1.1 + 0.2);
        g.endFill();
      }
    }

    c.addChildAt(g, 0);
  }

  // ── Particle initialisation ───────────────────────────────────────────────

  private initParticles(id: ThemeId): void {
    const W = this.app.screen.width;
    const H = this.app.screen.height;
    this.particles[id] = [];

    if (id === 0) {
      // Slow drifting sparkles / micro-comets
      for (let i = 0; i < 18; i++) {
        this.particles[0].push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 12, vy: Math.random() * 8 + 3,
          alpha: Math.random(), size: Math.random() * 1.8 + 0.4,
          color: Math.random() > 0.5 ? 0xaaddff : 0xffffff,
          life: Math.random() * 5, maxLife: 5 + Math.random() * 4,
        });
      }
    } else if (id === 1) {
      // Blowing dust particles
      for (let i = 0; i < 28; i++) {
        this.particles[1].push({
          x: Math.random() * W, y: Math.random() * H,
          vx: 22 + Math.random() * 35, vy: (Math.random() - 0.5) * 12,
          alpha: Math.random() * 0.35 + 0.08, size: Math.random() * 3.5 + 1,
          color: Math.random() > 0.5 ? 0xff5500 : 0xaa3300,
          life: Math.random() * 3, maxLife: 3 + Math.random() * 2.5,
        });
      }
    } else {
      // Rising bioluminescent spores
      const sc = [0x00ff88, 0x00ddcc, 0x33ffaa, 0x00aaff, 0x88ffcc];
      for (let i = 0; i < 24; i++) {
        this.particles[2].push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 14, vy: -(Math.random() * 18 + 6),
          alpha: Math.random() * 0.7 + 0.2, size: Math.random() * 3 + 0.8,
          color: sc[Math.floor(Math.random() * sc.length)],
          life: Math.random() * 6, maxLife: 6 + Math.random() * 4,
        });
      }
    }
  }

  // ── Theme switch with crossfade ───────────────────────────────────────────

  setTheme(id: ThemeId): void {
    if (id === this.currentTheme && !this.transitioning) return;
    this.targetTheme  = id;
    this.transitioning = true;
    this.transTimer   = 0;
    this.initParticles(id);
  }

  // ── Update (call each frame) ──────────────────────────────────────────────

  update(dt: number): void {
    const W = this.app.screen.width;
    const H = this.app.screen.height;

    // Cross-fade
    if (this.transitioning) {
      this.transTimer += dt;
      const p = Math.min(1, this.transTimer / this.TRANS_DUR);
      this.containers[this.currentTheme].alpha = 1 - p;
      this.containers[this.targetTheme].alpha  = p;
      if (p >= 1) {
        this.containers[this.currentTheme].alpha = 0;
        this.containers[this.targetTheme].alpha  = 1;
        this.currentTheme  = this.targetTheme;
        this.transitioning = false;
      }
    }

    // Animate particles for visible theme(s)
    const toUpdate = new Set<ThemeId>([this.currentTheme]);
    if (this.transitioning) toUpdate.add(this.targetTheme);

    for (const id of toUpdate) {
      const gfx = this.dynGfx[id];
      gfx.clear();

      for (const p of this.particles[id]) {
        p.life += dt;
        p.x    += p.vx * dt;
        p.y    += p.vy * dt;

        // Wrap horizontally; reset vertically
        if (p.x < 0) p.x += W;
        if (p.x > W) p.x -= W;

        if (id === 0) {
          // Twinkle
          p.alpha = Math.abs(Math.sin(p.life * 2.8)) * 0.65 + 0.1;
          if (p.y > H + 10) { p.y = -5; p.x = Math.random() * W; p.life = 0; }
        } else if (id === 1) {
          // Dust fades in/out
          const t = p.life / p.maxLife;
          p.alpha = Math.sin(t * Math.PI) * 0.4;
          if (p.life >= p.maxLife) { p.life = 0; p.x = -p.size; p.y = Math.random() * H; }
        } else {
          // Spores fade with height, reset at bottom
          p.alpha = (1 - p.life / p.maxLife) * 0.75;
          if (p.life >= p.maxLife || p.y < -10) {
            p.life = 0; p.x = Math.random() * W; p.y = H + p.size;
          }
        }

        if (p.alpha <= 0.01) continue;

        if (id === 0) {
          gfx.beginFill(p.color, p.alpha * 0.28); gfx.drawCircle(p.x, p.y, p.size * 2.2); gfx.endFill();
          gfx.beginFill(p.color, p.alpha);         gfx.drawCircle(p.x, p.y, p.size * 0.7); gfx.endFill();
        } else if (id === 1) {
          gfx.beginFill(p.color, p.alpha);
          gfx.drawEllipse(p.x, p.y, p.size * 2.5, p.size * 0.65);
          gfx.endFill();
        } else {
          gfx.beginFill(p.color, p.alpha * 0.18); gfx.drawCircle(p.x, p.y, p.size * 3.5); gfx.endFill();
          gfx.beginFill(p.color, p.alpha * 0.85); gfx.drawCircle(p.x, p.y, p.size);        gfx.endFill();
        }
      }
    }
  }
}
