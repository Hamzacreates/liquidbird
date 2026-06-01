import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Pause, Play, RotateCcw, Settings2, Volume2, VolumeX, X, Sparkles, Trophy, Zap, Maximize2, Minimize2, Wifi, WifiOff, Keyboard, Target, Flame, Award, Clock, Activity, Gauge, Download, Shield } from "lucide-react";

// ---------- World ----------
const WORLD_W = 480;
const WORLD_H = 720;
const BIRD_R = 18;
const BIRD_X = WORLD_W * 0.3;
const GROUND_H = 80;
const MAX_FALL = 900;

type Difficulty = "easy" | "chill" | "normal" | "hard" | "insane" | "nightmare";
type ThemeKey = "aurora" | "sunset" | "mint" | "noir" | "ember" | "ocean" | "candy" | "forest";
type BirdStyle = "classic" | "geo" | "prism" | "drop";
type TrailStyle = "sparkle" | "ribbon" | "smoke" | "none";
type Phase = "ready" | "playing" | "paused" | "dead";

const DIFFICULTY: Record<Difficulty, { gravity: number; flap: number; speed: number; gap: number; interval: number; label: string }> = {
  easy:      { gravity: 1300, flap: -460, speed: 135, gap: 240, interval: 1.90, label: "Easy" },
  chill:     { gravity: 1500, flap: -480, speed: 150, gap: 220, interval: 1.75, label: "Chill" },
  normal:    { gravity: 1800, flap: -520, speed: 185, gap: 190, interval: 1.55, label: "Normal" },
  hard:      { gravity: 2100, flap: -560, speed: 230, gap: 160, interval: 1.30, label: "Hard" },
  insane:    { gravity: 2400, flap: -600, speed: 280, gap: 140, interval: 1.05, label: "Insane" },
  nightmare: { gravity: 2700, flap: -630, speed: 330, gap: 125, interval: 0.85, label: "Nightmare" },
};

const THEMES: Record<ThemeKey, {
  label: string;
  sky: [string, string, string];
  bird: [string, string, string];
  glow: string;
  pipe: string;
  orb: number;
  swatch: string[];
}> = {
  aurora: { label: "Aurora", sky: ["#2a1b4a", "#3a4d8f", "#6fb6c9"], bird: ["rgba(255,255,255,0.95)", "rgba(255,200,240,0.85)", "rgba(140,120,255,0.7)"], glow: "rgba(255,180,240,0.7)", pipe: "200", orb: 200, swatch: ["#2a1b4a", "#6fb6c9", "#ff9ff3"] },
  sunset: { label: "Sunset", sky: ["#2d0e3a", "#a83264", "#ffb88c"], bird: ["rgba(255,255,255,0.95)", "rgba(255,210,160,0.85)", "rgba(255,90,140,0.7)"], glow: "rgba(255,160,120,0.75)", pipe: "30", orb: 20, swatch: ["#2d0e3a", "#ff6b6b", "#ffb88c"] },
  mint: { label: "Mint", sky: ["#062b2a", "#0f6e6b", "#7dd3c0"], bird: ["rgba(255,255,255,0.95)", "rgba(180,255,230,0.85)", "rgba(80,220,200,0.7)"], glow: "rgba(140,255,220,0.75)", pipe: "170", orb: 160, swatch: ["#062b2a", "#7dd3c0", "#a7f3d0"] },
  noir: { label: "Noir", sky: ["#0a0a14", "#1a1a2e", "#2d2d44"], bird: ["rgba(255,255,255,0.95)", "rgba(220,220,240,0.8)", "rgba(120,120,180,0.6)"], glow: "rgba(255,255,255,0.6)", pipe: "0", orb: 260, swatch: ["#0a0a14", "#2d2d44", "#dcdcef"] },
  ember: { label: "Ember", sky: ["#1a0606", "#5a1a14", "#ff7a3a"], bird: ["rgba(255,255,255,0.95)", "rgba(255,170,120,0.85)", "rgba(255,80,40,0.7)"], glow: "rgba(255,140,80,0.85)", pipe: "15", orb: 10, swatch: ["#1a0606", "#ff7a3a", "#ffd166"] },
  ocean: { label: "Ocean", sky: ["#031a3a", "#0a4a8a", "#5fc7e0"], bird: ["rgba(255,255,255,0.95)", "rgba(170,220,255,0.85)", "rgba(60,140,220,0.7)"], glow: "rgba(120,200,255,0.8)", pipe: "210", orb: 210, swatch: ["#031a3a", "#0a4a8a", "#5fc7e0"] },
  candy: { label: "Candy", sky: ["#3a0a3a", "#c83a9a", "#ffc8e8"], bird: ["rgba(255,255,255,0.95)", "rgba(255,200,240,0.85)", "rgba(255,120,200,0.7)"], glow: "rgba(255,180,230,0.85)", pipe: "320", orb: 320, swatch: ["#3a0a3a", "#ff7ac6", "#ffc8e8"] },
  forest: { label: "Forest", sky: ["#04140a", "#0e4a2a", "#7acf8a"], bird: ["rgba(255,255,255,0.95)", "rgba(200,255,210,0.85)", "rgba(80,180,110,0.7)"], glow: "rgba(160,255,180,0.8)", pipe: "130", orb: 130, swatch: ["#04140a", "#0e4a2a", "#7acf8a"] },
};

