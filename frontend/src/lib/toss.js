/**
 * The toss playground: a tiny 2D physics solver for the hero.
 *
 * Why hand-written instead of a library: the whole effect needs gravity, a
 * floor, walls, box-ish collision and throw velocity. That is ~150 lines here
 * versus ~45 KB for matter.js, on a page whose performance budget matters.
 *
 * Runs as a single gsap.ticker callback, per the one-clock rule. No private
 * requestAnimationFrame loop.
 */

const GRAVITY = 2600; // px/s², tuned so a throw arcs rather than drops
const FRICTION = 0.86; // ground drag per second
const AIR = 0.995;
const RESTITUTION = 0.42; // bounce energy kept on impact
const MAX_DT = 1 / 30; // clamp so a backgrounded tab cannot explode the sim

/**
 * @typedef {object} Chip
 * @property {number} x,y      centre position in CSS pixels
 * @property {number} vx,vy    velocity px/s
 * @property {number} w,h      size
 * @property {number} angle    radians
 * @property {number} spin     radians/s
 */

export function createToss({ chips, bounds, onCatch }) {
  let held = null;
  let pointer = { x: 0, y: 0, px: 0, py: 0 };
  let caught = new Set();

  /** Integrate one chip. */
  const step = (c, dt) => {
    if (c === held) return; // held chips follow the pointer, not gravity

    c.vy += GRAVITY * dt;
    c.vx *= Math.pow(AIR, dt * 60);
    c.vy *= Math.pow(AIR, dt * 60);

    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.angle += c.spin * dt;
    c.spin *= Math.pow(0.98, dt * 60);

    const halfW = c.w / 2;
    const halfH = c.h / 2;

    // Floor
    if (c.y + halfH > bounds.h) {
      c.y = bounds.h - halfH;
      if (Math.abs(c.vy) > 40) {
        c.vy = -c.vy * RESTITUTION;
        c.spin += (Math.random() - 0.5) * 6;
      } else {
        c.vy = 0;
      }
      c.vx *= Math.pow(FRICTION, dt * 60);
      c.spin *= Math.pow(0.8, dt * 60);
      // settle the tilt when it is basically at rest
      if (Math.abs(c.vx) < 8) c.angle *= Math.pow(0.85, dt * 60);
    }

    // Ceiling
    if (c.y - halfH < 0) {
      c.y = halfH;
      c.vy = Math.abs(c.vy) * RESTITUTION;
    }

    // Walls
    if (c.x - halfW < 0) {
      c.x = halfW;
      c.vx = Math.abs(c.vx) * RESTITUTION;
      c.spin += 2;
    }
    if (c.x + halfW > bounds.w) {
      c.x = bounds.w - halfW;
      c.vx = -Math.abs(c.vx) * RESTITUTION;
      c.spin -= 2;
    }
  };

  /** Cheap pairwise separation so chips do not stack inside each other. */
  const separate = () => {
    for (let i = 0; i < chips.length; i++) {
      for (let j = i + 1; j < chips.length; j++) {
        const a = chips[i];
        const b = chips[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minX = (a.w + b.w) / 2;
        const minY = (a.h + b.h) / 2;
        if (Math.abs(dx) < minX && Math.abs(dy) < minY) {
          const overlapX = minX - Math.abs(dx);
          const overlapY = minY - Math.abs(dy);
          if (overlapX < overlapY) {
            const push = (overlapX / 2) * Math.sign(dx || 1);
            if (a !== held) a.x -= push;
            if (b !== held) b.x += push;
            const t = a.vx;
            if (a !== held) a.vx = b.vx * 0.5;
            if (b !== held) b.vx = t * 0.5;
          } else {
            const push = (overlapY / 2) * Math.sign(dy || 1);
            if (a !== held) a.y -= push;
            if (b !== held) b.y += push;
            const t = a.vy;
            if (a !== held) a.vy = b.vy * 0.4;
            if (b !== held) b.vy = t * 0.4;
          }
        }
      }
    }
  };

  /** The catch zone: the laptop. A chip landing inside it counts as sent. */
  const checkCatch = (target) => {
    if (!target) return;
    for (const c of chips) {
      if (c === held) continue;
      const inside =
        c.x > target.x &&
        c.x < target.x + target.w &&
        c.y > target.y &&
        c.y < target.y + target.h;
      if (inside && !caught.has(c.id)) {
        caught.add(c.id);
        onCatch?.(c);
      } else if (!inside && caught.has(c.id)) {
        caught.delete(c.id);
      }
    }
  };

  return {
    chips,
    get held() {
      return held;
    },
    /** Pick up the chip under (x, y), topmost first. */
    grab(x, y) {
      for (let i = chips.length - 1; i >= 0; i--) {
        const c = chips[i];
        if (
          Math.abs(x - c.x) < c.w / 2 + 6 &&
          Math.abs(y - c.y) < c.h / 2 + 6
        ) {
          held = c;
          c.vx = 0;
          c.vy = 0;
          pointer = { x, y, px: x, py: y };
          // bring to front
          chips.splice(i, 1);
          chips.push(c);
          return c;
        }
      }
      return null;
    },
    move(x, y) {
      pointer.px = pointer.x;
      pointer.py = pointer.y;
      pointer.x = x;
      pointer.y = y;
      if (held) {
        held.x = x;
        held.y = y;
        held.angle = Math.max(-0.5, Math.min(0.5, (x - pointer.px) * 0.03));
      }
    },
    /** Let go, handing the pointer's recent velocity to the chip. */
    release() {
      if (!held) return;
      const vx = (pointer.x - pointer.px) * 60;
      const vy = (pointer.y - pointer.py) * 60;
      held.vx = Math.max(-2600, Math.min(2600, vx));
      held.vy = Math.max(-2600, Math.min(2600, vy));
      held.spin = (Math.random() - 0.5) * 8 + vx * 0.004;
      held = null;
    },
    resize(w, h) {
      bounds.w = w;
      bounds.h = h;
      for (const c of chips) {
        c.x = Math.max(c.w / 2, Math.min(w - c.w / 2, c.x));
        c.y = Math.max(c.h / 2, Math.min(h - c.h / 2, c.y));
      }
    },
    /**
     * Advance the simulation.
     * @param {number} dt seconds
     * @param {{x:number,y:number,w:number,h:number}|null} target catch zone
     * @param {number} idle slow ambient drift, 0 under reduced motion
     */
    update(dt, target, idle = 0) {
      const d = Math.min(dt, MAX_DT);
      for (const c of chips) {
        // Ambient breath so the pile is never completely dead at rest.
        if (idle && c !== held && Math.abs(c.vx) < 3 && c.y + c.h / 2 >= bounds.h - 1) {
          c.angle += Math.sin(idle + c.seed) * 0.0007;
        }
        step(c, d);
      }
      separate();
      checkCatch(target);
    },
  };
}
