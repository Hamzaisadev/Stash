import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { Trash2, Download, Lock, QrCode, LayoutGrid, List } from "lucide-react";
import { formatBytes, formatCountdown } from "../lib/format.js";
import { getFileKind } from "../lib/fileTypes.js";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Chip colour by file kind, so a glance tells you what something is. */
const TONE = {
  image: { bg: "#ff5d3a", ink: "#14161a" },
  video: { bg: "#ff5d3a", ink: "#14161a" },
  audio: { bg: "#ffc53d", ink: "#14161a" },
  pdf: { bg: "#2f4bff", ink: "#ffffff" },
  doc: { bg: "#2f4bff", ink: "#ffffff" },
  sheet: { bg: "#2f4bff", ink: "#ffffff" },
  slides: { bg: "#2f4bff", ink: "#ffffff" },
  archive: { bg: "#14161a", ink: "#ffffff" },
  code: { bg: "#14161a", ink: "#ffffff" },
  text: { bg: "#ffffff", ink: "#14161a" },
  other: { bg: "#ffffff", ink: "#14161a" },
};

const toneFor = (f) => TONE[getFileKind(f)] ?? TONE.other;

/** Time remaining, or "expired" once the clock has run out. */
const timeLeft = (expiresAt, now) =>
  formatCountdown(Number(expiresAt) - now) ?? "expired";

/**
 * The desk: files as physical objects on a shared surface.
 *
 * Replaces the card grid. Each file is a chip you can pick up and move; drag
 * one onto the bin and release to delete it. Positions are seeded from the
 * file id so a chip lands in the same spot for everyone in the room and does
 * not jump between renders.
 *
 * A list view sits behind a toggle and is the default on touch and under
 * reduced motion, because dragging is a poor primary interaction there and
 * the list is what screen readers should get.
 */
