"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trees, Waves, Mountain, Sun,
  Clock, CalendarDays, Sparkles, ArrowRight, X,
} from "lucide-react";
import { matchRetreats, type RetreatDetail } from "@/lib/api";

// ── Sanctuary theme system ────────────────────────────────────────────────────

type Sanctuary = "default" | "forest" | "ocean" | "desert" | "nordic";

const THEME: Record<Sanctuary, {
  overlay:     string;   // rgba color cast over the nature background
  borderColor: string;   // glassmorphic card border accent
  label:       string;
  noiseFilter: { type: BiquadFilterType; frequency: number; Q?: number };
  gain:        number;
}> = {
  default: {
    overlay:     "rgba(30,20,50,0.30)",
    borderColor: "rgba(255,255,255,0.20)",
    label:       "Sanctuary",
    noiseFilter: { type: "bandpass", frequency: 500 },
    gain:        0,                                 // silent in default
  },
  forest: {
    overlay:     "rgba(15,50,25,0.42)",
    borderColor: "rgba(80,200,120,0.55)",
    label:       "Forest Immersion",
    noiseFilter: { type: "lowpass", frequency: 320 },
    gain:        0.20,
  },
  ocean: {
    overlay:     "rgba(10,40,80,0.38)",
    borderColor: "rgba(80,200,230,0.55)",
    label:       "Coastal Sanctuary",
    noiseFilter: { type: "bandpass", frequency: 680, Q: 0.35 },
    gain:        0.24,
  },
  desert: {
    overlay:     "rgba(80,45,5,0.38)",
    borderColor: "rgba(220,175,60,0.55)",
    label:       "Desert Solitude",
    noiseFilter: { type: "lowpass", frequency: 160 },
    gain:        0.15,
  },
  nordic: {
    overlay:     "rgba(10,25,55,0.40)",
    borderColor: "rgba(160,210,255,0.55)",
    label:       "Nordic Stillness",
    noiseFilter: { type: "highpass", frequency: 220 },
    gain:        0.16,
  },
};

// Map retreat IDs → sanctuary environment
const RETREAT_SANCTUARY: Record<string, Sanctuary> = {
  "silent-forest-japan":      "forest",
  "coastal-yoga-portugal":    "ocean",
  "desert-digital-detox":     "desert",
  "ayurveda-kerala":          "forest",
  "nordic-sauna-finland":     "nordic",
};

// ── Pink noise generator (Web Audio API — no CDN needed) ──────────────────────

function buildPinkNoise(ctx: AudioContext, seconds = 8): AudioBufferSourceNode {
  const buf  = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1;
    b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
    b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
    b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
    data[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11;
    b6 = w*0.115926;
  }
  const src  = ctx.createBufferSource();
  src.buffer = buf;
  src.loop   = true;
  return src;
}

// ── useSanctuaryAudio hook ────────────────────────────────────────────────────

function useSanctuaryAudio(sanctuary: Sanctuary) {
  const ctxRef    = useRef<AudioContext | null>(null);
  const gainRef   = useRef<GainNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    const theme = THEME[sanctuary];

    // Stop previous source with fade-out
    const stopPrev = (ctx: AudioContext) => {
      const g = gainRef.current;
      const s = sourceRef.current;
      if (!g || !s) return;
      const t = ctx.currentTime + 1.2;
      g.gain.linearRampToValueAtTime(0, t);
      s.stop(t);
      gainRef.current   = null;
      sourceRef.current = null;
    };

    if (sanctuary === "default" || theme.gain === 0) {
      // Fade out and stop
      if (ctxRef.current) stopPrev(ctxRef.current);
      return;
    }

    // Create AudioContext on first themed preview
    const ctx = ctxRef.current ?? (() => {
      const c = new AudioContext();
      ctxRef.current = c;
      return c;
    })();
    if (ctx.state === "suspended") ctx.resume();

    stopPrev(ctx);

    // Short delay so fade-out overlaps with fade-in
    const startAt = ctx.currentTime + 0.6;

    // Noise → filter → gain → output
    const src    = buildPinkNoise(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type            = theme.noiseFilter.type;
    filter.frequency.value = theme.noiseFilter.frequency;
    if (theme.noiseFilter.Q) filter.Q.value = theme.noiseFilter.Q;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(theme.gain, startAt + 2);   // 2 s fade-in

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(startAt);

    gainRef.current   = gain;
    sourceRef.current = src;
  }, [sanctuary]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { sourceRef.current?.stop(); ctxRef.current?.close(); } catch { /* ignore */ }
    };
  }, []);
}

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

