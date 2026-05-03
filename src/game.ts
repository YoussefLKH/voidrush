import * as PIXI from 'pixi.js';
import { Player }            from './player';
import { EnemyManager }      from './enemies';
import { BulletSystem }      from './bullets';
import { EffectsManager }    from './effects';
import { HUD }               from './ui';
import { Menu }              from './menu';
import { BossBase, BossStampede, createBoss } from './boss';
import { BackgroundManager } from './background';
import { audio }             from './audio';
import { BOMB_BLAST_RADIUS } from './enemies';

export type GameState = 'menu' | 'playing' | 'boss-intro' | 'dead' | 'paused' | 'victory';

const LEVEL_DURATION       = 30;
const MAX_LIVES            = 3;
const INVINCIBILITY_DUR    = 2.0;
const VOID_STORM_INTERVAL  = 45;
const SHIELD_SPAWN_MIN     = 40;
const SHIELD_SPAWN_MAX     = 50;
const SHIELD_BURST_RADIUS  = 160;

// ─── Health Pickup (walk-to-collect, drops from boss kill) ───────────────────

class HealthPickup {
  readonly x:      number;
  readonly baseY:  number;
  readonly radius  = 22;
  alive  = true;

  private gfx:   PIXI.Container;
  private ring!: PIXI.Graphics;
  private layer: PIXI.Container;
  private timer  = 10.0;
  private t      = 0;

  constructor(x: number, y: number, layer: PIXI.Container) {
    this.x = x; this.baseY = y; this.layer = layer;
    this.gfx = new PIXI.Container();
    this.build();
    this.gfx.position.set(x, y);
    layer.addChild(this.gfx);
  }

  private build(): void {
    const bg = new PIXI.Graphics();
    bg.beginFill(0x00ff88, 0.08); bg.drawCircle(0, 0, 44); bg.endFill();
    bg.beginFill(0x00ff88, 0.17); bg.drawCircle(0, 0, 30); bg.endFill();
    this.gfx.addChild(bg);

    const plus = new PIXI.Graphics();
    plus.beginFill(0x00ff88, 0.95);
    plus.drawRoundedRect(-4, -14, 8, 28, 2);
    plus.drawRoundedRect(-14, -4, 28, 8,  2);
    plus.endFill();
    plus.beginFill(0xaaffdd, 0.7);
    plus.drawRect(-2, -12, 4, 6);
    plus.endFill();
    this.gfx.addChild(plus);

    this.ring = new PIXI.Graphics();
    this.gfx.addChild(this.ring);

    const lbl = new PIXI.Text('HEAL', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 9, fill: 0x00ff88,
    });
    lbl.anchor.set(0.5); lbl.position.set(0, 26);
    this.gfx.addChild(lbl);
  }

  update(dt: number): void {
    if (!this.alive) return;
    this.t     += dt;
    this.timer -= dt;
    if (this.timer <= 0) { this.destroy(); return; }

    this.gfx.position.set(this.x, this.baseY + Math.sin(this.t * 2.5) * 7);
    this.gfx.scale.set(1 + Math.sin(this.t * 5.5) * 0.04);

    this.ring.clear();
    const ratio  = this.timer / 10.0;
    const urgent = this.timer < 3.0;
    const col    = urgent ? 0xff4455 : 0x00ff88;
    const ral    = urgent ? 0.7 + Math.abs(Math.sin(this.t * 12)) * 0.3 : 0.75;
    this.ring.lineStyle(2.5, col, ral);
    this.ring.arc(0, 0, 32, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
  }

  collidesWithPlayer(px: number, py: number): boolean {
    return Math.hypot(this.x - px, this.baseY - py) < this.radius + 12;
  }

  destroy(): void {
    this.alive = false;
    if (this.gfx.parent) this.layer.removeChild(this.gfx);
    this.gfx.destroy({ children: true });
  }
}

// ─── Shield Crate (walk-to-collect, spawns every 40-50s) ─────────────────────

