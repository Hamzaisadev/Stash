import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { createToss } from "../lib/toss.js";
import { chips as chipData } from "../data/landing.js";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const TONES = {
  coral: "#ff5d3a",
  blue: "#2f4bff",
  sun: "#ffc53d",
  ink: "#14161a",
};

/** Ink that passes contrast on each chip colour. */
const LABEL_ON = {
  coral: "#14161a",
  blue: "#ffffff",
  sun: "#14161a",
  ink: "#ffffff",
};

/**
 * The hero playground.
 *
 * Chips sit on the desk with real physics. Grab one and throw it at the
 * laptop; it arcs, tumbles, and the laptop bounces when it catches. This is
 * both the signature moment and an honest demo of the product's core act.
 *
 * Canvas rather than DOM nodes: five elements with per-frame transforms is
 * fine either way, but canvas keeps the main thread free of layout work and
 * lets the motion trail cost nothing.
 */
export default function TossStage() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [caughtCount, setCaughtCount] = useState(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas || prefersReducedMotion()) return;

    const ctx = canvas.getContext("2d");
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = wrap.clientWidth;
    let h = wrap.clientHeight;

    const isPhone = () => w < 720;

    /** The catch zone, drawn as a laptop. Recomputed on resize. */
    const target = { x: 0, y: 0, w: 0, h: 0 };
    const layoutTarget = () => {
      const tw = Math.min(260, w * (isPhone() ? 0.42 : 0.26));
      const th = tw * 0.62;
      target.w = tw;
      target.h = th;
      target.x = w - tw - (isPhone() ? 8 : 24);
      target.y = h - th - 10;
    };

    // Chips start as a neat fanned stack resting on the desk, like a pile of
    // cards. Laying them out already-settled avoids a tangle on load: an
    // overlapping start let the separation pass shove them into odd angles.
    const chips = chipData.map((c, i) => {
      const cw = isPhone() ? 100 : 126;
      const ch = isPhone() ? 36 : 44;
      return {
        ...c,
        w: cw,
        h: ch,
        x: cw / 2 + 14 + i * (isPhone() ? 6 : 10),
        y: h - ch / 2 - i * (ch + 2),
        vx: 0,
        vy: 0,
        angle: (i % 2 ? 1 : -1) * 0.022,
        spin: 0,
        seed: i * 1.7,
        flash: 0, // catch highlight, decays
      };
    });

    const bounds = { w, h };
    let landed = 0;

    const sim = createToss({
      chips,
      bounds,
      onCatch: (c) => {
        c.flash = 1;
        landed += 1;
        setCaughtCount(landed);
        // The laptop acknowledges the catch.
        gsap.fromTo(
          pulse,
          { v: 1 },
          { v: 0, duration: 0.7, ease: "elastic.out(1, 0.45)" },
        );
      },
    });

    const pulse = { v: 0 };

    const resize = () => {
      const nw = wrap.clientWidth;
      const nh = wrap.clientHeight;
      // Reallocating the backing store is expensive, and the hero's svh-based
      // height changes continuously while mobile browser chrome slides away.
      // Without this guard the observer fired mid-scroll and produced frames
      // over a second long.
      if (nw === w && nh === h && canvas.width) return;
      w = nw;
      h = nh;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layoutTarget();
      sim.resize(w, h);
    };
    w = 0;
    h = 0;
    resize();

    // Coalesce bursts of resize notifications into one pass on the next frame.
    let resizePending = false;
    const ro = new ResizeObserver(() => {
      if (resizePending) return;
      resizePending = true;
      requestAnimationFrame(() => {
        resizePending = false;
        resize();
      });
    });
    ro.observe(wrap);

    /* --- pointer ------------------------------------------------------- */
    const local = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const onDown = (e) => {
      const { x, y } = local(e);
      const hit = sim.grab(x, y);
      if (hit) {
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault(); // only once we actually grabbed, so scrolling still works
      }
    };
    const onMove = (e) => {
      const { x, y } = local(e);
      sim.move(x, y);
      if (sim.held) e.preventDefault();
    };
    const onUp = (e) => {
      if (sim.held) {
        sim.release();
        if (canvas.hasPointerCapture(e.pointerId))
          canvas.releasePointerCapture(e.pointerId);
      }
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    /* --- draw ---------------------------------------------------------- */
    const roundRect = (x, y, rw, rh, r) => {
      ctx.beginPath();
      ctx.roundRect(-rw / 2, -rh / 2, rw, rh, r);
      void x;
      void y;
    };

    const drawTarget = () => {
      const squash = pulse.v;
      ctx.save();
      ctx.translate(target.x + target.w / 2, target.y + target.h);
      ctx.scale(1 + squash * 0.06, 1 - squash * 0.08);
      ctx.translate(-(target.x + target.w / 2), -(target.y + target.h));

      // screen
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#14161a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(target.x, target.y, target.w, target.h * 0.82, 8);
      ctx.fill();
      ctx.stroke();

      // base
      ctx.fillStyle = "#14161a";
      ctx.beginPath();
      ctx.roundRect(
        target.x - target.w * 0.06,
        target.y + target.h * 0.84,
        target.w * 1.12,
        target.h * 0.14,
        6,
      );
      ctx.fill();

      // a caught-count readout on the screen
      ctx.fillStyle = landed > 0 ? "#2f4bff" : "#9aa0a9";
      ctx.font = `600 ${Math.round(target.w * 0.1)}px "Geist Mono Variable", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        landed > 0 ? `${landed} received` : "waiting",
        target.x + target.w / 2,
        target.y + target.h * 0.41,
      );
      ctx.restore();
    };

    const drawChip = (c) => {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);

      // body
      ctx.fillStyle = TONES[c.tone] || TONES.ink;
      ctx.strokeStyle = "#14161a";
      ctx.lineWidth = 2;
      roundRect(0, 0, c.w, c.h, 10);
      ctx.fill();
      ctx.stroke();

      // catch flash
      if (c.flash > 0.01) {
        ctx.fillStyle = `rgba(255,255,255,${c.flash * 0.75})`;
        ctx.fill();
        c.flash *= 0.9;
      }

      // label
      ctx.fillStyle = LABEL_ON[c.tone] || "#fff";
      ctx.font = `500 ${Math.round(c.h * 0.3)}px "Geist Mono Variable", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(c.label, 0, 1);
      ctx.restore();
    };

    let last = gsap.ticker.time;
    let onScreen = true;

    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
      },
      { rootMargin: "120px" },
    );
    io.observe(wrap);

    const tick = () => {
      const now = gsap.ticker.time;
      const dt = now - last;
      last = now;
      if (!onScreen) return; // no work while off screen

      sim.update(dt, target, now);

      ctx.clearRect(0, 0, w, h);

      // desk line
      ctx.strokeStyle = "#e3ddd1";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, h - 1);
      ctx.lineTo(w, h - 1);
      ctx.stroke();

      drawTarget();
      for (const c of chips) drawChip(c);
    };

    gsap.ticker.add(tick);

    return () => {
      gsap.ticker.remove(tick);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div className="lp-stage" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="A desk with sample file chips you can drag and throw at a laptop."
      />
      {/* Reduced motion and no-JS: the same files, laid out, no physics. */}
      <div className="lp-stage__static" aria-hidden="true">
        {chipData.map((c) => (
          <span
            key={c.id}
            className="lp-chip-static"
            style={{
              background: TONES[c.tone],
              color: LABEL_ON[c.tone],
            }}
          >
            {c.label}
          </span>
        ))}
      </div>
      {/* Announce catches to screen readers without a visual duplicate. */}
      <p className="sr-only" aria-live="polite">
        {caughtCount > 0
          ? `${caughtCount} file${caughtCount === 1 ? "" : "s"} delivered to the laptop.`
          : ""}
      </p>
    </div>
  );
}