const BIRD_STYLES: { key: BirdStyle; label: string }[] = [
  { key: "classic", label: "Classic" },
  { key: "geo", label: "Hex" },
  { key: "prism", label: "Prism" },
  { key: "drop", label: "Drop" },
];
const TRAIL_STYLES: { key: TrailStyle; label: string }[] = [
  { key: "sparkle", label: "Sparkle" },
  { key: "ribbon", label: "Ribbon" },
  { key: "smoke", label: "Smoke" },
  { key: "none", label: "None" },
];

type Pipe = { x: number; gapY: number; passed: boolean; id: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; hue: number; kind?: TrailStyle };

// ---------- Audio ----------
class SfxEngine {
  ctx: AudioContext | null = null;
  enabled = true;
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); }
      catch { /* noop */ }
    }
    if (this.ctx?.state === "suspended") this.ctx.resume();
    return this.ctx;
  }
  blip(freq: number, dur = 0.08, type: OscillatorType = "sine", vol = 0.08) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  }
  flap() { this.blip(520, 0.09, "triangle", 0.06); }
  score() { this.blip(880, 0.07, "sine", 0.07); setTimeout(() => this.blip(1320, 0.08, "sine", 0.06), 60); }
  crash() {
    if (!this.enabled) return;
    const ctx = this.ensure(); if (!ctx) return;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(220, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.35);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.4);
  }
}

function medalFor(score: number) {
  if (score >= 40) return { label: "Prism", color: "from-fuchsia-400 to-cyan-300" };
  if (score >= 20) return { label: "Gold", color: "from-yellow-300 to-amber-500" };
  if (score >= 10) return { label: "Silver", color: "from-slate-200 to-slate-400" };
  if (score >= 3)  return { label: "Bronze", color: "from-orange-300 to-amber-700" };
  return { label: "Rookie", color: "from-white/40 to-white/10" };
}

