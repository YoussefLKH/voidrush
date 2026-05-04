import * as PIXI from 'pixi.js';
import { settings, SHIP_NAMES, SHIP_COLORS, ShipVariant } from './settings';
import { drawShipShape } from './player';
import { audio } from './audio';
import { getWinners } from './leaderboard';

type Screen = 'main' | 'avatar' | 'instructions' | 'leaderboard';

// ─── Menu ─────────────────────────────────────────────────────────────────────

export class Menu {
  private app:  PIXI.Application;
  private root: PIXI.Container;

  private mainScreen:  PIXI.Container;
  private avatarScreen:  PIXI.Container;
  private instrScreen:   PIXI.Container;
  private lbScreen:      PIXI.Container;

  // Avatar carousel refs
  private carouselRoot!:  PIXI.Container;
  private shipNameText!:  PIXI.Text;

  // Title pulse
  private titleGfx!: PIXI.Text;
  private t = 0;

  // Sound toggle button (main screen)
  private soundBtn!: PIXI.Container;

  /** Called when the player clicks START GAME */
  onStart:    () => void = () => {};
  /** Called when the player clicks TUTORIAL */
  onTutorial: () => void = () => {};

  constructor(app: PIXI.Application, layer: PIXI.Container) {
    this.app  = app;
    this.root = new PIXI.Container();
    layer.addChild(this.root);

    this.mainScreen   = this.buildMain();
    this.avatarScreen = this.buildAvatarPicker();
    this.instrScreen  = this.buildInstructions();
    this.lbScreen     = this.buildLeaderboard();

    this.root.addChild(this.mainScreen, this.avatarScreen, this.instrScreen, this.lbScreen);
    this.showScreen('main');

    app.ticker.add((d) => this.tick(d));
  }

  // ── Public ────────────────────────────────────────────────────────────────

  show(): void { this.root.visible = true;  this.showScreen('main'); }
  hide(): void { this.root.visible = false; }

  // ── Screen management ─────────────────────────────────────────────────────