export default function Desk({
  files,
  isOwner,
  onDownload,
  onDelete,
  onShowQr,
  downloadProgress,
  now,
  refreshFiles,
  fetchPreviewUrl,
}) {
  const surfaceRef = useRef(null);
  const binRef = useRef(null);
  const dragRef = useRef(null);
  const [view, setView] = useState(() =>
    prefersReducedMotion() || (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches)
      ? "list"
      : "desk",
  );
  const [overBin, setOverBin] = useState(false);

  // Deterministic scatter: same file, same spot, for everyone.
  const seeded = useMemo(() => {
    return files.map((f, i) => {
      let h = 0;
      for (let k = 0; k < f.id.length; k++) h = (h * 31 + f.id.charCodeAt(k)) | 0;
      const rand = (n) => Math.abs((h >> n) % 1000) / 1000;
      return {
        ...f,
        // Column-major so chips never pile into one corner as a room fills.
        col: i % 4,
        row: Math.floor(i / 4),
        jitterX: (rand(2) - 0.5) * 26,
        jitterY: (rand(5) - 0.5) * 18,
        tilt: (rand(8) - 0.5) * 7,
      };
    });
  }, [files]);

  /* --- expiry sweep ---------------------------------------------------
     The soonest expiry schedules one refresh, so expired chips disappear
     without the visitor reloading. Carried over from the old feed. */
  // Soonest expiry still in the future. Reads `now` (the shared clock) rather
  // than Date.now(), so the memo stays pure.
  const nextExpiry = useMemo(() => {
    const times = files
      .map((f) => Number(f.expires_at))
      .filter((t) => Number.isFinite(t) && t > now);
    return times.length ? Math.min(...times) : null;
  }, [files, now]);

  // Keyed on the timestamp alone: `now` ticks every second, so depending on
  // it here would tear down and rebuild the timer once a second.
  const refreshRef = useRef(refreshFiles);
  useEffect(() => {
    refreshRef.current = refreshFiles;
  });
  useEffect(() => {
    if (!nextExpiry) return;
    const delay = Math.max(nextExpiry - Date.now(), 0) + 1000;
    const timer = setTimeout(() => refreshRef.current?.(), delay);
    return () => clearTimeout(timer);
  }, [nextExpiry]);

  /* --- drag ---------------------------------------------------------- */
  useEffect(() => {
    if (view !== "desk" || prefersReducedMotion()) return;
    const surface = surfaceRef.current;
    if (!surface) return;

    const onPointerDown = (e) => {
      const chip = e.target.closest("[data-chip]");
      if (!chip || e.target.closest("[data-chip-action]")) return;

      const rect = chip.getBoundingClientRect();
      dragRef.current = {
        el: chip,
        id: chip.dataset.chip,
        dx: e.clientX - rect.left - rect.width / 2,
        dy: e.clientY - rect.top - rect.height / 2,
        moved: false,
      };
      chip.setPointerCapture(e.pointerId);
      chip.style.zIndex = "30";
      gsap.to(chip, { scale: 1.06, rotate: 0, duration: 0.18, ease: "power2.out" });
    };

    const onPointerMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      d.moved = true;
      const s = surface.getBoundingClientRect();
      gsap.set(d.el, {
        x: e.clientX - s.left - d.dx - d.el.offsetLeft - d.el.offsetWidth / 2,
        y: e.clientY - s.top - d.dy - d.el.offsetTop - d.el.offsetHeight / 2,
      });
      const bin = binRef.current?.getBoundingClientRect();
      setOverBin(
        !!bin &&
          e.clientX > bin.left &&
          e.clientX < bin.right &&
          e.clientY > bin.top &&
          e.clientY < bin.bottom,
      );
    };

    const onPointerUp = (e) => {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      d.el.style.zIndex = "";

      const bin = binRef.current?.getBoundingClientRect();
      const droppedOnBin =
        !!bin &&
        e.clientX > bin.left &&
        e.clientX < bin.right &&
        e.clientY > bin.top &&
        e.clientY < bin.bottom;
      setOverBin(false);

      if (droppedOnBin && isOwner(d.id)) {
        // Shrink into the bin, then ask the server. If the delete fails the
        // list re-renders from server state and the chip comes back.
        gsap.to(d.el, {
          scale: 0,
          autoAlpha: 0,
          duration: 0.3,
          ease: "back.in(2)",
          onComplete: () => onDelete(d.id),
        });
        return;
      }

      // Settle back onto the surface.
      gsap.to(d.el, {
        x: 0,
        y: 0,
        scale: 1,
        rotate: Number(d.el.dataset.tilt || 0),
        duration: 0.55,
        ease: "elastic.out(1, 0.6)",
      });
    };

    surface.addEventListener("pointerdown", onPointerDown);
    surface.addEventListener("pointermove", onPointerMove);
    surface.addEventListener("pointerup", onPointerUp);
    surface.addEventListener("pointercancel", onPointerUp);
    return () => {
      surface.removeEventListener("pointerdown", onPointerDown);
      surface.removeEventListener("pointermove", onPointerMove);
      surface.removeEventListener("pointerup", onPointerUp);
      surface.removeEventListener("pointercancel", onPointerUp);
    };
  }, [view, isOwner, onDelete]);

  /* --- new chips drop in ---------------------------------------------- */
  const seenIds = useRef(new Set());
  useEffect(() => {
    if (view !== "desk" || prefersReducedMotion()) return;
    const fresh = seeded.filter((f) => !seenIds.current.has(f.id));
    fresh.forEach((f) => seenIds.current.add(f.id));
    if (!fresh.length) return;
    const els = fresh
      .map((f) => surfaceRef.current?.querySelector(`[data-chip="${f.id}"]`))
      .filter(Boolean);
    if (els.length) {
      gsap.from(els, {
        y: -180,
        autoAlpha: 0,
        rotate: 14,
        duration: 0.7,
        ease: "back.out(1.5)",
        stagger: 0.07,
      });
    }
  }, [seeded, view]);

  /* --- image thumbnails ------------------------------------------------
     An image chip shows the image. URLs are signed and short-lived, so they
     are fetched once per file and cached for this mount only. */
  const [thumbs, setThumbs] = useState({});
  useEffect(() => {
    if (!fetchPreviewUrl) return;
    let cancelled = false;
    const wanted = files.filter(
      (f) => getFileKind(f) === "image" && !f.is_locked && !thumbs[f.id],
    );
    wanted.slice(0, 12).forEach((f) => {
      fetchPreviewUrl(f.id)
        .then((url) => {
          if (!cancelled && url) setThumbs((t) => ({ ...t, [f.id]: url }));
        })
        .catch(() => {
          /* preview is decoration; the chip still works without it */
        });
    });
    return () => {
      cancelled = true;
    };
    // thumbs is intentionally omitted: including it would re-run on every
    // resolved preview and loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, fetchPreviewUrl]);

  const Toggle = (
    <div className="dk-toggle" role="group" aria-label="View">
      <button
        type="button"
        onClick={() => setView("desk")}
        aria-pressed={view === "desk"}
        className={view === "desk" ? "is-on" : ""}
      >
        <LayoutGrid aria-hidden="true" /> Desk
      </button>
      <button
        type="button"
        onClick={() => setView("list")}
        aria-pressed={view === "list"}
        className={view === "list" ? "is-on" : ""}
      >
        <List aria-hidden="true" /> List
      </button>
    </div>
  );

  if (!files.length) {
    return (
      <section className="dk" aria-label="Files in this room">
        <header className="dk__bar">
          <p className="dk__count lp-mono">Nothing here yet</p>
          {Toggle}
        </header>
        <div className="dk__empty">
          <p className="dk__empty-title">The desk is clear.</p>
          <p className="dk__empty-sub">
            Drop a file anywhere on this page, or paste one, and it lands here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="dk" aria-label="Files in this room">
      <header className="dk__bar">
        <p className="dk__count lp-mono">
          {files.length} {files.length === 1 ? "thing" : "things"} on the desk
        </p>
        {Toggle}
      </header>

      {view === "list" ? (
        <ul className="dk__list">
          {seeded.map((f) => (
            <li key={f.id} className="dk__row">
              <span
                className="dk__swatch"
                style={{ background: toneFor(f).bg }}
                aria-hidden="true"
              />
              <span className="dk__row-name">{f.filename}</span>
              <span className="dk__row-meta lp-mono">
                {formatBytes(f.file_size)} · {timeLeft(f.expires_at, now)}
              </span>
              <span className="dk__row-actions">
                <button type="button" onClick={() => onDownload(f)} aria-label={`Download ${f.filename}`}>
                  <Download aria-hidden="true" />
                </button>
                <button type="button" onClick={() => onShowQr(f)} aria-label={`QR code for ${f.filename}`}>
                  <QrCode aria-hidden="true" />
                </button>
                {isOwner(f.id) && (
                  <button type="button" onClick={() => onDelete(f.id)} aria-label={`Delete ${f.filename}`}>
                    <Trash2 aria-hidden="true" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="dk__surface" ref={surfaceRef}>
          {seeded.map((f) => {
            const tone = toneFor(f);
            const pr = downloadProgress?.[f.id];
            return (
              <article
                key={f.id}
                data-chip={f.id}
                data-tilt={f.tilt}
                className="dk__chip"
                style={{
                  background: tone.bg,
                  color: tone.ink,
                  gridColumn: f.col + 1,
                  gridRow: f.row + 1,
                  translate: `${f.jitterX}px ${f.jitterY}px`,
                  rotate: `${f.tilt}deg`,
                }}
              >
                {thumbs[f.id] && (
                  <img
                    src={thumbs[f.id]}
                    alt=""
                    aria-hidden="true"
                    className="dk__chip-thumb"
                    draggable="false"
                  />
                )}
                <p className="dk__chip-name" title={f.filename}>
                  {f.is_locked && <Lock aria-hidden="true" className="dk__lock" />}
                  {f.filename}
                </p>
                <p className="dk__chip-meta lp-mono">
                  {formatBytes(f.file_size)} · {timeLeft(f.expires_at, now)}
                </p>
                {pr?.percent > 0 && pr.percent < 100 && (
                  <span className="dk__chip-bar" style={{ width: `${pr.percent}%` }} />
                )}
                <div className="dk__chip-actions">
                  <button
                    type="button"
                    data-chip-action
                    onClick={() => onDownload(f)}
                    aria-label={`Download ${f.filename}`}
                  >
                    <Download aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    data-chip-action
                    onClick={() => onShowQr(f)}
                    aria-label={`QR code for ${f.filename}`}
                  >
                    <QrCode aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}

          {/* Drag a chip here to delete it. Hidden from the a11y tree: the
              list view carries a real delete button for each file. */}
          <div
            ref={binRef}
            className={`dk__bin ${overBin ? "is-over" : ""}`}
            aria-hidden="true"
          >
            <Trash2 />
            <span className="lp-mono">drop to delete</span>
          </div>
        </div>
      )}
    </section>
  );
}
