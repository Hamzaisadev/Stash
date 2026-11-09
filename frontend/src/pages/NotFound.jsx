import { useEffect } from "react";
import { ArrowRight } from "lucide-react";

/**
 * 404, in the concept's voice: a throw that missed.
 *
 * Rooms are deleted after 24 hours, so a dead link here is the normal end of a
 * room's life rather than an error. The copy says that plainly instead of
 * blaming the visitor.
 */
export default function NotFound() {
  // A distinct title, so this page is distinguishable from the home page in
  // search results and tab strips.
  useEffect(() => {
    const previous = document.title;
    document.title = "Nothing landed here: Stash";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="lp" style={{ minHeight: "100svh", display: "flex", flexDirection: "column" }}>
      <a className="lp-skip" href="#main">
        Skip to content
      </a>
      <header style={{ paddingTop: "var(--gutter)" }}>
        <div className="lp-grid">
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
        </div>
      </header>

      <main
        id="main"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          paddingBlock: "clamp(3rem, 10vh, 7rem)",
        }}
      >
        <div className="lp-grid">
          <div style={{ gridColumn: "1 / span 12", maxWidth: "34ch" }}>
            <p className="lp-mono" style={{ fontSize: "var(--t-s)", color: "var(--muted)" }}>
              404
            </p>
            <h1 className="lp-display" style={{ marginTop: "0.75rem" }}>
              Nothing
              <br />
              landed here.
            </h1>
            <p
              style={{
                fontSize: "var(--t-body)",
                lineHeight: 1.55,
                color: "var(--muted)",
                marginTop: "1.25rem",
                maxWidth: "42ch",
              }}
            >
              This page does not exist, or it was a room that has already been
              deleted. Rooms only last 24 hours, so old links stop working by
              design.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.85rem", marginTop: "2rem" }}>
              <a className="lp-btn" href="/rooms">
                Open a new room
                <ArrowRight
                  className="lp-btn__arrow"
                  aria-hidden="true"
                  style={{ width: 17, height: 17 }}
                />
              </a>
              <a className="lp-btn lp-btn--ghost" href="/">
                Back to the start
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