class ShieldCrate {
  x: number; y: number;
  readonly radius = 18;
  alive = true;

  private gfx:   PIXI.Container;
  private inner: PIXI.Graphics;
  private ring:  PIXI.Graphics;
  private layer: PIXI.Container;
  private timer  = 12.0;
  private t      = 0;

  constructor(x: number, y: number, layer: PIXI.Container) {
    this.x = x; this.y = y; this.layer = layer;
    this.gfx   = new PIXI.Container();
    this.inner = new PIXI.Graphics();
    this.ring  = new PIXI.Graphics();
    this.gfx.addChild(this.inner);
    this.gfx.addChild(this.ring);
    this.buildInner();

    const lbl = new PIXI.Text('SHIELD', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 8, fill: 0x00ddff,
    });
    lbl.anchor.set(0.5); lbl.position.set(0, 32);
    this.gfx.addChild(lbl);

    this.gfx.position.set(x, y);
    layer.addChild(this.gfx);
  }

  private buildInner(): void {
    const g = this.inner;
    g.beginFill(0x00ddff, 0.06); g.drawCircle(0, 0, 44); g.endFill();
    g.beginFill(0x00ddff, 0.14); g.drawCircle(0, 0, 28); g.endFill();
    g.lineStyle(2, 0x00ddff, 0.9);
    g.beginFill(0x001a22, 0.95);
    g.drawPolygon([0, -20, 16, 0, 0, 20, -16, 0]);
    g.endFill();
    g.lineStyle(0);
    g.beginFill(0x00ddff, 0.95);
    g.drawPolygon([0, -10, 8, 0, 0, 10, -8, 0]);
    g.endFill();
    g.beginFill(0xaaffff, 0.72);
    g.drawRect(-2, -8, 4, 6);
    g.endFill();
  }

  update(dt: number): void {
    if (!this.alive) return;
    this.t     += dt;
    this.timer -= dt;
    if (this.timer <= 0) { this.destroy(); return; }

    this.inner.rotation += dt * 1.4;
    this.gfx.scale.set(1 + Math.sin(this.t * 4.2) * 0.06);

    this.ring.clear();
    const ratio  = this.timer / 12.0;
    const urgent = this.timer < 3.0;
    const col    = urgent ? 0xff4455 : 0x00ddff;
    const ral    = urgent ? 0.7 + Math.abs(Math.sin(this.t * 12)) * 0.3 : 0.75;
    this.ring.lineStyle(2.5, col, ral);
    this.ring.arc(0, 0, 30, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
  }

  collidesWithPlayer(px: number, py: number): boolean {
    return Math.hypot(this.x - px, this.y - py) < this.radius + 14;
  }

  destroy(): void {
    this.alive = false;
    if (this.gfx.parent) this.layer.removeChild(this.gfx);
    this.gfx.destroy({ children: true });
  }
}

// ─── Shield Orb (orbits player, absorbs 1 hit then detonates) ────────────────

class ShieldOrb {
  alive = true;
  private angle:  number;
  private timer   = 9.0;
  private t       = 0;
  private gfx:    PIXI.Graphics;
  private layer:  PIXI.Container;
  private readonly ORBIT_R = 38;

  constructor(layer: PIXI.Container, angleOffset = 0) {
    this.layer = layer;
    this.angle = angleOffset;

    this.gfx = new PIXI.Graphics();
    this.gfx.beginFill(0x00ddff, 0.10); this.gfx.drawCircle(0, 0, 18); this.gfx.endFill();
    this.gfx.beginFill(0x00ddff, 0.35); this.gfx.drawCircle(0, 0, 10); this.gfx.endFill();
    this.gfx.beginFill(0x00ddff, 0.95); this.gfx.drawCircle(0, 0,  6); this.gfx.endFill();
    this.gfx.beginFill(0xaaffff, 0.9);  this.gfx.drawCircle(-2, -2, 2.5); this.gfx.endFill();
    layer.addChild(this.gfx);
  }

