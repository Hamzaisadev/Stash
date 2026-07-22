import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useMotionValueEvent,
  AnimatePresence,
} from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  Layers,
  Upload,
  Users,
  Shield,
  Zap,
  Monitor,
  Smartphone,
  Video,
  Copy,
  Lock,
  Flame,
  ChevronRight,
  Star,
  FileText,
  Wifi,
  Send,
  Globe,
  Laptop,
  Timer,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

/* ─────────────────────────────────────────────
   Reveal — scroll-triggered fade up
───────────────────────────────────────────── */
function Reveal({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 44 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Magnetic button — GSAP hover repel effect
───────────────────────────────────────────── */
function MagneticButton({ children, className = "", href = "#" }) {
  const btnRef = useRef(null);
  const handleMouseMove = (e) => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    gsap.to(btn, { x: x * 0.2, y: y * 0.2, duration: 0.3, ease: "power2.out" });
  };
  const handleMouseLeave = () => {
    if (!btnRef.current) return;
    gsap.to(btnRef.current, {
      x: 0,
      y: 0,
      duration: 0.5,
      ease: "elastic.out(1, 0.4)",
    });
  };
  return (
    <a
      ref={btnRef}
      href={href}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
    >
      {children}
    </a>
  );
}

/* ─────────────────────────────────────────────
   Animated counter — counts up when in view
───────────────────────────────────────────── */
function Counter({ target, suffix = "", duration = 2 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = target / (duration * 60);
    const frame = () => {
      start += step;
      if (start >= target) {
        setCount(target);
        return;
      }
      setCount(Math.floor(start));
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [inView, target, duration]);

  return (
    <span ref={ref}>
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ═════════════════════════════════════════════
   LANDING PAGE
═════════════════════════════════════════════ */
function Landing() {
  const heroRef = useRef(null);
  const marqueeRef = useRef(null);

  /* ── Navbar: hide on scroll down, show on scroll up ── */
  const { scrollY } = useScroll();
  const [navVisible, setNavVisible] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const lastY = useRef(0);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const direction = latest > lastY.current ? "down" : "up";
    setScrolled(latest > 20);
    if (latest > 100) {
      setNavVisible(direction === "up");
    } else {
      setNavVisible(true);
    }
    lastY.current = latest;
  });

  /* ── Hero parallax ── */
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(heroProgress, [0, 1], [0, -100]);
  const heroOpacity = useTransform(heroProgress, [0, 0.6], [1, 0]);

  /* ── GSAP infinite marquee ── */
  useEffect(() => {
    if (!marqueeRef.current) return;
    const el = marqueeRef.current;
    const tw = gsap.to(el, {
      xPercent: -50,
      duration: 25,
      ease: "none",
      repeat: -1,
    });
    return () => tw.kill();
  }, []);

  /* ── Step auto-cycle ── */
  const [activeStep, setActiveStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActiveStep((p) => (p + 1) % 3), 3000);
    return () => clearInterval(t);
  }, []);

  /* ── Data ── */
  const steps = [
    {
      icon: <Upload className="w-6 h-6" />,
      title: "Drop your files",
      desc: "Drag and drop anything — photos, videos, documents, zip files. No size limits ever.",
    },
    {
      icon: <Send className="w-6 h-6" />,
      title: "Share the room link",
      desc: "Send the room link to whoever you want, or let nearby devices find you automatically.",
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Instant delivery",
      desc: "Files go directly to the other device. No middle-man, no upload wait, no cloud.",
    },
  ];

  const features = [
    {
      icon: <Monitor className="w-6 h-6" />,
      title: "Live Screen & Camera",
      desc: "Show your screen or face live to everyone in the room. One click to go fullscreen.",
    },
    {
      icon: <Lock className="w-6 h-6" />,
      title: "Password Locked Rooms",
      desc: "Protect rooms with rotating keys. Only people you give the code to can enter.",
    },
    {
      icon: <Flame className="w-6 h-6" />,
      title: "Self-Destructing Files",
      desc: "Files auto-delete after a timer or vanish the instant someone downloads them.",
    },
    {
      icon: <Copy className="w-6 h-6" />,
      title: "Shared Clipboard",
      desc: "Copy text, links, or notes on one device and grab them immediately on another.",
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Guest Approvals",
      desc: "You control who enters. Approve or deny join requests before anyone gets access.",
    },
    {
      icon: <Smartphone className="w-6 h-6" />,
      title: "Any Device, Any Browser",
      desc: "Works on phones, tablets, and laptops. No app store downloads needed.",
    },
  ];

  const useCases = [
    {
      icon: <Laptop className="w-7 h-7" />,
      title: "Classrooms",
      desc: "Teachers share lecture slides, students submit assignments — all in one temporary room.",
      color: "bg-blue-50 text-blue-500",
    },
    {
      icon: <Users className="w-7 h-7" />,
      title: "Meetings",
      desc: "Quick file handoffs during calls. Share screenshots, designs, and docs without email.",
      color: "bg-amber-50 text-amber-500",
    },
    {
      icon: <Globe className="w-7 h-7" />,
      title: "Travel",
      desc: "Send photos and boarding passes between your phone and a borrowed laptop instantly.",
      color: "bg-emerald-50 text-emerald-500",
    },
    {
      icon: <FileText className="w-7 h-7" />,
      title: "Events",
      desc: "Share slides, brochures, and resources with attendees. Room auto-cleans after.",
      color: "bg-purple-50 text-purple-500",
    },
  ];

  const stats = [
    { value: 0, label: "Accounts required", suffix: "" },
    { value: 16, label: "KB chunk size for speed", suffix: "KB" },
    { value: 100, label: "Direct device transfer", suffix: "%" },
    { value: 60, label: "Second room setup", suffix: "s" },
  ];

  const marqueeItems = [
    "No Sign Up",
    "Direct Transfer",
    "Auto Discovery",
    "No Size Limits",
    "Temporary Rooms",
    "Self-Destructing",
    "Screen Sharing",
    "Voice Notes",
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden font-sans selection:bg-red-100 selection:text-red-600">
      {/* ════════════════════════════════════════════
          1 — FLOATING NAVBAR (hides on scroll down)
      ════════════════════════════════════════════ */}
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: navVisible ? 0 : -100, opacity: navVisible ? 1 : 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-4 left-4 right-4 z-50 rounded-2xl transition-shadow duration-300 ${
          scrolled
            ? "bg-white/80 backdrop-blur-2xl shadow-lg shadow-slate-900/[0.04] border border-slate-200/60"
            : "bg-white/60 backdrop-blur-xl border border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center group-hover:rotate-12 transition-transform duration-300">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-extrabold tracking-tight text-slate-900">
              Stash
            </span>
          </a>

          <MagneticButton
            href="/rooms"
            className="inline-flex items-center gap-2 bg-slate-900 text-white text-[13px] font-semibold px-5 py-2.5 rounded-full hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
          >
            Open App
            <ArrowRight className="w-3.5 h-3.5" />
          </MagneticButton>
        </div>
      </motion.nav>

      {/* ════════════════════════════════════════════
          2 — HERO
      ════════════════════════════════════════════ */}
      <section
        ref={heroRef}
        className="relative min-h-[100svh] flex flex-col items-center justify-center px-6 pt-16 overflow-hidden"
      >
        {/* Decorative rings */}
        <div className="absolute top-24 right-[8%] w-80 h-80 rounded-full border border-red-100/50 pointer-events-none" />
        <div className="absolute bottom-28 left-[4%] w-52 h-52 rounded-full border border-slate-100 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-red-50/40 pointer-events-none blur-[120px]" />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 max-w-4xl mx-auto text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="inline-flex items-center gap-2 bg-red-50 border border-red-100 rounded-full px-4 py-1.5 mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px] font-semibold text-red-600 uppercase tracking-wider">
              Instant sharing
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
            className="text-5xl sm:text-6xl md:text-[5.5rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-slate-900 mb-6"
          >
            Send files instantly.
            <br />
            <span className="text-red-500">Securely.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.9,
              ease: [0.22, 1, 0.36, 1],
              delay: 0.55,
            }}
            className="text-lg md:text-xl text-slate-500 max-w-lg mx-auto mb-10 font-medium leading-relaxed"
          >
            Create a secure room, share the link, and transfer files directly
            between devices. No accounts, no cloud storage, and no friction.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <MagneticButton
              href="/rooms"
              className="inline-flex items-center gap-2.5 bg-red-500 text-white text-[15px] font-bold px-8 py-4 rounded-full hover:bg-red-600 active:scale-95 transition-all shadow-lg shadow-red-500/15 cursor-pointer"
            >
              Start sharing
              <ArrowRight className="w-4 h-4" />
            </MagneticButton>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 text-slate-500 text-[15px] font-semibold hover:text-slate-900 transition-colors cursor-pointer"
            >
              See how it works
              <ChevronRight className="w-4 h-4" />
            </a>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Scroll
          </span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-5 h-8 rounded-full border-2 border-slate-300 flex items-start justify-center pt-1.5"
          >
            <div className="w-1 h-1.5 rounded-full bg-slate-400" />
          </motion.div>
        </motion.div>
      </section>

      {/* ════════════════════════════════════════════
          3 — MARQUEE STRIP
      ════════════════════════════════════════════ */}
      <section className="py-6 border-y border-slate-100 bg-slate-50/80 overflow-hidden">
        <div className="flex whitespace-nowrap" ref={marqueeRef}>
          {[
            ...marqueeItems,
            ...marqueeItems,
            ...marqueeItems,
            ...marqueeItems,
          ].map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-3 mx-5 text-[13px] font-bold text-slate-300 uppercase tracking-widest select-none shrink-0"
            >
              <Star className="w-2.5 h-2.5 text-red-300 fill-red-300" />
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════
          4 — HOW IT WORKS
      ════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-24 md:py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <span className="text-[11px] font-bold uppercase tracking-widest text-red-500 mb-3 block">
                How it works
              </span>
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900">
                Three steps. That's it.
              </h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <motion.div
                  whileHover={{ y: -5 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="relative bg-white border border-slate-200 rounded-3xl p-8 md:p-10 cursor-default group hover:border-red-200 hover:shadow-lg hover:shadow-red-500/[0.03] transition-all duration-300"
                >
                  <span className="absolute top-5 right-6 text-[80px] font-black text-slate-50 leading-none select-none pointer-events-none group-hover:text-red-50 transition-colors">
                    {i + 1}
                  </span>
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-colors duration-300 ${
                      activeStep === i
                        ? "bg-red-500 text-white"
                        : "bg-slate-100 text-slate-500 group-hover:bg-red-50 group-hover:text-red-500"
                    }`}
                  >
                    {step.icon}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {step.desc}
                  </p>
                  <div className="mt-6 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-red-500 rounded-full"
                      animate={{ width: activeStep === i ? "100%" : "0%" }}
                      transition={{
                        duration: activeStep === i ? 3 : 0.3,
                        ease: activeStep === i ? "linear" : "easeOut",
                      }}
                    />
                  </div>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          5 — FEATURES GRID
      ════════════════════════════════════════════ */}
      <section className="py-24 md:py-32 px-6 bg-slate-50/60">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <span className="text-[11px] font-bold uppercase tracking-widest text-red-500 mb-3 block">
                Features
              </span>
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900">
                Everything you need,
                <br className="hidden sm:block" /> nothing you don't.
              </h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feat, i) => (
              <Reveal key={i} delay={i * 0.06}>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="bg-white border border-slate-200 rounded-3xl p-8 hover:border-red-200 hover:shadow-lg hover:shadow-red-500/[0.03] transition-all duration-300 group cursor-default"
                >
                  <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                    {feat.icon}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1.5">
                    {feat.title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {feat.desc}
                  </p>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          6 — PRODUCT SHOWCASE (mockup preview)
      ════════════════════════════════════════════ */}
      <section className="py-24 md:py-32 px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <span className="text-[11px] font-bold uppercase tracking-widest text-red-500 mb-3 block">
                Preview
              </span>
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900">
                Designed to get
                <br /> out of your way.
              </h2>
              <p className="text-base text-slate-500 max-w-md mx-auto mt-4 font-medium">
                A clean, minimal interface that works equally well on your phone
                and your laptop.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="relative max-w-4xl mx-auto">
              {/* Browser chrome mockup */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/[0.06] overflow-hidden">
                {/* Title bar */}
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-slate-200" />
                    <div className="w-3 h-3 rounded-full bg-slate-200" />
                    <div className="w-3 h-3 rounded-full bg-slate-200" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="bg-white border border-slate-200 rounded-lg px-4 py-1 text-[11px] font-mono text-slate-400 w-64 text-center">
                      stash.app/rooms/my-room
                    </div>
                  </div>
                </div>
                {/* "App" content inside */}
                <div className="bg-[#0a0a0f] p-6 md:p-10 min-h-[320px] flex flex-col items-center justify-center text-center gap-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-red-500 flex items-center justify-center">
                      <Layers className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-white font-bold text-sm">
                      my-room
                    </span>
                    <span className="text-[9px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">
                      3 online
                    </span>
                  </div>
                  {/* Mock file cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-md">
                    {["presentation.pdf", "photo-001.jpg", "notes.txt"].map(
                      (name, i) => (
                        <motion.div
                          key={name}
                          initial={{ opacity: 0, y: 20 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.3 + i * 0.12 }}
                          className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-left"
                        >
                          <FileText className="w-5 h-5 text-slate-500 mb-1.5" />
                          <p className="text-[10px] font-semibold text-slate-300 truncate">
                            {name}
                          </p>
                          <p className="text-[8px] text-slate-600 mt-0.5">
                            {(Math.random() * 5 + 0.5).toFixed(1)} MB
                          </p>
                        </motion.div>
                      ),
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-semibold text-slate-500">
                      All files shared in real time
                    </span>
                  </div>
                </div>
              </div>

              {/* Floating phone mockup (desktop only) */}
              <Reveal delay={0.3}>
                <div className="hidden md:block absolute -bottom-8 -right-8 w-48">
                  <div className="rounded-3xl border-2 border-slate-200 bg-white shadow-2xl shadow-slate-900/[0.08] overflow-hidden">
                    <div className="bg-[#0a0a0f] p-4 min-h-[200px] flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="w-5 h-5 rounded bg-red-500 flex items-center justify-center">
                          <Layers className="w-2.5 h-2.5 text-white" />
                        </div>
                        <span className="text-[9px] font-bold text-white">
                          my-room
                        </span>
                      </div>
                      {["photo-001.jpg", "notes.txt"].map((name) => (
                        <div
                          key={name}
                          className="bg-slate-900 border border-slate-800 rounded-lg p-2"
                        >
                          <p className="text-[8px] font-semibold text-slate-300 truncate">
                            {name}
                          </p>
                        </div>
                      ))}
                      <div className="mt-auto flex justify-center">
                        <span className="text-[7px] font-semibold text-emerald-400">
                          ● Connected
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          7 — STATS
      ════════════════════════════════════════════ */}
      <section className="py-20 px-6 bg-slate-50/60 border-y border-slate-100">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map((stat, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className="space-y-1">
                  <p className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
                    <Counter target={stat.value} suffix={stat.suffix} />
                  </p>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {stat.label}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          8 — USE CASES
      ════════════════════════════════════════════ */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <span className="text-[11px] font-bold uppercase tracking-widest text-red-500 mb-3 block">
                Use cases
              </span>
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900">
                Built for real situations.
              </h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {useCases.map((uc, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="flex gap-5 bg-white border border-slate-200 rounded-3xl p-7 hover:border-red-200 hover:shadow-lg hover:shadow-red-500/[0.03] transition-all duration-300 cursor-default group"
                >
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${uc.color} group-hover:scale-110 transition-transform duration-300`}
                  >
                    {uc.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">
                      {uc.title}
                    </h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      {uc.desc}
                    </p>
                  </div>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          9 — BIG CTA
      ════════════════════════════════════════════ */}
      <section className="py-28 md:py-36 px-6 bg-slate-50/60 relative overflow-hidden">
        {/* Decorative ring */}
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full border border-red-50 pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full border border-slate-100 pointer-events-none" />

        <Reveal>
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900 mb-6">
              Ready to share
              <br />
              <span className="text-red-500">without the fuss?</span>
            </h2>
            <p className="text-lg text-slate-500 max-w-md mx-auto mb-10 font-medium">
              No downloads. No sign ups. Just open a room and start sending
              files to any device, instantly.
            </p>
            <MagneticButton
              href="/rooms"
              className="inline-flex items-center gap-3 bg-slate-900 text-white text-base font-bold px-10 py-5 rounded-full hover:bg-slate-800 active:scale-95 transition-all shadow-xl shadow-slate-900/[0.08] cursor-pointer"
            >
              Create your first room
              <ArrowRight className="w-5 h-5" />
            </MagneticButton>
          </div>
        </Reveal>
      </section>

      {/* ════════════════════════════════════════════
          10 — FOOTER
      ════════════════════════════════════════════ */}
      <footer className="border-t border-slate-100 bg-white py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-red-500 flex items-center justify-center">
              <Layers className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-[15px] font-extrabold text-slate-900">
              Stash
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Fast, private, temporary file sharing. Built for humans.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
