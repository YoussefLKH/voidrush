// ─── Audio Manager ────────────────────────────────────────────────────────────
// MP3 files are loaded from /assets/audio/*.mp3
// Falls back to Web Audio API synthesis if files are not ready.

class AudioManager {
  private ctx:    AudioContext | null = null;
  private master: GainNode    | null = null;
  private sfx = new Map<string, AudioBuffer>();

  // Current music state
  private musicSource: AudioBufferSourceNode | null = null;
  private musicGain:   GainNode              | null = null;

  muted = false;

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx   = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  // ── Preload all 13 MP3s ───────────────────────────────────────────────────
  async preloadAll(): Promise<void> {
    const files = [
      'BGM', 'BOSS_1_THEME', 'BOSS_2_THEME', 'BOSS_3_THEME',
      'BOSS_ENTRANCE', 'BOSS_HIT', 'ENEMY_HIT', 'GAME_OVER',
      'LASER_BEAM', 'LEVEL_UP', 'LIFE_GAINED', 'PLAYER_HIT', 'VOID_STORM',
    ];
    const ctx = this.getCtx();
    await Promise.all(files.map(async (name) => {
      try {
        const res = await fetch(`/assets/audio/${name}.mp3`);
        if (!res.ok) return;
        const arr = await res.arrayBuffer();
        this.sfx.set(name, await ctx.decodeAudioData(arr));
      } catch { /* file not ready — synth fallback will be used */ }
    }));
  }

  // ── Generic SFX playback ──────────────────────────────────────────────────
  playSFX(name: string, vol = 0.8): void {
    const buf = this.sfx.get(name);
    if (!buf || this.muted) return;
    const ctx  = this.getCtx();
    const src  = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer      = buf;
    gain.gain.value = vol;
    src.connect(gain);
    gain.connect(this.master!);
    src.start();
  }

  // ── Music system ──────────────────────────────────────────────────────────
  private playMusic(name: string, loop = true, vol = 0.45): void {
    const buf = this.sfx.get(name);
    this.stopMusic();
    if (!buf || this.muted) return;
    const ctx       = this.getCtx();
    this.musicGain  = ctx.createGain();
    this.musicGain.gain.value = vol;
    this.musicGain.connect(this.master!);
    this.musicSource        = ctx.createBufferSource();
    this.musicSource.buffer = buf;
    this.musicSource.loop   = loop;
    this.musicSource.connect(this.musicGain);
    this.musicSource.start();
  }

  stopMusic(): void {
    try { this.musicSource?.stop(); } catch {}
    this.musicSource = null;
    this.musicGain   = null;
  }

  playBGM(): void            { this.playMusic('BGM',           true,  0.45); }
  playBossEntrance(): void   { this.playMusic('BOSS_ENTRANCE',  false, 0.60); }
  playBossTheme(n: 1|2|3): void { this.playMusic(`BOSS_${n}_THEME`, true, 0.55); }

  /** Stop boss music and restart BGM after a short pause. */
  stopBossFight(): void {
    this.stopMusic();
    setTimeout(() => this.playBGM(), 600);
  }

  // ── Procedural SFX — MP3-first, synth fallback ────────────────────────────

  shoot(): void {
    if (this.muted) return;
    if (this.sfx.has('LASER_BEAM')) { this.playSFX('LASER_BEAM', 0.55); return; }
    const ctx = this.getCtx(), t = ctx.currentTime;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(920, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.09);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.start(t); osc.stop(t + 0.09);
  }