  update(dt: number, px: number, py: number): void {
    if (!this.alive) return;
    this.t     += dt;
    this.timer -= dt;
    this.angle += dt * 2.5;

    this.gfx.position.set(
      px + Math.cos(this.angle) * this.ORBIT_R,
      py + Math.sin(this.angle) * this.ORBIT_R,
    );

    this.gfx.alpha = this.timer < 2.0
      ? 0.35 + Math.abs(Math.sin(this.t * 11)) * 0.65
      : 0.82 + Math.sin(this.t * 4) * 0.18;

    if (this.timer <= 0) this.destroy();
  }

  destroy(): void {
    this.alive = false;
    if (this.gfx.parent) this.layer.removeChild(this.gfx);
    this.gfx.destroy();
  }
}

// ─── Game ─────────────────────────────────────────────────────────────────────

export class Game {
  private app:   PIXI.Application;
  public  state: GameState = 'menu';

  // ── Render layers ──────────────────────────────────────────────────────────
  private bgLayer:      PIXI.Container;
  private enemyLayer:   PIXI.Container;
  private bossLayer:    PIXI.Container;
  private projLayer:    PIXI.Container;
  private fxLayer:      PIXI.Container;
  private playerLayer:  PIXI.Container;
  private bulletLayer:  PIXI.Container;
  private pickupLayer:  PIXI.Container;
  private uiLayer:      PIXI.Container;
  private menuLayer:    PIXI.Container;

  // ── Systems ────────────────────────────────────────────────────────────────
  private player:       Player;
  private enemyManager: EnemyManager;
  private bullets:      BulletSystem;
  private effects:      EffectsManager;
  private hud:          HUD;
  private menu:         Menu;
  private background:   BackgroundManager;
  private boss:         BossBase | null = null;

  // ── Pickups ────────────────────────────────────────────────────────────────
  private healthPickup:  HealthPickup | null = null;
  private shieldCrates:  ShieldCrate[] = [];
  private shieldOrbs:    ShieldOrb[]   = [];
  private crateTimer     = 0;

  // ── Game state ─────────────────────────────────────────────────────────────
  private score          = 0;
  private scoreTimer     = 0;
  private level          = 1;
  private levelTimer     = 0;
  private lives          = 2;
  private invincTimer    = 0;
  private bossActive     = false;
  private voidStormTimer = VOID_STORM_INTERVAL;

  // ── Pause ──────────────────────────────────────────────────────────────────
  private prevState: 'playing' | 'boss-intro' = 'playing';

  // ── Death any-key ──────────────────────────────────────────────────────────
  private deathKeyListener:   ((e: KeyboardEvent) => void) | null = null;
  private deathAutoTimer:     ReturnType<typeof setTimeout> | null = null;

  // ── Victory any-key ────────────────────────────────────────────────────────
  private victoryKeyListener: ((e: KeyboardEvent) => void) | null = null;
  private victoryAutoTimer:   ReturnType<typeof setTimeout> | null = null;

  // ── Input ──────────────────────────────────────────────────────────────────
  private spaceHeld = false;