  private showScreen(name: Screen): void {
    this.mainScreen.visible   = name === 'main';
    this.avatarScreen.visible = name === 'avatar';
    this.instrScreen.visible  = name === 'instructions';
    this.lbScreen.visible     = name === 'leaderboard';
    if (name === 'avatar')      this.rebuildCarousel();
    if (name === 'leaderboard') this.rebuildLeaderboard();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN MENU
  // ─────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────
  // MENU BACKGROUND FX  (particles · shooting stars · title aura)
  // ─────────────────────────────────────────────────────────────────────────

  private buildMenuFX(c: PIXI.Container): void {
    const W = this.app.screen.width;
    const H = this.app.screen.height;

    const gfx = new PIXI.Graphics();
    c.addChild(gfx);

    // ── Particles ──────────────────────────────────────────────────────────
    const COLORS = [0x00ffcc, 0xcc44ff, 0x4499ff, 0x00aaff, 0xff44dd];
    type P = { x: number; y: number; vx: number; vy: number; r: number;
               col: number; baseAlpha: number; phase: number; phaseSpd: number };
    const particles: P[] = [];
    for (let i = 0; i < 26; i++) {
      particles.push({
        x:        Math.random() * W,
        y:        Math.random() * H,
        vx:       (Math.random() - 0.5) * 20,
        vy:       (Math.random() - 0.5) * 20,
        r:        1.2 + Math.random() * 2.4,
        col:      COLORS[Math.floor(Math.random() * COLORS.length)],
        baseAlpha: 0.25 + Math.random() * 0.40,
        phase:    Math.random() * Math.PI * 2,
        phaseSpd: 0.4 + Math.random() * 1.1,
      });
    }

    // ── Shooting stars ─────────────────────────────────────────────────────
    type S = { x: number; y: number; nx: number; ny: number; spd: number;
               len: number; life: number; maxLife: number };
    const stars: S[] = [];
    let starTimer = 2 + Math.random() * 3;

    // ── Ticker ─────────────────────────────────────────────────────────────
    let t = 0;
    const tick = (delta: number) => {
      if (!gfx.parent) { this.app.ticker.remove(tick); return; }
      // only animate while main screen is visible
      if (!this.mainScreen.visible) { gfx.visible = false; return; }
      gfx.visible = true;

      const dt = delta / 60;
      t += dt;
      gfx.clear();

      // ── Title aura ──────────────────────────────────────────────────────
      const ax = W / 2, ay = H * 0.20;
      const aA = 0.055 + Math.sin(t * 1.3) * 0.030;
      gfx.beginFill(0x00ffff, aA);
      gfx.drawEllipse(ax, ay, 240, 58);
      gfx.endFill();
      gfx.beginFill(0x4400ff, aA * 0.55);
      gfx.drawEllipse(ax, ay + 10, 320, 90);
      gfx.endFill();

      // ── Particles ───────────────────────────────────────────────────────
      for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.phase += p.phaseSpd * dt;
        if (p.x < -12) p.x += W + 24;  if (p.x > W + 12) p.x -= W + 24;
        if (p.y < -12) p.y += H + 24;  if (p.y > H + 12) p.y -= H + 24;
        const a = p.baseAlpha * (0.55 + Math.sin(p.phase) * 0.45);
        // soft outer glow
        gfx.beginFill(p.col, a * 0.14);
        gfx.drawCircle(p.x, p.y, p.r * 4.0);
        gfx.endFill();
        // core dot
        gfx.beginFill(p.col, a);
        gfx.drawCircle(p.x, p.y, p.r);
        gfx.endFill();
      }

      // ── Shooting stars spawn ────────────────────────────────────────────
      starTimer -= dt;
      if (starTimer <= 0) {
        starTimer = 3.5 + Math.random() * 5;
        const sx = Math.random() * W * 0.75;
        const sy = Math.random() * H * 0.35;
        const ang = 0.22 + Math.random() * 0.55;   // diagonal right-downward
        const spd = 550 + Math.random() * 500;
        stars.push({
          x: sx, y: sy,
          nx: Math.cos(ang), ny: Math.sin(ang),
          spd,
          len: 70 + Math.random() * 130,
          life: 0,
          maxLife: 0.28 + Math.random() * 0.22,
        });
      }

      // ── Shooting stars draw ─────────────────────────────────────────────
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        s.x += s.nx * s.spd * dt;
        s.y += s.ny * s.spd * dt;
        s.life += dt;
        if (s.life >= s.maxLife || s.x > W + 60 || s.y > H + 60) {
          stars.splice(i, 1); continue;
        }
        const prog  = s.life / s.maxLife;
        const alpha = (1 - prog) * 0.85;
        // white core
        gfx.lineStyle(1.4, 0xffffff, alpha);
        gfx.moveTo(s.x, s.y);
        gfx.lineTo(s.x - s.nx * s.len, s.y - s.ny * s.len);
        // cyan glow trail
        gfx.lineStyle(3.5, 0x00ddff, alpha * 0.28);
        gfx.moveTo(s.x, s.y);
        gfx.lineTo(s.x - s.nx * s.len * 0.55, s.y - s.ny * s.len * 0.55);
      }
    };
    this.app.ticker.add(tick);
  }

  private buildMain(): PIXI.Container {
    const c = new PIXI.Container();
    const W = this.app.screen.width;
    const H = this.app.screen.height;

    // Dim overlay so stars are still barely visible
    const bg = new PIXI.Graphics();
    bg.beginFill(0x000008, 0.82); bg.drawRect(0, 0, W, H); bg.endFill();
    c.addChild(bg);

    // Animated background FX (particles, shooting stars, title aura)
    this.buildMenuFX(c);

    // VOID RUSH title
    this.titleGfx = new PIXI.Text('VOID RUSH', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize:   76,
      fontWeight: 'bold',
      fill:       0x00ffff,
      dropShadow: true, dropShadowColor: 0x00ffff,
      dropShadowBlur: 34, dropShadowDistance: 0,
    });
    this.titleGfx.anchor.set(0.5);
    this.titleGfx.position.set(W / 2, H * 0.20);
    c.addChild(this.titleGfx);

    // Subtitle
    const sub = new PIXI.Text('SURVIVE  ·  DODGE  ·  ASCEND', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: 13, fill: 0x336655, letterSpacing: 5,
    });
    sub.anchor.set(0.5);
    sub.position.set(W / 2, H * 0.20 + 60);
    c.addChild(sub);

    // Completion tagline
    const tagline = new PIXI.Text('○  REACH LEVEL 15 TO CONQUER THE VOID  ○', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: 10, fill: 0x2a4433, letterSpacing: 2,
    });
    tagline.anchor.set(0.5);
    tagline.position.set(W / 2, H * 0.20 + 82);
    c.addChild(tagline);

    // Thin decorative line
    const line = new PIXI.Graphics();
    line.lineStyle(1, 0x00ffcc, 0.25);
    line.moveTo(W / 2 - 130, H * 0.20 + 98);
    line.lineTo(W / 2 + 130, H * 0.20 + 98);
    c.addChild(line);

    // Primary menu items (larger, bright)
    const primary: [string, () => void][] = [
      ['START GAME',    () => this.onStart()],
    ];
    primary.forEach(([label, cb], i) => {
      const btn = this.menuItem(label, cb);
      btn.position.set(W / 2, H * 0.46 + i * 52);
      c.addChild(btn);
    });

    // TUTORIAL — secondary style (smaller, dimmer)
    const tutBtn = this.menuItemSecondary('▶  TUTORIAL', () => this.onTutorial());
    tutBtn.position.set(W / 2, H * 0.46 + 52);
    c.addChild(tutBtn);

    // Secondary items
    const secondary: [string, () => void][] = [
      ['LEADERBOARD',   () => this.showScreen('leaderboard')],
      ['CHANGE AVATAR', () => this.showScreen('avatar')],
      ['INSTRUCTIONS',  () => this.showScreen('instructions')],
      ['EXIT',          () => window.location.reload()],
    ];
    secondary.forEach(([label, cb], i) => {
      const btn = this.menuItem(label, cb);
      btn.position.set(W / 2, H * 0.46 + 114 + i * 50);
      c.addChild(btn);
    });

    // ── Bottom bar ───────────────────────────────────────────────────────────

    const ver = new PIXI.Text('v0.1', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 10, fill: 0x1a2233,
    });
    ver.anchor.set(0, 1); ver.position.set(18, H - 14);
    c.addChild(ver);

    const credits = new PIXI.Text('A  PROJECT  BY  YOUSSEF  LAKHAL', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 10, fill: 0x223344, letterSpacing: 2,
    });
    credits.anchor.set(0.5, 1); credits.position.set(W / 2, H - 14);
    c.addChild(credits);

    // Sound toggle icon — bottom-right corner
    this.soundBtn = new PIXI.Container();
    this.soundBtn.interactive = true;
    this.soundBtn.cursor = 'pointer';
    this.soundBtn.position.set(W - 38, H - 38);
    this.soundBtn.on('pointerdown', () => { audio.muted = !audio.muted; this.refreshSoundIcon(); });
    this.soundBtn.on('pointerover', () => { this.soundBtn.alpha = 0.65; });
    this.soundBtn.on('pointerout',  () => { this.soundBtn.alpha = 1; });
    // bg circle + speaker gfx
    this.soundBtn.addChild(new PIXI.Graphics(), new PIXI.Graphics());
    c.addChild(this.soundBtn);
    this.refreshSoundIcon();

    return c;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AVATAR PICKER SCREEN
  // ─────────────────────────────────────────────────────────────────────────

  private buildAvatarPicker(): PIXI.Container {
    const c = new PIXI.Container();
    const W = this.app.screen.width;
    const H = this.app.screen.height;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x000008, 0.93); bg.drawRect(0, 0, W, H); bg.endFill();
    c.addChild(bg);

    // Title
    c.addChild(this.sectionTitle('CHOOSE  YOUR  SHIP', W / 2, H * 0.12));

    const sub = new PIXI.Text('SELECT  YOUR  PILOT', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 11, fill: 0x334455, letterSpacing: 4,
    });
    sub.anchor.set(0.5); sub.position.set(W / 2, H * 0.12 + 44);
    c.addChild(sub);

    // Carousel container — ships go inside here at relative offsets
    this.carouselRoot = new PIXI.Container();
    this.carouselRoot.position.set(W / 2, H * 0.50);
    c.addChild(this.carouselRoot);

    // Left arrow (index 0 in carouselRoot)
    const leftArrow = this.arrowBtn('◄', () => {
      settings.cycleShip(-1);
      this.rebuildCarousel();
    });
    leftArrow.position.set(-195, 0);
    this.carouselRoot.addChild(leftArrow);

    // Right arrow (index 1 in carouselRoot)
    const rightArrow = this.arrowBtn('►', () => {
      settings.cycleShip(1);
      this.rebuildCarousel();
    });
    rightArrow.position.set(195, 0);
    this.carouselRoot.addChild(rightArrow);

    // Ship name label — below the carousel, absolute position
    this.shipNameText = new PIXI.Text('', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: 22, fontWeight: 'bold', fill: 0x00ffcc,
      dropShadow: true, dropShadowColor: 0x00ffcc, dropShadowBlur: 14, dropShadowDistance: 0,
    });
    this.shipNameText.anchor.set(0.5);
    this.shipNameText.position.set(W / 2, H * 0.50 + 112);
    c.addChild(this.shipNameText);

    // Hint
    const hint = new PIXI.Text('◄  ►  BROWSE  SHIPS', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 10, fill: 0x1a2c3a, letterSpacing: 3,
    });
    hint.anchor.set(0.5); hint.position.set(W / 2, H * 0.50 + 144);
    c.addChild(hint);

    // Initial carousel build
    this.rebuildCarousel();

    // BACK button
    const back = this.menuItem('← BACK', () => this.showScreen('main'));
    back.position.set(W / 2, H * 0.90);
    c.addChild(back);

    return c;
  }

  // Rebuild the 3 ship slots (called on every arrow press and screen open)
  private rebuildCarousel(): void {
    // Remove ship containers — everything after the 2 arrows (index 0 & 1)
    while (this.carouselRoot.children.length > 2) {
      const child = this.carouselRoot.getChildAt(2);
      this.carouselRoot.removeChildAt(2);
      child.destroy({ children: true });
    }

    const total = 4;
    const cur   = settings.ship as ShipVariant;
    const prev  = (((cur as number) - 1 + total) % total) as ShipVariant;
    const next  = (((cur as number) + 1) % total) as ShipVariant;

    type Slot = { variant: ShipVariant; x: number; scale: number; alpha: number; isCenter: boolean };
    const slots: Slot[] = [
      { variant: prev, x: -145, scale: 1.3,  alpha: 0.22, isCenter: false },
      { variant: cur,  x:    0, scale: 2.15, alpha: 1.00, isCenter: true  },
      { variant: next, x:  145, scale: 1.3,  alpha: 0.22, isCenter: false },
    ];

    for (const slot of slots) {
      const container = new PIXI.Container();
      container.position.set(slot.x, 0);
      container.alpha = slot.alpha;

      if (slot.isCenter) {
        // Selection glow ring — two concentric circles
        const ring = new PIXI.Graphics();
        const col  = SHIP_COLORS[slot.variant];
        ring.lineStyle(2, col, 0.5);
        ring.drawCircle(0, 0, 64);
        ring.lineStyle(1, col, 0.18);
        ring.drawCircle(0, 0, 76);
        container.addChild(ring);

        // Gentle breathing animation while avatar screen is open
        let rt = 0;
        const breathe = (d: number) => {
          if (!container.parent) { this.app.ticker.remove(breathe); return; }
          rt += d / 60;
          ring.alpha = 0.55 + Math.sin(rt * 2.2) * 0.45;
        };
        this.app.ticker.add(breathe);
      }

      const glow = new PIXI.Graphics();
      const ship = new PIXI.Graphics();
      container.addChild(glow, ship);
      drawShipShape(ship, glow, slot.variant, slot.scale);

      this.carouselRoot.addChild(container);
    }

    // Update ship name label
    this.shipNameText.text = SHIP_NAMES[settings.ship];
    const hex = SHIP_COLORS[settings.ship].toString(16).padStart(6, '0');
    (this.shipNameText.style as any).fill     = `#${hex}`;
    (this.shipNameText.style as any).dropShadowColor = `#${hex}`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INSTRUCTIONS SCREEN
  // ─────────────────────────────────────────────────────────────────────────

  private buildInstructions(): PIXI.Container {
    const c = new PIXI.Container();
    const W = this.app.screen.width;
    const H = this.app.screen.height;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x000008, 0.93); bg.drawRect(0, 0, W, H); bg.endFill();
    c.addChild(bg);

    c.addChild(this.sectionTitle('HOW TO PLAY', W / 2, H * 0.10));

    const lines = [
      '  MOVE        WASD  /  Arrow keys',
      '  FIRE        SPACEBAR  (fires in facing direction)',
      '',
      '  SURVIVE    Don\'t get hit by enemies',
      '  SCORE      +1 point per second alive',
      '  LEVEL UP   Every 30 seconds you advance',
      '',
      '──────────────────────────────────────────',
      '',
      '  △  RED    DART     — screams in a straight line',
      '  ⬠  ORANGE CHASER   — slow but tracks you',
      '  ⬡  PURPLE MINE     — timed explosive, shoot it!',
      '',
      '──────────────────────────────────────────',
      '',
      '  Bosses appear at levels 5, 10, and 15.',
      '  Defeat the level 15 boss to conquer the void.',
    ];

    const content = new PIXI.Text(lines.join('\n'), {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: 15, fill: 0xaabbcc, lineHeight: 25,
    });
    content.anchor.set(0.5, 0);
    content.position.set(W / 2, H * 0.21);
    c.addChild(content);

    const back = this.menuItem('← BACK', () => this.showScreen('main'));
    back.position.set(W / 2, H * 0.90);
    c.addChild(back);

    return c;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UI Factories
  // ─────────────────────────────────────────────────────────────────────────

  private menuItem(label: string, onClick: () => void): PIXI.Text {
    const t = new PIXI.Text(label, {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: 22, fill: '#8899aa',
    });
    t.anchor.set(0.5);
    t.interactive = true;
    t.cursor = 'pointer';
    t.on('pointerover', () => { (t.style as any).fill = '#00ffcc'; t.scale.set(1.07); });
    t.on('pointerout',  () => { (t.style as any).fill = '#8899aa'; t.scale.set(1);    });
    t.on('pointerdown', onClick);
    return t;
  }

  private menuItemSecondary(label: string, onClick: () => void): PIXI.Text {
    const t = new PIXI.Text(label, {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: 15, fill: '#3d6e8a',
    });
    t.anchor.set(0.5);
    t.interactive = true;
    t.cursor = 'pointer';
    t.on('pointerover', () => { (t.style as any).fill = '#55aacc'; t.scale.set(1.06); });
    t.on('pointerout',  () => { (t.style as any).fill = '#3d6e8a'; t.scale.set(1);    });
    t.on('pointerdown', onClick);
    return t;
  }

  private arrowBtn(symbol: string, onClick: () => void): PIXI.Text {
    const t = new PIXI.Text(symbol, {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: 32, fill: '#00ffcc',
    });
    t.anchor.set(0.5);
    t.interactive = true;
    t.cursor = 'pointer';
    t.on('pointerover', () => { t.scale.set(1.3); (t.style as any).fill = '#ffffff'; });
    t.on('pointerout',  () => { t.scale.set(1);   (t.style as any).fill = '#00ffcc'; });
    t.on('pointerdown', onClick);
    return t;
  }

  private sectionTitle(text: string, x: number, y: number): PIXI.Text {
    const t = new PIXI.Text(text, {
      fontFamily: 'Orbitron, sans-serif',
      fontSize:   40, fontWeight: 'bold', fill: 0x00ffcc,
      dropShadow: true, dropShadowColor: 0x00ffcc,
      dropShadowBlur: 18, dropShadowDistance: 0,
    });
    t.anchor.set(0.5);
    t.position.set(x, y);
    return t;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LEADERBOARD SCREEN
  // ─────────────────────────────────────────────────────────────────────────

  private lbRowsContainer!: PIXI.Container;

  private buildLeaderboard(): PIXI.Container {
    const c = new PIXI.Container();
    const W = this.app.screen.width;
    const H = this.app.screen.height;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x000008, 0.95); bg.drawRect(0, 0, W, H); bg.endFill();
    c.addChild(bg);

    // Title
    const title = new PIXI.Text('VOID  CONQUERORS', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 36, fontWeight: 'bold',
      fill: 0xffd700,
      dropShadow: true, dropShadowColor: 0xffaa00, dropShadowBlur: 20, dropShadowDistance: 0,
    });
    title.anchor.set(0.5); title.position.set(W / 2, H * 0.11);
    c.addChild(title);

    const sub = new PIXI.Text('ONLY  THOSE  WHO  DEFEATED  LEVEL  15  ARE  LISTED', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 9, fill: 0x223344, letterSpacing: 2,
    });
    sub.anchor.set(0.5); sub.position.set(W / 2, H * 0.11 + 42);
    c.addChild(sub);

    const divLine = new PIXI.Graphics();
    divLine.lineStyle(1, 0xffd700, 0.18);
    divLine.moveTo(W / 2 - 200, H * 0.11 + 58);
    divLine.lineTo(W / 2 + 200, H * 0.11 + 58);
    c.addChild(divLine);

    // Rows container (rebuilt dynamically on each open)
    this.lbRowsContainer = new PIXI.Container();
    this.lbRowsContainer.position.set(0, H * 0.11 + 68);
    c.addChild(this.lbRowsContainer);

    // Back button
    const back = this.menuItem('← BACK', () => this.showScreen('main'));
    back.position.set(W / 2, H * 0.92);
    c.addChild(back);

    return c;
  }

  private rebuildLeaderboard(): void {
    const W = this.app.screen.width;
    const H = this.app.screen.height;

    // Clear old rows
    this.lbRowsContainer.removeChildren();

    const winners = getWinners();

    if (winners.length === 0) {
      const empty = new PIXI.Text('NO  ONE  HAS  CONQUERED  THE  VOID  YET', {
        fontFamily: 'Orbitron, sans-serif', fontSize: 15, fill: 0x223344,
        letterSpacing: 2, align: 'center',
      });
      empty.anchor.set(0.5); empty.position.set(W / 2, H * 0.32);
      this.lbRowsContainer.addChild(empty);

      const hint = new PIXI.Text('Be the first to defeat all 15 levels.', {
        fontFamily: 'Orbitron, sans-serif', fontSize: 11, fill: 0x1a2a33,
      });
      hint.anchor.set(0.5); hint.position.set(W / 2, H * 0.32 + 34);
      this.lbRowsContainer.addChild(hint);
      return;
    }

    const RANK_COLORS = [0xffd700, 0xcccccc, 0xcd7f32]; // gold/silver/bronze
    const ROW_H = 44;
    const startY = 10;

    winners.forEach((w, i) => {
      const rankCol = i < 3 ? RANK_COLORS[i] : 0x445566;
      const rowY    = startY + i * ROW_H;

      // Row bg stripe (alternating)
      const rowBg = new PIXI.Graphics();
      rowBg.beginFill(i % 2 === 0 ? 0x001122 : 0x000d18, 0.5);
      rowBg.drawRect(W * 0.08, rowY + 2, W * 0.84, ROW_H - 4);
      rowBg.endFill();
      this.lbRowsContainer.addChild(rowBg);

      // Rank number
      const rankTxt = new PIXI.Text(`#${i + 1}`, {
        fontFamily: 'Orbitron, sans-serif', fontSize: 16, fontWeight: 'bold',
        fill: rankCol,
      });
      rankTxt.anchor.set(0, 0.5); rankTxt.position.set(W * 0.10, rowY + ROW_H / 2);
      this.lbRowsContainer.addChild(rankTxt);

      // Name
      const nameTxt = new PIXI.Text(w.name.toUpperCase(), {
        fontFamily: 'Orbitron, sans-serif', fontSize: 15, fontWeight: 'bold',
        fill: i < 3 ? rankCol : 0x88aacc,
      });
      nameTxt.anchor.set(0, 0.5); nameTxt.position.set(W * 0.20, rowY + ROW_H / 2);
      this.lbRowsContainer.addChild(nameTxt);

      // Score
      const scoreTxt = new PIXI.Text(`${w.score.toLocaleString()}  pts`, {
        fontFamily: 'Orbitron, sans-serif', fontSize: 14, fill: 0x00ffcc,
      });
      scoreTxt.anchor.set(1, 0.5); scoreTxt.position.set(W * 0.72, rowY + ROW_H / 2);
      this.lbRowsContainer.addChild(scoreTxt);

      // Date
      const dateTxt = new PIXI.Text(w.date, {
        fontFamily: 'Orbitron, sans-serif', fontSize: 10, fill: 0x334455,
      });
      dateTxt.anchor.set(1, 0.5); dateTxt.position.set(W * 0.90, rowY + ROW_H / 2);
      this.lbRowsContainer.addChild(dateTxt);
    });
  }

  // ── Sound icon ────────────────────────────────────────────────────────────

  private refreshSoundIcon(): void {
    if (!this.soundBtn) return;
    const bg  = this.soundBtn.getChildAt(0) as PIXI.Graphics;
    const spk = this.soundBtn.getChildAt(1) as PIXI.Graphics;
    const muted = audio.muted;
    const col   = muted ? 0x334455 : 0x00ccff;

    // Circle background
    bg.clear();
    bg.lineStyle(1.5, col, muted ? 0.25 : 0.5);
    bg.beginFill(0x00080f, 0.92);
    bg.drawCircle(0, 0, 24);
    bg.endFill();

    spk.clear();

    // Speaker cabinet + cone as a single filled polygon
    const fa = muted ? 0.35 : 0.95;
    spk.beginFill(col, fa);
    spk.moveTo(-9, -4);   // cabinet top-left
    spk.lineTo(-4, -4);   // cabinet top-right → cone base top
    spk.lineTo( 7, -10);  // cone tip-top
    spk.lineTo( 7,  10);  // cone tip-bottom
    spk.lineTo(-4,  4);   // cone base bottom
    spk.lineTo(-9,  4);   // cabinet bottom-left
    spk.closePath();
    spk.endFill();

    if (!muted) {
      // Inner sound arc
      const r1 = 9;
      const a1s = -Math.PI * 0.37, a1e = Math.PI * 0.37;
      spk.lineStyle(2.2, col, 0.88);
      spk.moveTo(7 + r1 * Math.cos(a1s), r1 * Math.sin(a1s));
      spk.arc(7, 0, r1, a1s, a1e);

      // Outer sound arc
      const r2 = 14;
      const a2s = -Math.PI * 0.50, a2e = Math.PI * 0.50;
      spk.lineStyle(1.6, col, 0.45);
      spk.moveTo(7 + r2 * Math.cos(a2s), r2 * Math.sin(a2s));
      spk.arc(7, 0, r2, a2s, a2e);
    } else {
      // Muted X over the speaker
      spk.lineStyle(2.5, 0xff3355, 0.95);
      spk.moveTo(10, -8); spk.lineTo(16, -2);
      spk.moveTo(10, -2); spk.lineTo(16, -8);
    }
  }

  // ── Ticker animation ──────────────────────────────────────────────────────

  private tick(delta: number): void {
    if (!this.root.visible || !this.mainScreen.visible) return;
    this.t += delta / 60;
    this.titleGfx.alpha = 0.78 + Math.sin(this.t * 2.0) * 0.22;
  }
}
