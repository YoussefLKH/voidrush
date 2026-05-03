// ─── Settings Singleton ───────────────────────────────────────────────────────
// Persists to localStorage. Import `settings` anywhere to read/write.

export type SpeedOption  = 'slow' | 'normal' | 'fast';
export type ShipVariant  = 0 | 1 | 2 | 3;

export const SPEED_MULTIPLIERS: Record<SpeedOption, number> = {
  slow:   0.65,
  normal: 1.00,
  fast:   1.50,
};

export const SHIP_NAMES   = ['ARROW', 'DIAMOND', 'WEDGE', 'VIPER'] as const;
export const SHIP_COLORS: Record<ShipVariant, number> = {
  0: 0x00ffff,   // cyan
  1: 0x4499ff,   // blue
  2: 0x00ff88,   // green
  3: 0xdd44ff,   // purple
};

interface ISettings {
  speed: SpeedOption;
  ship:  ShipVariant;
}

const DEFAULTS: ISettings = { speed: 'normal', ship: 0 };
const LS_KEY = 'voidrush_v1';

class SettingsStore {
  private _speed: SpeedOption;
  private _ship:  ShipVariant;

  constructor() {
    const d = this.load();
    this._speed = d.speed;
    this._ship  = d.ship;
  }

  private load(): ISettings {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {}
    return { ...DEFAULTS };
  }

  private save(): void {
    localStorage.setItem(LS_KEY, JSON.stringify({ speed: this._speed, ship: this._ship }));
  }

  // ── Getters ──────────────────────────────────────────────────────────────
  get speed():      SpeedOption  { return this._speed; }
  get ship():       ShipVariant  { return this._ship;  }
  get speedMult():  number       { return SPEED_MULTIPLIERS[this._speed]; }
  get shipColor():  number       { return SHIP_COLORS[this._ship]; }

  // ── Setters ──────────────────────────────────────────────────────────────
  setSpeed(v: SpeedOption): void { this._speed = v; this.save(); }
  setShip(v: ShipVariant):  void { this._ship  = v; this.save(); }
  cycleShip(dir: 1 | -1):   void {
    this._ship = ((this._ship + dir + 4) % 4) as ShipVariant;
    this.save();
  }
}

export const settings = new SettingsStore();
