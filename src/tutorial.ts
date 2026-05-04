import * as PIXI from 'pixi.js';
import { Player }       from './player';
import { BulletSystem } from './bullets';
import { audio }        from './audio';

// ─── Shield orb (mirrors game.ts) ─────────────────────────────────────────────

class TutOrb {
  alive  = true;
  private angle: number;
  private gfx:   PIXI.Graphics;
  private layer: PIXI.Container;
  private t = 0;
  private readonly R = 38;

  constructor(layer: PIXI.Container, offset = 0) {
    this.layer = layer;
    this.angle = offset;
    const g = this.gfx = new PIXI.Graphics();
    g.beginFill(0x00ddff, 0.10); g.drawCircle(0, 0, 18); g.endFill();
    g.beginFill(0x00ddff, 0.35); g.drawCircle(0, 0, 10); g.endFill();
    g.beginFill(0x00ddff, 0.95); g.drawCircle(0, 0,  6); g.endFill();
    g.beginFill(0xaaffff, 0.90); g.drawCircle(-2, -2, 2.5); g.endFill();
    layer.addChild(g);
  }

  update(dt: number, px: number, py: number): void {
    if (!this.alive) return;
    this.t += dt; this.angle += dt * 2.5;
    this.gfx.position.set(
      px + Math.cos(this.angle) * this.R,
      py + Math.sin(this.angle) * this.R,
    );
    this.gfx.alpha = 0.82 + Math.sin(this.t * 4) * 0.18;
  }

  get x() { return this.gfx.x; }
  get y() { return this.gfx.y; }

  destroy(): void {
    this.alive = false;
    if (this.gfx.parent) this.layer.removeChild(this.gfx);
    this.gfx.destroy();
  }
}

// ─── Tutorial enemy ───────────────────────────────────────────────────────────

type EKind = 'dart' | 'chaser' | 'boss';

interface ShotDesc { x: number; y: number; vx: number; vy: number; }

class TutEnemy {
  x: number; y: number;
  vx = 0; vy = 0;
  hp: number;
  readonly maxHp: number;
  readonly radius: number;
  readonly kind: EKind;
  alive = true;

  private gfx:     PIXI.Container;
  private bodyGfx: PIXI.Graphics;
  private hpBar:   PIXI.Graphics | null = null;
  private layer:   PIXI.Container;
  private t        = 0;
  private fireTimer: number;
  private readonly fireInterval: number;

  constructor(x: number, y: number, kind: EKind, layer: PIXI.Container) {
    this.x = x; this.y = y; this.kind = kind; this.layer = layer;

    if (kind === 'dart')        { this.hp = this.maxHp = 1;  this.radius = 11; this.fireInterval = 0; this.fireTimer = 0; }
    else if (kind === 'chaser') { this.hp = this.maxHp = 2;  this.radius = 13; this.fireInterval = 0; this.fireTimer = 0; }
    else                        { this.hp = this.maxHp = 8;  this.radius = 34; this.fireInterval = 2.1; this.fireTimer = 1.6; }

    this.gfx     = new PIXI.Container();
    this.bodyGfx = new PIXI.Graphics();
    this.gfx.addChild(this.bodyGfx);
    if (kind === 'boss') { this.hpBar = new PIXI.Graphics(); this.gfx.addChild(this.hpBar); }
    this.drawBody();
    this.gfx.position.set(x, y);
    layer.addChild(this.gfx);
  }

  private drawBody(): void {
    const g = this.bodyGfx; g.clear();
    if (this.kind === 'dart') {
      g.beginFill(0xff4433, 0.12); g.drawCircle(0, 0, 20); g.endFill();
      g.lineStyle(1.5, 0xff4433); g.beginFill(0x1a0000, 0.95);
      g.moveTo(0, -11); g.lineTo(9, 9); g.lineTo(0, 5); g.lineTo(-9, 9);
      g.closePath(); g.endFill();
    } else if (this.kind === 'chaser') {
      g.beginFill(0xff8833, 0.10); g.drawCircle(0, 0, 22); g.endFill();
      g.lineStyle(1.5, 0xff8833); g.beginFill(0x120600, 0.96);
      g.drawPolygon([0, -15, 12, -7, 15, 5, 0, 15, -15, 5, -12, -7]);
      g.endFill();
    } else {
      g.beginFill(0xcc44ff, 0.07); g.drawCircle(0, 0, 58); g.endFill();
      g.beginFill(0xcc44ff, 0.14); g.drawCircle(0, 0, 42); g.endFill();
      g.lineStyle(2.5, 0xcc44ff); g.beginFill(0x0c0012, 0.97);
      const pts: number[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        pts.push(Math.cos(a) * 34, Math.sin(a) * 34);
      }
      g.drawPolygon(pts); g.endFill();
      g.lineStyle(0);
      g.beginFill(0xff44ff, 0.90); g.drawCircle(0, 0, 11); g.endFill();
      g.beginFill(0xffffff, 0.80); g.drawCircle(-3, -3, 4); g.endFill();
    }
  }

