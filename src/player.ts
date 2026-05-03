import * as PIXI from 'pixi.js';
import { settings, SHIP_COLORS, ShipVariant } from './settings';

// ─── Standalone draw helper (also used by the Settings preview) ───────────────
export function drawShipShape(
  shipGfx: PIXI.Graphics,
  glowGfx: PIXI.Graphics,
  variant: ShipVariant,
  scale = 1,
): void {
  const color = SHIP_COLORS[variant];
  const s     = scale;

  // Glow rings
  glowGfx.clear();
  glowGfx.beginFill(color, 0.08); glowGfx.drawCircle(0, 0, 32 * s); glowGfx.endFill();
  glowGfx.beginFill(color, 0.18); glowGfx.drawCircle(0, 0, 20 * s); glowGfx.endFill();

  // Ship body
  shipGfx.clear();
  shipGfx.lineStyle(1.5, color, 1);
  shipGfx.beginFill(0x001a2e, 0.95);

  switch (variant) {
    case 0: // ARROW — narrow arrowhead
      shipGfx.moveTo(0,         -15 * s);
      shipGfx.lineTo( 11 * s,    8  * s);
      shipGfx.lineTo(  4 * s,    4  * s);
      shipGfx.lineTo(0,          10 * s);
      shipGfx.lineTo( -4 * s,    4  * s);
      shipGfx.lineTo(-11 * s,    8  * s);
      break;

    case 1: // DIAMOND — hexagonal teardrop
      shipGfx.moveTo(0,         -16 * s);
      shipGfx.lineTo( 10 * s,    2  * s);
      shipGfx.lineTo(  6 * s,   10  * s);
      shipGfx.lineTo(0,          14 * s);
      shipGfx.lineTo( -6 * s,   10  * s);
      shipGfx.lineTo(-10 * s,    2  * s);
      break;

    case 2: // WEDGE — wide manta-ray
      shipGfx.moveTo(0,          -8  * s);
      shipGfx.lineTo( 16 * s,     8  * s);
      shipGfx.lineTo(  6 * s,    12  * s);
      shipGfx.lineTo(0,          10  * s);
      shipGfx.lineTo( -6 * s,    12  * s);
      shipGfx.lineTo(-16 * s,     8  * s);
      break;

    case 3: // VIPER — sleek swept-wing fighter
      shipGfx.moveTo(0,          -18 * s);
      shipGfx.lineTo(  6 * s,    -6  * s);
      shipGfx.lineTo( 14 * s,     6  * s);
      shipGfx.lineTo(  4 * s,     8  * s);
      shipGfx.lineTo(0,           14 * s);
      shipGfx.lineTo( -4 * s,     8  * s);
      shipGfx.lineTo(-14 * s,     6  * s);
      shipGfx.lineTo( -6 * s,    -6  * s);
      break;
  }

  shipGfx.closePath();
  shipGfx.endFill();

  // Cockpit dot
  shipGfx.lineStyle(0);
  shipGfx.beginFill(color, 0.9);
  shipGfx.drawCircle(0, -3 * s, 2.5 * s);
  shipGfx.endFill();

  // Engine glow
  shipGfx.beginFill(0x0088ff, 0.6);
  shipGfx.drawCircle(0, 9 * s, 2 * s);
  shipGfx.endFill();
}

// ─── Player ───────────────────────────────────────────────────────────────────

export class Player {
  private app:       PIXI.Application;
  private container: PIXI.Container;
  private shipGfx:   PIXI.Graphics;
  private glowGfx:   PIXI.Graphics;

  public  x:       number;
  public  y:       number;
  public  readonly radius = 12;

  /** Angle (radians) the ship is currently facing. Default = up (-π/2). */
  public facingAngle = -Math.PI / 2;

  private speed = 320;
  private keys  = new Set<string>();
  private time  = 0;

  constructor(app: PIXI.Application, layer: PIXI.Container) {
    this.app = app;
    this.x   = app.screen.width  / 2;
    this.y   = app.screen.height / 2;

    this.container = new PIXI.Container();
    this.glowGfx   = new PIXI.Graphics();
    this.shipGfx   = new PIXI.Graphics();
    this.container.addChild(this.glowGfx, this.shipGfx);
    layer.addChild(this.container);

    this.redraw();
    this.bindInput();
    this.container.position.set(this.x, this.y);
    // Start facing up
    this.container.rotation = this.facingAngle + Math.PI / 2;
  }

  /** Re-draw when the ship variant changes in Settings. */
  redraw(): void {
    drawShipShape(this.shipGfx, this.glowGfx, settings.ship);
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  private bindInput(): void {
    window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener('keyup',   (e) => this.keys.delete(e.key.toLowerCase()));
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(dt: number): void {
    this.time += dt;
    const W = this.app.screen.width;
    const H = this.app.screen.height;

    let dx = 0, dy = 0;
    if (this.keys.has('w') || this.keys.has('arrowup'))    dy -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown'))  dy += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft'))  dx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      this.x += (dx / len) * this.speed * settings.speedMult * dt;
      this.y += (dy / len) * this.speed * settings.speedMult * dt;
      // Update facing angle based on movement direction
      this.facingAngle = Math.atan2(dy, dx);
      // Visual rotation: atan2 gives right=0, but ship model points up → add π/2 offset
      this.container.rotation = this.facingAngle + Math.PI / 2;
    }

    // Clamp to screen
    const pad = this.radius + 5;
    this.x = Math.max(pad, Math.min(W - pad, this.x));
    this.y = Math.max(pad, Math.min(H - pad, this.y));
    this.container.position.set(this.x, this.y);

    // Pulse glow
    this.glowGfx.alpha = 0.75 + Math.sin(this.time * 4.5) * 0.25;
  }

  reset(): void {
    this.x = this.app.screen.width  / 2;
    this.y = this.app.screen.height / 2;
    this.facingAngle = -Math.PI / 2; // face up
    this.container.position.set(this.x, this.y);
    this.container.rotation = this.facingAngle + Math.PI / 2;
    this.redraw();
  }
}
