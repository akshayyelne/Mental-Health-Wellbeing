"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { submitCheckin, getReflection, type SupportPlan } from "@/lib/api";

// ── Constants ─────────────────────────────────────────────────────────────────

const SUPPORT_OPTIONS = ["Family", "Friends", "Therapist", "Support Groups", "None"];
const SYMPTOM_OPTIONS = [
  "Anxiety", "Depression", "Insomnia", "Fatigue",
  "Loss of Interest", "Difficulty Concentrating",
  "Changes in Appetite", "Social Withdrawal",
  "Mood Swings", "Physical Discomfort",
];

type Tab = "Daily Check-in" | "Support Plan" | "History";

interface HistoryEntry {
  timestamp:  string;
  thread_id:  string;
  risk_level: string;
  stress:     number;
  symptoms:   string;
}

// ── Background (matches Wellness / Retreats pages) ────────────────────────────

function BackgroundLayers() {
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
      <svg aria-hidden="true" style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        zIndex: 1, pointerEvents: "none", opacity: 0.055,
      }}>
        <filter id="grain-ci">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
        </filter>
        <rect width="100%" height="100%" filter="url(#grain-ci)"/>
      </svg>
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, zIndex: 2,
        background: "rgba(30,20,50,0.30)", pointerEvents: "none",
      }}/>
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, zIndex: 2,
        background: "radial-gradient(ellipse 55% 40% at 82% 15%, rgba(240,210,175,0.18) 0%, transparent 55%)",
        pointerEvents: "none",
      }}/>
    </>
  );
}

// ── Soulora icon ──────────────────────────────────────────────────────────────

function SouloraIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C10 6 6 8 6 12c0 3.3 2.7 6 6 6s6-2.7 6-6c0-4-4-6-6-10z"/>
      <path d="M12 8c-1.5 2-3 3.5-3 5a3 3 0 0 0 6 0c0-1.5-1.5-3-3-5z"/>
    </svg>
  );
}

// ── Glass pill select ─────────────────────────────────────────────────────────