export function FlappyGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sfxRef = useRef(new SfxEngine());

  // Persistent settings
  const [theme, setTheme] = useState<ThemeKey>("aurora");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [birdStyle, setBirdStyle] = useState<BirdStyle>("classic");
  const [trailStyle, setTrailStyle] = useState<TrailStyle>("sparkle");
  const [soundOn, setSoundOn] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [termsAccepted, setTermsAccepted] = useState(true); // assume true to avoid SSR flash; verified in effect
  const [downloading, setDownloading] = useState(false);

  // Stats
  const [best, setBest] = useState(0);
  const [games, setGames] = useState(0);
  const [totalFlaps, setTotalFlaps] = useState(0);

  // UI state
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [runFlaps, setRunFlaps] = useState(0);
  const [runStart, setRunStart] = useState<number | null>(null);
  const [runMs, setRunMs] = useState(0);

  const stateRef = useRef({
    phase: "ready" as Phase,
    bird: { y: WORLD_H / 2, vy: 0, rot: 0 },
    pipes: [] as Pipe[],
    particles: [] as Particle[],
    spawnTimer: 0,
    pipeId: 0,
    score: 0,
    best: 0,
    t: 0,
    shake: 0,
    flash: 0,
    diff: DIFFICULTY.normal,
    theme: THEMES.aurora,
    birdStyle: "classic" as BirdStyle,
  });

  const theTheme = useMemo(() => THEMES[theme], [theme]);

  // Load persisted
  useEffect(() => {
    const b = Number(localStorage.getItem("glassbird:best") || 0);
    const g = Number(localStorage.getItem("glassbird:games") || 0);
    const f = Number(localStorage.getItem("glassbird:flaps") || 0);
    const t = (localStorage.getItem("glassbird:theme") as ThemeKey) || "aurora";
    const d = (localStorage.getItem("glassbird:diff") as Difficulty) || "normal";
    const bs = (localStorage.getItem("glassbird:bird") as BirdStyle) || "classic";
    const ts = (localStorage.getItem("glassbird:trail") as TrailStyle) || "sparkle";
    const s = localStorage.getItem("glassbird:sound");
    const ta = localStorage.getItem("glassbird:terms");
    stateRef.current.best = b;
    setBest(b); setGames(g); setTotalFlaps(f);
    if (THEMES[t]) setTheme(t);
    if (DIFFICULTY[d]) setDifficulty(d);
    if (BIRD_STYLES.some((x) => x.key === bs)) setBirdStyle(bs);
    if (TRAIL_STYLES.some((x) => x.key === ts)) setTrailStyle(ts);
    if (s !== null) setSoundOn(s === "1");
    setTermsAccepted(ta === "1");
  }, []);

  useEffect(() => { localStorage.setItem("glassbird:theme", theme); stateRef.current.theme = THEMES[theme]; }, [theme]);
  useEffect(() => { localStorage.setItem("glassbird:diff", difficulty); stateRef.current.diff = DIFFICULTY[difficulty]; }, [difficulty]);
  useEffect(() => { localStorage.setItem("glassbird:bird", birdStyle); stateRef.current.birdStyle = birdStyle; }, [birdStyle]);
  useEffect(() => { localStorage.setItem("glassbird:trail", trailStyle); }, [trailStyle]);
  useEffect(() => { localStorage.setItem("glassbird:sound", soundOn ? "1" : "0"); sfxRef.current.enabled = soundOn; }, [soundOn]);

  const reset = useCallback(() => {
    const s = stateRef.current;
    s.bird = { y: WORLD_H / 2, vy: 0, rot: 0 };
    s.pipes = []; s.particles = [];
    s.spawnTimer = 0; s.pipeId = 0; s.score = 0;
    s.t = 0; s.shake = 0; s.flash = 0;
    s.phase = "ready";
    setScore(0); setPhase("ready");
    setRunFlaps(0); setRunStart(null); setRunMs(0);
  }, []);

  const flap = useCallback(() => {
    const s = stateRef.current;
    if (s.phase === "paused") return;
    if (s.phase === "ready") {
      s.phase = "playing";
      setPhase("playing");
      setRunStart(performance.now());
    }
    if (s.phase === "dead") { reset(); return; }
    s.bird.vy = s.diff.flap;
    sfxRef.current.flap();
    setRunFlaps((f) => f + 1);
    setTotalFlaps((f) => { const n = f + 1; localStorage.setItem("glassbird:flaps", String(n)); return n; });
    const tk = trailStyle;
    const count = tk === "none" ? 0 : tk === "ribbon" ? 6 : tk === "smoke" ? 14 : 10;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 120;
      s.particles.push({
        x: BIRD_X - 6, y: s.bird.y + 6,
        vx: Math.cos(a) * sp * 0.4 - 40,
        vy: Math.sin(a) * sp * 0.4 + 30,
        life: 0, max: 0.5 + Math.random() * 0.5,
        size: tk === "smoke" ? 4 + Math.random() * 4 : 2 + Math.random() * 3,
        hue: stateRef.current.theme.orb + Math.random() * 80 - 40,
        kind: tk,
      });
    }
  }, [reset, trailStyle]);

  const togglePause = useCallback(() => {
    const s = stateRef.current;
    if (s.phase === "playing") { s.phase = "paused"; setPhase("paused"); }
    else if (s.phase === "paused") { s.phase = "playing"; setPhase("playing"); }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = wrapRef.current?.parentElement?.parentElement; // main wrapper
    try {
      if (!document.fullscreenElement) {
        await (el || document.documentElement).requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch { /* noop */ }
  }, []);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault(); flap();
      } else if (e.code === "KeyP") {
        e.preventDefault(); togglePause();
      } else if (e.code === "Escape") {
        if (document.fullscreenElement) return; // browser handles exit
        togglePause();
      } else if (e.code === "KeyM") {
        setSoundOn((s) => !s);
      } else if (e.code === "KeyR") {
        reset();
      } else if (e.code === "KeyF") {
        e.preventDefault(); toggleFullscreen();
      } else if (e.code === "KeyZ") {
        setFocusMode((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flap, togglePause, reset, toggleFullscreen]);

  // Fullscreen + online listeners
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    const onOn = () => setOnline(true);
    const onOff = () => setOnline(false);
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("online", onOn);
    window.addEventListener("offline", onOff);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("online", onOn);
      window.removeEventListener("offline", onOff);
    };
  }, []);

  // Run timer
  useEffect(() => {
    if (phase !== "playing" || runStart === null) return;
    const id = window.setInterval(() => setRunMs(performance.now() - runStart), 100);
    return () => window.clearInterval(id);
  }, [phase, runStart]);



  // Game loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      const wrap = wrapRef.current!;
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      (canvas as any)._dpr = dpr;
      (canvas as any)._w = rect.width;
      (canvas as any)._h = rect.height;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current!);

    const die = () => {
      const s = stateRef.current;
      if (s.phase !== "playing") return;
      s.phase = "dead"; s.shake = 14; s.flash = 1;
      sfxRef.current.crash();
      for (let i = 0; i < 60; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 80 + Math.random() * 280;
        s.particles.push({
          x: BIRD_X, y: s.bird.y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0, max: 0.8 + Math.random() * 0.6,
          size: 2 + Math.random() * 4,
          hue: stateRef.current.theme.orb + Math.random() * 80,
        });
      }
      if (s.score > s.best) {
        s.best = s.score;
        localStorage.setItem("glassbird:best", String(s.best));
        setBest(s.best);
      }
      setGames((g) => { const n = g + 1; localStorage.setItem("glassbird:games", String(n)); return n; });
      setPhase("dead");
    };

    const tick = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const s = stateRef.current;
      const D = s.diff;
      const TH = s.theme;
      s.t += dt;

      if (s.phase === "ready") {
        s.bird.y = WORLD_H / 2 + Math.sin(s.t * 2.4) * 12;
        s.bird.rot = Math.sin(s.t * 2.4) * 0.15;
      } else if (s.phase === "playing") {
        s.bird.vy += D.gravity * dt;
        if (s.bird.vy > MAX_FALL) s.bird.vy = MAX_FALL;
        s.bird.y += s.bird.vy * dt;
        const target = Math.max(-0.5, Math.min(1.2, s.bird.vy / 600));
        s.bird.rot += (target - s.bird.rot) * Math.min(1, dt * 8);

        s.spawnTimer += dt;
        if (s.spawnTimer >= D.interval) {
          s.spawnTimer = 0;
          const margin = 90;
          const gapY = margin + Math.random() * (WORLD_H - GROUND_H - margin * 2 - D.gap);
          s.pipes.push({ x: WORLD_W + 20, gapY, passed: false, id: ++s.pipeId });
        }
        for (const p of s.pipes) {
          p.x -= D.speed * dt;
          if (!p.passed && p.x + 84 < BIRD_X - BIRD_R) {
            p.passed = true; s.score += 1; setScore(s.score);
            sfxRef.current.score();
          }
        }
        s.pipes = s.pipes.filter((p) => p.x > -84 - 20);

        if (s.bird.y + BIRD_R > WORLD_H - GROUND_H || s.bird.y - BIRD_R < 0) {
          s.bird.y = Math.min(WORLD_H - GROUND_H - BIRD_R, Math.max(BIRD_R, s.bird.y));
          die();
        } else {
          for (const p of s.pipes) {
            if (BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + 84) {
              if (s.bird.y - BIRD_R < p.gapY || s.bird.y + BIRD_R > p.gapY + D.gap) {
                die(); break;
              }
            }
          }
        }
      } else if (s.phase === "dead") {
        s.bird.vy += D.gravity * dt;
        s.bird.y += s.bird.vy * dt;
        s.bird.rot += dt * 4;
        if (s.bird.y + BIRD_R > WORLD_H - GROUND_H) {
          s.bird.y = WORLD_H - GROUND_H - BIRD_R;
          s.bird.vy = 0;
        }
      }

      for (const p of s.particles) {
        p.life += dt;
        p.vy += 200 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      s.particles = s.particles.filter((p) => p.life < p.max);
      s.shake *= Math.pow(0.001, dt);
      s.flash *= Math.pow(0.02, dt);

      // draw
      const W = (canvas as any)._w as number;
      const H = (canvas as any)._h as number;
      const dpr = (canvas as any)._dpr as number;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const scale = Math.min(W / WORLD_W, H / WORLD_H);
      const ox = (W - WORLD_W * scale) / 2 + (Math.random() - 0.5) * s.shake;
      const oy = (H - WORLD_H * scale) / 2 + (Math.random() - 0.5) * s.shake;
      ctx.translate(ox, oy);
      ctx.scale(scale, scale);

      const sky = ctx.createLinearGradient(0, 0, 0, WORLD_H);
      sky.addColorStop(0, TH.sky[0]);
      sky.addColorStop(0.5, TH.sky[1]);
      sky.addColorStop(1, TH.sky[2]);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);

      for (let i = 0; i < 5; i++) {
        const px = ((i * 137 - s.t * 18) % (WORLD_W + 200) + WORLD_W + 200) % (WORLD_W + 200) - 100;
        const py = 80 + i * 90 + Math.sin(s.t * 0.5 + i) * 20;
        const r = 60 + i * 12;
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, `hsla(${TH.orb + i * 30}, 80%, 70%, 0.35)`);
        g.addColorStop(1, `hsla(${TH.orb + 80}, 80%, 60%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const p of s.pipes) drawPipe(ctx, p, D.gap, TH.pipe);
      drawGround(ctx, s.t);

      for (const p of s.particles) {
        const a = 1 - p.life / p.max;
        if (p.kind === "ribbon") {
          ctx.strokeStyle = `hsla(${p.hue}, 90%, 75%, ${a * 0.8})`;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 0.04, p.y + p.vy * 0.04);
          ctx.stroke();
        } else if (p.kind === "smoke") {
          ctx.fillStyle = `hsla(${p.hue}, 40%, 80%, ${a * 0.4})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + (1 - a) * 1.5), 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `hsla(${p.hue}, 90%, 75%, ${a * 0.9})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      drawBird(ctx, s.bird.y, s.bird.rot, s.t, TH.bird, TH.glow, s.birdStyle);

      if (s.phase === "paused") {
        ctx.fillStyle = "rgba(10,10,30,0.45)";
        ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      }

      if (s.flash > 0.01) {
        ctx.fillStyle = `rgba(255,255,255,${s.flash * 0.6})`;
        ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  const handlePointer = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-no-flap]")) return;
    e.preventDefault();
    flap();
  };

  const medal = medalFor(score);

  return (
    <main
      className="relative min-h-screen w-full overflow-hidden"
      style={{
        background:
          "radial-gradient(1200px 800px at 20% 10%, oklch(0.45 0.2 300 / 0.6), transparent 60%), radial-gradient(1000px 700px at 90% 90%, oklch(0.55 0.2 200 / 0.55), transparent 60%), oklch(0.14 0.05 270)",
      }}
    >
      <div className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full opacity-60 animate-float-orb"
           style={{ background: "radial-gradient(circle, oklch(0.7 0.25 330 / 0.7), transparent 60%)" }} />
      <div className="pointer-events-none absolute bottom-0 -right-24 h-[28rem] w-[28rem] rounded-full opacity-50 animate-float-orb"
           style={{ background: "radial-gradient(circle, oklch(0.7 0.25 200 / 0.7), transparent 60%)", animationDelay: "-4s" }} />

      <div className={`relative z-10 mx-auto flex min-h-screen w-full max-w-[1200px] flex-col items-center justify-center gap-4 p-3 sm:p-6 ${focusMode ? "max-w-[640px]" : ""}`}>
        {/* Top bar */}
        <header className="w-full flex items-center justify-between gap-2">
          <div className="glass rounded-full px-4 py-2 flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_var(--color-primary)] animate-pulse" />
            <span className="text-sm tracking-wide font-medium">Glassbird</span>
            <span className="hidden sm:inline text-xs text-white/40">·</span>
            <span className="hidden sm:inline text-xs text-white/60">{DIFFICULTY[difficulty].label}</span>
            <span className="hidden md:inline text-xs text-white/40">·</span>
            <span className="hidden md:inline text-xs text-white/60">{THEMES[theme].label}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="glass rounded-full h-9 px-3 hidden sm:flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-white/60" title={online ? "Online — cached locally" : "Offline — playing from cache"}>
              {online ? <Wifi className="h-3 w-3 text-emerald-300" /> : <WifiOff className="h-3 w-3 text-amber-300" />}
              {online ? "Online" : "Offline"}
            </div>
            <IconBtn onClick={() => setFocusMode((v) => !v)} active={focusMode} label="Focus mode (Z)" title="Focus mode (Z)">
              <Target className="h-4 w-4" />
            </IconBtn>
            <IconBtn onClick={toggleFullscreen} active={isFullscreen} label="Fullscreen (F)" title="Fullscreen (F)">
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </IconBtn>
            <IconBtn onClick={() => setSoundOn((s) => !s)} label="Sound (M)" title="Mute (M)">
              {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-white/50" />}
            </IconBtn>
            <IconBtn onClick={() => setSettingsOpen(true)} label="Settings" title="Settings">
              <Settings2 className="h-4 w-4" />
            </IconBtn>
          </div>
        </header>

        {/* Main grid with side rails */}
        <div className={`w-full grid gap-4 ${focusMode ? "grid-cols-1 place-items-center" : "lg:grid-cols-[1fr_auto_1fr] grid-cols-1 lg:items-start items-center justify-items-center"}`}>
          {/* Left rail */}
          {!focusMode && (
            <aside className="hidden lg:flex w-full max-w-[260px] flex-col gap-3 self-stretch">
              <Panel title="Live run" icon={<Activity className="h-3 w-3" />}>
                <RailRow icon={<Flame className="h-3.5 w-3.5 text-amber-300" />} label="Score" value={String(score)} />
                <RailRow icon={<Clock className="h-3.5 w-3.5 text-cyan-300" />} label="Time" value={fmtTime(runMs)} />
                <RailRow icon={<Zap className="h-3.5 w-3.5 text-fuchsia-300" />} label="Flaps" value={String(runFlaps)} />
                <RailRow icon={<Gauge className="h-3.5 w-3.5 text-emerald-300" />} label="FPS feel" value={DIFFICULTY[difficulty].label} />
              </Panel>
              <Panel title="Career" icon={<Trophy className="h-3 w-3" />}>
                <RailRow icon={<Trophy className="h-3.5 w-3.5 text-amber-300" />} label="Best" value={String(best)} />
                <RailRow icon={<Award className="h-3.5 w-3.5 text-cyan-200" />} label="Games" value={String(games)} />
                <RailRow icon={<Zap className="h-3.5 w-3.5 text-fuchsia-300" />} label="Total flaps" value={String(totalFlaps)} />
              </Panel>
              <Panel title="Palette" icon={<Sparkles className="h-3 w-3" />}>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(THEMES) as ThemeKey[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => setTheme(k)}
                      className={`h-9 rounded-lg border transition ${theme === k ? "border-white scale-105" : "border-white/15 hover:border-white/40"}`}
                      style={{ background: `linear-gradient(135deg, ${THEMES[k].swatch.join(", ")})` }}
                      title={THEMES[k].label}
                      aria-label={THEMES[k].label}
                    />
                  ))}
                </div>
              </Panel>
            </aside>
          )}

          {/* Game frame */}
          <div
            ref={wrapRef}
            onPointerDown={handlePointer}
            className="relative w-full max-w-[480px] rounded-[2rem] overflow-hidden glass-strong select-none shadow-[0_30px_120px_-20px_rgba(120,80,255,0.45)]"
            style={{ aspectRatio: `${WORLD_W} / ${WORLD_H}`, touchAction: "none", cursor: "pointer" }}
          >
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

            {/* HUD score */}
            <div className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2">
              <div className="glass rounded-full px-6 py-2 font-display text-4xl leading-none">
                {score}
              </div>
            </div>

            {/* Top-right in-game controls */}
            {(phase === "playing" || phase === "paused") && (
              <div data-no-flap className="absolute top-5 right-5 flex gap-2">
                <button
                  onClick={togglePause}
                  className="glass rounded-full h-9 w-9 grid place-items-center hover:scale-105 transition"
                  aria-label="Pause"
                  title="Pause (P)"
                >
                  {phase === "paused" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </button>
                <button
                  onClick={reset}
                  className="glass rounded-full h-9 w-9 grid place-items-center hover:scale-105 transition"
                  aria-label="Restart"
                  title="Restart (R)"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Best chip */}
            <div className="pointer-events-none absolute top-5 left-5">
              <div className="glass rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/70 flex items-center gap-1">
                <Trophy className="h-3 w-3" /> {best}
              </div>
            </div>

            {/* Bottom HUD: live run while playing */}
            {phase === "playing" && (
              <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                <div className="glass rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/70 flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> {fmtTime(runMs)}
                </div>
                <div className="glass rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/70 flex items-center gap-1.5">
                  <Zap className="h-3 w-3" /> {runFlaps}
                </div>
              </div>
            )}

            {/* Overlays */}
            {phase === "ready" && (
              <Overlay>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.3em] text-white/60">
                  <Sparkles className="h-3 w-3" /> Liquid flight
                </div>
                <h1 className="font-display text-5xl text-balance leading-none">
                  Glass<span className="italic">bird</span>
                </h1>
                <p className="text-sm text-white/70 max-w-[18rem] text-balance">
                  Tap, click or press space to flap. Glide through the prisms.
                </p>
                <div data-no-flap className="flex items-center gap-2 mt-1">
                  {(Object.keys(THEMES) as ThemeKey[]).map((k) => (
                    <button
                      key={k}
                      onClick={(e) => { e.stopPropagation(); setTheme(k); }}
                      className={`h-7 w-7 rounded-full border transition ${theme === k ? "border-white scale-110" : "border-white/30 hover:border-white/60"}`}
                      style={{ background: `linear-gradient(135deg, ${THEMES[k].swatch.join(", ")})` }}
                      aria-label={THEMES[k].label}
                      title={THEMES[k].label}
                    />
                  ))}
                </div>
                <button data-no-flap onClick={(e) => { e.stopPropagation(); flap(); }} className="mt-2 glass-strong rounded-full px-6 py-3 text-sm font-medium hover:scale-[1.03] transition-transform">
                  Begin flight
                </button>
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mt-1">
                  space · tap · click
                </div>
              </Overlay>
            )}

            {phase === "paused" && (
              <Overlay>
                <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">Paused</div>
                <h2 className="font-display text-4xl">Take a breath</h2>
                <button data-no-flap onClick={(e) => { e.stopPropagation(); togglePause(); }} className="mt-1 glass-strong rounded-full px-6 py-3 text-sm font-medium hover:scale-[1.03] transition-transform inline-flex items-center gap-2">
                  <Play className="h-4 w-4" /> Resume
                </button>
              </Overlay>
            )}

            {phase === "dead" && (
              <Overlay>
                <div className={`text-[10px] uppercase tracking-[0.3em] bg-gradient-to-r ${medal.color} bg-clip-text text-transparent font-semibold`}>
                  {medal.label}
                </div>
                <div className="flex items-end gap-6">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">Score</span>
                    <span className="font-display text-5xl leading-none">{score}</span>
                  </div>
                  <div className="h-10 w-px bg-white/15" />
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">Best</span>
                    <span className="font-display text-3xl leading-none text-white/80">{best}</span>
                  </div>
                </div>
                <div className="flex gap-3 text-[10px] uppercase tracking-[0.2em] text-white/50">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtTime(runMs)}</span>
                  <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> {runFlaps} flaps</span>
                </div>
                {score > 0 && score === best && (
                  <div className="text-[11px] uppercase tracking-[0.25em] text-amber-300 flex items-center gap-1">
                    <Zap className="h-3 w-3" /> New best
                  </div>
                )}
                <button data-no-flap onClick={(e) => { e.stopPropagation(); flap(); }} className="mt-1 glass-strong rounded-full px-6 py-3 text-sm font-medium hover:scale-[1.03] transition-transform">
                  Fly again
                </button>
              </Overlay>
            )}
          </div>

          {/* Right rail */}
          {!focusMode && (
            <aside className="hidden lg:flex w-full max-w-[260px] flex-col gap-3 self-stretch">
              <Panel title="Achievements" icon={<Award className="h-3 w-3" />}>
                <Achievement label="First flap" unlocked={totalFlaps >= 1} hint="Press space" />
                <Achievement label="Bronze medal" unlocked={best >= 3} hint="Score 3" />
                <Achievement label="Silver medal" unlocked={best >= 10} hint="Score 10" />
                <Achievement label="Gold medal" unlocked={best >= 20} hint="Score 20" />
                <Achievement label="Prism rank" unlocked={best >= 40} hint="Score 40" />
                <Achievement label="Marathoner" unlocked={games >= 25} hint="25 runs" />
              </Panel>
              <Panel title="Shortcuts" icon={<Keyboard className="h-3 w-3" />}>
                <Key k="Space" v="Flap" />
                <Key k="P" v="Pause" />
                <Key k="R" v="Restart" />
                <Key k="M" v="Mute" />
                <Key k="F" v="Fullscreen" />
                <Key k="Z" v="Focus mode" />
              </Panel>
              <Panel title="Tip" icon={<Sparkles className="h-3 w-3" />}>
                <p className="text-xs text-white/70 leading-relaxed">
                  Short, rhythmic taps beat panic mashing. Aim for the centre of each prism gap and let gravity do the rest.
                </p>
              </Panel>
            </aside>
          )}
        </div>

        {/* Stats strip (mobile/small) */}
        {!focusMode && (
          <div className="w-full max-w-[480px] grid grid-cols-3 gap-2 lg:hidden">
            <Stat label="Best" value={best} />
            <Stat label="Games" value={games} />
            <Stat label="Flaps" value={totalFlaps} />
          </div>
        )}

        {!focusMode && (
          <footer className="text-[10px] uppercase tracking-[0.25em] text-white/40 text-center leading-relaxed">
            <div>space flap · P pause · M mute · R reset · F fullscreen · Z focus</div>
            <div className="mt-1 text-white/30">© {new Date().getFullYear()} Hamza · Made by Hamza · All rights reserved</div>
          </footer>
        )}
      </div>


      {/* Settings drawer */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSettingsOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md glass-strong rounded-3xl p-6 animate-in slide-in-from-bottom-6 duration-300 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-2xl">Settings</h3>
              <button onClick={() => setSettingsOpen(false)} className="h-8 w-8 grid place-items-center rounded-full glass hover:scale-105 transition">
                <X className="h-4 w-4" />
              </button>
            </div>

            <Section title="Theme">
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(THEMES) as ThemeKey[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setTheme(k)}
                    className={`relative rounded-2xl p-3 text-left border transition ${theme === k ? "border-white/80" : "border-white/15 hover:border-white/40"}`}
                    style={{ background: `linear-gradient(135deg, ${THEMES[k].swatch.join(", ")})` }}
                  >
                    <div className="text-xs font-medium text-white drop-shadow">{THEMES[k].label}</div>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Difficulty">
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`rounded-xl py-2 text-sm transition ${difficulty === d ? "glass-strong" : "glass hover:bg-white/10"}`}
                  >
                    {DIFFICULTY[d].label}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Bird style">
              <div className="grid grid-cols-4 gap-2">
                {BIRD_STYLES.map((b) => (
                  <button
                    key={b.key}
                    onClick={() => setBirdStyle(b.key)}
                    className={`rounded-xl py-2 text-xs capitalize transition ${birdStyle === b.key ? "glass-strong" : "glass hover:bg-white/10"}`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Trail">
              <div className="grid grid-cols-4 gap-2">
                {TRAIL_STYLES.map((b) => (
                  <button
                    key={b.key}
                    onClick={() => setTrailStyle(b.key)}
                    className={`rounded-xl py-2 text-xs capitalize transition ${trailStyle === b.key ? "glass-strong" : "glass hover:bg-white/10"}`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Audio">
              <button
                onClick={() => setSoundOn((s) => !s)}
                className="w-full glass rounded-xl px-4 py-3 flex items-center justify-between hover:bg-white/10 transition"
              >
                <span className="text-sm">Sound effects</span>
                <span className={`h-6 w-11 rounded-full relative transition ${soundOn ? "bg-primary/70" : "bg-white/15"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${soundOn ? "left-[1.4rem]" : "left-0.5"}`} />
                </span>
              </button>
            </Section>

            <Section title="Stats">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Best" value={best} />
                <Stat label="Games" value={games} />
                <Stat label="Flaps" value={totalFlaps} />
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem("glassbird:best");
                  localStorage.removeItem("glassbird:games");
                  localStorage.removeItem("glassbird:flaps");
                  stateRef.current.best = 0;
                  setBest(0); setGames(0); setTotalFlaps(0);
                }}
                className="mt-2 w-full glass rounded-xl px-4 py-2 text-xs text-white/70 hover:text-white hover:bg-white/10 transition"
              >
                Reset stats
              </button>
            </Section>

            <Section title="Offline">
              <button
                onClick={async () => {
                  try {
                    setDownloading(true);
                    const res = await fetch("/glassbird-offline.html");
                    const html = await res.text();
                    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "Glassbird.html";
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 1500);
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setDownloading(false);
                  }
                }}
                className="w-full glass-strong rounded-xl px-4 py-3 flex items-center justify-center gap-2 hover:scale-[1.01] transition text-sm font-medium"
              >
                <Download className="h-4 w-4" />
                {downloading ? "Preparing…" : "Download Game (offline HTML)"}
              </button>
              <p className="text-[11px] text-white/50 mt-2 leading-relaxed">
                Saves a single self-contained <code className="text-white/70">Glassbird.html</code> file to your device. Open it any time — no internet required.
              </p>
            </Section>

            <Section title="About">
              <div className="text-xs text-white/70 leading-relaxed">
                Glassbird — a liquid glass take on Flappy Bird.<br />
                <span className="text-white/50">Made with care by</span> <span className="text-white">Hamza</span>.<br />
                © {new Date().getFullYear()} Hamza. All rights reserved.
              </div>
            </Section>

            <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 text-center mt-2">
              shortcuts · space P M R F Z
            </div>
          </div>
        </div>
      )}

      {/* Terms & welcome gate */}
      {!termsAccepted && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md glass-strong rounded-3xl p-7 animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/60 mb-1">
              <Shield className="h-3 w-3" /> Welcome
            </div>
            <h2 className="font-display text-4xl leading-none mb-3">
              Glass<span className="italic">bird</span>
            </h2>
            <p className="text-sm text-white/75 leading-relaxed">
              A liquid glass take on Flappy Bird — crafted by <span className="text-white font-medium">Hamza</span>.
            </p>
            <div className="my-5 h-px bg-white/10" />
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/50 mb-2">Terms &amp; conditions</div>
            <ul className="text-xs text-white/70 leading-relaxed space-y-1.5 list-disc pl-4">
              <li>Glassbird is provided as-is, for personal entertainment. No warranties.</li>
              <li>Game progress is stored locally on this device. Clearing site data erases it.</li>
              <li>This app does not collect, track, or transmit any personal data.</li>
              <li>All artwork, code and assets are © {new Date().getFullYear()} Hamza. Reuse without permission is not allowed.</li>
            </ul>
            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">© Hamza</div>
              <button
                onClick={() => { localStorage.setItem("glassbird:terms", "1"); setTermsAccepted(true); }}
                className="glass-strong rounded-full px-6 py-3 text-sm font-medium hover:scale-[1.03] transition-transform"
              >
                I agree — let's fly
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function fmtTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function IconBtn({ children, onClick, active, label, title }: { children: React.ReactNode; onClick: () => void; active?: boolean; label: string; title?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={title || label}
      className={`rounded-full h-9 w-9 grid place-items-center transition-transform hover:scale-105 ${active ? "glass-strong text-primary" : "glass"}`}
    >
      {children}
    </button>
  );
}

function Panel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-white/50 mb-3">
        {icon}{title}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function RailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2 text-white/70">{icon}{label}</div>
      <div className="font-display text-base leading-none text-white/95">{value}</div>
    </div>
  );
}

function Achievement({ label, unlocked, hint }: { label: string; unlocked: boolean; hint: string }) {
  return (
    <div className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs transition ${unlocked ? "bg-gradient-to-r from-amber-400/15 to-fuchsia-400/15 border border-white/20" : "bg-white/[0.03] border border-white/10"}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${unlocked ? "bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.8)]" : "bg-white/20"}`} />
        <span className={unlocked ? "text-white" : "text-white/50"}>{label}</span>
      </div>
      <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">{hint}</span>
    </div>
  );
}

