import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Minus } from "lucide-react";

import { site } from "../data/landing.js";
import { plans, honesty, faq } from "../data/pricing.js";
import {
  getLicenseKey,
  setLicenseKey,
  clearLicenseKey,
} from "../lib/license.js";

import "../styles/landing.css";
import "../styles/pricing.css";

const API_BASE = import.meta.env.PROD
  ? `${import.meta.env.VITE_BACKEND_URL || ""}/api`
  : `http://${window.location.hostname}:5000/api`;

/**
 * License redemption.
 *
 * Validated against the server rather than parsed here: the signature is the
 * only thing that makes a key real, and that check belongs where the secret
 * is. A client-side "looks like a key" test would just be a lie with extra
 * steps.
 */
function LicensePanel() {
  const [input, setInput] = useState("");
  const [active, setActive] = useState(() => getLicenseKey());
  const [state, setState] = useState({ status: "idle", message: "" });
  const [plan, setPlan] = useState(null);

  // Show what the stored key currently entitles you to, so an expired license
  // is visible here rather than discovered at the next upload.
  //
  // `plan` is only ever cleared by the actions that clear `active` (remove, or
  // a rejected key), never by this effect: resetting it here on every !active
  // render is a synchronous setState in an effect, which cascades renders.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    fetch(`${API_BASE}/billing/me`, { headers: { "x-stash-license": active } })
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        const data = body?.data;
        if (data?.licensed) {
          setPlan(data.plan);
          setState({ status: "idle", message: "" });
        } else {
          setPlan(null);
          setState({
            status: "error",
            message: data?.licenseError || "That license is no longer valid.",
          });
        }
      })
      .catch(() => {
        // Offline or backend down: say nothing rather than claim the key is bad.
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  const redeem = async (event) => {
    event.preventDefault();
    const key = input.trim();
    if (!key) return;

    setState({ status: "working", message: "" });
    try {
      const res = await fetch(`${API_BASE}/billing/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ license_key: key }),
      });
      const body = await res.json();

      if (!res.ok) {
        setState({
          status: "error",
          message: body?.message || "That key was not accepted.",
        });
        return;
      }

      setLicenseKey(key);
      setActive(key);
      setPlan(body.data.plan);
      setInput("");
      setState({
        status: "ok",
        message: `${body.data.plan.name} is active on this browser.`,
      });
    } catch {
      setState({
        status: "error",
        message: "Could not reach the server. Check your connection.",
      });
    }
  };

  const remove = () => {
    clearLicenseKey();
    setActive(null);
    setPlan(null);
    setState({ status: "idle", message: "Licence removed from this browser." });
  };

  return (
    <div className="pr-license" data-reveal>
      <h3 className="pr-license-title">Already bought a licence?</h3>

      {active && plan ? (
        <>
          <p className="pr-license-active">
            <Check aria-hidden="true" className="pr-tick" />
            <span>
              <strong>{plan.name}</strong> is active on this browser.
            </span>
          </p>
          <button type="button" className="pr-ghost" onClick={remove}>
            Remove licence
          </button>
        </>
      ) : (
        <form onSubmit={redeem} className="pr-license-form">
          <label className="pr-label" htmlFor="licence">
            Paste your key
          </label>
          <div className="pr-license-row">
            <input
              id="licence"
              className="pr-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="STASH-PRO-XXXXX-XXXXX-XXXXX"
              autoComplete="off"
              spellCheck="false"
              aria-describedby="licence-help"
            />
            <button
              type="submit"
              className="pr-cta pr-cta-solid"
              disabled={state.status === "working" || !input.trim()}
            >
              {state.status === "working" ? "Checking…" : "Activate"}
            </button>
          </div>
          <p id="licence-help" className="pr-license-help">
            The key is stored in this browser only. There is nothing to log into.
          </p>
        </form>
      )}

      {state.message ? (
        <p
          className={
            state.status === "error" ? "pr-msg pr-msg-error" : "pr-msg pr-msg-ok"
          }
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

function PlanCard({ plan }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    if (plan.id === "free") {
      window.location.href = "/rooms";
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/billing/checkout/${plan.id}`);
      const body = await res.json();
      if (!res.ok || !body?.data?.url) {
        setError(body?.message || "Checkout is not available right now.");
        setBusy(false);
        return;
      }
      window.location.href = body.data.url;
    } catch {
      setError("Could not reach the server.");
      setBusy(false);
    }
  };

  return (
    <article
      className={plan.highlight ? "pr-card pr-card-lead" : "pr-card"}
      data-reveal
    >
      {plan.highlight ? <span className="pr-badge">Most picked</span> : null}

      <header className="pr-card-head">
        <h3 className="pr-plan-name">{plan.name}</h3>
        <p className="pr-price">
          <span className="pr-price-figure">{plan.price}</span>
          <span className="pr-price-cadence">{plan.cadence}</span>
        </p>
        <p className="pr-tagline">{plan.tagline}</p>
      </header>

      <button
        type="button"
        className={
          plan.highlight ? "pr-cta pr-cta-solid" : "pr-cta pr-cta-outline"
        }
        onClick={start}
        disabled={busy}
      >
        {busy ? "Opening checkout…" : plan.cta}
      </button>

      {error ? (
        <p className="pr-msg pr-msg-error" role="status">
          {error}
        </p>
      ) : null}

      <ul className="pr-features">
        {plan.features.map((f) => (
          <li key={f}>
            <Check aria-hidden="true" className="pr-tick" />
            <span>{f}</span>
          </li>
        ))}
        {plan.missing.map((f) => (
          <li key={f} className="pr-feature-missing">
            <Minus aria-hidden="true" className="pr-tick" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function Pricing() {
  const rootRef = useRef(null);

  useEffect(() => {
    document.title = "Pricing — Stash";
  }, []);

  return (
    <div className="lp pr" ref={rootRef}>
      <header className="lp-grid pr-nav">
        <a className="pr-wordmark" href="/">
          stash
        </a>
        <nav aria-label="Primary" className="pr-nav-links">
          <a className="lp-nav-link lp-nav-secondary" href="/#carries">
            What it carries
          </a>
          <a className="lp-nav-link" href="/rooms">
            Open Stash
          </a>
        </nav>
      </header>

      <main>
        <section className="lp-grid pr-hero">
          <p className="pr-eyebrow" data-reveal>
            Pricing
          </p>
          <h1 className="lp-display pr-title" data-reveal>
            Free to use.
            <br />
            Free to run yourself.
          </h1>
          <p className="pr-sub" data-reveal>
            The free plan is the whole product, not a trial. Paying lifts the
            limits on <em>our</em> servers — or you can self-host and lift them
            all for nothing.
          </p>
        </section>

        <section className="lp-grid pr-plans" aria-label="Plans">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </section>

        <section className="lp-grid pr-section" aria-labelledby="honesty-title">
          <h2 id="honesty-title" className="pr-h2" data-reveal>
            {honesty.heading}
          </h2>
          <ul className="pr-honesty" data-reveal data-stagger>
            {honesty.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>

        <section className="lp-grid pr-section">
          <LicensePanel />
        </section>

        <section className="lp-grid pr-section" aria-labelledby="faq-title">
          <h2 id="faq-title" className="pr-h2" data-reveal>
            Questions
          </h2>
          <dl className="pr-faq" data-reveal data-stagger>
            {faq.map((item) => (
              <div key={item.q} className="pr-faq-item">
                <dt>{item.q}</dt>
                <dd>{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="lp-grid pr-foot">
        <nav aria-label="Footer" className="pr-foot-links">
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
          >
            Source (MIT)
            <ArrowUpRight aria-hidden="true" style={{ width: 12, height: 12 }} />
          </a>
        </nav>
      </footer>
    </div>
  );
}