/* ── Background — cross-fades theme overlay on sanctuary change ─────────── */
function BackgroundLayers({ sanctuary }: { sanctuary: Sanctuary }) {
  return (
    <>
      <img
        src="/nature-bg.jpg" alt="" aria-hidden="true"
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
        <filter id="grain-ret">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
        </filter>
        <rect width="100%" height="100%" filter="url(#grain-ret)"/>
      </svg>
      {/* 2-second cross-fade theme overlay */}
      <AnimatePresence>
        <motion.div
          key={sanctuary}
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{    opacity: 0 }}
          transition={{ duration: 2, ease: "easeInOut" }}
          style={{
            position: "absolute", inset: 0, zIndex: 2,
            background: THEME[sanctuary].overlay,
            pointerEvents: "none",
          }}
        />
      </AnimatePresence>
      {/* warm top-right haze (always present) */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, zIndex: 3,
        background: "radial-gradient(ellipse 55% 40% at 82% 15%, rgba(240,210,175,0.16) 0%, transparent 55%)",
        pointerEvents: "none",
      }}/>
    </>
  );
}

/* ── Slide animation variants ───────────────────────────────────────────── */
const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({
    x: dir > 0 ? -80 : 80,
    opacity: 0,
  }),
};

const transition = { duration: 0.38, ease: [0.32, 0, 0.68, 1] as const };

/* ── Step progress dots ─────────────────────────────────────────────────── */
function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-2 justify-center mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width:  i === step ? 20 : 8,
            height: 8,
            background: i <= step ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.22)",
          }}
        />
      ))}
    </div>
  );
}

/* ── Environment options ────────────────────────────────────────────────── */
const ENVIRONMENTS = [
  { label: "Forest",  Icon: Trees,    desc: "Ancient trees & deep silence" },
  { label: "Ocean",   Icon: Waves,    desc: "Salt air & endless horizons"  },
  { label: "Mountain",Icon: Mountain, desc: "Heights & crisp clarity"      },
  { label: "Desert",  Icon: Sun,      desc: "Vast space & starlit skies"   },
];

/* ── Timeline options ───────────────────────────────────────────────────── */
const TIMELINES = [
  { label: "Short stay",  Icon: Clock,        desc: "3–5 days · Quick reset",    value: "short"  },
  { label: "Long stay",   Icon: CalendarDays, desc: "7–10 days · Deep renewal",  value: "long"   },
];

