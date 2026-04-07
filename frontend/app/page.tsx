"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import { getIntention, type IntentionResponse } from "@/lib/api";

/* ── Soulora lotus icon ─────────────────────────────────────────────────── */
function SouloraIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.4"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C10 6 6 8 6 12c0 3.3 2.7 6 6 6s6-2.7 6-6c0-4-4-6-6-10z"/>
      <path d="M12 8c-1.5 2-3 3.5-3 5a3 3 0 0 0 6 0c0-1.5-1.5-3-3-5z"/>
    </svg>
  );
}

/* ── SVG scene layers drawn on top of the background image ──────────────── */
function SceneLayers() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* extra mist band across the waterline */}
      <div className="absolute left-0 right-0"
        style={{
          top: "58%", height: "10%",
          background: "linear-gradient(to bottom, transparent 0%, rgba(215,208,232,0.32) 50%, transparent 100%)",
          filter: "blur(10px)",
        }}
      />
      {/* bottom flower bloom amplifier */}
      <div className="absolute bottom-0 left-0 right-0 h-[16%]"
        style={{
          background: "linear-gradient(to top, rgba(90,48,130,0.42) 0%, transparent 100%)",
        }}
      />
      {/* warm top-right light leak */}
      <div className="absolute top-0 right-0 w-[45%] h-[45%]"
        style={{
          background: "radial-gradient(ellipse at 80% 20%, rgba(220,185,145,0.28) 0%, transparent 65%)",
        }}
      />
    </div>
  );
}

/* ── Breath Synchronizer + Soundscape (bottom-left) ─────────────────────── */
const PHASES = [
  { label: "Inhale", duration: 4, scale: 1.55 },
  { label: "Hold",   duration: 7, scale: 1.55 },
  { label: "Exhale", duration: 8, scale: 1.00 },
] as const;

// Pink noise via Web Audio API — sounds like gentle rain / flowing water.
// No CDN, no Docker image bloat: generated entirely in the browser.
function buildPinkNoise(ctx: AudioContext): AudioBufferSourceNode {
  const sampleRate = ctx.sampleRate;
  const seconds    = 8;                                   // looping buffer length
  const buf        = ctx.createBuffer(1, sampleRate * seconds, sampleRate);
  const data       = buf.getChannelData(0);
  let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1;                     // white noise sample
    b0 = 0.99886*b0 + w*0.0555179;
    b1 = 0.99332*b1 + w*0.0750759;
    b2 = 0.96900*b2 + w*0.1538520;
    b3 = 0.86650*b3 + w*0.3104856;
    b4 = 0.55000*b4 + w*0.5329522;
    b5 = -0.7616*b5 - w*0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w*0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  const src  = ctx.createBufferSource();
  src.buffer = buf;
  src.loop   = true;
  return src;
}

