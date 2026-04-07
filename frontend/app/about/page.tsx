"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, FlaskConical, Heart, ArrowLeft } from "lucide-react";

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

/* ── Background (consistent with all sanctuary pages) ───────────────────── */
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
      {/* grain */}
      <svg aria-hidden="true" style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        zIndex: 1, pointerEvents: "none", opacity: 0.055,
      }}>
        <filter id="grain-about">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
        </filter>
        <rect width="100%" height="100%" filter="url(#grain-about)"/>
      </svg>
      {/* dark vignette */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, zIndex: 2,
        background: "rgba(30,20,50,0.30)", pointerEvents: "none",
      }}/>
      {/* warm top-right haze */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, zIndex: 2,
        background: "radial-gradient(ellipse 55% 40% at 82% 15%, rgba(240,210,175,0.20) 0%, transparent 55%)",
        pointerEvents: "none",
      }}/>
    </>
  );
}

/* ── Card animation variants ────────────────────────────────────────────── */
const cardVariants = {
  hidden:  { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
};

/* ── Section card ───────────────────────────────────────────────────────── */
function SectionCard({
  index, icon: Icon, iconColor, eyebrow, title, children,
}: {
  index:     number;
  icon:      React.ElementType;
  iconColor: string;
  eyebrow:   string;
  title:     string;
  children:  React.ReactNode;
}) {
  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      className="glass px-8 sm:px-10 py-9 sm:py-10 w-full"
    >
      {/* icon badge */}
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center mb-5"
        style={{
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.20)",
        }}
      >
        <Icon size={20} color={iconColor}/>
      </div>

      <p className="text-white/50 text-xs uppercase tracking-widest mb-1.5">{eyebrow}</p>
      <h2 className="font-display text-white text-2xl sm:text-3xl font-light leading-snug mb-4">
        {title}
      </h2>
      <div className="text-white/75 text-sm sm:text-base leading-relaxed space-y-3">
        {children}
      </div>
    </motion.div>
  );
}

/* ── Stat pill ──────────────────────────────────────────────────────────── */
function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div
      className="flex flex-col items-center px-6 py-4 rounded-2xl"
      style={{
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.15)",
      }}
    >
      <span className="font-display text-white text-2xl sm:text-3xl font-light">{value}</span>
      <span className="text-white/50 text-xs mt-1 text-center">{label}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════════════════ */
export default function AboutPage() {
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

        {/* ── Content ── */}
        <div className="relative z-10 flex-1 px-5 sm:px-8 pt-4 pb-32 overflow-y-auto">
          <div className="max-w-2xl mx-auto flex flex-col gap-6">

            {/* ── Hero heading ── */}
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="text-center py-4"
            >
              <p className="text-white/50 text-xs uppercase tracking-widest mb-3">Our Story</p>
              <h1 className="font-display text-white text-4xl sm:text-5xl font-light leading-tight">
                A Sanctuary Built<br/>
                <em className="not-italic">With Intention</em>
              </h1>
              <p className="text-white/60 text-sm sm:text-base mt-4 max-w-md mx-auto leading-relaxed">
                Soulora was born from a simple belief: that intelligent technology,
                guided by compassion, can make genuine wellbeing accessible to everyone.
              </p>
            </motion.div>

            {/* ── Stats row ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.55, ease: "easeOut" }}
              className="grid grid-cols-3 gap-3"
            >
              <StatPill value="12.5K+" label="Souls supported"/>
              <StatPill value="98%"    label="Report feeling heard"/>
              <StatPill value="24 / 7" label="Always present"/>
            </motion.div>

            {/* ── Card 1 — Philosophy ── */}
            <SectionCard
              index={0}
              icon={Sparkles}
              iconColor="rgba(200,170,255,0.90)"
              eyebrow="Our Philosophy"
              title="AI as a Bridge, Not a Barrier"
            >
              <p>
                We believe the future of mental wellness isn&apos;t a chatbot that dispenses
                advice — it&apos;s an intelligent companion that truly listens, remembers your
                journey, and adapts to where you are right now.
              </p>
              <p>
                Soulora sits at the intersection of agentic AI and human wisdom. Our
                LangGraph-powered pipeline doesn&apos;t just process your words; it reasons
                across them — identifying patterns, tracking risk, and weaving a support
                plan as unique as you are.
              </p>
              <p>
                Technology is the vessel. You are the sanctuary.
              </p>
            </SectionCard>

            {/* ── Card 2 — Science ── */}
            <SectionCard
              index={1}
              icon={FlaskConical}
              iconColor="rgba(160,220,200,0.90)"
              eyebrow="Evidence-Based Serenity"
              title="The Science Behind the Stillness"
            >
              <p>
                Every ritual, every reflection, and every support plan is grounded in
                evidence-based frameworks — cognitive behavioural principles, positive
                psychology, and trauma-informed care.
              </p>
              <p>
                Our AI personalises along three axes:{" "}
                <strong className="text-white/90">emotional state</strong> (what you&apos;re
                feeling right now),{" "}
                <strong className="text-white/90">physiological signals</strong> (sleep,
                stress, energy), and{" "}
                <strong className="text-white/90">environmental context</strong> (where you
                are, how much time you have).
              </p>
              <p>
                The result is care that meets you exactly where you are — not where a
                generic algorithm assumes you should be.
              </p>
            </SectionCard>

            {/* ── Card 3 — Mission ── */}
            <SectionCard
              index={2}
              icon={Heart}
              iconColor="rgba(255,180,180,0.90)"
              eyebrow="The Mission"
              title="Proactive, Not Just Reactive"
            >
              <p>
                The mental health system was built for crisis. We built Soulora for the
                quiet moments before crisis — the Sunday evening dread, the creeping
                disconnection, the burnout that arrives before anyone notices.
              </p>
              <p>
                Our goal is to shift the paradigm: from seeking help when things break
                down, to cultivating resilience as a daily practice. Through micro-rituals,
                personalised retreat matching, and continuous check-ins, Soulora becomes
                a companion for the whole human arc — not just its hardest chapters.
              </p>
              <p className="text-white/60 text-xs italic">
                Soulora is a supportive tool and does not replace professional mental
                health care. In a crisis, please contact 988 or your local emergency services.
              </p>
            </SectionCard>

          </div>
        </div>

        {/* ── Floating "Return to Sanctuary" button ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
        >
          <Link
            href="/"
            className="flex items-center gap-2.5 px-6 py-3 rounded-2xl text-white/90
                       text-sm font-medium transition-all hover:-translate-y-0.5 hover:text-white"
            style={{
              background: "rgba(60,38,100,0.72)",
              border: "1px solid rgba(180,140,255,0.35)",
              backdropFilter: "blur(18px)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
            }}
          >
            <ArrowLeft size={15}/>
            Return to Sanctuary
          </Link>
        </motion.div>

      </div>

      <p className="relative z-10 text-center text-white/32 text-[10px] py-2 px-4">
        🔒 Secure Session · Not a substitute for professional mental health care
      </p>
    </div>
  );
}
