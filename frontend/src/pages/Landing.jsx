import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, ArrowUpRight, ChevronDown } from "lucide-react";
import Loader from "../components/Loader.jsx";

import {
  site,
  steps,
  carries,
  limits,
  expiryOptions,
  truth,
} from "../data/landing.js";
import TossStage from "../components/TossStage.jsx";

gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * One reveal treatment, reused everywhere: things arrive like something set
 * down on a desk. Motion verb: toss.
 */
function useReveal(scopeRef) {
  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.utils.toArray("[data-reveal]").forEach((el) => {
        const targets = el.hasAttribute("data-stagger")
          ? Array.from(el.children)
          : [el];
        gsap.from(targets, {
          y: 28,
          autoAlpha: 0,
          duration: 0.9,
          ease: "expo.out",
          stagger: 0.06,
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });
    }, scope);

    return () => ctx.revert();
  }, [scopeRef]);
}

/** Plays once per tab: a 2.5s intro on every internal navigation would be a tax. */
const SEEN_KEY = "stash_intro_seen";

export default function Landing() {
  const rootRef = useRef(null);
  const [showLoader, setShowLoader] = useState(() => {
    if (typeof window === "undefined") return false;
    if (prefersReducedMotion()) return false;
    try {
      return sessionStorage.getItem(SEEN_KEY) !== "1";
    } catch {
      return true; // storage blocked: show it rather than crash
    }
  });

  // Lock scrolling for the duration, set before paint so the page cannot
  // flash scrolled underneath the curtain.
  useEffect(() => {
    if (!showLoader) return;
    document.documentElement.classList.add("is-loading");
  }, [showLoader]);

  const handleLoaderDone = () => {
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* storage blocked; the intro simply replays next load */
    }
    document.documentElement.classList.remove("is-loading");
    setShowLoader(false);
  };

  useReveal(rootRef);

  return (
    <div className="lp" ref={rootRef}>
      {showLoader && <Loader onDone={handleLoaderDone} />}
      <a className="lp-skip" href="#main">
        Skip to content
      </a>

      {/* ── header ──────────────────────────────────────────── */}
      <header style={{ paddingTop: "var(--gutter)" }}>
        <div className="lp-grid" style={{ alignItems: "center" }}>
          <a
            href="/"
            className="lp-mono lp-wordmark"
            aria-label="Stash, home"
            style={{
              gridColumn: "1 / span 6",
              fontSize: "var(--t-s)",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              minHeight: 28,
              justifySelf: "start",
            }}
          >
            <span className="lp-wordmark__dot" aria-hidden="true" />
            stash
          </a>
          <nav
            aria-label="Main"
            style={{
              gridColumn: "7 / span 6",
              display: "flex",
              gap: "clamp(1rem, 2.5vw, 2rem)",
              justifyContent: "flex-end",
              alignItems: "center",
            }}
          >
            <a className="lp-nav-link lp-nav-secondary" href="#carries">
              What it carries
            </a>
            <a className="lp-nav-link lp-nav-secondary" href="#limits">
              Limits
            </a>
            <a className="lp-nav-link" href="/rooms">
              Open app
            </a>
            {/* Phones only. <details> gives keyboard support, Escape and
                correct expanded state for free, with no focus-trap code. */}
            <details className="lp-menu">
              <summary className="lp-menu__btn" aria-label="Sections">
                Sections
                <ChevronDown
                  className="lp-menu__caret"
                  aria-hidden="true"
                  style={{ width: 15, height: 15 }}
                />
              </summary>
              <div className="lp-menu__panel">
                <a href="#how">How it works</a>
                <a href="#carries">What it carries</a>
                <a href="#limits">Limits</a>
              </div>
            </details>
          </nav>
        </div>
      </header>

      <main id="main">
        {/* ── 1. HERO + playground ──────────────────────────── */}
        <section className="lp-hero" aria-labelledby="hero-title">
          <div className="lp-grid">
            <div className="lp-hero__head" style={{ gridColumn: "1 / span 12" }}>
              <p className="lp-label" data-reveal>
                No account · No install · Free
              </p>
              <h1
                id="hero-title"
                className="lp-display"
                data-reveal
                style={{ marginTop: "0.75rem" }}
              >
                Toss it
                <br />
                across.
              </h1>
            </div>
          </div>

          {/* Pitch and playground. On desktop these sit either side of the
              headline (see .lp-hero in landing.css); on phones they stack. */}
          <div className="lp-grid">
            <div className="lp-hero__cols" style={{ gridColumn: "1 / span 12" }}>
            <div>
              <p
                data-reveal
                style={{
                  fontSize: "var(--t-l)",
                  lineHeight: 1.2,
                  letterSpacing: "-0.02em",
                  fontWeight: 600,
                  maxWidth: "20ch",
                }}
              >
                Phone to laptop in about ten seconds.
              </p>
              <p
                data-reveal
                style={{
                  fontSize: "var(--t-body)",
                  lineHeight: 1.55,
                  color: "var(--muted)",
                  maxWidth: "42ch",
                  marginTop: "1rem",
                }}
              >
                Open a room, drop your file in, and share the link. No sign up,
                nothing to install, and the room cleans itself up afterwards.
              </p>

              <div
                data-reveal
                data-stagger
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.85rem",
                  marginTop: "2rem",
                }}
              >
                <a className="lp-btn" href="/rooms">
                  Open a room
                  <ArrowRight
                    className="lp-btn__arrow"
                    aria-hidden="true"
                    style={{ width: 17, height: 17 }}
                  />
                </a>
                <a className="lp-btn lp-btn--ghost" href="#how">
                  How it works
                </a>
              </div>
            </div>

            {/* the signature */}
            <div>
              <TossStage />
              <p className="lp-label lp-stage__hint">
                Grab a file and throw it at the laptop
              </p>
            </div>
            </div>
          </div>
        </section>

        {/* ── 2. THREE STEPS ────────────────────────────────── */}
        <section
          id="how"
          aria-labelledby="how-title"
          style={{ paddingBlock: "clamp(5rem, 13vh, 11rem)" }}
        >
          <div className="lp-grid">
            <h2
              id="how-title"
              className="lp-h2"
              data-reveal
              style={{ gridColumn: "1 / span 12", maxWidth: "16ch" }}
            >
              Three steps, no account.
            </h2>

            <ol
              data-reveal
              data-stagger
              style={{
                gridColumn: "1 / span 12",
                listStyle: "none",
                margin: "clamp(2.5rem, 6vw, 4rem) 0 0",
                padding: 0,
                display: "grid",
                gap: "clamp(1.5rem, 4vw, 3rem)",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 16rem), 1fr))",
              }}
            >
              {steps.map((s, i) => (
                <li key={s.n}>
                  <span
                    className="lp-mono"
                    aria-hidden="true"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 54,
                      height: 54,
                      borderRadius: "var(--r)",
                      border: "2px solid var(--ink)",
                      background: [
                        "var(--coral)",
                        "var(--sun)",
                        "var(--blue)",
                      ][i],
                      color: i === 2 ? "#fff" : "var(--ink)",
                      fontWeight: 600,
                      fontSize: "1.05rem",
                      boxShadow: "0 4px 0 0 var(--ink)",
                    }}
                  >
                    {s.n}
                  </span>
                  <h3
                    style={{
                      fontSize: "var(--t-l)",
                      fontWeight: 800,
                      letterSpacing: "-0.03em",
                      margin: "1.25rem 0 0.5rem",
                    }}
                  >
                    {s.title}
                  </h3>
                  <p
                    style={{
                      fontSize: "var(--t-body)",
                      lineHeight: 1.55,
                      color: "var(--muted)",
                      maxWidth: "30ch",
                    }}
                  >
                    {s.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── 3. WHAT A ROOM CARRIES — index list ──────────── */}
        <section
          id="carries"
          aria-labelledby="carries-title"
          style={{ paddingBlock: "clamp(4rem, 10vh, 8rem)" }}
        >
          <div className="lp-grid">
            <h2
              id="carries-title"
              className="lp-h2"
              data-reveal
              style={{ gridColumn: "1 / span 12", maxWidth: "18ch" }}
            >
              Not only files.
            </h2>

            <ul
              style={{
                gridColumn: "1 / span 12",
                listStyle: "none",
                margin: "clamp(2rem, 5vw, 3rem) 0 0",
                padding: 0,
                borderBottom: "2px solid var(--ink)",
              }}
            >
              {carries.map((item) => (
                <li className="lp-row" key={item.n} data-reveal>
                  <div
                    className="lp-row__inner"
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "2.5rem minmax(0, 1fr) minmax(0, 1.3fr)",
                      gap: "var(--gutter)",
                      alignItems: "baseline",
                      paddingInline: "0.5rem",
                    }}
                  >
                    <span
                      className="lp-mono"
                      style={{ fontSize: "var(--t-xs)", color: "var(--muted)" }}
                    >
                      {item.n}
                    </span>
                    <h3
                      style={{
                        fontSize: "clamp(1.3rem, 3vw, 2.1rem)",
                        fontWeight: 800,
                        letterSpacing: "-0.035em",
                      }}
                    >
                      {item.title}
                    </h3>
                    <div>
                      <p
                        className="lp-mono"
                        style={{
                          fontSize: "var(--t-xs)",
                          color: "var(--blue)",
                          marginBottom: "0.35rem",
                          fontWeight: 500,
                        }}
                      >
                        {item.meta}
                      </p>
                      <p
                        style={{
                          fontSize: "var(--t-s)",
                          lineHeight: 1.5,
                          color: "var(--muted)",
                        }}
                      >
                        {item.body}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── 4. LIMITS STRIP ──────────────────────────────── */}
        <section
          id="limits"
          aria-labelledby="limits-title"
          className="lp-strip"
          style={{ paddingBlock: "clamp(3rem, 8vh, 5.5rem)" }}
        >
          <div className="lp-grid">
            <h2
              id="limits-title"
              data-reveal
              style={{
                gridColumn: "1 / span 12",
                fontSize: "var(--t-l)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                marginBottom: "clamp(1.5rem, 4vw, 2.5rem)",
              }}
            >
              The limits, up front. No asterisks.
            </h2>

            <dl
              data-reveal
              data-stagger
              style={{
                gridColumn: "1 / span 12",
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(min(100%, 10rem), 1fr))",
                gap: "var(--gutter)",
                margin: 0,
              }}
            >
              {limits.map((l) => (
                <div key={l.label}>
                  <dd
                    className="lp-mono"
                    style={{
                      margin: 0,
                      fontSize: "clamp(2.25rem, 5.5vw, 4rem)",
                      fontWeight: 600,
                      letterSpacing: "-0.045em",
                      lineHeight: 1,
                    }}
                  >
                    {l.value}
                    <span style={{ fontSize: "0.34em", marginLeft: "0.35em" }}>
                      {l.unit}
                    </span>
                  </dd>
                  <dt
                    style={{
                      fontSize: "var(--t-s)",
                      marginTop: "0.5rem",
                      lineHeight: 1.4,
                      opacity: 0.85,
                    }}
                  >
                    {l.label}
                  </dt>
                </div>
              ))}
            </dl>

            <div
              data-reveal
              style={{
                gridColumn: "1 / span 12",
                marginTop: "clamp(2rem, 5vw, 3rem)",
                paddingTop: "1.5rem",
                borderTop: "2px solid rgba(255,255,255,0.3)",
              }}
            >
              <p
                className="lp-label"
                style={{ color: "rgba(255,255,255,0.85)", marginBottom: "1rem" }}
              >
                You pick how long it lives
              </p>
              <ul
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                }}
              >
                {expiryOptions.map((o) => (
                  <li
                    key={o.label}
                    className="lp-mono"
                    style={{
                      fontSize: "var(--t-s)",
                      padding: "0.5rem 0.9rem",
                      borderRadius: "var(--r)",
                      border: "2px solid #fff",
                      background: o.isDefault ? "#fff" : "transparent",
                      color: o.isDefault ? "var(--blue)" : "#fff",
                      fontWeight: o.isDefault ? 600 : 400,
                    }}
                  >
                    {o.label}
                    {o.isDefault ? " · default" : ""}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── 5. STRAIGHT TALK ─────────────────────────────── */}
        <section
          aria-labelledby="truth-title"
          style={{ paddingBlock: "clamp(4.5rem, 12vh, 9rem)" }}
        >
          <div className="lp-grid" style={{ rowGap: "clamp(2rem, 5vw, 3.5rem)" }}>
            <h2
              id="truth-title"
              className="lp-h2"
              data-reveal
              style={{ gridColumn: "1 / span 12", maxWidth: "20ch" }}
            >
              Straight talk.
            </h2>

            <div
              style={{
                gridColumn: "1 / span 12",
                display: "grid",
                gap: "clamp(2rem, 5vw, 3.5rem)",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(min(100%, 20rem), 1fr))",
              }}
            >
              <div data-reveal>
                <p
                  className="lp-label"
                  style={{ color: "var(--blue)", marginBottom: "1.1rem" }}
                >
                  What it does
                </p>
                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "grid",
                    gap: "0.85rem",
                  }}
                >
                  {truth.does.map((t) => (
                    <li
                      key={t}
                      style={{
                        fontSize: "var(--t-body)",
                        lineHeight: 1.5,
                        paddingLeft: "1.6rem",
                        position: "relative",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          left: 0,
                          top: "0.42em",
                          width: 10,
                          height: 10,
                          borderRadius: 3,
                          background: "var(--blue)",
                          border: "2px solid var(--ink)",
                        }}
                      />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              <div data-reveal>
                <p className="lp-label" style={{ marginBottom: "1.1rem" }}>
                  What it does not
                </p>
                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "grid",
                    gap: "0.85rem",
                  }}
                >
                  {truth.doesNot.map((t) => (
                    <li
                      key={t}
                      style={{
                        fontSize: "var(--t-body)",
                        lineHeight: 1.5,
                        color: "var(--muted)",
                        paddingLeft: "1.6rem",
                        position: "relative",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          left: 0,
                          top: "0.42em",
                          width: 10,
                          height: 10,
                          borderRadius: 3,
                          background: "transparent",
                          border: "2px solid var(--muted)",
                        }}
                      />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── 6. CLOSING CTA ───────────────────────────────── */}
        <section
          aria-labelledby="cta-title"
          style={{
            paddingBlock: "clamp(4rem, 11vh, 8rem)",
            borderTop: "2px solid var(--ink)",
          }}
        >
          <div className="lp-grid">
            <div style={{ gridColumn: "1 / span 12" }}>
              <h2
                id="cta-title"
                className="lp-display"
                data-reveal
                style={{ fontSize: "var(--t-xl)" }}
              >
                Got something to send?
              </h2>
              <div data-reveal style={{ marginTop: "2rem" }}>
                <a className="lp-btn" href="/rooms">
                  Open a room
                  <ArrowRight
                    className="lp-btn__arrow"
                    aria-hidden="true"
                    style={{ width: 17, height: 17 }}
                  />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: "2px solid var(--ink)",
          paddingBlock: "clamp(2.5rem, 7vh, 4.5rem)",
          background: "#fff",
        }}
      >
        <div className="lp-grid" style={{ rowGap: "2rem" }}>
          {/* Decorative, but still legible: an outlined wordmark reads as a
              deliberate graphic rather than washed-out text, and clears the
              contrast floor instead of hiding from it. */}
          <p
            className="lp-display lp-footer-mark"
            aria-hidden="true"
            style={{
              gridColumn: "1 / span 12",
              fontSize: "clamp(3rem, 15vw, 11rem)",
              margin: 0,
              lineHeight: 0.8,
              userSelect: "none",
            }}
          >
            stash
          </p>

          <p
            style={{
              gridColumn: "1 / span 12",
              fontSize: "var(--t-s)",
              lineHeight: 1.6,
              color: "var(--muted)",
              maxWidth: "62ch",
            }}
          >
            Stash is not end-to-end encrypted. Files are encrypted in transit and
            at rest by the storage provider, and whoever runs the server can
            access what passes through it. Do not use it for anything you would
            not trust a hosted service with. Read the{" "}
            <a className="lp-link" href="/privacy">
              privacy policy
            </a>{" "}
            before you upload.
          </p>

          <nav
            aria-label="Footer"
            style={{
              gridColumn: "1 / span 12",
              display: "flex",
              flexWrap: "wrap",
              gap: "1.5rem",
              alignItems: "center",
            }}
          >
            <a className="lp-util" href="/privacy">
              Privacy
            </a>
            <a className="lp-util" href="/terms">
              Terms &amp; acceptable use
            </a>
            <a
              className="lp-util"
              href={site.repo}
              target="_blank"
              rel="noopener noreferrer"
              style={{ gap: "0.3rem" }}
            >
              Source (MIT)
              <ArrowUpRight aria-hidden="true" style={{ width: 12, height: 12 }} />
            </a>
            <a className="lp-util" href="mailto:abuse@stash.example">
              Report abuse
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