function BreathCard() {
  const [phase,   setPhase]   = useState(0);
  const [hovered, setHovered] = useState(false);
  const [soundOn, setSoundOn] = useState(false);

  const ctxRef    = useRef<AudioContext | null>(null);
  const gainRef   = useRef<GainNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const current   = PHASES[phase];

  // Fade in / fade out when soundOn toggles
  useEffect(() => {
    if (soundOn) {
      // Create (or resume) AudioContext on user gesture
      const ctx  = ctxRef.current ?? new AudioContext();
      ctxRef.current = ctx;
      if (ctx.state === "suspended") ctx.resume();

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.30, ctx.currentTime + 2); // 2 s fade-in
      gain.connect(ctx.destination);
      gainRef.current = gain;

      const src = buildPinkNoise(ctx);
      src.connect(gain);
      src.start();
      sourceRef.current = src;
    } else {
      // Fade out over 1.5 s then stop
      const gain = gainRef.current;
      const src  = sourceRef.current;
      const ctx  = ctxRef.current;
      if (!gain || !src || !ctx) return;
      const stopAt = ctx.currentTime + 1.5;
      gain.gain.linearRampToValueAtTime(0, stopAt);
      src.stop(stopAt);
      sourceRef.current = null;
      gainRef.current   = null;
    }
  }, [soundOn]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sourceRef.current?.stop();
      ctxRef.current?.close();
    };
  }, []);

  // Advance phase after animation
  function onAnimComplete() {
    if (current.label === "Hold") return;
    setPhase((p: number) => (p + 1) % PHASES.length);
  }

  // Hold timeout
  useEffect(() => {
    if (current.label !== "Hold") return;
    const t = setTimeout(() => setPhase((p: number) => (p + 1) % PHASES.length), current.duration * 1000);
    return () => clearTimeout(t);
  }, [phase, current]);

  // Glow intensifies when hovering or sound is on
  const active    = hovered || soundOn;
  const glowSize  = active ? "60px" : "36px";
  const glowAlpha = active ? "0.65" : "0.35";
  const ringColor = soundOn ? "rgba(120,210,200,0.55)" : "rgba(180,140,255,0.45)";

  return (
    <div
      className="glass-dark p-4 w-[185px] sm:w-[210px] flex flex-col items-center gap-3
                 select-none relative"
      style={{ backdropFilter: "blur(15px)" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Sound toggle — top-right corner */}
      <button
        onClick={() => setSoundOn((s: boolean) => !s)}
        className="absolute top-3 right-3 text-white/50 hover:text-white/90
                   transition-colors p-1 rounded-full"
        style={{
          background: soundOn ? "rgba(120,210,200,0.20)" : "transparent",
          border: soundOn ? "1px solid rgba(120,210,200,0.35)" : "1px solid transparent",
        }}
        aria-label={soundOn ? "Mute nature sounds" : "Play nature sounds"}
      >
        {soundOn
          ? <Volume2 size={13} className="text-teal-300"/>
          : <VolumeX size={13}/>
        }
      </button>

      {/* Glowing circle */}
      <div className="relative flex items-center justify-center" style={{ width: 84, height: 84 }}>
        {/* outer glow blob */}
        <div
          className="absolute rounded-full transition-all duration-700"
          style={{
            width: glowSize, height: glowSize,
            background: `radial-gradient(circle, rgba(180,140,255,${glowAlpha}) 0%, transparent 70%)`,
            filter: "blur(12px)",
          }}
        />
        {/* sound-sync pulse ring — visible only when audio plays */}
        {soundOn && (
          <motion.div
            className="absolute rounded-full"
            animate={{ scale: [1, 1.18, 1], opacity: [0.35, 0.65, 0.35] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: 64, height: 64, border: "1px solid rgba(120,210,200,0.50)" }}
          />
        )}
        {/* breathing circle */}
        <motion.div
          animate={{ scale: current.scale, opacity: current.label === "Hold" ? 0.92 : 1 }}
          transition={{ duration: current.label === "Hold" ? 0.3 : current.duration, ease: "easeInOut" }}
          onAnimationComplete={onAnimComplete}
          className="rounded-full"
          style={{
            width: 52, height: 52,
            background: "radial-gradient(circle at 38% 35%, rgba(230,215,255,0.95) 0%, rgba(150,110,210,0.75) 60%, rgba(100,70,170,0.60) 100%)",
            boxShadow: `0 0 ${active ? "26px" : "14px"} ${ringColor}`,
            border: "1px solid rgba(255,255,255,0.40)",
            transition: "box-shadow 0.5s",
          }}
        />
      </div>

      {/* Phase label */}
      <AnimatePresence mode="wait">
        <motion.p
          key={current.label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{    opacity: 0, y: -4 }}
          transition={{ duration: 0.35 }}
          className="text-white/80 text-xs font-medium tracking-widest uppercase"
        >
          {current.label}
        </motion.p>
      </AnimatePresence>

      <p className="text-white/38 text-[10px]">4 · 7 · 8 Breath</p>
    </div>
  );
}

