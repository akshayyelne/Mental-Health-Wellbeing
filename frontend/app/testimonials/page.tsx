"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

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

/* ── Background ─────────────────────────────────────────────────────────── */
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
        <filter id="grain-tm">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
        </filter>
        <rect width="100%" height="100%" filter="url(#grain-tm)"/>
      </svg>
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, zIndex: 2,
        background: "rgba(30,20,50,0.32)", pointerEvents: "none",
      }}/>
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, zIndex: 2,
        background: "radial-gradient(ellipse 55% 40% at 82% 15%, rgba(240,210,175,0.18) 0%, transparent 55%)",
        pointerEvents: "none",
      }}/>
    </>
  );
}

/* ── Sparkle rating ─────────────────────────────────────────────────────── */
function SparkleRating({ count = 5 }: { count?: number }) {
  return (
    <div className="flex items-center gap-1 mb-4">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2l1.8 5.4h5.7l-4.6 3.3 1.7 5.3L12 13l-4.6 3 1.7-5.3-4.6-3.3h5.7z"
            fill="rgba(255,220,120,0.90)"
            stroke="rgba(255,200,80,0.60)"
            strokeWidth="0.5"
          />
        </svg>
      ))}
      <span className="text-white/45 text-[10px] ml-1 uppercase tracking-widest">High Vibration</span>
    </div>
  );
}

/* ── Gradient avatar circle ──────────────────────────────────────────────── */
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #C4A8E8 0%, #7AB8C4 100%)",   // lavender → sage
  "linear-gradient(135deg, #A8D5B5 0%, #8A7AC4 100%)",   // sage → deep purple
  "linear-gradient(135deg, #E8C4A8 0%, #C4A8D8 100%)",   // warm peach → lavender
  "linear-gradient(135deg, #A8B5E8 0%, #B5E8C4 100%)",   // periwinkle → mint
  "linear-gradient(135deg, #D4A8C8 0%, #A8C4D4 100%)",   // rose → sky
  "linear-gradient(135deg, #C8D4A8 0%, #D4A8C8 100%)",   // chartreuse → rose
];

function Avatar({ index, initials }: { index: number; initials: string }) {
  return (
    <div
      className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white/80
                 text-sm font-semibold select-none"
      style={{
        background: AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length],
        filter: "blur(0.6px) brightness(1.05)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
      }}
    >
      {initials}
    </div>
  );
}

/* ── Testimonial data ────────────────────────────────────────────────────── */
interface Testimonial {
  initials: string;
  name:     string;
  role:     string;
  quote:    string;
  outcome:  string;   // the concrete change they experienced
  feature:  string;   // which Soulora feature they used
}

const TESTIMONIALS: Testimonial[] = [
  {
    initials: "SK",
    name:     "Sophia K.",
    role:     "Senior Product Manager · London",
    quote:
      "I was so burned out I couldn't name what I was feeling. Soulora's reflection card read back my own words and said, 'You seem to be carrying a quiet exhaustion that's been here longer than you've admitted.' I cried. I finally felt heard — by an app.",
    outcome:  "Reduced anxiety episodes from daily to once a week within a month.",
    feature:  "Real-Time Reflection · Daily Check-in",
  },
  {
    initials: "JM",
    name:     "James M.",
    role:     "Freelance Architect · Berlin",
    quote:
      "I didn't think I needed a retreat — I thought I just needed a holiday. The Retreat Matchmaker picked up on the word 'hollow' I used when describing my week and matched me with a silent forest immersion in Japan. Six days later I came home a different person.",
    outcome:  "First full week without insomnia in over two years.",
    feature:  "Retreat Matchmaker",
  },
  {
    initials: "AL",
    name:     "Amara L.",
    role:     "Secondary School Teacher · Toronto",
    quote:
      "My morning routine was doom-scrolling. Now it's a 7-minute Soulora ritual. The app doesn't just tell me to breathe — it tells me *why* today's ritual suits how I said I felt, and something about that specificity makes it land differently.",
    outcome:  "Started the school year without the usual September burnout for the first time.",
    feature:  "Wellness Rituals · Daily Check-in",
  },
  {
    initials: "RP",
    name:     "Rafael P.",
    role:     "Intensive Care Nurse · São Paulo",
    quote:
      "I work in an ICU. I've seen what stress does to a body. I used to dismiss apps like this. Then the support plan told me my stress score and sleep pattern were 'consistent with compassion fatigue' and gave me a phased action plan. Evidence-based, calm, and kind. That's rare.",
    outcome:  "Used the action plan to negotiate a schedule change with his manager.",
    feature:  "AI Support Plan",
  },
  {
    initials: "ZN",
    name:     "Zara N.",
    role:     "Postgraduate Student · Edinburgh",
    quote:
      "I was mid-panic-attack when I opened the app. The check-in asked one question: 'How does your soul feel today?' I typed two words — 'completely lost' — and what came back wasn't a helpline number. It was the most gentle, accurate summary of my inner world I've ever read.",
    outcome:  "Started therapy two weeks later. Says Soulora gave her the language to start.",
    feature:  "Daily Check-in · Real-Time Reflection",
  },
  {
    initials: "MO",
    name:     "Marcus O.",
    role:     "Entrepreneur · Lagos",
    quote:
      "I travel constantly. Every hotel room looks the same and feels like nowhere. Soulora generates rituals based on where I am — a 5-minute desert detox for a layover, a grounding practice for a hotel gym. It's become the one consistent thing in a life without consistency.",
    outcome:  "Built a travel wellness routine that he now shares with his team.",
    feature:  "Wellness Rituals · Retreat Matchmaker",
  },
];

