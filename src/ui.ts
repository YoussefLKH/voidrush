import * as PIXI from 'pixi.js';

const MAX_LIVES = 3;
const SEG_COUNT = 20; // boss HP bar segments (1 per HP)

export class HUD {
  private app:   PIXI.Application;
  private layer: PIXI.Container;

  // Score
  private scoreText: PIXI.Text;

  // Level badge (top-left)
  private levelNum: PIXI.Text;

  // Hearts (top-center)
  private heartContainers: PIXI.Container[] = [];

  // Boss health bar (top of screen, hidden when no boss)
  private bossBarRoot:  PIXI.Container;
  private bossSegs:     PIXI.Graphics[] = [];
  private bossNameText: PIXI.Text;
  private bossPhaseText: PIXI.Text;

  // Level progress bar (very top of screen)
  private progressRoot: PIXI.Container;
  private progressFill: PIXI.Graphics;

  // Pause menu (created/destroyed on demand)
  private pauseRoot:       PIXI.Container | null = null;
  private pauseSoundLabel: PIXI.Text      | null = null;

  // Victory screen (created/destroyed on demand)
  private victoryRoot:     PIXI.Container | null = null;

  // Level-up flash
  private levelUpContainer: PIXI.Container;
  private levelUpText:      PIXI.Text;

  // Game over
  private goContainer:  PIXI.Container;
  private finalScore:   PIXI.Text;
  private finalLevel:   PIXI.Text;
  private finalPercent: PIXI.Text;

  constructor(app: PIXI.Application, layer: PIXI.Container) {
    this.app   = app;
    this.layer = layer;
    const W    = app.screen.width;
    const H    = app.screen.height;

    // ── Score (top-right) ─────────────────────────────────────────────────
    const sLabel = new PIXI.Text('SCORE', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 10, fill: 0x00ffcc,
    });
    sLabel.alpha = 0.5;
    sLabel.anchor.set(1, 0); sLabel.position.set(W - 18, 10);
    layer.addChild(sLabel);

