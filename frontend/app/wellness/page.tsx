"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Wind, Waves, Sparkles, CheckCircle2 } from "lucide-react";
import { generateRitual, type Ritual } from "@/lib/api";

/* ── Soulora icon ───────────────────────────────────────────────────────── */
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

/* ── Background (blur 5px + brightness 0.9 per design spec) ─────────────── */
function BackgroundLayers() {
  return (
    <>
      <img
        src="/nature-bg.jpg"
        alt="" aria-hidden="true"
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover", objectPosition: "center", zIndex: 0,
          pointerEvents: "none", userSelect: "none",
          filter: "blur(5px) brightness(0.9)",
          transform: "scale(1.05)", transformOrigin: "center",
        }}
      />
      {/* grain */}
      <svg aria-hidden="true" style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        zIndex: 1, pointerEvents: "none", opacity: 0.055,
      }}>
        <filter id="grain-well">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
        </filter>
        <rect width="100%" height="100%" filter="url(#grain-well)"/>
      </svg>
      {/* dark vignette */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, zIndex: 2,
        background: "rgba(30,20,50,0.28)", pointerEvents: "none",
      }}/>
      {/* warm top-right haze */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, zIndex: 2,
        background: "radial-gradient(ellipse 55% 40% at 82% 15%, rgba(240,210,175,0.22) 0%, transparent 55%)",
        pointerEvents: "none",
      }}/>
    </>
  );
}

/* ── Shimmer skeleton ───────────────────────────────────────────────────── */
function ShimmerCard() {
  return (
    <div className="glass mx-auto max-w-2xl w-full px-8 py-10 animate-pulse">
      <div className="h-6 bg-white/20 rounded-full w-3/5 mx-auto mb-8"/>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-4 mb-7">
          <div className="w-10 h-10 rounded-full bg-white/15 shrink-0"/>
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3 bg-white/20 rounded-full w-1/3"/>
            <div className="h-3 bg-white/15 rounded-full w-full"/>
            <div className="h-3 bg-white/10 rounded-full w-4/5"/>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Step definitions ───────────────────────────────────────────────────── */
const STEP_META = [
  { key: "opening",     label: "Opening",     Icon: Wind,     color: "rgba(180,210,240,0.85)" },
  { key: "practice",    label: "Practice",    Icon: Waves,    color: "rgba(180,230,210,0.85)" },
  { key: "integration", label: "Integration", Icon: Sparkles, color: "rgba(220,200,255,0.85)" },
] as const;

/* ── Peace toast ────────────────────────────────────────────────────────── */
function PeaceToast() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{    opacity: 0, y: -16, scale: 0.96 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50
                 flex items-center gap-3 px-6 py-3.5 rounded-2xl
                 shadow-xl select-none"
      style={{
        background: "rgba(60,38,100,0.82)",
        border: "1px solid rgba(200,180,255,0.30)",
        backdropFilter: "blur(18px)",
      }}
    >
      <CheckCircle2 size={18} className="text-green-300 shrink-0"/>
      <span className="text-white/90 text-sm font-medium">
        Ritual complete · Returning to your sanctuary…
      </span>
    </motion.div>
  );
}

/* ── Animated ritual card ───────────────────────────────────────────────── */
function RitualCard({ ritual, onComplete }: { ritual: Ritual; onComplete: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0  }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="glass mx-auto max-w-2xl w-full px-8 sm:px-10 py-9 sm:py-10"
    >
      {/* title */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0  }}
        transition={{ delay: 0.15, duration: 0.45 }}
        className="font-display text-white text-2xl sm:text-3xl font-light
                   leading-tight tracking-tight text-center mb-8"
      >
        {ritual.title}
      </motion.h2>

      {/* steps — fade in one-by-one with stagger */}
      <ol className="relative">
        {STEP_META.map(({ key, label, Icon, color }, idx) => (
          <motion.li
            key={key}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1,  x: 0   }}
            transition={{ delay: 0.35 + idx * 0.28, duration: 0.5, ease: "easeOut" }}
            className="flex gap-4"
          >
            {/* icon + connector */}
            <div className="flex flex-col items-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.22)",
                }}
              >
                <Icon size={18} color={color}/>
              </div>
              {idx < STEP_META.length - 1 && (
                <motion.div
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: 0.55 + idx * 0.28, duration: 0.35, ease: "easeOut" }}
                  style={{
                    width: 1, flex: 1, minHeight: "2rem", margin: "4px 0",
                    background: "rgba(255,255,255,0.15)",
                    transformOrigin: "top",
                  }}
                />
              )}
            </div>

            {/* text */}
            <div className="pb-8">
              <p className="text-white/60 text-xs font-medium uppercase tracking-widest mb-1">
                {label}
              </p>
              <p className="text-white/90 text-sm sm:text-base leading-relaxed">
                {ritual.steps[key]}
              </p>
            </div>
          </motion.li>
        ))}
      </ol>

      {/* Ritual Complete CTA */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1,  y: 0  }}
        transition={{ delay: 0.35 + STEP_META.length * 0.28 + 0.2, duration: 0.45 }}
        className="flex justify-center mt-2"
      >
        <button
          onClick={onComplete}
          className="flex items-center gap-2 btn-soul px-8 py-3"
        >
          <CheckCircle2 size={16}/>
          Ritual Complete
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ── Environments & time options ────────────────────────────────────────── */
const ENVIRONMENTS = [
  "Home — quiet room",
  "Home — garden or balcony",
  "Bedroom",
  "Office or desk",
  "Outdoors — nature",
  "Café or public space",
  "Commuting",
];
const TIME_OPTIONS = [3, 5, 10, 15, 20, 30];