/* ── Single testimonial card ─────────────────────────────────────────────── */
function TestimonialCard({ t, index }: { t: Testimonial; index: number }) {
  return (
    <motion.div
      custom={index}
      initial={{ opacity: 0, y: 36, scale: 0.97 }}
      whileInView={{
        opacity: 1, y: 0, scale: 1,
        transition: {
          delay: (index % 2) * 0.15,         // stagger within each column
          duration: 0.65,
          type: "spring",
          stiffness: 90,
          damping: 18,
        },
      }}
      viewport={{ once: true, margin: "-40px" }}
      className="glass px-7 py-7 flex flex-col gap-4 break-inside-avoid"
    >
      <SparkleRating />

      {/* quote */}
      <blockquote className="text-white/88 text-sm sm:text-[15px] leading-relaxed">
        &ldquo;{t.quote}&rdquo;
      </blockquote>

      {/* outcome pill */}
      <div
        className="rounded-xl px-4 py-2.5"
        style={{
          background: "rgba(138,92,201,0.16)",
          border: "1px solid rgba(180,140,255,0.22)",
        }}
      >
        <p className="text-white/55 text-[10px] uppercase tracking-widest mb-0.5">Outcome</p>
        <p className="text-white/85 text-xs leading-relaxed">{t.outcome}</p>
      </div>

      {/* author row */}
      <div className="flex items-center gap-3 pt-1">
        <Avatar index={index} initials={t.initials} />
        <div>
          <p className="text-white/90 text-sm font-medium">{t.name}</p>
          <p className="text-white/45 text-xs">{t.role}</p>
        </div>
      </div>

      {/* feature tag */}
      <p
        className="text-[10px] text-white/40 pt-0.5 border-t"
        style={{ borderColor: "rgba(255,255,255,0.10)" }}
      >
        Used: {t.feature}
      </p>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════════════════ */
export default function TestimonialsPage() {
  const col1 = TESTIMONIALS.filter((_, i) => i % 2 === 0);
  const col2 = TESTIMONIALS.filter((_, i) => i % 2 !== 0);

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
        <div className="relative z-10 flex-1 px-5 sm:px-8 pt-2 pb-32 overflow-y-auto">

          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="text-center max-w-xl mx-auto py-6 mb-6"
          >
            <p className="text-white/50 text-xs uppercase tracking-widest mb-3">Souls of Soulora</p>
            <h1 className="font-display text-white text-4xl sm:text-5xl font-light leading-tight">
              What Changed<br/>
              <em className="not-italic">When They Were Heard</em>
            </h1>
            <p className="text-white/58 text-sm mt-4 leading-relaxed">
              These aren&apos;t reviews of features. They&apos;re accounts of moments where
              something shifted — quietly, and for good.
            </p>
          </motion.div>

          {/* Masonry grid — 2 cols on md+, single col on mobile */}
          <div className="max-w-4xl mx-auto">
            {/* Mobile: single column */}
            <div className="flex flex-col gap-5 md:hidden">
              {TESTIMONIALS.map((t, i) => (
                <TestimonialCard key={t.name} t={t} index={i} />
              ))}
            </div>

            {/* Desktop: staggered 2-column masonry */}
            <div className="hidden md:grid grid-cols-2 gap-5 items-start">
              {/* Column 1 — offset slightly lower for stagger feel */}
              <div className="flex flex-col gap-5 mt-0">
                {col1.map((t, i) => (
                  <TestimonialCard key={t.name} t={t} index={i * 2} />
                ))}
              </div>
              {/* Column 2 — pushed down to create visual stagger */}
              <div className="flex flex-col gap-5 mt-10">
                {col2.map((t, i) => (
                  <TestimonialCard key={t.name} t={t} index={i * 2 + 1} />
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Floating CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-3"
        >
          <Link
            href="/checkin"
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white text-sm
                       font-medium transition-all hover:-translate-y-0.5"
            style={{
              background: "rgba(138,92,201,0.72)",
              border: "1px solid rgba(180,140,255,0.40)",
              backdropFilter: "blur(18px)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
            }}
          >
            Begin Your Journey
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 px-5 py-3 rounded-2xl text-white/80 text-sm
                       font-medium transition-all hover:-translate-y-0.5 hover:text-white"
            style={{
              background: "rgba(60,38,100,0.65)",
              border: "1px solid rgba(255,255,255,0.18)",
              backdropFilter: "blur(18px)",
            }}
          >
            <ArrowLeft size={14}/>
            Sanctuary
          </Link>
        </motion.div>

      </div>

      <p className="relative z-10 text-center text-white/32 text-[10px] py-2 px-4">
        🔒 Secure Session · Not a substitute for professional mental health care
      </p>
    </div>
  );
}