    this.scoreText = new PIXI.Text('0', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 28, fontWeight: 'bold', fill: 0x00ffcc,
      dropShadow: true, dropShadowColor: 0x00ffcc, dropShadowBlur: 14, dropShadowDistance: 0,
    });
    this.scoreText.anchor.set(1, 0); this.scoreText.position.set(W - 18, 22);
    layer.addChild(this.scoreText);

    // ── Level badge (top-left) ────────────────────────────────────────────
    const lLabel = new PIXI.Text('LEVEL', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 10, fill: 0xffcc00,
    });
    lLabel.alpha = 0.5;
    lLabel.position.set(18, 10);
    layer.addChild(lLabel);

    this.levelNum = new PIXI.Text('1', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 28, fontWeight: 'bold', fill: 0xffcc00,
      dropShadow: true, dropShadowColor: 0xffcc00, dropShadowBlur: 14, dropShadowDistance: 0,
    });
    this.levelNum.position.set(18, 22);
    layer.addChild(this.levelNum);

    // ── Hearts (top-center) ───────────────────────────────────────────────
    this.heartContainers = [];
    for (let i = 0; i < MAX_LIVES; i++) {
      const c = new PIXI.Container();
      c.position.set(W / 2 - (MAX_LIVES - 1) * 22 + i * 44, 24);
      layer.addChild(c);
      this.heartContainers.push(c);
    }
    this.renderHearts(2);

    // ── Boss health bar — 10 segments ─────────────────────────────────────
    this.bossBarRoot = new PIXI.Container();
    this.bossBarRoot.visible = false;
    layer.addChild(this.bossBarRoot);

    const barW = Math.min(440, W * 0.58);
    const segW = Math.floor((barW - (SEG_COUNT - 1) * 3) / SEG_COUNT);
    const barH = 18;
    const barX = W / 2 - barW / 2;
    const barY = 62;

    this.bossNameText = new PIXI.Text('', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 13, fontWeight: 'bold', fill: 0xffffff,
      letterSpacing: 4,
    });
    this.bossNameText.anchor.set(0.5); this.bossNameText.position.set(W / 2, barY - 20);
    this.bossBarRoot.addChild(this.bossNameText);

    this.bossPhaseText = new PIXI.Text('', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 10, fill: 0x667788,
    });
    this.bossPhaseText.anchor.set(0.5); this.bossPhaseText.position.set(W / 2, barY + barH + 8);
    this.bossBarRoot.addChild(this.bossPhaseText);

    // Draw 10 segment boxes
    this.bossSegs = [];
    for (let i = 0; i < SEG_COUNT; i++) {
      const sx  = barX + i * (segW + 3);
      const seg = new PIXI.Graphics();
      this.bossBarRoot.addChild(seg);
      this.bossSegs.push(seg);
      this.drawSeg(seg, sx, barY, segW, barH, 0x00ffcc, true);
    }

    // ── Level-up flash ────────────────────────────────────────────────────
    this.levelUpContainer = new PIXI.Container();
    this.levelUpContainer.visible = false;
    layer.addChild(this.levelUpContainer);

    this.levelUpText = new PIXI.Text('', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 44, fontWeight: '900', fill: 0xffcc00,
      dropShadow: true, dropShadowColor: 0xffaa00, dropShadowBlur: 28, dropShadowDistance: 0,
    });
    this.levelUpText.anchor.set(0.5); this.levelUpText.position.set(W / 2, H / 2 - 24);
    this.levelUpContainer.addChild(this.levelUpText);

    const lvlSub = new PIXI.Text('things just got harder.', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 13, fill: 0x887755,
    });
    lvlSub.anchor.set(0.5); lvlSub.position.set(W / 2, H / 2 + 30);
    this.levelUpContainer.addChild(lvlSub);

    // ── Game Over ─────────────────────────────────────────────────────────
    this.goContainer = new PIXI.Container();
    this.goContainer.visible = false;
    layer.addChild(this.goContainer);

    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.78); overlay.drawRect(0, 0, W, H); overlay.endFill();
    this.goContainer.addChild(overlay);

    const goTitle = new PIXI.Text('YOU DIED', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 56, fontWeight: '900', fill: 0xff2244,
      dropShadow: true, dropShadowColor: 0xff0000, dropShadowBlur: 28, dropShadowDistance: 0,
    });
    goTitle.anchor.set(0.5); goTitle.position.set(W / 2, H / 2 - 80);
    this.goContainer.addChild(goTitle);

    this.finalScore = new PIXI.Text('', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 28, fill: 0xffffff,
    });
    this.finalScore.anchor.set(0.5); this.finalScore.position.set(W / 2, H / 2 - 10);
    this.goContainer.addChild(this.finalScore);

    this.finalLevel = new PIXI.Text('', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 16, fill: 0xffcc00,
    });
    this.finalLevel.anchor.set(0.5); this.finalLevel.position.set(W / 2, H / 2 + 28);
    this.goContainer.addChild(this.finalLevel);

    this.finalPercent = new PIXI.Text('', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 13, fill: 0x00ddff, letterSpacing: 1,
    });
    this.finalPercent.anchor.set(0.5); this.finalPercent.position.set(W / 2, H / 2 + 62);
    this.goContainer.addChild(this.finalPercent);

    const goSub = new PIXI.Text('returning to menu...', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 12, fill: 0x333344,
    });
    goSub.anchor.set(0.5); goSub.position.set(W / 2, H / 2 + 100);
    this.goContainer.addChild(goSub);

    const anyKey = new PIXI.Text('PRESS  ANY  KEY  TO  CONTINUE', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 11, fill: 0x00ffcc, letterSpacing: 3,
    });
    anyKey.anchor.set(0.5); anyKey.position.set(W / 2, H / 2 + 132);
    this.goContainer.addChild(anyKey);

    // Blink the "press any key" text whenever game-over is visible
    let bkt = 0;
    this.app.ticker.add((delta) => {
      if (!this.goContainer.visible) { bkt = 0; return; }
      bkt += delta / 60;
      anyKey.alpha = 0.25 + Math.abs(Math.sin(bkt * 2.6)) * 0.75;
    });

    // ── Level progress bar (very top of screen, full width) ───────────────
    this.progressRoot = new PIXI.Container();
    this.progressRoot.visible = false;
    layer.addChild(this.progressRoot);

    const pbBg = new PIXI.Graphics();
    pbBg.beginFill(0x001122, 0.55); pbBg.drawRect(0, 0, W, 6); pbBg.endFill();
    this.progressRoot.addChild(pbBg);

    this.progressFill = new PIXI.Graphics();
    this.progressRoot.addChild(this.progressFill);
  }

  // ── Boss bar helpers ──────────────────────────────────────────────────────

  private drawSeg(
    g: PIXI.Graphics, x: number, y: number, w: number, h: number,
    color: number, filled: boolean,
  ): void {
    g.clear();
    if (filled) {
      g.lineStyle(1, color, 0.7);
      g.beginFill(color, 0.85);
      g.drawRoundedRect(x, y, w, h, 2);
      g.endFill();
      // Inner bright stripe
      g.beginFill(0xffffff, 0.18);
      g.drawRoundedRect(x + 1, y + 1, w - 2, h / 3, 1);
      g.endFill();
    } else {
      g.lineStyle(1, 0x334455, 0.7);
      g.beginFill(0x050a0f, 0.7);
      g.drawRoundedRect(x, y, w, h, 2);
      g.endFill();
    }
  }

  // ── Hearts (retro pixel style) ────────────────────────────────────────────

  private renderHearts(lives: number): void {
    // 8-column × 6-row pixel-art heart template
    const shape = [
      [0,1,1,0,0,1,1,0],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,0,0],
      [0,0,0,1,1,0,0,0],
    ];
    const S = 3; // pixel block size
    const pw = shape[0].length * S; // 24
    const ph = shape.length    * S; // 18

    for (let i = 0; i < MAX_LIVES; i++) {
      const c      = this.heartContainers[i];
      const filled = i < lives;
      c.removeChildren();

      const g = new PIXI.Graphics();

      if (filled) {
        // Red glow behind heart
        g.beginFill(0xff2244, 0.22); g.drawCircle(0, 2, 18); g.endFill();

        // Red pixel heart
        g.beginFill(0xff2244, 1);
        for (let row = 0; row < shape.length; row++) {
          for (let col = 0; col < shape[row].length; col++) {
            if (shape[row][col]) {
              g.drawRect(col * S - pw / 2, row * S - ph / 2, S, S);
            }
          }
        }
        g.endFill();

        // Bright highlight pixels (top-left of each lobe)
        g.beginFill(0xff7799, 0.85);
        g.drawRect(1 * S - pw / 2, 0 * S - ph / 2, S, S);
        g.drawRect(2 * S - pw / 2, 0 * S - ph / 2, S, S);
        g.drawRect(5 * S - pw / 2, 0 * S - ph / 2, S, S);
        g.drawRect(6 * S - pw / 2, 0 * S - ph / 2, S, S);
        g.drawRect(0 * S - pw / 2, 1 * S - ph / 2, S, S);
        g.drawRect(4 * S - pw / 2, 1 * S - ph / 2, S, S);
        g.endFill();
      } else {
        // Dark sunken pixel heart
        g.beginFill(0x1a2233, 1);
        for (let row = 0; row < shape.length; row++) {
          for (let col = 0; col < shape[row].length; col++) {
            if (shape[row][col]) {
              g.drawRect(col * S - pw / 2, row * S - ph / 2, S, S);
            }
          }
        }
        g.endFill();
        // Dim border outline
        g.lineStyle(1, 0x334455, 0.6);
        g.drawRect(-pw / 2 - 1, -ph / 2 - 1, pw + 2, ph + 2);
        g.lineStyle(0);
      }

      c.addChild(g);
    }
  }

  setLives(n: number): void { this.renderHearts(n); }

  animateHeartGain(lives: number): void {
    this.renderHearts(lives);
    const c = this.heartContainers[lives - 1];
    if (!c) return;
    let t = 0;
    const anim = (delta: number) => {
      t += delta / 60;
      const s = 1 + Math.sin(t * 12) * 0.28;
      c.scale.set(s);
      if (t > 0.6) { c.scale.set(1); this.app.ticker.remove(anim); }
    };
    this.app.ticker.add(anim);
  }

  animateHeartLoss(lives: number): void {
    const c = this.heartContainers[lives];
    if (!c) return;
    let t = 0;
    const anim = (delta: number) => {
      t += delta / 60;
      c.alpha = 0.3 + Math.abs(Math.sin(t * 14)) * 0.7;
      if (t > 0.5) { c.alpha = 1; this.renderHearts(lives); this.app.ticker.remove(anim); }
    };
    this.app.ticker.add(anim);
  }

  // ── Boss bar ──────────────────────────────────────────────────────────────

  showBossBar(name: string, color: number): void {
    this.bossBarRoot.visible = true;
    this.bossNameText.text   = name;
    (this.bossNameText.style as any).fill = `#${color.toString(16).padStart(6, '0')}`;
    this.updateBossBar(1, color);
  }

  updateBossBar(ratio: number, color: number, phaseLabel = ''): void {
    const filled = Math.max(0, Math.min(SEG_COUNT, Math.ceil(ratio * SEG_COUNT)));
    const W   = this.app.screen.width;
    const barW = Math.min(440, W * 0.58);
    const segW = Math.floor((barW - (SEG_COUNT - 1) * 3) / SEG_COUNT);
    const barH = 18;
    const barX = W / 2 - barW / 2;
    const barY = 62;

    for (let i = 0; i < SEG_COUNT; i++) {
      const sx = barX + i * (segW + 3);
      this.drawSeg(this.bossSegs[i], sx, barY, segW, barH, color, i < filled);
    }
    this.bossPhaseText.text = phaseLabel;
  }

  hideBossBar(): void { this.bossBarRoot.visible = false; }

  // ── Boss Intro Cinematic ──────────────────────────────────────────────────
  /**
   * Shows a full-screen boss intro for ~6 seconds.
   * onComplete fires when the hold phase ends (fight is starting),
   * before the visual fade-out completes — so music switches seamlessly.
   */
  showBossIntro(name: string, color: number, onComplete: () => void): void {
    const W = this.app.screen.width, H = this.app.screen.height;

    const intro = new PIXI.Container();
    this.layer.addChild(intro);

    // Dark overlay
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0); overlay.drawRect(0, 0, W, H); overlay.endFill();
    intro.addChild(overlay);

    // Cinematic bars
    const barH = 70;
    const topBar = new PIXI.Graphics();
    topBar.beginFill(0x000000, 1); topBar.drawRect(0, 0, W, barH); topBar.endFill();
    intro.addChild(topBar);

    const botBar = new PIXI.Graphics();
    botBar.beginFill(0x000000, 1); botBar.drawRect(0, H - barH, W, barH); botBar.endFill();
    intro.addChild(botBar);

    // BOSS ENCOUNTER label
    const warnText = new PIXI.Text('B O S S  E N C O U N T E R', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 13, fill: 0x667788, letterSpacing: 5,
    });
    warnText.anchor.set(0.5); warnText.position.set(W / 2, H / 2 - 55); warnText.alpha = 0;
    intro.addChild(warnText);

    // Boss name
    const nameText = new PIXI.Text(name, {
      fontFamily: 'Orbitron, sans-serif', fontSize: 50, fontWeight: '900', fill: color,
      dropShadow: true, dropShadowColor: color, dropShadowBlur: 32, dropShadowDistance: 0,
      letterSpacing: 6,
    });
    nameText.anchor.set(0.5); nameText.position.set(W / 2, H / 2); nameText.alpha = 0;
    intro.addChild(nameText);

    // Decorative line
    const deco = new PIXI.Graphics();
    deco.lineStyle(1, color, 0.4);
    deco.moveTo(W / 2 - 160, H / 2 + 38);
    deco.lineTo(W / 2 + 160, H / 2 + 38);
    deco.alpha = 0;
    intro.addChild(deco);

    let phase: 'in' | 'hold' | 'out' = 'in';
    let elapsed = 0;
    let held    = 0;
    let completed = false;

    const anim = (delta: number) => {
      const dt = delta / 60;

      if (phase === 'in') {
        elapsed += dt;
        const p = Math.min(1, elapsed / 0.6);
        overlay.clear();
        overlay.beginFill(0x000000, p * 0.82); overlay.drawRect(0, 0, W, H); overlay.endFill();
        warnText.alpha = Math.max(0, (elapsed - 0.2) * 2.5);
        nameText.alpha = Math.max(0, (elapsed - 0.35) * 2.5);
        deco.alpha     = Math.max(0, (elapsed - 0.45) * 3);
        nameText.scale.set(0.88 + p * 0.12); // scale in
        if (elapsed >= 0.8) { phase = 'hold'; elapsed = 0; }

      } else if (phase === 'hold') {
        held += dt;
        // Gentle pulse on name
        nameText.scale.set(1 + Math.sin(held * 3.5) * 0.018);
        if (held >= 2.0 && !completed) {
          completed = true;
          onComplete(); // signal game: fight begins, switch music
        }
        if (held >= 2.2) { phase = 'out'; elapsed = 0; }

      } else {
        elapsed += dt;
        const p = Math.max(0, 1 - elapsed / 0.55);
        overlay.clear();
        overlay.beginFill(0x000000, p * 0.82); overlay.drawRect(0, 0, W, H); overlay.endFill();
        warnText.alpha = p;
        nameText.alpha = p;
        deco.alpha     = p;
        topBar.alpha   = p;
        botBar.alpha   = p;
        if (elapsed >= 0.6) {
          this.layer.removeChild(intro);
          intro.destroy({ children: true });
          this.app.ticker.remove(anim);
        }
      }
    };
    this.app.ticker.add(anim);
  }

  // ── Void Storm warning ────────────────────────────────────────────────────

  showVoidStormWarning(dir: string): void {
    const W = this.app.screen.width, H = this.app.screen.height;
    const warn = new PIXI.Text(`⚠  VOID STORM — ${dir.toUpperCase()}  ⚠`, {
      fontFamily: 'Orbitron, sans-serif', fontSize: 24, fontWeight: 'bold', fill: 0xff2222,
      dropShadow: true, dropShadowColor: 0xff0000, dropShadowBlur: 22, dropShadowDistance: 0,
    });
    warn.anchor.set(0.5); warn.position.set(W / 2, H * 0.38);
    this.layer.addChild(warn);
    let t = 0;
    const anim = (delta: number) => {
      t += delta / 60;
      warn.alpha = 0.4 + Math.abs(Math.sin(t * 7)) * 0.6;
      if (t > 2.2) { this.layer.removeChild(warn); warn.destroy(); this.app.ticker.remove(anim); }
    };
    this.app.ticker.add(anim);
  }

  // ── Round-start 3-2-1 countdown ──────────────────────────────────────────
  showRoundStart(level: number, onComplete: () => void): void {
    const W = this.app.screen.width, H = this.app.screen.height;

    const c = new PIXI.Container();
    this.layer.addChild(c);

    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.55); overlay.drawRect(0, 0, W, H); overlay.endFill();
    c.addChild(overlay);

    const roundLabel = new PIXI.Text(`ROUND  ${level}`, {
      fontFamily: 'Orbitron, sans-serif', fontSize: 36, fontWeight: '900', fill: 0xffcc00,
      dropShadow: true, dropShadowColor: 0xffaa00, dropShadowBlur: 22, dropShadowDistance: 0,
    });
    roundLabel.anchor.set(0.5); roundLabel.position.set(W / 2, H / 2 - 55); roundLabel.alpha = 0;
    c.addChild(roundLabel);

    const countText = new PIXI.Text('3', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 88, fontWeight: '900', fill: 0xffffff,
      dropShadow: true, dropShadowColor: 0x00ffcc, dropShadowBlur: 30, dropShadowDistance: 0,
    });
    countText.anchor.set(0.5); countText.position.set(W / 2, H / 2 + 10);
    c.addChild(countText);

    const subText = new PIXI.Text('get ready', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 13, fill: 0x556677,
    });
    subText.anchor.set(0.5); subText.position.set(W / 2, H / 2 + 72);
    c.addChild(subText);

    let elapsed = 0;
    let count   = 3;
    let completed = false;

    const anim = (delta: number) => {
      const dt = delta / 60;
      elapsed += dt;

      // Fade in during first 0.4s
      const fadeIn = Math.min(1, elapsed / 0.4);
      overlay.alpha    = fadeIn * 0.55;
      roundLabel.alpha = fadeIn;

      // Countdown ticks
      const tick = Math.floor(elapsed);
      if (tick < 3) {
        const newCount = 3 - tick;
        if (newCount !== count) {
          count = newCount;
          countText.text = String(count);
          countText.scale.set(1.4); // pop scale
        }
        // Scale lerp back to 1
        countText.scale.set(Math.max(1, countText.scale.x - delta * 0.04));
        countText.alpha = 1;

        // Color per number
        const colors = [0, 0xff4444, 0xffaa00, 0x00ffcc];
        (countText.style as any).fill = `#${colors[count].toString(16).padStart(6, '0')}`;

      } else if (!completed) {
        completed = true;
        countText.text = 'GO!';
        countText.scale.set(1.6);
        (countText.style as any).fill = '#00ffcc';
        onComplete();
      }

      // Fade out after 3.3s
      if (elapsed > 3.3) {
        const fo = Math.max(0, 1 - (elapsed - 3.3) / 0.4);
        c.alpha = fo;
        if (fo <= 0) {
          this.layer.removeChild(c);
          c.destroy({ children: true });
          this.app.ticker.remove(anim);
        }
      }
    };
    this.app.ticker.add(anim);
  }

  // ── Level progress bar ────────────────────────────────────────────────────

  showProgressBar(): void {
    this.progressRoot.visible = true;
    this.updateProgressBar(0);
  }

  updateProgressBar(ratio: number): void {
    const W = this.app.screen.width;
    const r = Math.max(0, Math.min(1, ratio));
    this.progressFill.clear();
    if (r > 0.001) {
      this.progressFill.beginFill(0x00ff88, 0.88);
      this.progressFill.drawRect(0, 0, W * r, 6);
      this.progressFill.endFill();
      // Bright leading-edge glow
      this.progressFill.beginFill(0xaaffdd, 0.9);
      this.progressFill.drawRect(W * r - 5, 0, 5, 6);
      this.progressFill.endFill();
    }
  }

  hideProgressBar(): void {
    this.progressRoot.visible = false;
  }

  // ── Score / Level ─────────────────────────────────────────────────────────

  setScore(n: number): void {
    this.scoreText.text = String(n);
    this.scoreText.position.x = this.app.screen.width - 18;
  }

  setLevel(n: number): void { this.levelNum.text = String(n); }

  // ── Level-up banner ───────────────────────────────────────────────────────

  showLevelUp(level: number): void {
    this.levelUpText.text         = `LEVEL  ${level}`;
    this.levelUpContainer.visible = true;
    this.levelUpContainer.alpha   = 0;

    let phase: 'in' | 'hold' | 'out' = 'in'; let held = 0;
    const anim = (delta: number) => {
      const dt = delta / 60;
      if (phase === 'in')        { this.levelUpContainer.alpha += dt * 3.5; if (this.levelUpContainer.alpha >= 1) { this.levelUpContainer.alpha = 1; phase = 'hold'; } }
      else if (phase === 'hold') { held += dt; if (held >= 1.2) phase = 'out'; }
      else                       { this.levelUpContainer.alpha -= dt * 2; if (this.levelUpContainer.alpha <= 0) { this.levelUpContainer.visible = false; this.app.ticker.remove(anim); } }
    };
    this.app.ticker.add(anim);
  }

  // ── Game Over ─────────────────────────────────────────────────────────────

  showGameOver(score: number, level: number): void {
    this.finalScore.text   = `SCORE  ${score}`;
    this.finalLevel.text   = `REACHED  LEVEL  ${level}`;
    const pct              = Math.min(99, Math.round((level / 15) * 100));
    this.finalPercent.text = `${pct}%  OF  THE  VOID  CONQUERED`;
    this.goContainer.visible = true;
    this.goContainer.alpha   = 0;
    const fade = (delta: number) => {
      this.goContainer.alpha += (delta / 60) * 3;
      if (this.goContainer.alpha >= 1) { this.goContainer.alpha = 1; this.app.ticker.remove(fade); }
    };
    this.app.ticker.add(fade);
  }

  hideGameOver(): void { this.goContainer.visible = false; this.goContainer.alpha = 0; }

  // ── Victory screen ────────────────────────────────────────────────────────

  showVictory(score: number): void {
    if (this.victoryRoot) return;
    const W = this.app.screen.width, H = this.app.screen.height;

    const root = new PIXI.Container();
    this.victoryRoot = root;
    this.layer.addChild(root);

    // Dark overlay
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000008, 0.88); overlay.drawRect(0, 0, W, H); overlay.endFill();
    root.addChild(overlay);

    // Title
    const title = new PIXI.Text('VOID  CONQUERED', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 52, fontWeight: '900', fill: 0xffcc00,
      dropShadow: true, dropShadowColor: 0xffaa00, dropShadowBlur: 36, dropShadowDistance: 0,
      letterSpacing: 4,
    });
    title.anchor.set(0.5); title.position.set(W / 2, H / 2 - 95);
    root.addChild(title);

    // Subtitle
    const sub = new PIXI.Text('MISSION  COMPLETE', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 14, fill: 0x00ffcc, letterSpacing: 6,
    });
    sub.anchor.set(0.5); sub.position.set(W / 2, H / 2 - 44);
    root.addChild(sub);

    // Decorative line
    const line = new PIXI.Graphics();
    line.lineStyle(1, 0xffcc00, 0.3);
    line.moveTo(W / 2 - 160, H / 2 - 22); line.lineTo(W / 2 + 160, H / 2 - 22);
    root.addChild(line);

    // Score
    const scoreText = new PIXI.Text(`FINAL  SCORE   ${score}`, {
      fontFamily: 'Orbitron, sans-serif', fontSize: 26, fill: 0xffffff,
    });
    scoreText.anchor.set(0.5); scoreText.position.set(W / 2, H / 2 + 12);
    root.addChild(scoreText);

    // Level cleared
    const cleared = new PIXI.Text('LEVEL  15  CLEARED', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 15, fill: 0xffcc00, letterSpacing: 2,
    });
    cleared.anchor.set(0.5); cleared.position.set(W / 2, H / 2 + 52);
    root.addChild(cleared);

    // 100%
    const pct = new PIXI.Text('100%  OF  THE  VOID  CONQUERED', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 13, fill: 0x00ddff, letterSpacing: 1,
    });
    pct.anchor.set(0.5); pct.position.set(W / 2, H / 2 + 84);
    root.addChild(pct);

    // Returning hint
    const goSub = new PIXI.Text('returning to menu...', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 12, fill: 0x333344,
    });
    goSub.anchor.set(0.5); goSub.position.set(W / 2, H / 2 + 118);
    root.addChild(goSub);

    // Press any key
    const anyKey = new PIXI.Text('PRESS  ANY  KEY  TO  CONTINUE', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 11, fill: 0xffcc00, letterSpacing: 3,
    });
    anyKey.anchor.set(0.5); anyKey.position.set(W / 2, H / 2 + 148);
    root.addChild(anyKey);

    // Fade in
    root.alpha = 0;
    const fade = (delta: number) => {
      root.alpha += (delta / 60) * 2.5;
      if (root.alpha >= 1) { root.alpha = 1; this.app.ticker.remove(fade); }
    };
    this.app.ticker.add(fade);

    // Blink the any-key text
    let bkt = 0;
    this.app.ticker.add((delta) => {
      if (!this.victoryRoot) { return; }
      bkt += delta / 60;
      anyKey.alpha = 0.25 + Math.abs(Math.sin(bkt * 2.4)) * 0.75;
    });

    // Pulse the title
    let pt = 0;
    this.app.ticker.add((delta) => {
      if (!this.victoryRoot) { return; }
      pt += delta / 60;
      title.alpha = 0.82 + Math.sin(pt * 1.8) * 0.18;
    });
  }

  hideVictory(): void {
    if (this.victoryRoot) {
      this.layer.removeChild(this.victoryRoot);
      this.victoryRoot.destroy({ children: true });
      this.victoryRoot = null;
    }
  }

  // ── Pause menu ────────────────────────────────────────────────────────────

  showPauseMenu(
    isMuted:       boolean,
    score:         number,
    level:         number,
    onResume:      () => void,
    onToggleSound: () => void,
    onQuit:        () => void,
  ): void {
    if (this.pauseRoot) return;

    const W = this.app.screen.width, H = this.app.screen.height;
    const root = new PIXI.Container();
    this.pauseRoot = root;
    this.layer.addChild(root);

    // Dark overlay
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000008, 0.80); overlay.drawRect(0, 0, W, H); overlay.endFill();
    root.addChild(overlay);

    // Panel
    const pW = 360, pH = 320;
    const panel = new PIXI.Graphics();
    panel.lineStyle(1, 0x00ffcc, 0.28);
    panel.beginFill(0x000d18, 0.96);
    panel.drawRoundedRect(W / 2 - pW / 2, H / 2 - pH / 2, pW, pH, 10);
    panel.endFill();
    root.addChild(panel);

    // Title
    const title = new PIXI.Text('PAUSED', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 38, fontWeight: '900', fill: 0x00ffcc,
      dropShadow: true, dropShadowColor: 0x00ffcc, dropShadowBlur: 22, dropShadowDistance: 0,
    });
    title.anchor.set(0.5); title.position.set(W / 2, H / 2 - 118);
    root.addChild(title);

    // Score / level info
    const info = new PIXI.Text(`SCORE  ${score}   ·   LEVEL  ${level}`, {
      fontFamily: 'Orbitron, sans-serif', fontSize: 11, fill: 0x335544, letterSpacing: 2,
    });
    info.anchor.set(0.5); info.position.set(W / 2, H / 2 - 76);
    root.addChild(info);

    // Divider
    const div = new PIXI.Graphics();
    div.lineStyle(1, 0x00ffcc, 0.18);
    div.moveTo(W / 2 - 130, H / 2 - 58);
    div.lineTo(W / 2 + 130, H / 2 - 58);
    root.addChild(div);

    // Button helper
    const makeBtn = (label: string, y: number, cb: () => void): PIXI.Text => {
      const t = new PIXI.Text(label, {
        fontFamily: 'Orbitron, sans-serif', fontSize: 20, fill: 0x8899aa,
      });
      t.anchor.set(0.5); t.position.set(W / 2, y);
      t.interactive = true; t.cursor = 'pointer';
      t.on('pointerover', () => { (t.style as any).fill = '#00ffcc'; t.scale.set(1.07); });
      t.on('pointerout',  () => { (t.style as any).fill = '#8899aa'; t.scale.set(1); });
      t.on('pointerdown', cb);
      root.addChild(t);
      return t;
    };

    makeBtn('RESUME MISSION', H / 2 - 22, onResume);

    this.pauseSoundLabel = makeBtn(
      isMuted ? 'SOUND:  OFF' : 'SOUND:  ON',
      H / 2 + 34,
      onToggleSound,
    );

    makeBtn('ABANDON SHIP', H / 2 + 90, onQuit);

    // ESC hint
    const hint = new PIXI.Text('ESC  ·  resume', {
      fontFamily: 'Orbitron, sans-serif', fontSize: 10, fill: 0x1e2e3e, letterSpacing: 4,
    });
    hint.anchor.set(0.5); hint.position.set(W / 2, H / 2 + 138);
    root.addChild(hint);
  }

  updatePauseSoundLabel(isMuted: boolean): void {
    if (this.pauseSoundLabel) {
      this.pauseSoundLabel.text = isMuted ? 'SOUND:  OFF' : 'SOUND:  ON';
    }
  }

  hidePauseMenu(): void {
    if (this.pauseRoot) {
      this.layer.removeChild(this.pauseRoot);
      this.pauseRoot.destroy({ children: true });
      this.pauseRoot = null;
      this.pauseSoundLabel = null;
    }
  }
}