function Key({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-white/70">{v}</span>
      <kbd className="glass rounded-md px-2 py-0.5 text-[10px] tracking-wider text-white/80">{k}</kbd>
    </div>
  );
}


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="text-[10px] uppercase tracking-[0.25em] text-white/50 mb-2">{title}</div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-2xl px-3 py-2 text-center">
      <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">{label}</div>
      <div className="font-display text-2xl leading-tight">{value}</div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="glass-strong rounded-3xl px-8 py-7 flex flex-col items-center gap-3 text-center pointer-events-auto">
        {children}
      </div>
    </div>
  );
}

// ---- draw helpers ----
function drawPipe(ctx: CanvasRenderingContext2D, p: Pipe, gap: number, hue: string) {
  const PIPE_WIDTH = 84;
  const topH = p.gapY;
  const botY = p.gapY + gap;
  const botH = WORLD_H - GROUND_H - botY;

  const draw = (x: number, y: number, w: number, h: number) => {
    const grd = ctx.createLinearGradient(x, 0, x + w, 0);
    grd.addColorStop(0, "rgba(255,255,255,0.05)");
    grd.addColorStop(0.3, `hsla(${hue}, 80%, 80%, 0.22)`);
    grd.addColorStop(0.7, `hsla(${hue}, 80%, 70%, 0.18)`);
    grd.addColorStop(1, "rgba(255,255,255,0.05)");
    roundRect(ctx, x, y, w, h, 14);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, x, y, w, h, 14);
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x + 6, y + 4, 4, h - 8);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x + w - 12, y + 4, 3, h - 8);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.2;
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 13);
    ctx.stroke();
  };

  if (topH > 0) draw(p.x, 0, PIPE_WIDTH, topH);
  if (botH > 0) draw(p.x, botY, PIPE_WIDTH, botH);

  ctx.save();
  ctx.shadowColor = `hsla(${hue}, 90%, 75%, 0.9)`;
  ctx.shadowBlur = 18;
  ctx.fillStyle = `hsla(${hue}, 90%, 85%, 0.85)`;
  ctx.fillRect(p.x + 4, p.gapY - 3, PIPE_WIDTH - 8, 3);
  ctx.fillRect(p.x + 4, p.gapY + gap, PIPE_WIDTH - 8, 3);
  ctx.restore();
}

