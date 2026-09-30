// PrivateAI · rings.js
// The generative field (DESIGN.md, section 5.3): a slowly turning field of fine orbits with small points of
// light travelling along them. On the home page it is a quiet background behind the holding page's own mark,
// which keeps its original CSS animation (data-mode="field": orbits only). On the 404 page it also draws the
// two rings, apart. It is seeded, so it draws the same field every time; it runs at no more than 30 frames a
// second; and it stops when it is out of view, when the tab is hidden, when the visitor prefers reduced motion
// (one still frame is drawn instead), or when the Pause motion box is ticked. Without this script, nothing
// here is drawn and the page is complete.

const TAU = Math.PI * 2;
const RING_R = 118;
const STROKE = 28;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const lightScheme = matchMedia("(prefers-color-scheme: light)");

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// "#rrggbb" to an rgba() string, for gradients that fade a token colour to nothing.
function withAlpha(hex, alpha) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(255,255,255,${alpha})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}

class Rings {
  constructor(host) {
    this.host = host;
    this.apart = host.dataset.variant === "apart";
    this.fieldOnly = host.dataset.mode === "field";
    this.markScale = Number(host.dataset.markScale) || 0.76;
    this.pauseBox = host.closest(".art")?.querySelector("[data-motion-pause]") || null;
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    if (!this.ctx) {
      // No canvas: fall back to the holding page's CSS drift on the SVG mark (paused by the same box).
      host.querySelector("svg")?.classList.add("mark--drift");
      return;
    }
    host.append(this.canvas);

    this.t = 2.4; // a pleasing arrangement for the still frame
    this.last = 0;
    this.visible = true;
    this.paused = this.pauseBox?.checked ?? false;
    this.running = false;
    this.tick = this.tick.bind(this);

    this.makeField(Number(host.dataset.seed) || 1609);
    this.readColours();
    this.resize();
    this.draw();
    if (!this.fieldOnly) host.classList.add("is-drawn");
    this.pauseBox?.addEventListener("change", () => {
      this.paused = this.pauseBox.checked;
      this.update();
    });

    new ResizeObserver(() => {
      this.resize();
      this.draw();
    }).observe(host);
    new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      this.update();
    }).observe(host);
    document.addEventListener("visibilitychange", () => this.update());
    reduceMotion.addEventListener("change", () => this.update());
    lightScheme.addEventListener("change", () => {
      this.readColours();
      this.draw();
    });
    this.update();
  }

  makeField(seed) {
    const rand = seeded(seed);
    const centres = this.apart ? [118, 394] : [206, 306];
    this.centres = centres;
    const count = this.apart ? 8 : 12;
    this.orbits = [];
    for (let i = 0; i < count; i++) {
      const side = i % 2; // 0: violet, left; 1: gold, right
      this.orbits.push({
        cx: centres[side] + (rand() - 0.5) * 60,
        cy: 256 + (rand() - 0.5) * 36,
        r: 150 + rand() * 175,
        squash: 0.42 + rand() * 0.5,
        tilt: rand() * TAU,
        spin: (0.012 + rand() * 0.03) * (rand() < 0.5 ? -1 : 1),
        side,
        alpha: 0.09 + rand() * 0.15,
      });
    }
    this.points = [];
    const perOrbit = this.apart ? 1 : 2;
    for (const orbit of this.orbits) {
      for (let j = 0; j < perOrbit; j++) {
        this.points.push({
          orbit,
          phase: rand() * TAU,
          speed: (0.1 + rand() * 0.22) * (rand() < 0.5 ? -1 : 1),
          size: 1.6 + rand() * 1.8,
          trail: 0.35 + rand() * 0.45,
        });
      }
    }
  }

  readColours() {
    const css = getComputedStyle(this.host);
    const get = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    this.colours = {
      violet: get("--violet", "#9d86ff"),
      gold: get("--gold", "#f1d27a"),
      gold2: get("--gold-2", "#c9a227"),
      core: get("--core", "#ffffff"),
    };
    // Brighter on paper; quieter when the field sits behind the holding page's mark.
    this.boost = (lightScheme.matches && !this.fieldOnly ? 1.35 : 1) * (this.fieldOnly ? 0.75 : 1);
    // Behind the holding page's mark the field keeps the holding page's own palette in both themes.
    if (this.fieldOnly) this.colours = { violet: "#9d86ff", gold: "#f1d27a", gold2: "#c9a227", core: "#ffffff" };
  }

  resize() {
    const size = this.host.getBoundingClientRect().width;
    if (!size) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.size = size;
    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
    // The mark fills the middle of the box (76% on the 404, 50% behind the home page's mark), so the field
    // lines up with the SVG it surrounds.
    this.scale = (size * this.markScale) / 512;
    this.offset = (size * (1 - this.markScale)) / 2;
    this.dpr = dpr;
    const ctx = this.ctx;
    const mid = size / 2;
    this.fade = ctx.createRadialGradient(mid, mid, size * 0.18, mid, mid, size * 0.5);
    this.fade.addColorStop(0, "rgba(0,0,0,1)");
    this.fade.addColorStop(0.7, "rgba(0,0,0,0.85)");
    this.fade.addColorStop(1, "rgba(0,0,0,0)");
  }

  canRun() {
    return !reduceMotion.matches && !this.paused && this.visible && document.visibilityState === "visible";
  }

  update() {
    if (this.canRun()) this.start();
    else {
      this.stop();
      if (reduceMotion.matches && this.ctx) {
        this.t = 2.4;
        this.draw();
      }
    }
  }

  start() {
    if (this.running || !this.ctx) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  stop() {
    if (!this.running) return;
    cancelAnimationFrame(this.raf);
    this.running = false;
  }

  tick(now) {
    this.raf = requestAnimationFrame(this.tick);
    const elapsed = now - this.last;
    if (elapsed < 33) return; // at most 30 frames a second
    this.last = now;
    this.t += Math.min(elapsed, 100) / 1000;
    this.draw();
  }

  // Convert mark units (the holding page's 512 box) to canvas pixels.
  x(u) {
    return this.offset + u * this.scale;
  }

  draw() {
    const { ctx, size, colours, boost } = this;
    if (!size) return;
    const s = this.scale;
    const t = this.t;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.lineCap = "round";

    // Breathing, as on the holding page: 10 units apart over 7 seconds, core pulsing over 3.5.
    const drift = 5 * (1 - Math.cos((TAU * t) / 7));
    const ax = this.centres[0] + (this.apart ? -drift * 0.6 : drift);
    const bx = this.centres[1] - (this.apart ? -drift * 0.6 : drift);

    // The field of orbits.
    for (const o of this.orbits) {
      const rot = o.tilt + o.spin * t;
      ctx.beginPath();
      ctx.ellipse(this.x(o.cx), this.x(o.cy), o.r * s, o.r * o.squash * s, rot, 0, TAU);
      ctx.strokeStyle = o.side ? colours.gold : colours.violet;
      ctx.globalAlpha = Math.min(1, o.alpha * boost);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Points of light travelling along them, with short fading trails.
    for (const p of this.points) {
      const o = p.orbit;
      const rot = o.tilt + o.spin * t;
      const theta = p.phase + p.speed * t;
      const rx = o.r * s;
      const ry = o.r * o.squash * s;
      const cx = this.x(o.cx);
      const cy = this.x(o.cy);
      const colour = o.side ? colours.gold : colours.violet;
      const dir = Math.sign(p.speed);
      const segments = 5;
      for (let k = 0; k < segments; k++) {
        const a0 = theta - dir * p.trail * ((k + 1) / segments);
        const a1 = theta - dir * p.trail * (k / segments);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, rot, Math.min(a0, a1), Math.max(a0, a1));
        ctx.strokeStyle = colour;
        ctx.globalAlpha = Math.min(1, 0.5 * (1 - k / segments) * boost);
        ctx.lineWidth = p.size * s * 0.9;
        ctx.stroke();
      }
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const px = cx + rx * cos * Math.cos(rot) - ry * sin * Math.sin(rot);
      const py = cy + rx * cos * Math.sin(rot) + ry * sin * Math.cos(rot);
      // A point passing through the lens the two rings share glows brighter.
      const ux = (px - this.offset) / s;
      const uy = (py - this.offset) / s;
      const inLens =
        !this.apart && Math.hypot(ux - ax, uy - 256) < RING_R && Math.hypot(ux - bx, uy - 256) < RING_R;
      ctx.beginPath();
      ctx.arc(px, py, p.size * s * (inLens ? 2.4 : 1.3), 0, TAU);
      ctx.fillStyle = inLens ? colours.core : colour;
      ctx.globalAlpha = inLens ? 0.95 : Math.min(1, 0.85 * boost);
      ctx.fill();
    }

    // Soften the field towards the edges of the box.
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = this.fade;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = "source-over";

    // Behind the holding page's mark, the field is all that is drawn.
    if (this.fieldOnly) return;

    // The mark itself, as drawn on the holding page.
    ctx.lineWidth = STROKE * s;
    ctx.beginPath();
    ctx.arc(this.x(ax), this.x(256), RING_R * s, 0, TAU);
    ctx.strokeStyle = colours.violet;
    ctx.stroke();

    const g = ctx.createLinearGradient(this.x(bx - RING_R), this.x(256 - RING_R), this.x(bx + RING_R), this.x(256 + RING_R));
    g.addColorStop(0, colours.gold);
    g.addColorStop(1, colours.gold2);
    ctx.beginPath();
    ctx.arc(this.x(bx), this.x(256), RING_R * s, 0, TAU);
    ctx.strokeStyle = g;
    ctx.stroke();

    if (!this.apart) {
      const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.cos((TAU * t) / 3.5));
      const cx = this.x(256);
      const halo = ctx.createRadialGradient(cx, cx, 0, cx, cx, 70 * s);
      halo.addColorStop(0, withAlpha(colours.core, 1));
      halo.addColorStop(1, withAlpha(colours.core, 0));
      ctx.globalAlpha = 0.18 * pulse;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cx, 70 * s, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = colours.core;
      ctx.beginPath();
      ctx.arc(cx, cx, 20 * s, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

for (const host of document.querySelectorAll("[data-rings]")) new Rings(host);