/* ══════════════════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════════════════ */
export default function WellnessPage() {
  const router = useRouter();
  const [energy, setEnergy]   = useState(5);
  const [env, setEnv]         = useState(ENVIRONMENTS[0]);
  const [time, setTime]       = useState(10);
  const [loading, setLoading] = useState(false);
  const [ritual, setRitual]   = useState<Ritual | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setRitual(null);
    try {
      const result = await generateRitual({ energy_level: energy, environment: env, time_available: time });
      setRitual(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleComplete() {
    setShowToast(true);
    setTimeout(() => router.push("/"), 2200);
  }

  const energyLabel =
    energy <= 3 ? "Low & depleted" :
    energy <= 6 ? "Calm & steady"  :
                  "Bright & energised";

  return (
    <div className="relative min-h-screen flex flex-col" style={{ backgroundColor: "#B0A0C4" }}>
      <BackgroundLayers />

      {/* peace toast */}
      <AnimatePresence>
        {showToast && <PeaceToast />}
      </AnimatePresence>

      {/* outer rounded frame */}
      <div
        className="relative z-10 flex-1 flex flex-col m-3 sm:m-5 rounded-[24px] overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.20)" }}
      >
        <div className="absolute inset-0 rounded-[24px]"
             style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(1.5px)" }}/>

        {/* Nav */}
        <nav className="relative z-10 flex items-center px-6 sm:px-10 py-5">
          <Link href="/" className="text-white/70 hover:text-white transition-colors mr-6">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </Link>
          <div className="flex items-center gap-2 text-white mx-auto
                          sm:absolute sm:left-1/2 sm:-translate-x-1/2">
            <SouloraIcon />
            <span className="font-display text-[1.35rem] tracking-wide">Soulora</span>
          </div>
        </nav>

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-start
                        px-5 pt-4 pb-20 sm:pb-28 gap-6">

          {/* heading */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0   }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-center mb-2"
          >
            <p className="text-white/55 text-xs uppercase tracking-widest mb-2">Wellness Alchemist</p>
            <h1 className="font-display text-white text-3xl sm:text-4xl font-light leading-tight">
              Craft Your Ritual
            </h1>
            <p className="text-white/65 text-sm mt-2">
              Tell us where you are and we&apos;ll weave a moment just for you.
            </p>
          </motion.div>

          {/* Discovery card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0  }}
            transition={{ delay: 0.15, duration: 0.5, ease: "easeOut" }}
            className="glass mx-auto max-w-2xl w-full px-8 sm:px-10 py-8 sm:py-9 flex flex-col gap-7"
          >
            {/* Energy slider */}
            <div>
              <div className="flex justify-between items-baseline mb-3">
                <label className="text-white/80 text-sm font-medium">Energy level</label>
                <span className="text-white text-xs font-semibold">
                  {energy}/10 — <span className="text-white/70 font-normal">{energyLabel}</span>
                </span>
              </div>
              <input
                type="range" min={1} max={10} value={energy}
                onChange={(e) => setEnergy(Number(e.target.value))}
                className="soul-slider w-full"
              />
              <div className="flex justify-between text-white/35 text-[10px] mt-1.5">
                <span>Depleted</span><span>Energised</span>
              </div>
            </div>

            {/* Environment dropdown */}
            <div>
              <label className="text-white/80 text-sm font-medium block mb-2">
                Where are you right now?
              </label>
              <select
                value={env}
                onChange={(e) => setEnv(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm text-white/90 outline-none appearance-none cursor-pointer"
                style={{
                  background: "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.22)",
                  backdropFilter: "blur(8px)",
                }}
              >
                {ENVIRONMENTS.map((e) => (
                  <option key={e} value={e} style={{ background: "#4a3870", color: "#fff" }}>{e}</option>
                ))}
              </select>
            </div>

            {/* Time pills */}
            <div>
              <label className="text-white/80 text-sm font-medium block mb-2">
                Time available
              </label>
              <div className="flex flex-wrap gap-2">
                {TIME_OPTIONS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTime(t)}
                    className="px-4 py-1.5 rounded-full text-sm transition-all"
                    style={{
                      background: time === t ? "rgba(138,92,201,0.75)" : "rgba(255,255,255,0.10)",
                      border: `1px solid ${time === t ? "rgba(180,140,255,0.5)" : "rgba(255,255,255,0.20)"}`,
                      color: time === t ? "#fff" : "rgba(255,255,255,0.70)",
                    }}
                  >
                    {t} min
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="btn-soul w-full mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Weaving your ritual…" : "Generate My Ritual"}
            </button>
          </motion.div>

          {/* Shimmer */}
          {loading && <ShimmerCard />}

          {/* Error */}
          {error && !loading && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="glass mx-auto max-w-2xl w-full px-8 py-6 text-center"
            >
              <p className="text-white/80 text-sm">{error}</p>
              <button onClick={handleGenerate} className="btn-ghost mt-4 text-sm px-6 py-2">
                Try again
              </button>
            </motion.div>
          )}

          {/* Ritual result */}
          {ritual && !loading && (
            <RitualCard ritual={ritual} onComplete={handleComplete} />
          )}
        </div>
      </div>

      <p className="relative z-10 text-center text-white/32 text-[10px] py-2 px-4">
        🔒 Secure Session · Not a substitute for professional mental health care
      </p>
    </div>
  );
}