  enemyHit(): void {
    if (this.muted) return;
    if (this.sfx.has('ENEMY_HIT')) { this.playSFX('ENEMY_HIT', 0.5); return; }
    const ctx = this.getCtx(), t = ctx.currentTime;
    const buf  = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = 900;
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.28, t); src.start(t);
  }

  enemyDeath(): void {
    if (this.muted) return;
    if (this.sfx.has('ENEMY_HIT')) { this.playSFX('ENEMY_HIT', 0.7); return; }
    const ctx = this.getCtx(), t = ctx.currentTime;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.22);
    g.gain.setValueAtTime(0.38, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.start(t); osc.stop(t + 0.22);
  }

  playerHit(): void {
    if (this.muted) return;
    if (this.sfx.has('PLAYER_HIT')) { this.playSFX('PLAYER_HIT', 0.75); return; }
    const ctx = this.getCtx(), t = ctx.currentTime;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.35);
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t); osc.stop(t + 0.35);
  }

  levelUp(): void {
    if (this.muted) return;
    if (this.sfx.has('LEVEL_UP')) { this.playSFX('LEVEL_UP', 0.7); return; }
    const ctx = this.getCtx(), t = ctx.currentTime;
    [380, 480, 600, 800].forEach((freq, i) => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = freq;
      const s = t + i * 0.075;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.28, s + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.45);
      osc.start(s); osc.stop(s + 0.45);
    });
  }

  bossRoar(): void {
    if (this.muted) return;
    if (this.sfx.has('BOSS_ENTRANCE')) { this.playSFX('BOSS_ENTRANCE', 0.7); return; }
    const ctx = this.getCtx(), t = ctx.currentTime;
    const osc = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    osc.connect(f); f.connect(g); g.connect(ctx.destination);
    osc.type = 'sawtooth'; f.type = 'lowpass';
    f.frequency.setValueAtTime(2200, t); f.frequency.exponentialRampToValueAtTime(80, t + 1.8);
    osc.frequency.setValueAtTime(90, t); osc.frequency.exponentialRampToValueAtTime(35, t + 1.8);
    g.gain.setValueAtTime(0.65, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    osc.start(t); osc.stop(t + 1.8);
  }

  bossHit(): void {
    if (this.muted) return;
    if (this.sfx.has('BOSS_HIT')) { this.playSFX('BOSS_HIT', 0.6); return; }
    const ctx = this.getCtx(), t = ctx.currentTime;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, t); osc.frequency.exponentialRampToValueAtTime(75, t + 0.18);
    g.gain.setValueAtTime(0.42, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.start(t); osc.stop(t + 0.18);
  }

  bossPhaseChange(): void {
    if (this.muted) return;
    const ctx = this.getCtx(), t = ctx.currentTime;
    [200, 150, 100, 80, 60].forEach((freq, i) => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sawtooth'; osc.frequency.value = freq;
      const s = t + i * 0.1;
      g.gain.setValueAtTime(0.5, s); g.gain.exponentialRampToValueAtTime(0.001, s + 0.25);
      osc.start(s); osc.stop(s + 0.25);
    });
  }

  heartGain(): void {
    if (this.muted) return;
    if (this.sfx.has('LIFE_GAINED')) { this.playSFX('LIFE_GAINED', 0.7); return; }
    const ctx = this.getCtx(), t = ctx.currentTime;
    [550, 720, 920].forEach((freq, i) => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = freq;
      const s = t + i * 0.07;
      g.gain.setValueAtTime(0.25, s); g.gain.exponentialRampToValueAtTime(0.001, s + 0.25);
      osc.start(s); osc.stop(s + 0.25);
    });
  }

  voidStormWarning(): void {
    if (this.muted) return;
    if (this.sfx.has('VOID_STORM')) { this.playSFX('VOID_STORM', 0.75); return; }
    const ctx = this.getCtx(), t = ctx.currentTime;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.linearRampToValueAtTime(580, t + 0.3);
    osc.frequency.linearRampToValueAtTime(280, t + 0.6);
    osc.frequency.linearRampToValueAtTime(580, t + 0.9);
    g.gain.setValueAtTime(0.42, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    osc.start(t); osc.stop(t + 1.1);
  }

  shieldPickup(): void {
    if (this.muted) return;
    const ctx = this.getCtx(), t = ctx.currentTime;
    [600, 800, 1050, 1400].forEach((freq, i) => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(this.master!);
      osc.type = 'sine'; osc.frequency.value = freq;
      const s = t + i * 0.055;
      g.gain.setValueAtTime(0.18, s); g.gain.exponentialRampToValueAtTime(0.001, s + 0.22);
      osc.start(s); osc.stop(s + 0.22);
    });
  }

  shieldPop(): void {
    if (this.muted) return;
    const ctx = this.getCtx(), t = ctx.currentTime;
    // Deep thud
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(this.master!);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.22);
    g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.start(t); osc.stop(t + 0.25);
    // High shimmer
    const osc2 = ctx.createOscillator(), g2 = ctx.createGain();
    osc2.connect(g2); g2.connect(this.master!);
    osc2.type = 'sine'; osc2.frequency.value = 1600;
    g2.gain.setValueAtTime(0.28, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    osc2.start(t); osc2.stop(t + 0.38);
  }

  gameOver(): void {
    if (this.muted) return;
    if (this.sfx.has('GAME_OVER')) { this.playSFX('GAME_OVER', 0.7); return; }
    const ctx = this.getCtx(), t = ctx.currentTime;
    [380, 280, 190, 140].forEach((freq, i) => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = freq;
      const s = t + i * 0.18;
      g.gain.setValueAtTime(0.3, s); g.gain.exponentialRampToValueAtTime(0.001, s + 0.5);
      osc.start(s); osc.stop(s + 0.5);
    });
  }
}

export const audio = new AudioManager();