/* ── AI Guided Intention card (bottom-right) ─────────────────────────────── */
function timeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

function IntentionCard() {
  const [data,    setData]    = useState<IntentionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Read last check-in context from localStorage (written by checkin page)
    let stress: number | undefined;
    let sleep:  number | undefined;
    try {
      const raw = localStorage.getItem("soulora_last_checkin");
      if (raw) { const p = JSON.parse(raw); stress = p.stress; sleep = p.sleep; }
    } catch { /* ignore */ }

    getIntention(stress, sleep, timeOfDay())
      .then(setData)
      .catch(() => setData({
        insight:   "Take a mindful breath. Your sanctuary is ready whenever you are.",
        cta_label: "Open Sanctuary",
        cta_href:  "/wellness",
      }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      className="glass-dark p-4 w-[228px] sm:w-[255px] relative overflow-hidden"
      style={{ isolation: "isolate" }}
    >
      {/* pulsing border glow */}
      <motion.div
        animate={{ opacity: [0.35, 0.75, 0.35] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 rounded-[inherit] pointer-events-none"
        style={{
          boxShadow: "inset 0 0 0 1px rgba(180,140,255,0.60)",
          borderRadius: "inherit",
        }}
      />

      {/* eyebrow — time-aware */}
      <p className="text-white/45 text-[10px] uppercase tracking-widest mb-2">
        {{ morning: "Morning Insight", afternoon: "Afternoon Check-in",
           evening: "Evening Reflection", night: "Night Guidance" }[timeOfDay()]}
      </p>

      {/* insight text or shimmer */}
      {loading ? (
        <div className="space-y-2 animate-pulse mb-4">
          <div className="h-2.5 bg-white/15 rounded-full w-full"/>
          <div className="h-2.5 bg-white/10 rounded-full w-4/5"/>
          <div className="h-2.5 bg-white/08 rounded-full w-3/5"/>
        </div>
      ) : (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="font-display text-white/90 text-sm leading-snug mb-4"
        >
          {data?.insight}
        </motion.p>
      )}

      {/* CTA */}
      {!loading && data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Link
            href={data.cta_href}
            className="inline-flex items-center gap-1.5 text-xs font-medium
                       text-white px-3.5 py-1.5 rounded-full transition-all
                       hover:-translate-y-0.5"
            style={{
              background: "rgba(138,92,201,0.55)",
              border: "1px solid rgba(180,140,255,0.40)",
            }}
          >
            {data.cta_label}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5"
                 viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </Link>
        </motion.div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Landing Page
══════════════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  return (
    <div className="relative min-h-screen flex flex-col" style={{ backgroundColor: "#B0A0C4" }}>

      {/* ── Background image — real <img> so no CSS pipeline can suppress it ── */}
      <img
        src="/nature-bg.jpg"
        alt=""
        aria-hidden="true"
        style={{
          position:   "absolute",
          inset:      0,
          width:      "100%",
          height:     "100%",
          objectFit:  "cover",
          objectPosition: "center",
          zIndex:     0,
          pointerEvents: "none",
          userSelect: "none",
          filter:     "blur(4px) brightness(0.88)",
          transform:  "scale(1.05)",
          transformOrigin: "center",
        }}
      />

      {/* ── Grain / noise overlay — tricks the eye away from pixelation ── */}
      <svg
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          zIndex: 1, pointerEvents: "none", opacity: 0.055,
        }}
      >
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)"/>
      </svg>

      {/* ── Dark vignette to lift text readability ── */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0, zIndex: 2,
          background: "rgba(30,20,50,0.28)",
          pointerEvents: "none",
        }}
      />

      {/* ── Warm peach tint overlay (top-right sun haze) ── */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset:    0,
          zIndex:   2,
          background: "radial-gradient(ellipse 55% 40% at 82% 15%, rgba(240,210,175,0.22) 0%, transparent 55%)",
          pointerEvents: "none",
        }}
      />

      <SceneLayers />

      {/* ── outer rounded glass frame ──────────────────────────────────── */}
      <div
        className="relative z-10 flex-1 flex flex-col m-3 sm:m-5 rounded-[24px] overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.20)" }}
      >
        {/* very subtle inner blur tint */}
        <div className="absolute inset-0 rounded-[24px]"
             style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(1.5px)" }}/>

        {/* ══════════════════════════════════
            NAV
        ══════════════════════════════════ */}
        <nav className="relative z-10 flex items-center px-6 sm:px-10 py-5">
          {/* left nav links */}
          <div className="hidden sm:flex items-center gap-8 text-white/80 text-sm font-medium">
            <Link href="/wellness" className="hover:text-white transition-colors">Wellness</Link>
            <Link href="/retreats"  className="hover:text-white transition-colors">Retreats</Link>
          </div>

          {/* centred wordmark */}
          <div className="flex items-center gap-2 text-white mx-auto
                          sm:absolute sm:left-1/2 sm:-translate-x-1/2">
            <SouloraIcon />
            <span className="font-display text-[1.35rem] tracking-wide">Soulora</span>
          </div>

          {/* right nav links */}
          <div className="hidden sm:flex items-center gap-8 text-white/80 text-sm font-medium ml-auto">
            <Link href="/about"      className="hover:text-white transition-colors">About</Link>
            <Link href="/testimonials" className="hover:text-white transition-colors">Testimonials</Link>
          </div>

          {/* mobile menu icon */}
          <button className="sm:hidden ml-auto text-white/75 hover:text-white transition-colors"
                  aria-label="Open menu">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2"
                 viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
        </nav>

        {/* ══════════════════════════════════
            HERO — glassmorphic card
        ══════════════════════════════════ */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center
                        text-center px-5 pt-4 pb-20 sm:pb-28">

          {/* ── trust badge ── */}
          <div className="glass mb-7 px-4 py-1.5 text-white/88 text-xs sm:text-sm font-medium
                          tracking-wide">
            Trusted by 12.5K+ Souls
          </div>

          {/* ── glassmorphic card wrapping the hero copy ── */}
          <div className="glass mx-auto px-8 sm:px-10 py-9 sm:py-10 max-w-2xl w-full
                          flex flex-col items-center">

            {/* headline */}
            <h1 className="font-display text-white font-light leading-[1.08] tracking-tight mb-3
                           text-3xl sm:text-4xl md:text-5xl">
              Your Sanctuary for<br className="hidden sm:block"/>
              <em className="not-italic">Mindful Living</em>
            </h1>

            {/* sub-headline */}
            <p className="text-white/78 text-sm sm:text-base leading-relaxed max-w-sm mb-8">
              Soulora invites you to slow down, heal, &amp; rediscover joy
              through mindful living &amp; holistic care.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              {/*
                "Book a free call" — opens Calendly.
                Replace the href with your actual Calendly link.
              */}
              <a
                href="https://calendly.com"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-soul w-full sm:w-auto text-center"
              >
                Book a free call
              </a>

              {/*
                "Check in" — routes to /checkin which calls the FastAPI /chat endpoint.
                API base is controlled by NEXT_PUBLIC_API_URL (see docker-compose build args).
              */}
              <Link href="/checkin" className="btn-ghost w-full sm:w-auto text-center">
                Check in
              </Link>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════
            FLOATING CARDS
        ══════════════════════════════════ */}
        <div className="absolute bottom-5 left-5 sm:bottom-9 sm:left-9 z-10">
          <BreathCard />
        </div>
        <div className="absolute bottom-5 right-5 sm:bottom-9 sm:right-9 z-10 hidden md:block">
          <IntentionCard />
        </div>

      </div>{/* end glass frame */}

      {/* compliance footer */}
      <p className="relative z-10 text-center text-white/32 text-[10px] py-2 px-4">
        🔒 Secure Session · Data encrypted in transit and at rest ·
        Not a substitute for professional mental health care
      </p>
    </div>
  );
}