function drawGround(ctx: CanvasRenderingContext2D, t: number) {
  const y = WORLD_H - GROUND_H;
  const g = ctx.createLinearGradient(0, y, 0, WORLD_H);
  g.addColorStop(0, "rgba(255,255,255,0.18)");
  g.addColorStop(1, "rgba(40,30,80,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, y, WORLD_W, GROUND_H);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillRect(0, y, WORLD_W, 1);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, y, WORLD_W, GROUND_H);
  ctx.clip();
  for (let i = 0; i < 8; i++) {
    const x = ((i * 90 - t * 180) % (WORLD_W + 200) + WORLD_W + 200) % (WORLD_W + 200) - 100;
    const grd = ctx.createLinearGradient(x, 0, x + 60, 0);
    grd.addColorStop(0, "rgba(255,255,255,0)");
    grd.addColorStop(0.5, "rgba(255,255,255,0.08)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(x, y, 60, GROUND_H);
  }
  ctx.restore();
}

function drawBird(ctx: CanvasRenderingContext2D, y: number, rot: number, t: number, palette: [string, string, string], glow: string, style: BirdStyle = "classic") {
  ctx.save();
  ctx.translate(BIRD_X, y);
  ctx.rotate(rot);

  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 36);
  g.addColorStop(0, glow);
  g.addColorStop(1, "rgba(255,180,240,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createRadialGradient(-6, -8, 2, 0, 0, BIRD_R + 4);
  body.addColorStop(0, palette[0]);
  body.addColorStop(0.4, palette[1]);
  body.addColorStop(1, palette[2]);
  ctx.fillStyle = body;
  ctx.beginPath();
  if (style === "geo") {
    const s = BIRD_R;
    ctx.moveTo(s, 0);
    for (let i = 1; i < 6; i++) {
      const a = (i * Math.PI * 2) / 6;
      ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
    }
    ctx.closePath();
  } else if (style === "prism") {
    const s = BIRD_R;
    ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0); ctx.closePath();
  } else if (style === "drop") {
    ctx.moveTo(BIRD_R, 0);
    ctx.bezierCurveTo(BIRD_R, BIRD_R, -BIRD_R, BIRD_R, -BIRD_R, 0);
    ctx.bezierCurveTo(-BIRD_R, -BIRD_R * 1.2, BIRD_R, -BIRD_R * 1.2, BIRD_R, 0);
    ctx.closePath();
  } else {
    ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2);
  }
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.ellipse(-6, -8, 5, 3, -0.5, 0, Math.PI * 2);
  ctx.fill();

  const wing = Math.sin(t * 18) * 0.6;
  ctx.save();
  ctx.translate(-2, 2);
  ctx.rotate(wing);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(-6, 4, 10, 5, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "#1a1530";
  ctx.beginPath();
  ctx.arc(7, -3, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(7.7, -3.7, 0.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,200,120,0.95)";
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(22, 2);
  ctx.lineTo(14, 4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
