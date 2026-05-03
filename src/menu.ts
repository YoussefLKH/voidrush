import * as PIXI from 'pixi.js';
import { settings, SHIP_NAMES, SHIP_COLORS, ShipVariant } from './settings';
import { drawShipShape } from './player';
import { audio } from './audio';

type Screen = 'main' | 'avatar' | 'instructions';

// ─── Menu ─────────────────────────────────────────────────────────────────────

export class Menu {
  private app:  PIXI.Application;
  private root: PIXI.Container;

  private mainScreen:  PIXI.Container;
  private avatarScreen: PIXI.Container;
  private instrScreen: PIXI.Container;

  // Avatar carousel refs
  private carouselRoot!:  PIXI.Container;
  private shipNameText!:  PIXI.Text;

  // Title pulse
  private titleGfx!: PIXI.Text;
  private t = 0;

  // Sound toggle button (main screen)
  private soundBtn!: PIXI.Container;

  /** Called when the player clicks START GAME */
  onStart: () => void = () => {};

  constructor(app: PIXI.Application, layer: PIXI.Container) {
    this.app  = app;
    this.root = new PIXI.Container();
    layer.addChild(this.root);

    this.mainScreen   = this.buildMain();
    this.avatarScreen = this.buildAvatarPicker();
    this.instrScreen  = this.buildInstructions();

    this.root.addChild(this.mainScreen, this.avatarScreen, this.instrScreen);
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
    if (name === 'avatar') this.rebuildCarousel();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN MENU
  // ─────────────────────────────────────────────────────────────────────────

  private buildMain(): PIXI.Container {
    const c = new PIXI.Container();
    const W = this.app.screen.width;
    const H = this.app.screen.height;

    // Dim overlay so stars are still barely visible
    const bg = new PIXI.Graphics();
    bg.beginFill(0x000008, 0.82); bg.drawRect(0, 0, W, H); bg.endFill();
    c.addChild(bg);

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

    // Menu items
    const items: [string, () => void][] = [
      ['START GAME',    () => this.onStart()],
      ['CHANGE AVATAR', () => this.showScreen('avatar')],
      ['INSTRUCTIONS',  () => this.showScreen('instructions')],
      ['EXIT',          () => window.location.reload()],
    ];
    items.forEach(([label, cb], i) => {
      const btn = this.menuItem(label, cb);
      btn.position.set(W / 2, H * 0.48 + i * 56);
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
