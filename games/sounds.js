/* BearSound — маленькая звуковая библиотека на WebAudio без файлов.
   Умеет: звуки событий (клик, pop, match, win, lose), 8-bit фоновую музыку. */
(function () {
  const Sound = {
    ctx: null,
    sfxEnabled: true,
    musicEnabled: true,
    musicTimer: null,
    _noteIdx: 0,

    _ctx() {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },

    _tone(freq, duration, type = 'sine', vol = 0.2, attack = 0.01) {
      if (!this.sfxEnabled) return;
      try {
        const ctx = this._ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + attack);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration + 0.02);
      } catch (e) { /* ignore */ }
    },

    /* — звуки — */
    click() { this._tone(720, 0.06, 'square', 0.15); },
    tap()   { this._tone(1200, 0.05, 'square', 0.12); },
    move()  { this._tone(440, 0.05, 'triangle', 0.1); },
    pop()   {
      // Весёлый бабах — короткий высокий тон + шум
      const f = 500 + Math.random() * 400;
      this._tone(f, 0.08, 'triangle', 0.22);
      setTimeout(() => this._tone(f * 2, 0.04, 'sine', 0.15), 30);
    },
    eat()   {
      this._tone(600, 0.08, 'square', 0.18);
      setTimeout(() => this._tone(900, 0.1, 'square', 0.18), 60);
    },
    match() {
      [523, 659, 784].forEach((f, i) => setTimeout(() => this._tone(f, 0.1, 'square', 0.18), i * 80));
    },
    win() {
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((f, i) => setTimeout(() => this._tone(f, 0.18, 'square', 0.22), i * 130));
    },
    lose() {
      this._tone(300, 0.15, 'sawtooth', 0.25);
      setTimeout(() => this._tone(220, 0.2, 'sawtooth', 0.25), 160);
      setTimeout(() => this._tone(160, 0.3, 'sawtooth', 0.28), 340);
    },
    blocked() {
      this._tone(180, 0.08, 'sawtooth', 0.18);
    },

    /* — фоновая музыка — весёлая 8-bit мелодия в цикле — */
    _melody: [
      // C-мажор, весёлая гоночная мелодия
      [523, 0.2], [659, 0.2], [784, 0.2], [659, 0.2],
      [523, 0.2], [659, 0.2], [784, 0.4],
      [880, 0.2], [784, 0.2], [659, 0.2], [523, 0.4],
      [784, 0.2], [659, 0.2], [523, 0.2], [392, 0.4],
      [523, 0.2], [659, 0.2], [784, 0.2], [1047, 0.2],
      [784, 0.2], [659, 0.2], [523, 0.4],
    ],

    startMusic() {
      if (this.musicTimer) return;
      if (!this.musicEnabled) return;
      this._noteIdx = 0;
      const playNext = () => {
        if (!this.musicEnabled) { this.musicTimer = null; return; }
        const [freq, dur] = this._melody[this._noteIdx % this._melody.length];
        // тихая мелодия чтобы не мешала
        try {
          const ctx = this._ctx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur * 0.9);
          osc.connect(gain).connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + dur);
        } catch (e) { /* ignore */ }
        this._noteIdx++;
        this.musicTimer = setTimeout(playNext, dur * 1000 + 30);
      };
      playNext();
    },
    stopMusic() {
      if (this.musicTimer) clearTimeout(this.musicTimer);
      this.musicTimer = null;
    },

    /* — переключатели — */
    toggleSfx() {
      this.sfxEnabled = !this.sfxEnabled;
      localStorage.setItem('bear_sfx', this.sfxEnabled ? '1' : '0');
      return this.sfxEnabled;
    },
    toggleMusic() {
      this.musicEnabled = !this.musicEnabled;
      localStorage.setItem('bear_music', this.musicEnabled ? '1' : '0');
      if (this.musicEnabled) this.startMusic();
      else this.stopMusic();
      return this.musicEnabled;
    },

    init() {
      const sfx = localStorage.getItem('bear_sfx');
      const mus = localStorage.getItem('bear_music');
      if (sfx === '0') this.sfxEnabled = false;
      if (mus === '0') this.musicEnabled = false;
      // Браузеры блокируют autoplay — запустим музыку на первой интеракции
      const resume = () => {
        this._ctx(); // создать контекст
        if (this.musicEnabled) this.startMusic();
        document.removeEventListener('click', resume);
        document.removeEventListener('touchstart', resume);
        document.removeEventListener('keydown', resume);
      };
      document.addEventListener('click', resume, { once: true });
      document.addEventListener('touchstart', resume, { once: true });
      document.addEventListener('keydown', resume, { once: true });
    },
  };

  Sound.init();
  window.BearSound = Sound;
})();