function GlassPillSelect({ options, selected, onChange }: {
  options:  string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) =>
    onChange(selected.includes(opt)
      ? selected.filter(s => s !== opt)
      : [...selected, opt]);

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {options.map(opt => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className="px-3.5 py-1.5 text-sm rounded-full transition-all duration-150"
            style={{
              background: active ? "rgba(138,92,201,0.45)" : "rgba(255,255,255,0.10)",
              border: `1px solid ${active ? "rgba(180,140,255,0.60)" : "rgba(255,255,255,0.20)"}`,
              color: active ? "#fff" : "rgba(255,255,255,0.68)",
              backdropFilter: "blur(6px)",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ── Glass textarea ────────────────────────────────────────────────────────────

function GlassTextarea({ value, onChange, placeholder, rows = 4 }: {
  value:       string;
  onChange:    (v: string) => void;
  placeholder: string;
  rows?:       number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-xl px-4 py-3 text-sm text-white/90
                 placeholder-white/30 outline-none resize-none transition-all"
      style={{
        background: "rgba(255,255,255,0.08)",
        border: `1px solid ${focused ? "rgba(180,140,255,0.65)" : "rgba(255,255,255,0.18)"}`,
        backdropFilter: "blur(6px)",
        boxShadow: focused ? "0 0 0 3px rgba(138,92,201,0.18)" : "none",
      }}
    />
  );
}

// ── Gradient slider ───────────────────────────────────────────────────────────

function GradientSlider({ min, max, value, onChange }: {
  min: number; max: number; value: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="relative mt-2">
      {/* gradient track behind */}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-full h-[5px] rounded-full pointer-events-none"
        style={{
          background: "linear-gradient(90deg, #6BAA8E 0%, #8A5CC9 100%)",
          opacity: 0.55,
        }}
      />
      {/* filled portion overlay */}
      <div
        className="absolute top-1/2 -translate-y-1/2 h-[5px] rounded-full pointer-events-none"
        style={{
          width: `${pct}%`,
          background: "linear-gradient(90deg, #6BAA8E 0%, #8A5CC9 100%)",
        }}
      />
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="soul-slider relative w-full"
        style={{ background: "transparent" }}
      />
    </div>
  );
}

// ── Real-time Reflection card ─────────────────────────────────────────────────

function ReflectionCard({ text }: { text: string | null; loading: boolean } & { loading: boolean }) {
  if (!text && !arguments[0]?.loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl px-4 py-4 mt-4"
      style={{
        background: "rgba(138,92,201,0.15)",
        border: "1px solid rgba(180,140,255,0.25)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={13} className="text-purple-300 shrink-0"/>
        <span className="text-white/60 text-xs uppercase tracking-widest">Your Reflection</span>
      </div>
      {arguments[0]?.loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-white/15 rounded-full w-full"/>
          <div className="h-3 bg-white/10 rounded-full w-4/5"/>
          <div className="h-3 bg-white/08 rounded-full w-3/5"/>
        </div>
      ) : (
        <p className="text-white/85 text-sm leading-relaxed italic">{text}</p>
      )}
    </motion.div>
  );
}

// ── Loading steps ─────────────────────────────────────────────────────────────

const LOAD_STEPS = [
  "Checking safety indicators…",
  "Analysing clinical markers…",
  "Building your action plan…",
  "Designing long-term strategy…",
  "Synthesising support plan…",
];

function LoadingSteps() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= LOAD_STEPS.length - 1) return;
    const t = setTimeout(() => setStep(s => s + 1), 2200);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <div className="glass mx-auto max-w-xl w-full px-7 py-7 mt-4 space-y-2">
      {LOAD_STEPS.map((s, i) => (
        <div key={s} className={`flex items-center gap-2.5 text-sm transition-opacity duration-300
                                  ${i <= step ? "opacity-100" : "opacity-25"}`}>
          {i < step
            ? <span className="text-green-300 text-xs">✓</span>
            : i === step
            ? <svg className="animate-spin w-3.5 h-3.5 text-purple-300 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            : <span className="w-3.5"/>}
          <span className={i <= step ? "text-white/85" : "text-white/30"}>{s}</span>
        </div>
      ))}
    </div>
  );
}

// ── Support plan cards ────────────────────────────────────────────────────────

function PlanCard({ emoji, title, content }: { emoji: string; title: string; content: string }) {
  return (
    <div className="glass px-6 py-5 mb-4">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="text-lg">{emoji}</span>
        <span className="font-semibold text-white/90 text-sm">{title}</span>
      </div>
      <div className="prose prose-invert prose-sm text-white/80 max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const colour: Record<string, string> = {
    crisis:   "rgba(255,100,100,0.80)",
    elevated: "rgba(255,165,80,0.80)",
    moderate: "rgba(255,220,80,0.80)",
    low:      "rgba(120,220,160,0.80)",
  };
  const label = level.charAt(0).toUpperCase() + level.slice(1);
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full"
      style={{
        background: "rgba(255,255,255,0.10)",
        border: `1px solid ${colour[level] ?? "rgba(255,255,255,0.25)"}`,
        color: colour[level] ?? "rgba(255,255,255,0.75)",
      }}
    >
      {label}
    </span>
  );
}

// ── Step progress dots ────────────────────────────────────────────────────────

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-2 justify-center mb-7">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="rounded-full transition-all duration-300" style={{
          width: i === step ? 20 : 8, height: 8,
          background: i <= step ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.22)",
        }}/>
      ))}
    </div>
  );
}

// ── Slide variants ────────────────────────────────────────────────────────────