  constructor(app: PIXI.Application) {
    this.app = app;

    this.bgLayer     = new PIXI.Container();
    this.enemyLayer  = new PIXI.Container();
    this.bossLayer   = new PIXI.Container();
    this.projLayer   = new PIXI.Container();
    this.fxLayer     = new PIXI.Container();
    this.playerLayer = new PIXI.Container();
    this.bulletLayer = new PIXI.Container();
    this.pickupLayer = new PIXI.Container();
    this.uiLayer     = new PIXI.Container();
    this.menuLayer   = new PIXI.Container();

    app.stage.addChild(
      this.bgLayer, this.enemyLayer, this.bossLayer, this.projLayer,
      this.fxLayer, this.playerLayer, this.bulletLayer, this.pickupLayer,
      this.uiLayer, this.menuLayer,
    );

    this.background   = new BackgroundManager(app, this.bgLayer);
    this.player       = new Player(app, this.playerLayer);
    this.enemyManager = new EnemyManager(app, this.enemyLayer);
    this.bullets      = new BulletSystem(this.bulletLayer);
    this.effects      = new EffectsManager(app, this.fxLayer);
    this.hud          = new HUD(app, this.uiLayer);
    this.menu         = new Menu(app, this.menuLayer);

    this.menu.onStart = () => this.startGame();

    this.playerLayer.visible = false;
    this.enemyLayer.visible  = false;
    this.bossLayer.visible   = false;
    this.projLayer.visible   = false;
    this.bulletLayer.visible = false;
    this.pickupLayer.visible = false;
    this.uiLayer.visible     = false;

    // Spacebar
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); this.spaceHeld = true; }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.spaceHeld = false;
    });

    // ESC — pause / resume
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape') return;
      if (this.state === 'playing' || this.state === 'boss-intro') {
        this.pauseGame();
      } else if (this.state === 'paused') {
        this.resumeGame();
      }
    });

    app.ticker.add((delta) => this.update(delta));
  }

  // ── Pause / resume ────────────────────────────────────────────────────────

  private pauseGame(): void {
    this.prevState = this.state as 'playing' | 'boss-intro';
    this.state     = 'paused';
    this.hud.showPauseMenu(
      audio.muted,
      this.score,
      this.level,
      () => this.resumeGame(),
      () => { audio.muted = !audio.muted; this.hud.updatePauseSoundLabel(audio.muted); },
      () => this.quitToMenu(),
    );
  }

  private resumeGame(): void {
    this.hud.hidePauseMenu();
    this.state = this.prevState;
  }

  private quitToMenu(): void {
    this.hud.hidePauseMenu();
    this.hud.hideProgressBar();
    this.hud.hideBossBar();

    if (this.boss) { this.boss.destroy(); this.boss = null; }
    this.bossActive = false;
    this.enemyManager.reset();

    if (this.healthPickup) { this.healthPickup.destroy(); this.healthPickup = null; }
    for (const c of this.shieldCrates) c.destroy(); this.shieldCrates = [];
    for (const o of this.shieldOrbs)   o.destroy(); this.shieldOrbs   = [];

    this.bullets.reset();

    this.playerLayer.visible = false;
    this.enemyLayer.visible  = false;
    this.bossLayer.visible   = false;
    this.projLayer.visible   = false;
    this.bulletLayer.visible = false;
    this.pickupLayer.visible = false;
    this.uiLayer.visible     = false;

    audio.stopMusic();
    this.state = 'menu';
    this.menu.show();
  }

  // ── Game start ────────────────────────────────────────────────────────────

  private startGame(): void {
    this.score          = 0;
    this.scoreTimer     = 0;
    this.level          = 1;
    this.levelTimer     = 0;
    this.lives          = 2;
    this.invincTimer    = 0;
    this.bossActive     = false;
    this.voidStormTimer = VOID_STORM_INTERVAL;
    this.boss           = null;
    this.crateTimer     = SHIELD_SPAWN_MIN + Math.random() * (SHIELD_SPAWN_MAX - SHIELD_SPAWN_MIN);

    if (this.healthPickup) { this.healthPickup.destroy(); this.healthPickup = null; }
    for (const c of this.shieldCrates) c.destroy(); this.shieldCrates = [];
    for (const o of this.shieldOrbs)   o.destroy(); this.shieldOrbs   = [];

    this.player.reset();
    this.enemyManager.reset();
    this.enemyManager.setLevel(1);
    this.bullets.reset();

    this.hud.setScore(0);
    this.hud.setLevel(1);
    this.hud.setLives(2);
    this.hud.hideGameOver();
    this.hud.hideBossBar();
    this.hud.showProgressBar();

    this.background.setTheme(0);

    this.playerLayer.visible = true;
    this.enemyLayer.visible  = true;
    this.bossLayer.visible   = true;
    this.projLayer.visible   = true;
    this.bulletLayer.visible = true;
    this.pickupLayer.visible = true;
    this.uiLayer.visible     = true;

    this.menu.hide();
    this.state = 'playing';

    audio.preloadAll().then(() => audio.playBGM());
  }

  // ── Hit handling ──────────────────────────────────────────────────────────

  private onHit(): void {
    if (this.invincTimer > 0) return;

    // Shield absorbs the hit → detonate
    if (this.shieldOrbs.length > 0) {
      const orb = this.shieldOrbs.shift()!;
      orb.destroy();
      this.triggerShieldBurst();
      return;
    }

    this.lives--;
    this.invincTimer = INVINCIBILITY_DUR;
    this.effects.shake(14, 0.4);
    this.effects.flashRed();
    audio.playerHit();
    this.hud.animateHeartLoss(this.lives);
    this.hud.setLives(this.lives);
    if (this.lives <= 0) this.onDeath();
  }

  private triggerShieldBurst(): void {
    const px = this.player.x, py = this.player.y;

    this.effects.shieldBurst(px, py);
    audio.shieldPop();

    for (const enemy of this.enemyManager.getEnemies()) {
      if (Math.hypot(enemy.x - px, enemy.y - py) < SHIELD_BURST_RADIUS) {
        enemy.takeDamage(999);
        this.score += 5;
        this.hud.setScore(this.score);
      }
    }
    this.enemyManager.removeDeadEnemies();

    if (this.boss) {
      this.boss.clearProjsInRadius(px, py, SHIELD_BURST_RADIUS);
    }
  }

  private onDeath(): void {
    this.state = 'dead';
    this.enemyLayer.visible  = false;
    this.bossLayer.visible   = false;
    this.projLayer.visible   = false;
    this.pickupLayer.visible = false;

    for (const c of this.shieldCrates) c.destroy(); this.shieldCrates = [];
    for (const o of this.shieldOrbs)   o.destroy(); this.shieldOrbs   = [];
    this.hud.hideProgressBar();

    audio.stopMusic();
    audio.gameOver();
    this.hud.showGameOver(this.score, this.level);

    // Shared cleanup called by both paths
    const doGoToMenu = () => {
      if (this.state !== 'dead') return;

      // Cancel the other path
      if (this.deathKeyListener) {
        window.removeEventListener('keydown', this.deathKeyListener);
        this.deathKeyListener = null;
      }
      if (this.deathAutoTimer !== null) {
        clearTimeout(this.deathAutoTimer);
        this.deathAutoTimer = null;
      }

      if (this.boss) { this.boss.destroy(); this.boss = null; }
      if (this.healthPickup) { this.healthPickup.destroy(); this.healthPickup = null; }
      this.playerLayer.visible = false;
      this.bulletLayer.visible = false;
      this.uiLayer.visible     = false;
      this.hud.hideGameOver();
      this.menu.show();
      this.state = 'menu';
    };

    // Auto-return after 4 s
    this.deathAutoTimer = setTimeout(doGoToMenu, 4000);

    // Press any key after 0.9 s (prevents accidental skip)
    setTimeout(() => {
      if (this.state !== 'dead') return;
      this.deathKeyListener = () => doGoToMenu();
      window.addEventListener('keydown', this.deathKeyListener, { once: true });
    }, 900);
  }

  // ── Boss flow ─────────────────────────────────────────────────────────────

  private triggerBoss(level: number): void {
    this.state      = 'boss-intro';
    this.bossActive = true;
    this.enemyManager.clearAll();
    this.hud.hideProgressBar();

    this.boss = createBoss(level, this.app, this.bossLayer, this.projLayer);

    audio.stopMusic();
    audio.playBossEntrance();

    this.hud.showBossIntro(this.boss.name, this.boss.color, () => {
      audio.playBGM();
      this.hud.showBossBar(this.boss!.name, this.boss!.color);
      this.state = 'playing';
    });
  }

  private onBossKill(): void {
    const b = this.boss!;
    this.effects.bossExplosion(b.x, b.y, b.color);
    this.effects.shake(18, 0.65);

    this.score += 100;
    this.hud.setScore(this.score);

    this.hud.hideBossBar();
    b.destroy();
    this.boss       = null;
    this.bossActive = false;

    // Level 15 boss defeated → victory!
    if (this.level >= 15) {
      this.onVictory();
      return;
    }

    if (this.lives < MAX_LIVES) {
      this.healthPickup = new HealthPickup(b.x, b.y, this.pickupLayer);
    }

    this.hud.showProgressBar();
    this.crateTimer = SHIELD_SPAWN_MIN + Math.random() * (SHIELD_SPAWN_MAX - SHIELD_SPAWN_MIN);
  }

  // ── Victory ───────────────────────────────────────────────────────────────

  private onVictory(): void {
    this.state = 'victory';
    this.enemyLayer.visible  = false;
    this.bossLayer.visible   = false;
    this.projLayer.visible   = false;
    this.pickupLayer.visible = false;

    for (const c of this.shieldCrates) c.destroy(); this.shieldCrates = [];
    for (const o of this.shieldOrbs)   o.destroy(); this.shieldOrbs   = [];
    this.hud.hideProgressBar();

    audio.stopMusic();
    audio.levelUp();

    this.hud.showVictory(this.score);

    const doGoToMenu = () => {
      if (this.state !== 'victory') return;

      if (this.victoryKeyListener) {
        window.removeEventListener('keydown', this.victoryKeyListener);
        this.victoryKeyListener = null;
      }
      if (this.victoryAutoTimer !== null) {
        clearTimeout(this.victoryAutoTimer);
        this.victoryAutoTimer = null;
      }

      if (this.healthPickup) { this.healthPickup.destroy(); this.healthPickup = null; }
      this.playerLayer.visible = false;
      this.bulletLayer.visible = false;
      this.uiLayer.visible     = false;
      this.hud.hideVictory();
      this.menu.show();
      this.state = 'menu';
    };

    // Auto-return after 10 s
    this.victoryAutoTimer = setTimeout(doGoToMenu, 10000);

    // Any-key shortcut after 1 s
    setTimeout(() => {
      if (this.state !== 'victory') return;
      this.victoryKeyListener = () => doGoToMenu();
      window.addEventListener('keydown', this.victoryKeyListener, { once: true });
    }, 1000);
  }

  private collectHealthPickup(): void {
    if (!this.healthPickup) return;
    this.healthPickup.destroy();
    this.healthPickup = null;

    this.lives = Math.min(MAX_LIVES, this.lives + 1);
    this.hud.animateHeartGain(this.lives);
    this.hud.setLives(this.lives);
    this.effects.flashGreen();
    this.effects.shake(5, 0.25);
    audio.heartGain();
    this.spawnHealText();
  }

  private spawnHealText(): void {
    const W = this.app.screen.width, H = this.app.screen.height;
    const txt = new PIXI.Text('+1  LIFE', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 22, fontWeight: '900', fill: 0x00ff88,
      dropShadow: true, dropShadowColor: 0x00ff88, dropShadowBlur: 16, dropShadowDistance: 0,
    });
    txt.anchor.set(0.5);
    txt.position.set(
      Math.min(W - 80, Math.max(80, this.player.x)),
      Math.min(H - 40, Math.max(40, this.player.y - 20)),
    );
    this.uiLayer.addChild(txt);
    let t = 0;
    const anim = (delta: number) => {
      t += delta / 60;
      txt.y -= 35 * (delta / 60);
      txt.alpha = Math.max(0, 1 - t / 1.2);
      if (t >= 1.2) { this.uiLayer.removeChild(txt); txt.destroy(); this.app.ticker.remove(anim); }
    };
    this.app.ticker.add(anim);
  }

  // ── Main loop ─────────────────────────────────────────────────────────────

  private update(delta: number): void {
    const dt = delta / 60;

    this.background.update(dt);
    this.effects.update(dt);

    // Paused — background + effects keep running, everything else freezes
    if (this.state === 'paused') return;

    // ── Boss intro ────────────────────────────────────────────────────────────
    if (this.state === 'boss-intro') {
      this.player.update(dt);
      if (this.boss) this.boss.update(dt, this.player.x, this.player.y);
      if (this.invincTimer > 0) {
        this.invincTimer -= dt;
        this.playerLayer.alpha = Math.sin(this.invincTimer * 25) > 0 ? 1 : 0.3;
      } else {
        this.playerLayer.alpha = 1;
        if (this.boss?.projHitsPlayer(this.player.x, this.player.y, this.player.radius)) {
          this.onHit();
        }
      }
      return;
    }

    if (this.state !== 'playing') return;

    // ── I-frames flash ────────────────────────────────────────────────────────
    if (this.invincTimer > 0) {
      this.invincTimer -= dt;
      this.playerLayer.alpha = Math.sin(this.invincTimer * 25) > 0 ? 1 : 0.3;
    } else {
      this.playerLayer.alpha = 1;
    }

    // ── Player ────────────────────────────────────────────────────────────────
    this.player.update(dt);

    // ── Shooting ──────────────────────────────────────────────────────────────
    if (this.spaceHeld) {
      if (this.bullets.tryFireAngle(this.player.x, this.player.y, this.player.facingAngle)) {
        audio.shoot();
      }
    }
    this.bullets.update(dt);

    // ── Health pickup ─────────────────────────────────────────────────────────
    if (this.healthPickup) {
      this.healthPickup.update(dt);
      if (!this.healthPickup.alive) {
        this.healthPickup = null;
      } else if (this.lives < MAX_LIVES &&
                 this.healthPickup.collidesWithPlayer(this.player.x, this.player.y)) {
        this.collectHealthPickup();
      }
    }

    // ── Shield crates ─────────────────────────────────────────────────────────
    for (const crate of this.shieldCrates) {
      crate.update(dt);
      if (!crate.alive) continue;
      if (crate.collidesWithPlayer(this.player.x, this.player.y)) {
        // Replace with 3 fresh orbs equally spaced around the player
        for (const o of this.shieldOrbs) o.destroy();
        this.shieldOrbs = [];
        for (let i = 0; i < 3; i++) {
          this.shieldOrbs.push(new ShieldOrb(this.pickupLayer, (i / 3) * Math.PI * 2));
        }
        audio.shieldPickup();
        this.effects.explosion(crate.x, crate.y, 0x00ddff, 10);
        crate.destroy();
      }
    }
    this.shieldCrates = this.shieldCrates.filter((c) => c.alive);

    // ── Shield orbs ───────────────────────────────────────────────────────────
    for (const orb of this.shieldOrbs) {
      orb.update(dt, this.player.x, this.player.y);
    }
    this.shieldOrbs = this.shieldOrbs.filter((o) => o.alive);

    // ── Score ─────────────────────────────────────────────────────────────────
    this.scoreTimer += dt;
    if (this.scoreTimer >= 1) {
      this.score++;
      this.scoreTimer -= 1;
      this.hud.setScore(this.score);
    }

    // ── Enemies ───────────────────────────────────────────────────────────────
    this.enemyManager.update(dt, this.player.x, this.player.y);

    // Bullet → enemy
    for (const enemy of this.enemyManager.getEnemies()) {
      if (this.bullets.checkHit(enemy.x, enemy.y, enemy.radius)) {
        enemy.takeDamage(1);
        audio.enemyHit();
        this.effects.explosion(enemy.x, enemy.y, enemy.color, 8);
        if (enemy.isDead()) {
          this.score += 5;
          this.hud.setScore(this.score);
          this.effects.explosion(enemy.x, enemy.y, enemy.color, 14);
        }
      }
    }

    // Bomb timer explosions
    for (const enemy of this.enemyManager.getEnemies()) {
      if (enemy.isReadyToExplode() && !enemy.isDead()) {
        this.effects.explosion(enemy.x, enemy.y, 0xaa00ff, 22);
        if (this.invincTimer <= 0 &&
            Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y) < BOMB_BLAST_RADIUS) {
          this.onHit();
        }
        enemy.takeDamage(999);
      }
    }

    this.enemyManager.removeDeadEnemies();

    // Enemy → player
    if (this.invincTimer <= 0 &&
        this.enemyManager.collidesWithPlayer(this.player.x, this.player.y, this.player.radius)) {
      this.onHit();
    }

    // ── Level timer ───────────────────────────────────────────────────────────
    if (!this.bossActive) {
      this.levelTimer += dt;
      this.hud.updateProgressBar(this.levelTimer / LEVEL_DURATION);

      if (this.levelTimer >= LEVEL_DURATION) {
        this.levelTimer -= LEVEL_DURATION;
        this.level++;
        this.hud.setLevel(this.level);
        this.effects.levelUpEffect();
        this.effects.shake(10, 0.35);
        audio.levelUp();

        if (this.level === 6)  this.background.setTheme(1);
        if (this.level === 11) this.background.setTheme(2);

        if (this.level === 5 || this.level === 10 || this.level === 15) {
          this.triggerBoss(this.level);
        } else {
          this.enemyManager.clearAll();
          this.enemyManager.setPaused(true);
          this.enemyManager.setLevel(this.level);
          this.hud.showRoundStart(this.level, () => {
            this.enemyManager.setPaused(false);
          });
        }
      }

      // Shield crate spawning
      this.crateTimer -= dt;
      if (this.crateTimer <= 0) {
        this.crateTimer = SHIELD_SPAWN_MIN + Math.random() * (SHIELD_SPAWN_MAX - SHIELD_SPAWN_MIN);
        const W = this.app.screen.width, H = this.app.screen.height, pad = 90;
        this.shieldCrates.push(new ShieldCrate(
          pad + Math.random() * (W - pad * 2),
          pad + Math.random() * (H - pad * 2),
          this.pickupLayer,
        ));
      }

      // Void Storm
      this.voidStormTimer -= dt;
      if (this.voidStormTimer <= 0) {
        this.voidStormTimer = VOID_STORM_INTERVAL;
        const dirs = ['left', 'right', 'top', 'bottom'] as const;
        const dir  = dirs[Math.floor(Math.random() * dirs.length)];
        this.enemyManager.triggerVoidStorm(dir);
        this.hud.showVoidStormWarning(dir);
        this.effects.flashCrimson();
        audio.voidStormWarning();
      }
    }

    // ── Boss fight ────────────────────────────────────────────────────────────
    if (this.bossActive && this.boss) {
      this.boss.update(dt, this.player.x, this.player.y);

      const bossHit = this.boss.processBullets(
        (x, y, r) => this.bullets.checkHit(x, y, r),
      );
      if (bossHit) {
        audio.bossHit();
        this.effects.explosion(this.boss.x, this.boss.y, this.boss.color, 6);
        this.hud.updateBossBar(this.boss.getHpRatio(), this.boss.color);
        if (this.boss.isDead()) { this.onBossKill(); return; }
      }

      if (this.invincTimer <= 0 &&
          this.boss.projHitsPlayer(this.player.x, this.player.y, this.player.radius)) {
        this.onHit();
      }

      if (this.invincTimer <= 0 &&
          this.boss.bodyCollidesWithPlayer(this.player.x, this.player.y, this.player.radius)) {
        this.onHit();
      }

      if (this.boss instanceof BossStampede && this.boss.isCharging()) {
        this.effects.spawnTrail(this.boss.x, this.boss.y, this.boss.color);
      }
    }
  }
}
