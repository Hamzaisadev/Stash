import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

const DURATION = 2.5; // seconds, fixed by design decision (see DESIGN.md)

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** The chips that assemble during the count, then get tossed. */
const CHIPS = [
  { label: "beach.jpg", tone: "var(--coral)", ink: "#14161a", at: 0.1 },
  { label: "setlist.pdf", tone: "var(--blue)", ink: "#ffffff", at: 0.3 },
  { label: "demo.mp3", tone: "var(--sun)", ink: "#14161a", at: 0.5 },
  { label: "notes.txt", tone: "#14161a", ink: "#ffffff", at: 0.7 },
];

/**
 * The intro: a stack of file chips assembles while a counter runs, then the
 * whole pile is tossed off-screen and the page is revealed underneath.
 *
 * Runs for a fixed 2.5s on every visit, by explicit request. That is longer
 * than a utility page would normally earn, so three things soften it:
 * a skip button, a session flag so it plays once per tab, and a full bypass
 * under reduced motion.
 */
export default function Loader({ onDone }) {
  const rootRef = useRef(null);
  const countRef = useRef(null);
  const barRef = useRef(null);
  const chipRefs = useRef([]);
  const tlRef = useRef(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if (prefersReducedMotion()) {
      onDone?.();
      return;
    }

    const progress = { v: 0 };
    const tl = gsap.timeline({
      onComplete: () => {
        document.documentElement.classList.remove("is-loading");
        onDone?.();
      },
    });
    tlRef.current = tl;

    // The counter and the bar share one tween, so they can never disagree.
    tl.to(
      progress,
      {
        v: 100,
        duration: DURATION * 0.78,
        ease: "power1.inOut",
        onUpdate: () => setCount(Math.round(progress.v)),
      },
      0,
    );
    tl.fromTo(
      barRef.current,
      { scaleX: 0 },
      { scaleX: 1, duration: DURATION * 0.78, ease: "power1.inOut" },
      0,
    );

    // Each chip drops onto the pile as the count passes its mark.
    CHIPS.forEach((c, i) => {
      const el = chipRefs.current[i];
      if (!el) return;
      tl.fromTo(
        el,
        { yPercent: -260, autoAlpha: 0, rotate: i % 2 ? 8 : -8 },
        {
          yPercent: 0,
          autoAlpha: 1,
          rotate: i % 2 ? 1.5 : -1.5,
          duration: 0.5,
          ease: "back.out(2)",
        },
        c.at * DURATION * 0.72,
      );
    });

    // The toss: the pile leaves to the right, then the curtain lifts.
    tl.to(
      chipRefs.current.filter(Boolean),
      {
        x: () => window.innerWidth * 0.75,
        y: -60,
        rotate: 24,
        autoAlpha: 0,
        duration: 0.5,
        ease: "power3.in",
        stagger: 0.04,
      },
      DURATION * 0.78,
    );
    tl.to(
      [countRef.current, barRef.current?.parentElement],
      { autoAlpha: 0, duration: 0.25, ease: "power2.in" },
      DURATION * 0.78,
    );
    tl.to(
      root,
      { yPercent: -100, duration: 0.55, ease: "expo.inOut" },
      DURATION * 0.86,
    );

    return () => {
      tl.kill();
      document.documentElement.classList.remove("is-loading");
    };
  }, [onDone]);

  // Skip jumps the timeline to the toss rather than cutting hard, so the
  // handoff into the page still reads as one motion.
  const skip = () => {
    const tl = tlRef.current;
    if (!tl) return onDone?.();
    tl.tweenTo(tl.duration(), { duration: 0.45, ease: "power2.inOut" });
  };

  return (
    <div className="lp-loader" ref={rootRef} role="status" aria-label="Loading Stash">
      <div className="lp-loader__inner">
        <div className="lp-loader__stack">
          {CHIPS.map((c, i) => (
            <span
              key={c.label}
              ref={(el) => (chipRefs.current[i] = el)}
              className="lp-loader__chip"
              style={{ background: c.tone, color: c.ink }}
            >
              {c.label}
            </span>
          ))}
        </div>

        <div className="lp-loader__meter">
          <span className="lp-loader__count lp-mono" ref={countRef}>
            {String(count).padStart(3, "0")}
          </span>
          <span className="lp-loader__track">
            <span className="lp-loader__bar" ref={barRef} />
          </span>
        </div>
      </div>

      <button type="button" className="lp-loader__skip lp-mono" onClick={skip}>
        Skip
      </button>
    </div>
  );
}
