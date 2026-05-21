import { useEffect, useRef, useState, useCallback } from "react";

// ---------- Tunables ----------
const WORLD_W = 480;
const WORLD_H = 720;
const GRAVITY = 1800;            // px/s^2
const FLAP_VELOCITY = -520;      // px/s
const MAX_FALL = 900;
const PIPE_SPEED = 180;          // px/s
const PIPE_GAP = 190;
const PIPE_WIDTH = 84;
const PIPE_INTERVAL = 1.55;      // seconds between pipes
const BIRD_R = 18;
const BIRD_X = WORLD_W * 0.3;
const GROUND_H = 80;

type Pipe = { x: number; gapY: number; passed: boolean; id: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; hue: number };

type Phase = "ready" | "playing" | "dead";

export function FlappyGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Mutable game state lives in a ref to avoid re-renders per frame.
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
  });

  const [, force] = useState(0);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");

  // Load best
  useEffect(() => {
    const b = Number(localStorage.getItem("glassbird:best") || 0);
    stateRef.current.best = b;
    setBest(b);
  }, []);

  const reset = useCallback(() => {
    const s = stateRef.current;
    s.bird = { y: WORLD_H / 2, vy: 0, rot: 0 };
    s.pipes = [];
    s.particles = [];
    s.spawnTimer = 0;
    s.pipeId = 0;
    s.score = 0;
    s.t = 0;
    s.shake = 0;
    s.flash = 0;
    s.phase = "ready";
    setScore(0);
    setPhase("ready");
  }, []);

  const flap = useCallback(() => {
    const s = stateRef.current;
    if (s.phase === "ready") {
      s.phase = "playing";
      setPhase("playing");
    }
    if (s.phase === "dead") {
      reset();
      return;
    }
    s.bird.vy = FLAP_VELOCITY;
    // burst particles
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 120;
      s.particles.push({
        x: BIRD_X - 6,
        y: s.bird.y + 6,
        vx: Math.cos(a) * sp * 0.4 - 40,
        vy: Math.sin(a) * sp * 0.4 + 30,
        life: 0,
        max: 0.5 + Math.random() * 0.4,
        size: 2 + Math.random() * 3,
        hue: 200 + Math.random() * 140,
      });
    }
  }, [reset]);

  // Input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        flap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flap]);

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
      s.phase = "dead";
      s.shake = 14;
      s.flash = 1;
      // crash particles
      for (let i = 0; i < 50; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 80 + Math.random() * 260;
        s.particles.push({
          x: BIRD_X,
          y: s.bird.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0,
          max: 0.8 + Math.random() * 0.6,
          size: 2 + Math.random() * 4,
          hue: 280 + Math.random() * 80,
        });
      }
      if (s.score > s.best) {
        s.best = s.score;
        localStorage.setItem("glassbird:best", String(s.best));
        setBest(s.best);
      }
      setPhase("dead");
    };

    const tick = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const s = stateRef.current;
      s.t += dt;

      // ---- update ----
      if (s.phase === "ready") {
        // gentle hover
        s.bird.y = WORLD_H / 2 + Math.sin(s.t * 2.4) * 12;
        s.bird.rot = Math.sin(s.t * 2.4) * 0.15;
      } else if (s.phase === "playing") {
        s.bird.vy += GRAVITY * dt;
        if (s.bird.vy > MAX_FALL) s.bird.vy = MAX_FALL;
        s.bird.y += s.bird.vy * dt;
        // rotation smooth toward velocity
        const target = Math.max(-0.5, Math.min(1.2, s.bird.vy / 600));
        s.bird.rot += (target - s.bird.rot) * Math.min(1, dt * 8);

        // spawn pipes
        s.spawnTimer += dt;
        if (s.spawnTimer >= PIPE_INTERVAL) {
          s.spawnTimer = 0;
          const margin = 90;
          const gapY = margin + Math.random() * (WORLD_H - GROUND_H - margin * 2 - PIPE_GAP);
          s.pipes.push({ x: WORLD_W + 20, gapY, passed: false, id: ++s.pipeId });
        }
        // move pipes
        for (const p of s.pipes) {
          p.x -= PIPE_SPEED * dt;
          if (!p.passed && p.x + PIPE_WIDTH < BIRD_X - BIRD_R) {
            p.passed = true;
            s.score += 1;
            setScore(s.score);
          }
        }
        s.pipes = s.pipes.filter((p) => p.x > -PIPE_WIDTH - 20);

        // collide
        if (s.bird.y + BIRD_R > WORLD_H - GROUND_H || s.bird.y - BIRD_R < 0) {
          s.bird.y = Math.min(WORLD_H - GROUND_H - BIRD_R, Math.max(BIRD_R, s.bird.y));
          die();
        } else {
          for (const p of s.pipes) {
            if (BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_WIDTH) {
              if (s.bird.y - BIRD_R < p.gapY || s.bird.y + BIRD_R > p.gapY + PIPE_GAP) {
                die();
                break;
              }
            }
          }
        }
      } else if (s.phase === "dead") {
        s.bird.vy += GRAVITY * dt;
        s.bird.y += s.bird.vy * dt;
        s.bird.rot += dt * 4;
        if (s.bird.y + BIRD_R > WORLD_H - GROUND_H) {
          s.bird.y = WORLD_H - GROUND_H - BIRD_R;
          s.bird.vy = 0;
        }
      }

      // particles
      for (const p of s.particles) {
        p.life += dt;
        p.vy += 200 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      s.particles = s.particles.filter((p) => p.life < p.max);
      s.shake *= Math.pow(0.001, dt);
      s.flash *= Math.pow(0.02, dt);

      // ---- draw ----
      const W = (canvas as any)._w as number;
      const H = (canvas as any)._h as number;
      const dpr = (canvas as any)._dpr as number;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      // Map world (WORLD_W x WORLD_H) into canvas keeping aspect
      const scale = Math.min(W / WORLD_W, H / WORLD_H);
      const ox = (W - WORLD_W * scale) / 2 + (Math.random() - 0.5) * s.shake;
      const oy = (H - WORLD_H * scale) / 2 + (Math.random() - 0.5) * s.shake;
      ctx.translate(ox, oy);
      ctx.scale(scale, scale);

      // Sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, WORLD_H);
      sky.addColorStop(0, "#2a1b4a");
      sky.addColorStop(0.5, "#3a4d8f");
      sky.addColorStop(1, "#6fb6c9");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);

      // parallax orbs
      for (let i = 0; i < 5; i++) {
        const px = ((i * 137 - s.t * 18) % (WORLD_W + 200) + WORLD_W + 200) % (WORLD_W + 200) - 100;
        const py = 80 + i * 90 + Math.sin(s.t * 0.5 + i) * 20;
        const r = 60 + i * 12;
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, `hsla(${200 + i * 30}, 80%, 70%, 0.35)`);
        g.addColorStop(1, "hsla(280, 80%, 60%, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Pipes — liquid glass
      for (const p of s.pipes) drawPipe(ctx, p);

      // Ground — glass strip
      drawGround(ctx, s.t);

      // Particles
      for (const p of s.particles) {
        const a = 1 - p.life / p.max;
        ctx.fillStyle = `hsla(${p.hue}, 90%, 75%, ${a * 0.9})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }

      // Bird
      drawBird(ctx, s.bird.y, s.bird.rot, s.t);

      // flash
      if (s.flash > 0.01) {
        ctx.fillStyle = `rgba(255,255,255,${s.flash * 0.6})`;
        ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  // touch/click on the canvas wrapper to flap
  const handlePointer = (e: React.PointerEvent) => {
    e.preventDefault();
    flap();
  };

  return (
    <main
      className="relative min-h-screen w-full overflow-hidden"
      style={{
        background:
          "radial-gradient(1200px 800px at 20% 10%, oklch(0.45 0.2 300 / 0.6), transparent 60%), radial-gradient(1000px 700px at 90% 90%, oklch(0.55 0.2 200 / 0.55), transparent 60%), oklch(0.14 0.05 270)",
      }}
    >
      {/* ambient floating orbs */}
      <div className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full opacity-60 animate-float-orb"
           style={{ background: "radial-gradient(circle, oklch(0.7 0.25 330 / 0.7), transparent 60%)" }} />
      <div className="pointer-events-none absolute bottom-0 -right-24 h-[28rem] w-[28rem] rounded-full opacity-50 animate-float-orb"
           style={{ background: "radial-gradient(circle, oklch(0.7 0.25 200 / 0.7), transparent 60%)", animationDelay: "-4s" }} />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-4 gap-4">
        <header className="w-full max-w-[480px] flex items-center justify-between">
          <div className="glass rounded-full px-4 py-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_var(--color-primary)]" />
            <span className="text-sm tracking-wide font-medium">Glassbird</span>
          </div>
          <div className="glass rounded-full px-4 py-2 text-sm">
            Best <span className="font-display text-lg ml-1">{best}</span>
          </div>
        </header>

        <div
          ref={wrapRef}
          onPointerDown={handlePointer}
          className="relative w-full max-w-[480px] rounded-[2rem] overflow-hidden glass-strong select-none"
          style={{ aspectRatio: `${WORLD_W} / ${WORLD_H}`, touchAction: "none", cursor: "pointer" }}
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

          {/* HUD score */}
          <div className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2">
            <div className="glass rounded-full px-6 py-2 font-display text-4xl leading-none">
              {score}
            </div>
          </div>

          {/* Overlays */}
          {phase === "ready" && (
            <Overlay>
              <h1 className="font-display text-5xl text-balance leading-none">
                Glass<span className="italic">bird</span>
              </h1>
              <p className="text-sm text-white/70 max-w-[18rem] text-balance">
                Tap, click or press space to flap. Glide through the prisms.
              </p>
              <button onClick={flap} className="mt-2 glass-strong rounded-full px-6 py-3 text-sm font-medium hover:scale-[1.03] transition-transform">
                Begin flight
              </button>
            </Overlay>
          )}
          {phase === "dead" && (
            <Overlay>
              <div className="text-xs uppercase tracking-[0.3em] text-white/60">Splash</div>
              <h2 className="font-display text-5xl">{score}</h2>
              <div className="text-sm text-white/70">Best · {best}</div>
              <button onClick={flap} className="mt-2 glass-strong rounded-full px-6 py-3 text-sm font-medium hover:scale-[1.03] transition-transform">
                Fly again
              </button>
            </Overlay>
          )}
        </div>

        <footer className="text-xs text-white/50 tracking-wide">
          space · tap · click
        </footer>
      </div>
    </main>
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
function drawPipe(ctx: CanvasRenderingContext2D, p: Pipe) {
  const topH = p.gapY;
  const botY = p.gapY + PIPE_GAP;
  const botH = WORLD_H - GROUND_H - botY;

  const draw = (x: number, y: number, w: number, h: number) => {
    // glass body
    const grd = ctx.createLinearGradient(x, 0, x + w, 0);
    grd.addColorStop(0, "rgba(255,255,255,0.05)");
    grd.addColorStop(0.3, "rgba(180,230,255,0.22)");
    grd.addColorStop(0.7, "rgba(140,200,255,0.18)");
    grd.addColorStop(1, "rgba(255,255,255,0.05)");
    roundRect(ctx, x, y, w, h, 14);
    ctx.fillStyle = grd;
    ctx.fill();

    // inner highlight
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, x, y, w, h, 14);
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x + 6, y + 4, 4, h - 8);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x + w - 12, y + 4, 3, h - 8);
    ctx.restore();

    // border
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.2;
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 13);
    ctx.stroke();
  };

  if (topH > 0) draw(p.x, 0, PIPE_WIDTH, topH);
  if (botH > 0) draw(p.x, botY, PIPE_WIDTH, botH);

  // glowing rim at gap edges
  ctx.save();
  ctx.shadowColor = "rgba(140,220,255,0.9)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "rgba(200,240,255,0.85)";
  ctx.fillRect(p.x + 4, p.gapY - 3, PIPE_WIDTH - 8, 3);
  ctx.fillRect(p.x + 4, p.gapY + PIPE_GAP, PIPE_WIDTH - 8, 3);
  ctx.restore();
}

function drawGround(ctx: CanvasRenderingContext2D, t: number) {
  const y = WORLD_H - GROUND_H;
  const g = ctx.createLinearGradient(0, y, 0, WORLD_H);
  g.addColorStop(0, "rgba(255,255,255,0.18)");
  g.addColorStop(1, "rgba(40,30,80,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, y, WORLD_W, GROUND_H);

  // top highlight line
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillRect(0, y, WORLD_W, 1);

  // moving shimmer stripes
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

function drawBird(ctx: CanvasRenderingContext2D, y: number, rot: number, t: number) {
  ctx.save();
  ctx.translate(BIRD_X, y);
  ctx.rotate(rot);

  // outer glow
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 36);
  glow.addColorStop(0, "rgba(255,180,240,0.7)");
  glow.addColorStop(1, "rgba(255,180,240,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.fill();

  // body — glass orb
  const body = ctx.createRadialGradient(-6, -8, 2, 0, 0, BIRD_R + 4);
  body.addColorStop(0, "rgba(255,255,255,0.95)");
  body.addColorStop(0.4, "rgba(255,200,240,0.85)");
  body.addColorStop(1, "rgba(140,120,255,0.7)");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2);
  ctx.fill();

  // rim
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // highlight
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.ellipse(-6, -8, 5, 3, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // wing — animated
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

  // eye
  ctx.fillStyle = "#1a1530";
  ctx.beginPath();
  ctx.arc(7, -3, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(7.7, -3.7, 0.8, 0, Math.PI * 2);
  ctx.fill();

  // beak
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