/* ── Shimmer for results ─────────────────────────────────────────────────── */
function ResultsShimmer() {
  return (
    <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto">
      {[0, 1].map((i) => (
        <div key={i} className="glass px-7 py-7 animate-pulse">
          <div className="h-5 bg-white/20 rounded-full w-2/3 mb-3"/>
          <div className="h-3 bg-white/15 rounded-full w-full mb-2"/>
          <div className="h-3 bg-white/10 rounded-full w-4/5 mb-5"/>
          <div className="flex gap-2">
            {[0,1,2].map(j => (
              <div key={j} className="h-5 w-16 bg-white/15 rounded-full"/>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Match score bar (deterministic: rank 1 = 97%, rank 2 = 88%) ────────── */
const MATCH_SCORES = [97, 88];

function MatchScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height: 5, background: "rgba(255,255,255,0.12)" }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg, rgba(138,92,201,0.9), rgba(200,160,255,0.9))" }}
        />
      </div>
      <span className="text-white/70 text-xs font-medium tabular-nums shrink-0">
        {score}% match
      </span>
    </div>
  );
}

/* ── Single retreat result card ─────────────────────────────────────────── */
function RetreatCard({ retreat, index, sanctuary, onPreview }: {
  retreat:   RetreatDetail;
  index:     number;
  sanctuary: Sanctuary;
  onPreview: (s: Sanctuary) => void;
}) {
  const tierColour: Record<string, string> = {
    "budget-friendly": "rgba(120,220,160,0.85)",
    "mid-range":       "rgba(180,200,255,0.85)",
    "luxury":          "rgba(255,200,120,0.85)",
  };

  const tierLabel: Record<string, string> = {
    "budget-friendly": "Budget-friendly",
    "mid-range":       "Mid-range",
    "luxury":          "Luxury",
  };

  const rankLabel = index === 0 ? "Top Pick" : "Runner-up";
  const matchScore = MATCH_SCORES[index] ?? 80;

  const retreatSanctuary = RETREAT_SANCTUARY[retreat.id] ?? "default";
  const accentBorder     = sanctuary !== "default"
    ? THEME[sanctuary].borderColor
    : "rgba(255,255,255,0.18)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0  }}
      transition={{ delay: index * 0.2, duration: 0.5, ease: "easeOut" }}
      className="px-6 sm:px-9 py-7 sm:py-8 w-full flex flex-col gap-5"
      style={{
        background: "rgba(255,255,255,0.09)",
        backdropFilter: "blur(15px)",
        WebkitBackdropFilter: "blur(15px)",
        border: `1px solid ${accentBorder}`,
        borderRadius: 20,
        transition: "border-color 1.5s ease",
        boxShadow: "0 4px 32px rgba(0,0,0,0.18)",
      }}
    >
      {/* ── Top meta row ── */}
      <div className="flex flex-wrap items-start gap-2 justify-between">
        {/* AI Curated badge + rank */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold
                       px-2.5 py-1 rounded-full uppercase tracking-wide"
            style={{
              background: "rgba(138,92,201,0.35)",
              border: "1px solid rgba(180,140,255,0.45)",
              color: "rgba(220,200,255,0.95)",
            }}
          >
            <Sparkles size={10}/> AI Curated for You
          </span>
          <span
            className="text-[11px] font-medium px-2.5 py-1 rounded-full uppercase tracking-wide"
            style={{
              background: index === 0 ? "rgba(255,200,80,0.18)" : "rgba(255,255,255,0.08)",
              border: `1px solid ${index === 0 ? "rgba(255,200,80,0.35)" : "rgba(255,255,255,0.15)"}`,
              color: index === 0 ? "rgba(255,220,120,0.90)" : "rgba(255,255,255,0.55)",
            }}
          >
            {rankLabel}
          </span>
        </div>

        {/* Tier + duration */}
        <span
          className="text-xs font-medium px-3 py-1 rounded-full shrink-0"
          style={{
            background: "rgba(255,255,255,0.09)",
            color: tierColour[retreat.price_tier] ?? "rgba(255,255,255,0.75)",
            border: `1px solid ${tierColour[retreat.price_tier] ?? "rgba(255,255,255,0.20)"}`,
          }}
        >
          {tierLabel[retreat.price_tier] ?? retreat.price_tier} · {retreat.duration_days} days
        </span>
      </div>

      {/* ── Title ── */}
      <h3 className="font-display text-white text-xl sm:text-2xl font-light leading-snug -mt-1">
        {retreat.title}
      </h3>

      {/* ── Match score bar ── */}
      <MatchScoreBar score={matchScore} />

      {/* ── Description ── */}
      <p className="text-white/72 text-sm leading-relaxed">
        {retreat.description}
      </p>

      {/* ── AI Insight panel ── */}
      <div
        className="rounded-xl px-4 py-3.5"
        style={{
          background: "rgba(138,92,201,0.16)",
          border: "1px solid rgba(180,140,255,0.22)",
        }}
      >
        <div className="flex items-start gap-2.5">
          <Sparkles size={13} className="text-purple-300 mt-0.5 shrink-0"/>
          <p className="text-white/88 text-sm leading-relaxed italic">
            {retreat.ai_insight}
          </p>
        </div>
      </div>

      {/* ── Highlights ── */}
      <div className="flex flex-wrap gap-2">
        {retreat.highlights.map((h) => (
          <span
            key={h}
            className="text-xs px-3 py-1 rounded-full text-white/68"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.14)",
            }}
          >
            {h}
          </span>
        ))}
      </div>

      {/* ── CTA buttons — stack on mobile, row on sm+ ── */}
      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <a
          href="https://calendly.com"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-soul flex-1 text-center text-sm py-2.5"
        >
          Book Discovery Call
        </a>
        <button
          onClick={() => onPreview(retreatSanctuary)}
          className="btn-ghost flex-1 text-center text-sm py-2.5 transition-all"
          style={{
            borderColor: retreatSanctuary !== "default" ? THEME[retreatSanctuary].borderColor : undefined,
          }}
        >
          {sanctuary === retreatSanctuary && sanctuary !== "default"
            ? `Previewing ${THEME[retreatSanctuary].label}`
            : "View Sanctuary Details"}
        </button>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════════════════ */
type Stage = "questions" | "loading" | "results";

export default function RetreatsPage() {
  const [step, setStep]       = useState(0);
  const [dir,  setDir]        = useState(1);          // slide direction
  const [soul, setSoul]       = useState("");         // step 1 textarea
  const [env,  setEnv]        = useState("");         // step 2 environment
  const [timeline, setTimeline] = useState("");       // step 3 short/long
  const [stage,     setStage]     = useState<Stage>("questions");
  const [results,   setResults]   = useState<RetreatDetail[]>([]);
  const [error,     setError]     = useState<string | null>(null);
  const [sanctuary, setSanctuary] = useState<Sanctuary>("default");

  useSanctuaryAudio(sanctuary);

  function goTo(next: number) {
    setDir(next > step ? 1 : -1);
    setStep(next);
  }

  async function submit() {
    // Build a rich natural-language query from all three answers
    const query = [
      soul.trim(),
      env     ? `I feel drawn to ${env.toLowerCase()} environments.` : "",
      timeline === "short"
        ? "I only have a few days for a short reset."
        : "I can invest in a longer, deeper renewal of 7–10 days.",
    ].filter(Boolean).join(" ");

    setStage("loading");
    setError(null);
    try {
      const data = await matchRetreats(query);
      setResults(data.matches);
      setStage("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStage("questions");
    }
  }

  function reset() {
    setSoul(""); setEnv(""); setTimeline("");
    setStep(0); setDir(1); setStage("questions");
    setResults([]); setError(null);
  }

  return (
    <div className="relative min-h-screen flex flex-col" style={{ backgroundColor: "#B0A0C4" }}>
      <BackgroundLayers sanctuary={sanctuary} />

      {/* outer rounded frame */}
      <div
        className="relative z-10 flex-1 flex flex-col m-3 sm:m-5 rounded-[24px] overflow-hidden"
        style={{ border: `1px solid ${THEME[sanctuary].borderColor}`, transition: "border-color 1.5s ease" }}
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

          {/* Exit Preview — visible only during sanctuary preview */}
          <AnimatePresence>
            {sanctuary !== "default" && (
              <motion.button
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0  }}
                exit={{    opacity: 0, x: 12  }}
                transition={{ duration: 0.3 }}
                onClick={() => setSanctuary("default")}
                className="ml-auto flex items-center gap-1.5 text-xs font-medium
                           px-3 py-1.5 rounded-full transition-all hover:opacity-80"
                style={{
                  background: "rgba(255,255,255,0.12)",
                  border: `1px solid ${THEME[sanctuary].borderColor}`,
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                <X size={11}/> Exit Preview
              </motion.button>
            )}
          </AnimatePresence>
        </nav>

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center
                        px-5 pt-2 pb-20 sm:pb-28">

          {/* ─── QUESTION FLOW ─────────────────────────────────────────── */}
          {stage === "questions" && (
            <div className="w-full max-w-2xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-8"
              >
                <p className="text-white/55 text-xs uppercase tracking-widest mb-2">
                  Retreat Concierge
                </p>
                <h1 className="font-display text-white text-3xl sm:text-4xl font-light">
                  Find Your Sanctuary
                </h1>
              </motion.div>

              <div className="glass px-8 sm:px-10 py-9 sm:py-10 overflow-hidden">
                <ProgressDots step={step} total={3} />

                {/* ── AnimatePresence for slide transitions ── */}
                <div className="overflow-hidden">
                  <AnimatePresence custom={dir} mode="wait">

                    {/* Step 1 */}
                    {step === 0 && (
                      <motion.div
                        key="step-0"
                        custom={dir}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={transition}
                        className="flex flex-col"
                      >
                        <p className="text-white/55 text-xs uppercase tracking-widest mb-2">
                          Step 1 of 3
                        </p>
                        <h2 className="font-display text-white text-2xl sm:text-3xl font-light
                                       leading-snug mb-4">
                          How does your soul feel today?
                        </h2>
                        <p className="text-white/60 text-sm mb-5">
                          Speak freely — describe your emotional state, what you&apos;re
                          carrying, or what you&apos;re longing for.
                        </p>
                        <textarea
                          value={soul}
                          onChange={(e) => setSoul(e.target.value)}
                          placeholder="e.g. I feel spiritually drained and need silence…"
                          rows={4}
                          className="w-full rounded-xl px-4 py-3 text-sm text-white/90
                                     placeholder-white/30 outline-none resize-none"
                          style={{
                            background: "rgba(255,255,255,0.08)",
                            border: "1px solid rgba(255,255,255,0.20)",
                            backdropFilter: "blur(6px)",
                          }}
                        />
                        <button
                          onClick={() => goTo(1)}
                          disabled={soul.trim().length < 5}
                          className="btn-soul mt-5 self-end flex items-center gap-2
                                     disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Continue <ArrowRight size={15}/>
                        </button>
                      </motion.div>
                    )}

                    {/* Step 2 */}
                    {step === 1 && (
                      <motion.div
                        key="step-1"
                        custom={dir}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={transition}
                        className="flex flex-col"
                      >
                        <p className="text-white/55 text-xs uppercase tracking-widest mb-2">
                          Step 2 of 3
                        </p>
                        <h2 className="font-display text-white text-2xl sm:text-3xl font-light
                                       leading-snug mb-5">
                          What sanctuary calls to you?
                        </h2>
                        <div className="grid grid-cols-2 gap-3">
                          {ENVIRONMENTS.map(({ label, Icon, desc }) => {
                            const active = env === label;
                            return (
                              <button
                                key={label}
                                onClick={() => setEnv(label)}
                                className="flex flex-col items-start gap-1 rounded-xl px-4 py-4
                                           text-left transition-all"
                                style={{
                                  background: active
                                    ? "rgba(138,92,201,0.40)"
                                    : "rgba(255,255,255,0.08)",
                                  border: `1px solid ${active
                                    ? "rgba(180,140,255,0.55)"
                                    : "rgba(255,255,255,0.16)"}`,
                                }}
                              >
                                <Icon size={20} color={active ? "rgba(220,200,255,0.9)" : "rgba(255,255,255,0.55)"}/>
                                <span className={`text-sm font-medium ${active ? "text-white" : "text-white/75"}`}>
                                  {label}
                                </span>
                                <span className="text-white/45 text-xs">{desc}</span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex justify-between mt-5">
                          <button onClick={() => goTo(0)}
                            className="text-white/55 text-sm hover:text-white transition-colors">
                            ← Back
                          </button>
                          <button
                            onClick={() => goTo(2)}
                            disabled={!env}
                            className="btn-soul flex items-center gap-2
                                       disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Continue <ArrowRight size={15}/>
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 3 */}
                    {step === 2 && (
                      <motion.div
                        key="step-2"
                        custom={dir}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={transition}
                        className="flex flex-col"
                      >
                        <p className="text-white/55 text-xs uppercase tracking-widest mb-2">
                          Step 3 of 3
                        </p>
                        <h2 className="font-display text-white text-2xl sm:text-3xl font-light
                                       leading-snug mb-5">
                          What is your timeline?
                        </h2>
                        <div className="flex flex-col gap-3">
                          {TIMELINES.map(({ label, Icon, desc, value }) => {
                            const active = timeline === value;
                            return (
                              <button
                                key={value}
                                onClick={() => setTimeline(value)}
                                className="flex items-center gap-4 rounded-xl px-5 py-4
                                           text-left transition-all"
                                style={{
                                  background: active
                                    ? "rgba(138,92,201,0.40)"
                                    : "rgba(255,255,255,0.08)",
                                  border: `1px solid ${active
                                    ? "rgba(180,140,255,0.55)"
                                    : "rgba(255,255,255,0.16)"}`,
                                }}
                              >
                                <Icon size={22} color={active ? "rgba(220,200,255,0.9)" : "rgba(255,255,255,0.55)"}/>
                                <div>
                                  <p className={`text-sm font-medium ${active ? "text-white" : "text-white/80"}`}>
                                    {label}
                                  </p>
                                  <p className="text-white/45 text-xs mt-0.5">{desc}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {error && (
                          <p className="text-red-300/80 text-xs mt-4">{error}</p>
                        )}
                        <div className="flex justify-between mt-6">
                          <button onClick={() => goTo(1)}
                            className="text-white/55 text-sm hover:text-white transition-colors">
                            ← Back
                          </button>
                          <button
                            onClick={submit}
                            disabled={!timeline}
                            className="btn-soul flex items-center gap-2
                                       disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Find My Retreat <Sparkles size={14}/>
                          </button>
                        </div>
                      </motion.div>
                    )}

                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}

          {/* ─── LOADING ───────────────────────────────────────────────── */}
          {stage === "loading" && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="w-full max-w-2xl mx-auto flex flex-col items-center gap-6"
            >
              <div className="text-center">
                <p className="text-white/55 text-xs uppercase tracking-widest mb-2">
                  Retreat Concierge
                </p>
                <p className="font-display text-white text-2xl font-light">
                  Listening to your soul…
                </p>
                <p className="text-white/55 text-sm mt-2">
                  Matching your energy to the perfect sanctuary
                </p>
              </div>
              <ResultsShimmer />
            </motion.div>
          )}

          {/* ─── RESULTS ───────────────────────────────────────────────── */}
          {stage === "results" && (
            <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-2"
              >
                <p className="text-white/55 text-xs uppercase tracking-widest mb-1">
                  Your Matches
                </p>
                <h2 className="font-display text-white text-3xl font-light">
                  Sanctuaries Chosen for You
                </h2>
              </motion.div>

              {results.map((r, i) => (
                <RetreatCard
                  key={r.id}
                  retreat={r}
                  index={i}
                  sanctuary={sanctuary}
                  onPreview={setSanctuary}
                />
              ))}

              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex justify-center mt-2"
              >
                <button onClick={reset}
                  className="btn-ghost text-sm px-7 py-2.5 flex items-center gap-2">
                  Start again
                </button>
              </motion.div>
            </div>
          )}

        </div>
      </div>

      <p className="relative z-10 text-center text-white/32 text-[10px] py-2 px-4">
        🔒 Secure Session · Not a substitute for professional mental health care
      </p>
    </div>
  );
}