  private redrawHpBar(): void {
    if (!this.hpBar) return;
    const g = this.hpBar; g.clear();
    const W = 90, H = 10, X = -45, Y = 52;
    g.beginFill(0x000000, 0.72); g.drawRoundedRect(X, Y, W, H, 3); g.endFill();
    const r = Math.max(0, this.hp / this.maxHp);
    const c = r > 0.55 ? 0xcc44ff : r > 0.28 ? 0xff8833 : 0xff3344;
    g.beginFill(c, 0.92); g.drawRoundedRect(X + 1, Y + 1, (W - 2) * r, H - 2, 2); g.endFill();
    g.lineStyle(1, c, 0.55); g.drawRoundedRect(X, Y, W, H, 3);
    g.lineStyle(0);
    // BOSS label
    const label = new PIXI.Text('TUTORIAL BOSS', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 8, fill: 0xcc44ff,
    });
    label.anchor.set(0.5, 1); label.position.set(0, Y - 2);
    // Rebuild each frame would be too expensive — skip text, just bar
  }

  /** Returns a shot descriptor if the boss fires this tick. */
  update(dt: number, tx: number, ty: number): ShotDesc | null {
    if (!this.alive) return null;
    this.t += dt;
    this.gfx.rotation += dt * (this.kind === 'boss' ? 0.55 : 1.8);

    if (this.kind === 'dart' || this.kind === 'boss') {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    } else {
      // chaser: home in slowly
      const dx = tx - this.x, dy = ty - this.y;
      const d  = Math.hypot(dx, dy) || 1;
      this.x += (dx / d) * 95 * dt;
      this.y += (dy / d) * 95 * dt;
    }

    this.gfx.position.set(this.x, this.y);
    if (this.hpBar) this.redrawHpBar();

    if (this.kind === 'boss') {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = this.fireInterval;
        const dx = tx - this.x, dy = ty - this.y;
        const d  = Math.hypot(dx, dy) || 1;
        const sp = 170;
        return { x: this.x, y: this.y, vx: (dx / d) * sp, vy: (dy / d) * sp };
      }
    }
    return null;
  }

  takeDamage(n: number): void { this.hp -= n; if (this.hp <= 0) this.alive = false; }

  destroy(): void {
    this.alive = false;
    if (this.gfx.parent) this.layer.removeChild(this.gfx);
    this.gfx.destroy({ children: true });
  }
}

// ─── Boss projectile ──────────────────────────────────────────────────────────

interface TutProj { x: number; y: number; vx: number; vy: number; gfx: PIXI.Graphics; life: number; }

// ─── Step definitions ─────────────────────────────────────────────────────────

type TutStep = 'intro' | 'move-right' | 'move-left' | 'move-up' | 'move-down' | 'shoot' | 'boss' | 'shields' | 'dodge' | 'complete';

const STEP_LABEL: Record<TutStep, string> = {
  'intro':      '',
  'move-right': 'STEP  1 / 8',
  'move-left':  'STEP  2 / 8',
  'move-up':    'STEP  3 / 8',
  'move-down':  'STEP  4 / 8',
  'shoot':      'STEP  5 / 8',
  'boss':       'STEP  6 / 8',
  'shields':    'STEP  7 / 8',
  'dodge':      'STEP  8 / 8',
  'complete':   'COMPLETE',
};

// ─── Tutorial ─────────────────────────────────────────────────────────────────

export class Tutorial {
  /** Add this to app.stage at the desired z-order from game.ts */
  readonly root: PIXI.Container;

  private entityLayer:  PIXI.Container;
  private playerLayer:  PIXI.Container;
  private bulletLayer:  PIXI.Container;
  private projLayer:    PIXI.Container;
  private uiLayer:      PIXI.Container;
  private overlayLayer: PIXI.Container;   // per-step guide graphics live here (index 1+)