const slide = {
  enter: (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (d: number) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
};
const slideTrans = { duration: 0.35, ease: [0.32, 0, 0.68, 1] as const };

// ══════════════════════════════════════════════════════════════════════════════
// Page
// ══════════════════════════════════════════════════════════════════════════════

export default function CheckinPage() {
  const [activeTab,     setActiveTab]     = useState<Tab>("Daily Check-in");
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [plan,          setPlan]          = useState<SupportPlan | null>(null);
  const [history,       setHistory]       = useState<HistoryEntry[]>([]);

  // form fields
  const [mentalState,   setMentalState]   = useState("");
  const [sleepHours,    setSleepHours]    = useState(7);
  const [stressLevel,   setStressLevel]   = useState(5);
  const [supportSystem, setSupportSystem] = useState<string[]>([]);
  const [recentChanges, setRecentChanges] = useState("");
  const [symptoms,      setSymptoms]      = useState<string[]>([]);

  // multi-step
  const [step, setStep] = useState(0);
  const [dir,  setDir]  = useState(1);

  // real-time reflection
  const [reflection,        setReflection]        = useState<string | null>(null);
  const [reflectionLoading, setReflectionLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (mentalState.trim().length < 20) { setReflection(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setReflectionLoading(true);
      try {
        const r = await getReflection(mentalState);
        setReflection(r);
      } finally {
        setReflectionLoading(false);
      }
    }, 1800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [mentalState]);

  function goTo(next: number) {
    setDir(next > step ? 1 : -1);
    setStep(next);
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const result = await submitCheckin({
        mental_state: mentalState, sleep_hours: sleepHours,
        stress_level: stressLevel, support_system: supportSystem,
        recent_changes: recentChanges, symptoms,
      });
      setPlan(result);
      try { localStorage.setItem("soulora_last_checkin", JSON.stringify({ stress: stressLevel, sleep: sleepHours })); } catch { /* ignore */ }
      setHistory(prev => [{
        timestamp:  new Date().toLocaleString(),
        thread_id:  result.thread_id,
        risk_level: result.risk_level,
        stress:     stressLevel,
        symptoms:   symptoms.join(", ") || "—",
      }, ...prev]);
      setActiveTab("Support Plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setMentalState(""); setSleepHours(7); setStressLevel(5);
    setSupportSystem([]); setRecentChanges(""); setSymptoms([]);
    setReflection(null); setStep(0); setDir(1); setError(null);
  }

  const TAB_LIST: { id: Tab; label: string }[] = [
    { id: "Daily Check-in", label: "Check-in" },
    { id: "Support Plan",   label: "My Plan"  },
    { id: "History",        label: "History"  },
  ];

  return (
    <div className="relative min-h-screen flex flex-col" style={{ backgroundColor: "#B0A0C4" }}>
      <BackgroundLayers />

      {/* outer rounded frame */}
      <div
        className="relative z-10 flex-1 flex flex-col m-3 sm:m-5 rounded-[24px] overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.20)" }}
      >
        <div className="absolute inset-0 rounded-[24px]"
             style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(1.5px)" }}/>

        {/* ── Nav ── */}
        <nav className="relative z-10 flex items-center px-6 sm:px-10 py-5">
          <Link href="/" className="text-white/70 hover:text-white transition-colors mr-4">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </Link>
          <div className="flex items-center gap-2 text-white mx-auto
                          sm:absolute sm:left-1/2 sm:-translate-x-1/2">
            <SouloraIcon />
            <span className="font-display text-[1.35rem] tracking-wide">Soulora</span>
          </div>
          <a href="https://calendly.com" target="_blank" rel="noopener noreferrer"
             className="ml-auto btn-soul text-sm py-2 px-5 hidden sm:block">
            Book a call
          </a>
        </nav>

        {/* ── Body ── */}
        <div className="relative z-10 flex-1 flex flex-col items-center px-5 pt-2 pb-24 overflow-y-auto">

          {/* Tab bar */}
          <div className="flex gap-1 mb-8 w-full max-w-xl"
               style={{
                 background: "rgba(255,255,255,0.08)",
                 border: "1px solid rgba(255,255,255,0.15)",
                 borderRadius: 16, padding: 4,
               }}>
            {TAB_LIST.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="flex-1 py-2 text-sm font-medium rounded-xl transition-all duration-200"
                style={{
                  background: activeTab === id ? "rgba(255,255,255,0.16)" : "transparent",
                  color: activeTab === id ? "#fff" : "rgba(255,255,255,0.48)",
                  border: activeTab === id ? "1px solid rgba(255,255,255,0.22)" : "1px solid transparent",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ════════════════════════════════════════════════════════════════
              Tab 1 — Daily Check-in (3-step wizard)
          ════════════════════════════════════════════════════════════════ */}
          {activeTab === "Daily Check-in" && (
            <div className="w-full max-w-xl">
              <div className="glass px-8 sm:px-10 py-9 overflow-hidden">
                <ProgressDots step={step} total={3} />

                <AnimatePresence custom={dir} mode="wait">

                  {/* ── Step 1: Feelings + sliders ── */}
                  {step === 0 && (
                    <motion.div key="s0" custom={dir} variants={slide}
                      initial="enter" animate="center" exit="exit" transition={slideTrans}
                      className="flex flex-col gap-5"
                    >
                      <div>
                        <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Step 1 of 3</p>
                        <h2 className="font-display text-white text-2xl sm:text-3xl font-light leading-snug">
                          How does your soul feel today?
                        </h2>
                      </div>

                      <GlassTextarea
                        value={mentalState}
                        onChange={setMentalState}
                        placeholder="Describe your emotional state, thoughts, or concerns…"
                        rows={5}
                      />

                      {/* Real-time reflection */}
                      <AnimatePresence>
                        {(reflectionLoading || reflection) && (
                          <ReflectionCard
                            text={reflection}
                            loading={reflectionLoading}
                          />
                        )}
                      </AnimatePresence>

                      {/* Sliders */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <div className="flex justify-between mb-1">
                            <label className="text-white/75 text-sm">Stress level</label>
                            <span className="text-white text-sm font-semibold">{stressLevel}/10</span>
                          </div>
                          <GradientSlider min={1} max={10} value={stressLevel} onChange={setStressLevel}/>
                          <div className="flex justify-between text-[10px] text-white/35 mt-1">
                            <span>Low</span><span>High</span>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <label className="text-white/75 text-sm">Sleep</label>
                            <span className="text-white text-sm font-semibold">{sleepHours} hrs</span>
                          </div>
                          <GradientSlider min={0} max={12} value={sleepHours} onChange={setSleepHours}/>
                          <div className="flex justify-between text-[10px] text-white/35 mt-1">
                            <span>0 hrs</span><span>12 hrs</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => goTo(1)}
                        disabled={mentalState.trim().length < 5}
                        className="btn-soul self-end flex items-center gap-2
                                   disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Continue <ArrowRight size={15}/>
                      </button>
                    </motion.div>
                  )}

                  {/* ── Step 2: Life changes + support system ── */}
                  {step === 1 && (
                    <motion.div key="s1" custom={dir} variants={slide}
                      initial="enter" animate="center" exit="exit" transition={slideTrans}
                      className="flex flex-col gap-5"
                    >
                      <div>
                        <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Step 2 of 3</p>
                        <h2 className="font-display text-white text-2xl sm:text-3xl font-light leading-snug">
                          What&apos;s been shifting in your world?
                        </h2>
                      </div>

                      <div>
                        <label className="text-white/75 text-sm block mb-1.5">
                          Any significant life changes recently?
                        </label>
                        <GlassTextarea
                          value={recentChanges}
                          onChange={setRecentChanges}
                          placeholder="Job changes, relationships, losses, moving home…"
                          rows={3}
                        />
                      </div>

                      <div>
                        <label className="text-white/75 text-sm block mb-1">
                          Who&apos;s in your corner right now?
                        </label>
                        <GlassPillSelect
                          options={SUPPORT_OPTIONS}
                          selected={supportSystem}
                          onChange={setSupportSystem}
                        />
                      </div>

                      <div className="flex justify-between mt-2">
                        <button onClick={() => goTo(0)}
                          className="text-white/50 text-sm hover:text-white transition-colors">
                          ← Back
                        </button>
                        <button onClick={() => goTo(2)}
                          className="btn-soul flex items-center gap-2">
                          Continue <ArrowRight size={15}/>
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Step 3: Symptoms + submit ── */}
                  {step === 2 && (
                    <motion.div key="s2" custom={dir} variants={slide}
                      initial="enter" animate="center" exit="exit" transition={slideTrans}
                      className="flex flex-col gap-5"
                    >
                      <div>
                        <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Step 3 of 3</p>
                        <h2 className="font-display text-white text-2xl sm:text-3xl font-light leading-snug">
                          What are you noticing in your body &amp; mind?
                        </h2>
                      </div>

                      <div>
                        <label className="text-white/75 text-sm block mb-1">
                          Select any that resonate
                        </label>
                        <GlassPillSelect
                          options={SYMPTOM_OPTIONS}
                          selected={symptoms}
                          onChange={setSymptoms}
                        />
                      </div>

                      {error && (
                        <div className="rounded-xl px-4 py-3 text-sm"
                             style={{
                               background: "rgba(220,60,60,0.18)",
                               border: "1px solid rgba(255,120,120,0.30)",
                               color: "rgba(255,180,180,0.90)",
                             }}>
                          {error}
                        </div>
                      )}

                      <div className="flex justify-between mt-2">
                        <button onClick={() => goTo(1)}
                          className="text-white/50 text-sm hover:text-white transition-colors">
                          ← Back
                        </button>
                        <button
                          onClick={handleSubmit}
                          disabled={loading}
                          className="btn-soul flex items-center gap-2
                                     disabled:opacity-60 disabled:cursor-not-allowed
                                     hover:-translate-y-0.5 transition-transform"
                        >
                          {loading
                            ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10"
                                        stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                              </svg> Analysing…</>
                            : <>Get My Support Plan <Sparkles size={14}/></>
                          }
                        </button>
                      </div>
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>

              {/* Loading steps below the card */}
              <AnimatePresence>
                {loading && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}>
                    <LoadingSteps />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              Tab 2 — Support Plan
          ════════════════════════════════════════════════════════════════ */}
          {activeTab === "Support Plan" && (
            <div className="w-full max-w-xl">
              {!plan ? (
                <div className="glass px-8 py-12 text-center">
                  <p className="text-4xl mb-3">🌿</p>
                  <p className="text-white/60 text-sm">
                    Complete the <button onClick={() => setActiveTab("Daily Check-in")}
                      className="underline text-white/80 hover:text-white">Daily Check-in</button> to receive your plan.
                  </p>
                </div>
              ) : plan.risk_level === "crisis" ? (
                <div className="glass px-7 py-7" style={{ border: "1px solid rgba(255,100,100,0.40)" }}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-2xl">🚨</span>
                    <span className="font-bold text-red-300 text-lg">Immediate Support Needed</span>
                  </div>
                  <div className="prose prose-invert prose-sm text-white/85 max-w-none">
                    <ReactMarkdown>{plan.synthesis}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-5">
                    <h2 className="font-display text-white text-3xl font-light">Your Support Plan</h2>
                    <RiskBadge level={plan.risk_level} />
                  </div>

                  <PlanCard emoji="🧠" title="Situation Assessment"       content={plan.assessment} />
                  <PlanCard emoji="🎯" title="Action Plan & Resources"    content={plan.action_plan} />
                  <PlanCard emoji="🔄" title="Long-term Support Strategy" content={plan.followup} />

                  {Object.keys(plan.wellness_score).length > 0 && (
                    <div className="glass px-6 py-5 mb-4">
                      <p className="text-white/70 text-xs uppercase tracking-widest mb-4">📊 Wellness Score</p>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        {([
                          ["Overall", (plan.wellness_score as Record<string,unknown>).wellness_score],
                          ["Risk",    (plan.wellness_score as Record<string,unknown>).risk_level],
                          ["Sleep",   ((plan.wellness_score as Record<string,unknown>).breakdown as Record<string,unknown>)?.sleep_score],
                        ] as [string, unknown][]).map(([label, val]) => (
                          <div key={label} className="rounded-xl py-3 px-2"
                               style={{ background: "rgba(255,255,255,0.08)" }}>
                            <div className="text-xl font-bold text-white">{String(val ?? "—")}</div>
                            <div className="text-[11px] text-white/50 mt-0.5">{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => { resetForm(); setActiveTab("Daily Check-in"); }}
                    className="text-sm text-white/45 hover:text-white/80 underline underline-offset-2 transition-colors"
                  >
                    Start a new check-in
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              Tab 3 — History
          ════════════════════════════════════════════════════════════════ */}
          {activeTab === "History" && (
            <div className="w-full max-w-xl">
              <h2 className="font-display text-white text-3xl font-light mb-6">Session History</h2>

              {history.length === 0 ? (
                <div className="glass px-8 py-12 text-center">
                  <p className="text-4xl mb-3">🕑</p>
                  <p className="text-white/55 text-sm">No check-ins recorded yet.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {history.map((entry, i) => (
                    <div key={i} className="glass px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white/90 text-sm font-medium">{entry.timestamp}</p>
                        <p className="text-white/35 text-[11px] font-mono mt-0.5 truncate">{entry.thread_id}</p>
                        <p className="text-white/55 text-xs mt-1">Symptoms: {entry.symptoms}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-white/60 text-sm">
                          Stress <strong className="text-white">{entry.stress}/10</strong>
                        </span>
                        <RiskBadge level={entry.risk_level} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {history.length > 0 && (
                <button
                  onClick={() => { setHistory([]); setPlan(null); setActiveTab("Daily Check-in"); }}
                  className="mt-5 text-sm text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors"
                >
                  Clear history & start fresh
                </button>
              )}
            </div>
          )}

        </div>{/* end body */}

        {/* ── Crisis notice — pinned above footer ── */}
        <div className="relative z-10 text-center px-5 pb-3 pt-1">
          <p className="text-white/40 text-[11px]">
            ⚠️ Crisis support: Call <strong className="text-white/60">988</strong>,
            text <strong className="text-white/60">HOME</strong> to{" "}
            <strong className="text-white/60">741741</strong>, or call{" "}
            <strong className="text-white/60">911</strong> ·
            Not a substitute for professional mental health care
          </p>
        </div>

      </div>{/* end outer frame */}
    </div>
  );
}