  private player:  Player;
  private bullets: BulletSystem;

  private enemies: TutEnemy[] = [];
  private projs:   TutProj[]  = [];
  private orbs:    TutOrb[]   = [];

  private step:       TutStep = 'intro';
  private stepTimer   = 0;
  private stepDone    = false;
  private invincTimer = 0;
  private spaceHeld   = false;
  private dodgeTimer  = 0;
  private bossBounceT = 0;
  private shieldLabel: PIXI.Text | null = null; // live-updated during shields step

  private hintText!:       PIXI.Text;
  private subText!:        PIXI.Text;
  private progressText!:   PIXI.Text;
  private dodgeCountText!: PIXI.Text;

  onComplete: () => void = () => {};

  constructor(app: PIXI.Application) {
    this.root = new PIXI.Container();
    this.root.visible = false;

    this.overlayLayer = new PIXI.Container();
    this.entityLayer  = new PIXI.Container();
    this.projLayer    = new PIXI.Container();
    this.playerLayer  = new PIXI.Container();
    this.bulletLayer  = new PIXI.Container();
    this.uiLayer      = new PIXI.Container();

    this.root.addChild(
      this.overlayLayer,
      this.entityLayer,
      this.projLayer,
      this.playerLayer,
      this.bulletLayer,
      this.uiLayer,
    );

    this.player  = new Player(app, this.playerLayer);
    this.bullets = new BulletSystem(this.bulletLayer);

    this.buildStaticUI(app);
    this.bindInput(app);
    app.ticker.add((d) => this.tick(app, d));
  }

  show(): void  { this.root.visible = true;  this.gotoStep('intro', this.cachedApp!); }
  hide(): void  { this.root.visible = false; this.clearAll(); }

  // cache app for use in callbacks
  private cachedApp: PIXI.Application | null = null;

  // ── Static UI ─────────────────────────────────────────────────────────────

  private buildStaticUI(app: PIXI.Application): void {
    this.cachedApp = app;
    const W = app.screen.width, H = app.screen.height;

    // Semi-transparent dark bg (index 0 of overlayLayer — permanent)
    const bg = new PIXI.Graphics();
    bg.beginFill(0x000008, 0.88); bg.drawRect(0, 0, W, H); bg.endFill();
    this.overlayLayer.addChild(bg);

    // Top bar
    const bar = new PIXI.Graphics();
    bar.beginFill(0x000008, 0.82); bar.drawRect(0, 0, W, 54); bar.endFill();
    bar.lineStyle(1, 0x00ffcc, 0.22); bar.moveTo(0, 54); bar.lineTo(W, 54);
    this.uiLayer.addChild(bar);

    const titleTxt = new PIXI.Text('TUTORIAL', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 22, fontWeight: 'bold',
      fill: 0x00ffcc, dropShadow: true, dropShadowColor: 0x00ffcc,
      dropShadowBlur: 14, dropShadowDistance: 0,
    });
    titleTxt.anchor.set(0.5, 0.5); titleTxt.position.set(W / 2, 27);
    this.uiLayer.addChild(titleTxt);

    const esc = new PIXI.Text('ESC  EXIT', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 10, fill: 0x334455, letterSpacing: 2,
    });
    esc.anchor.set(1, 0.5); esc.position.set(W - 18, 27);
    this.uiLayer.addChild(esc);

    this.progressText = new PIXI.Text('', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 10, fill: 0x446677, letterSpacing: 2,
    });
    this.progressText.anchor.set(0, 0.5); this.progressText.position.set(18, 27);
    this.uiLayer.addChild(this.progressText);

    // Bottom instruction bar
    const btmBar = new PIXI.Graphics();
    btmBar.beginFill(0x000008, 0.78); btmBar.drawRect(0, H - 76, W, 76); btmBar.endFill();
    btmBar.lineStyle(1, 0x00ffcc, 0.18); btmBar.moveTo(0, H - 76); btmBar.lineTo(W, H - 76);
    this.uiLayer.addChild(btmBar);

    this.hintText = new PIXI.Text('', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 19, fontWeight: 'bold',
      fill: 0xffffff, align: 'center',
      dropShadow: true, dropShadowColor: 0x000033, dropShadowBlur: 8, dropShadowDistance: 0,
    });
    this.hintText.anchor.set(0.5, 1); this.hintText.position.set(W / 2, H - 38);
    this.uiLayer.addChild(this.hintText);

    this.subText = new PIXI.Text('', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 11, fill: 0x6688aa,
      letterSpacing: 2, align: 'center',
    });
    this.subText.anchor.set(0.5, 1); this.subText.position.set(W / 2, H - 14);
    this.uiLayer.addChild(this.subText);

    // Dodge countdown (right side, shown during dodge step only)
    this.dodgeCountText = new PIXI.Text('7', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 52, fontWeight: 'bold',
      fill: 0xff4444, dropShadow: true, dropShadowColor: 0xff0000,
      dropShadowBlur: 22, dropShadowDistance: 0,
    });
    this.dodgeCountText.anchor.set(0.5, 0.5);
    this.dodgeCountText.position.set(W - 60, H / 2);
    this.dodgeCountText.alpha = 0;
    this.uiLayer.addChild(this.dodgeCountText);
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  private bindInput(app: PIXI.Application): void {
    window.addEventListener('keydown', (e) => {
      if (!this.root.visible) return;
      if (e.code === 'Space') { e.preventDefault(); this.spaceHeld = true; }
      if (e.code === 'Escape') { this.hide(); this.onComplete(); }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.spaceHeld = false;
    });
  }

  // ── Step machine ──────────────────────────────────────────────────────────

  private gotoStep(s: TutStep, app: PIXI.Application): void {
    if (!this.root.visible) return;
    const W = app.screen.width, H = app.screen.height;

    this.clearAll();
    this.step        = s;
    this.stepTimer   = 0;
    this.stepDone    = false;
    this.dodgeTimer  = 0;
    this.bossBounceT = 0;
    this.progressText.text    = STEP_LABEL[s];
    this.dodgeCountText.alpha = 0;
    this.player.reset();

    switch (s) {

      case 'intro':
        this.stepTimer = 2.6;
        this.setHint('WELCOME  TO  VOID  RUSH', 'INTERACTIVE  TUTORIAL  —  LEARN  THE  BASICS');
        break;

      case 'move-right': {
        const zoneX = W * 0.70;
        const g = new PIXI.Graphics();
        // Glowing target zone
        g.lineStyle(2, 0x00ffcc, 0.65); g.beginFill(0x00ffcc, 0.07);
        g.drawRoundedRect(zoneX, H * 0.18, W * 0.25, H * 0.64, 10); g.endFill();
        // Arrow guide
        g.lineStyle(2.5, 0x00ffcc, 0.32);
        g.moveTo(W * 0.32, H / 2); g.lineTo(W * 0.63, H / 2);
        g.moveTo(W * 0.59, H / 2 - 13); g.lineTo(W * 0.63, H / 2);
        g.moveTo(W * 0.59, H / 2 + 13); g.lineTo(W * 0.63, H / 2);
        this.overlayLayer.addChild(g);

        const lbl = new PIXI.Text('REACH\nHERE', {
          fontFamily: 'Orbitron, sans-serif', fontSize: 13, fill: 0x00ffcc, align: 'center',
        });
        lbl.anchor.set(0.5); lbl.position.set(W * 0.825, H / 2); lbl.alpha = 0.6;
        this.overlayLayer.addChild(lbl);

        this.setHint('PRESS  D  OR  →  TO  MOVE  RIGHT', 'FLY  INTO  THE  CYAN  ZONE');
        break;
      }

      case 'move-left': {
        const g = new PIXI.Graphics();
        g.lineStyle(2, 0x00ffcc, 0.65); g.beginFill(0x00ffcc, 0.07);
        g.drawRoundedRect(W * 0.05, H * 0.18, W * 0.25, H * 0.64, 10); g.endFill();
        // Arrow pointing left
        g.lineStyle(2.5, 0x00ffcc, 0.32);
        g.moveTo(W * 0.68, H / 2); g.lineTo(W * 0.37, H / 2);
        g.moveTo(W * 0.41, H / 2 - 13); g.lineTo(W * 0.37, H / 2);
        g.moveTo(W * 0.41, H / 2 + 13); g.lineTo(W * 0.37, H / 2);
        this.overlayLayer.addChild(g);

        const lbl = new PIXI.Text('REACH\nHERE', {
          fontFamily: 'Orbitron, sans-serif', fontSize: 13, fill: 0x00ffcc, align: 'center',
        });
        lbl.anchor.set(0.5); lbl.position.set(W * 0.175, H / 2); lbl.alpha = 0.6;
        this.overlayLayer.addChild(lbl);

        this.setHint('PRESS  A  OR  ←  TO  MOVE  LEFT', 'FLY  INTO  THE  CYAN  ZONE');
        break;
      }

      case 'move-up': {
        const zoneY = H * 0.07;
        const g = new PIXI.Graphics();
        g.lineStyle(2, 0x00ffcc, 0.65); g.beginFill(0x00ffcc, 0.07);
        g.drawRoundedRect(W * 0.18, zoneY, W * 0.64, H * 0.22, 10); g.endFill();
        g.lineStyle(2.5, 0x00ffcc, 0.32);
        g.moveTo(W / 2, H * 0.58); g.lineTo(W / 2, H * 0.33);
        g.moveTo(W / 2 - 13, H * 0.37); g.lineTo(W / 2, H * 0.33);
        g.moveTo(W / 2 + 13, H * 0.37); g.lineTo(W / 2, H * 0.33);
        this.overlayLayer.addChild(g);

        const lbl = new PIXI.Text('REACH HERE', {
          fontFamily: 'Orbitron, sans-serif', fontSize: 13, fill: 0x00ffcc, align: 'center',
        });
        lbl.anchor.set(0.5); lbl.position.set(W / 2, zoneY + H * 0.11); lbl.alpha = 0.6;
        this.overlayLayer.addChild(lbl);

        this.setHint('PRESS  W  OR  ↑  TO  FLY  UPWARD', 'REACH  THE  TOP  ZONE');
        break;
      }

      case 'move-down': {
        const zoneYBot = H * 0.74;
        const g = new PIXI.Graphics();
        g.lineStyle(2, 0x00ffcc, 0.65); g.beginFill(0x00ffcc, 0.07);
        g.drawRoundedRect(W * 0.18, zoneYBot, W * 0.64, H * 0.22, 10); g.endFill();
        // Arrow pointing down
        g.lineStyle(2.5, 0x00ffcc, 0.32);
        g.moveTo(W / 2, H * 0.42); g.lineTo(W / 2, H * 0.67);
        g.moveTo(W / 2 - 13, H * 0.63); g.lineTo(W / 2, H * 0.67);
        g.moveTo(W / 2 + 13, H * 0.63); g.lineTo(W / 2, H * 0.67);
        this.overlayLayer.addChild(g);

        const lbl2 = new PIXI.Text('REACH HERE', {
          fontFamily: 'Orbitron, sans-serif', fontSize: 13, fill: 0x00ffcc, align: 'center',
        });
        lbl2.anchor.set(0.5); lbl2.position.set(W / 2, zoneYBot + H * 0.11); lbl2.alpha = 0.6;
        this.overlayLayer.addChild(lbl2);

        this.setHint('PRESS  S  OR  ↓  TO  FLY  DOWN', 'REACH  THE  BOTTOM  ZONE');
        break;
      }

      case 'shoot': {
        const tx = W * 0.70, ty = H * 0.38;
        const dummy = new TutEnemy(tx, ty, 'dart', this.entityLayer);
        // Freeze dart in place
        dummy.vx = 0; dummy.vy = 0;
        this.enemies.push(dummy);

        const g = new PIXI.Graphics();
        g.lineStyle(2,   0xff4433, 0.52); g.drawCircle(tx, ty, 38);
        g.lineStyle(1,   0xff4433, 0.28); g.drawCircle(tx, ty, 56);
        g.lineStyle(1.2, 0xff4433, 0.30);
        g.moveTo(tx - 68, ty); g.lineTo(tx - 32, ty);
        g.moveTo(tx + 32, ty); g.lineTo(tx + 68, ty);
        g.moveTo(tx, ty - 68); g.lineTo(tx, ty - 32);
        g.moveTo(tx, ty + 32); g.lineTo(tx, ty + 68);
        this.overlayLayer.addChild(g);

        this.setHint('AIM  WITH  WASD  ·  FIRE  WITH  SPACE', 'DESTROY  THE  TARGET  ENEMY');
        break;
      }

      case 'boss': {
        const boss = new TutEnemy(W / 2, H * 0.26, 'boss', this.entityLayer);
        boss.vx = 42;
        this.enemies.push(boss);

        // Boss name label (static)
        const bossLbl = new PIXI.Text('TUTORIAL  BOSS', {
          fontFamily: 'Orbitron, sans-serif', fontSize: 16, fontWeight: 'bold',
          fill: 0xcc44ff, dropShadow: true, dropShadowColor: 0xcc44ff,
          dropShadowBlur: 10, dropShadowDistance: 0,
        });
        bossLbl.anchor.set(0.5); bossLbl.position.set(W / 2, H * 0.08);
        this.overlayLayer.addChild(bossLbl);

        this.setHint('DEFEAT  THE  BOSS', 'DODGE  ITS  SHOTS  ·  RETURN  FIRE  WITH  SPACE');
        break;
      }

      case 'shields': {
        // Grant 3 shield orbs
        for (let i = 0; i < 3; i++) {
          this.orbs.push(new TutOrb(this.entityLayer, (i / 3) * Math.PI * 2));
        }
        // 3 slow chasers from edges
        const pts: [number, number][] = [
          [W * 0.08, H * 0.20], [W * 0.92, H * 0.32], [W * 0.50, H * 0.88],
        ];
        for (const [ex, ey] of pts) {
          this.enemies.push(new TutEnemy(ex, ey, 'chaser', this.entityLayer));
        }

        // Orb count display — stored as field so onPlayerHit can update it live
        this.shieldLabel = new PIXI.Text('SHIELD  ORBS:  ◈ ◈ ◈', {
          fontFamily: 'Orbitron, sans-serif', fontSize: 14, fill: 0x00ddff,
          dropShadow: true, dropShadowColor: 0x00ddff, dropShadowBlur: 10, dropShadowDistance: 0,
        });
        this.shieldLabel.anchor.set(0.5); this.shieldLabel.position.set(W / 2, H * 0.08);
        this.overlayLayer.addChild(this.shieldLabel);

        this.setHint('SHIELD  ORBS  ORBIT  YOU', 'EACH  ORB  ABSORBS  ONE  HIT  ·  THEN  DETONATES');
        break;
      }

      case 'dodge': {
        this.dodgeTimer = 7.0;
        this.spawnDodgeWave(app);
        this.dodgeCountText.alpha = 1;
        this.setHint('DODGE  THE  INCOMING  SWARM!', 'SURVIVE  7  SECONDS  OR  DESTROY  THEM  ALL');
        break;
      }

      case 'complete': {
        this.setHint('YOU\'RE  READY  FOR  THE  VOID!', 'PRESS  ANY  KEY  TO  RETURN  TO  MENU');

        const dismiss = () => {
          if (!this.root.visible || this.step !== 'complete') return;
          this.hide(); this.onComplete();
        };
        // One-shot any-key — slight delay so the last float text doesn't trigger it
        setTimeout(() => {
          if (!this.root.visible) return;
          window.addEventListener('keydown',     dismiss, { once: true });
          window.addEventListener('pointerdown', dismiss, { once: true });
        }, 600);
        break;
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private setHint(main: string, sub: string): void {
    this.hintText.text = main;
    this.subText.text  = sub;
  }

  private clearAll(): void {
    for (const e of this.enemies) e.destroy();  this.enemies = [];
    for (const o of this.orbs)    o.destroy();  this.orbs    = [];
    for (const p of this.projs)   { if (p.gfx.parent) this.projLayer.removeChild(p.gfx); p.gfx.destroy(); }
    this.projs = [];
    this.bullets.reset();

    this.shieldLabel = null;
    // Remove per-step overlay graphics (keep index 0 = permanent dark bg)
    while (this.overlayLayer.children.length > 1) {
      const c = this.overlayLayer.getChildAt(1);
      this.overlayLayer.removeChildAt(1);
      c.destroy({ children: true });
    }
  }

  private spawnDodgeWave(app: PIXI.Application): void {
    const W = app.screen.width, H = app.screen.height;
    const cx = W / 2, cy = H / 2;
    const spawnPts: [number, number][] = [
      [-30, H * 0.15], [-30, H * 0.50], [-30, H * 0.82],
      [W + 30, H * 0.28], [W + 30, H * 0.62],
      [W * 0.22, -30], [W * 0.58, -30],
      [W * 0.42, H + 30],
    ];
    for (const [ex, ey] of spawnPts) {
      const dart = new TutEnemy(ex, ey, 'dart', this.entityLayer);
      const dx = cx - ex, dy = cy - ey;
      const d  = Math.hypot(dx, dy) || 1;
      const sp = 155 + Math.random() * 95;
      dart.vx = (dx / d) * sp; dart.vy = (dy / d) * sp;
      this.enemies.push(dart);
    }
  }

  private showFloat(msg: string, color: number, app: PIXI.Application): void {
    const W = app.screen.width, H = app.screen.height;
    const txt = new PIXI.Text(msg, {
      fontFamily: 'Orbitron, sans-serif', fontSize: 26, fontWeight: 'bold',
      fill: color, dropShadow: true, dropShadowColor: color,
      dropShadowBlur: 18, dropShadowDistance: 0,
    });
    txt.anchor.set(0.5); txt.position.set(W / 2, H * 0.42);
    this.uiLayer.addChild(txt);
    let t = 0;
    const fn = (d: number) => {
      t += d / 60; txt.y -= 28 * (d / 60);
      txt.alpha = Math.max(0, 1 - t / 1.5);
      if (t >= 1.5) { if (txt.parent) this.uiLayer.removeChild(txt); txt.destroy(); app.ticker.remove(fn); }
    };
    app.ticker.add(fn);
  }

  // ── Main ticker ───────────────────────────────────────────────────────────

  private tick(app: PIXI.Application, delta: number): void {
    if (!this.root.visible) return;
    const dt = delta / 60;
    const W  = app.screen.width, H = app.screen.height;

    // Intro — just auto-advance after timer
    if (this.step === 'intro') {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) this.gotoStep('move-right', app);
      return;
    }

    // ── Player ───────────────────────────────────────────────────────────────
    this.player.update(dt);

    // ── Shooting ─────────────────────────────────────────────────────────────
    if (this.spaceHeld) {
      if (this.bullets.tryFireAngle(this.player.x, this.player.y, this.player.facingAngle)) {
        audio.shoot();
      }
    }
    this.bullets.update(dt);

    // ── I-frames ─────────────────────────────────────────────────────────────
    if (this.invincTimer > 0) {
      this.invincTimer -= dt;
      this.playerLayer.alpha = Math.sin(this.invincTimer * 25) > 0 ? 1 : 0.3;
    } else {
      this.playerLayer.alpha = 1;
    }

    // ── Shield orbs ───────────────────────────────────────────────────────────
    for (const o of this.orbs) o.update(dt, this.player.x, this.player.y);

    // ── Boss patrol bounce ────────────────────────────────────────────────────
    if (this.step === 'boss') {
      this.bossBounceT += dt;
      for (const e of this.enemies) {
        if (e.kind === 'boss') {
          if (e.x < 80 || e.x > W - 80) e.vx *= -1;
          e.vy = Math.sin(this.bossBounceT * 0.75) * 28;
        }
      }
    }

    // ── Update enemies → collect boss shots ───────────────────────────────────
    for (const e of this.enemies) {
      const shot = e.update(dt, this.player.x, this.player.y);
      if (shot) {
        const g = new PIXI.Graphics();
        g.beginFill(0xff88ff, 0.38); g.drawCircle(0, 0, 12); g.endFill();
        g.beginFill(0xcc44ff, 0.95); g.drawCircle(0, 0,  5); g.endFill();
        g.position.set(shot.x, shot.y);
        this.projLayer.addChild(g);
        this.projs.push({ ...shot, gfx: g, life: 0 });
      }
    }

    // ── Update boss projectiles ───────────────────────────────────────────────
    this.projs = this.projs.filter((p) => {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life += dt;
      p.gfx.position.set(p.x, p.y);
      const alive = p.life < 6 && p.x > -60 && p.x < W + 60 && p.y > -60 && p.y < H + 60;
      if (!alive) { if (p.gfx.parent) this.projLayer.removeChild(p.gfx); p.gfx.destroy(); }
      return alive;
    });

    // ── Bullets → enemies ─────────────────────────────────────────────────────
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (this.bullets.checkHit(e.x, e.y, e.radius)) {
        e.takeDamage(1);
        audio.enemyHit();
      }
    }
    this.enemies = this.enemies.filter((e) => {
      if (!e.alive) { e.destroy(); return false; } return true;
    });

    // ── Enemy / proj → player ─────────────────────────────────────────────────
    if (this.invincTimer <= 0) {
      for (const e of this.enemies) {
        if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < e.radius + this.player.radius) {
          this.onPlayerHit(app); break;
        }
      }
      for (const p of this.projs) {
        if (Math.hypot(p.x - this.player.x, p.y - this.player.y) < 5 + this.player.radius) {
          this.onPlayerHit(app); break;
        }
      }
    }

    // ── Dodge countdown display ───────────────────────────────────────────────
    if (this.step === 'dodge' && !this.stepDone) {
      this.dodgeTimer -= dt;
      const secs = Math.max(0, Math.ceil(this.dodgeTimer));
      this.dodgeCountText.text  = secs.toString();
      this.dodgeCountText.alpha = 0.55 + Math.sin(Date.now() / 400) * 0.28;
    }

    // ── Step completion ───────────────────────────────────────────────────────
    if (!this.stepDone) this.checkComplete(app);
  }

  private onPlayerHit(app: PIXI.Application): void {
    audio.playerHit();
    if (this.step === 'shields' && this.orbs.length > 0) {
      this.orbs.shift()!.destroy();
      this.showFloat('SHIELD  ABSORBED  THE  HIT!', 0x00ddff, app);
      this.invincTimer = 1.4;

      // Update shield counter label live
      if (this.shieldLabel) {
        const full  = '◈ '.repeat(this.orbs.length);
        const empty = '◇ '.repeat(Math.max(0, 3 - this.orbs.length));
        this.shieldLabel.text = `SHIELD  ORBS:  ${(full + empty).trim()}`;
      }

      if (this.orbs.length === 0 && !this.stepDone) {
        // All shields gone — update hint
        this.setHint('ALL  SHIELDS  DEPLETED!', 'DODGE  OR  DESTROY  THE  REMAINING  ENEMIES');
      }
    } else {
      this.invincTimer = 1.8;
      this.showFloat('KEEP  DODGING!', 0xff4455, app);
    }
  }

  private checkComplete(app: PIXI.Application): void {
    const H = app.screen.height;

    switch (this.step) {

      case 'move-right':
        if (this.player.x > app.screen.width * 0.70) {
          this.stepDone = true;
          this.showFloat('NICE  FLYING!', 0x00ffcc, app);
          setTimeout(() => this.gotoStep('move-left', app), 1300);
        }
        break;

      case 'move-left':
        if (this.player.x < app.screen.width * 0.30) {
          this.stepDone = true;
          this.showFloat('GREAT  CONTROL!', 0x00ffcc, app);
          setTimeout(() => this.gotoStep('move-up', app), 1300);
        }
        break;

      case 'move-up':
        if (this.player.y < H * 0.29) {
          this.stepDone = true;
          this.showFloat('PERFECT!', 0x00ffcc, app);
          setTimeout(() => this.gotoStep('move-down', app), 1300);
        }
        break;

      case 'move-down':
        if (this.player.y > H * 0.71) {
          this.stepDone = true;
          this.showFloat('FULL  RANGE  UNLOCKED!', 0x00ffcc, app);
          setTimeout(() => this.gotoStep('shoot', app), 1300);
        }
        break;

      case 'shoot':
        if (this.enemies.length === 0) {
          this.stepDone = true;
          this.showFloat('TARGET  DESTROYED!', 0xff6644, app);
          setTimeout(() => this.gotoStep('boss', app), 1500);
        }
        break;

      case 'boss':
        if (this.enemies.length === 0) {
          this.stepDone = true;
          this.showFloat('+1  LIFE  RESTORED!', 0x00ff88, app);
          setTimeout(() => this.gotoStep('shields', app), 2000);
        }
        break;

      case 'shields':
        if (this.enemies.length === 0) {
          this.stepDone = true;
          const msg = this.orbs.length > 0 ? 'SHIELDS  HELD!  ALL  CLEAR!' : 'ALL  CLEAR  —  BARELY!';
          this.showFloat(msg, 0x00ddff, app);
          setTimeout(() => this.gotoStep('dodge', app), 1700);
        }
        break;

      case 'dodge':
        if (this.enemies.length === 0) {
          this.stepDone = true;
          this.dodgeCountText.alpha = 0;
          this.showFloat('ALL  DESTROYED!', 0x00ffcc, app);
          setTimeout(() => this.gotoStep('complete', app), 1500);
        } else if (this.dodgeTimer <= 0) {
          this.stepDone = true;
          this.dodgeCountText.alpha = 0;
          this.showFloat('YOU  SURVIVED!', 0x00ffcc, app);
          setTimeout(() => this.gotoStep('complete', app), 1500);
        }
        break;
    }
  }
}
