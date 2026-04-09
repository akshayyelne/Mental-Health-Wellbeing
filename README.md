# Soulora — AI Mental Wellbeing Sanctuary

> A proactive, agentic mental wellness platform built with LangGraph, FastAPI, and Next.js.

> Soulora bridges evidence-based wellbeing practices with agentic AI — providing personalised support plans, micro-rituals, retreat matchmaking, and real-time emotional reflection, all wrapped in a premium glassmorphic UI.
Soulora utilizes a specialized team of multi - AI agents to ensure high-fidelity support.
---
**Product Demo :** 

https://github.com/akshayyelne/Mental-Health-Wellbeing/blob/main/Product%20Demo/SouloraDemo.mp4

## ✨ Features

### 🧘 Daily Check-in & AI Support Plans
A 3-step conversational check-in (emotional state → life changes → symptoms) that feeds a LangGraph multi-agent pipeline. The pipeline produces a personalised risk assessment, action plan, and long-term support strategy. A real-time **Reflection card** surfaces a compassionate summary of the user's emotional state as they type.

### 🌿 Wellness Rituals
The **Wellness Alchemist** generates bespoke 3-step micro-rituals (Opening → Practice → Integration) tailored to the user's energy level, environment, and available time. Powered by `llama-3.3-70b-versatile` via Groq.

### 🏔️ Retreat Matchmaker
A 3-step conversational UI matches users to one of 5 curated global retreats based on natural-language emotional input. The **Virtual Sanctuary Preview** cross-fades the background, shifts card border colours, and synthesises ambient soundscapes (Web Audio API — no CDN required) when a retreat is previewed.

### 🫁 Breath Synchronizer
A 4-7-8 breathing widget (Inhale 4s → Hold 7s → Exhale 8s) with a glowing animated SVG circle. Includes a one-click **nature soundscape** — generated via the Voss-McCartney pink noise algorithm directly in the browser. Fades in over 2 seconds for a premium audio experience.

### 🤖 AI Guided Intention
A proactive morning/afternoon/evening card on the landing page that calls the `/api/intention` endpoint with the user's last check-in context (stress/sleep from `localStorage`) and displays a personalised nudge with a context-aware CTA.

### 📖 About & Testimonials
Glassmorphic static pages with framer-motion stagger animations, outcome-first testimonials, and a philosophy section connecting agentic AI to evidence-based care.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Docker Compose                       │
│                                                         │
│  ┌────────────────┐   ┌────────────────┐   ┌─────────┐ │
│  │  Next.js 15    │   │  FastAPI       │   │   MCP   │ │
│  │  (frontend)    │──▶│  (backend)     │──▶│ Server  │ │
│  │  :3000         │   │  :8000         │   │internal │ │
│  └────────────────┘   └───────┬────────┘   └─────────┘ │
│                               │                         │
│                    ┌──────────▼──────────┐              │
│                    │  LangGraph Pipeline  │              │
│                    │  safety_router       │              │
│                    │  assess_mental_state │              │
│                    │  create_action_plan  │              │
│                    │  design_followup     │              │
│                    │  synthesise_plan     │              │
│                    └──────────┬──────────┘              │
│                               │                         │
│              ┌────────────────▼────────────────┐        │
│              │  Supabase (PostgresSaver)        │        │
│              │  Checkpoint persistence          │        │
│              └─────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

**LLM**: `llama-3.3-70b-versatile` via [Groq](https://groq.com)  
**Checkpoints**: Supabase Postgres via `langgraph-checkpoint-postgres`

---

## 🛠️ Tech Stack

| Layer     | Technology                                      |
|-----------|-------------------------------------------------|
| Frontend  | Next.js 15 (App Router), TypeScript, Tailwind CSS, Framer Motion |
| Backend   | FastAPI, LangGraph, LangChain, Pydantic v2      |
| LLM       | Groq — `llama-3.3-70b-versatile`               |
| Database  | Supabase (Postgres) for session checkpoints     |
| Audio     | Web Audio API — programmatic pink noise synthesis |
| Container | Docker + Docker Compose                         |

---

## 🚀 Getting Started

The entire application runs inside Docker — no local Python or Node.js installation required.

### Prerequisites

- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** — install and start it
- **[Groq API key](https://console.groq.com)** — free tier, takes 30 seconds to create

### Step 1 — Clone the repository

```bash
git clone https://github.com/akshayyelne/Mental-Health-Wellbeing
cd Mental-Health-Wellbeing
```

### Step 2 — Create your environment file

```bash
cp .env.example .env
```

Open `.env` and add your Groq key:

```env
GROQ_API_KEY=your_groq_api_key_here
```

Everything else in `.env.example` is optional and pre-filled with safe defaults.

> **Supabase (optional):** If you have a Supabase project, add `SUPABASE_DB_URI` to enable persistent sessions. Without it, the app runs in stateless mode — all features still work.

### Step 3 — Build and run

```bash
docker compose up --build
```

First build takes ~2 minutes. Subsequent starts are instant.

### Step 4 — Open the app

| Service       | URL                           |
|---------------|-------------------------------|
| 🌿 Soulora UI | **http://localhost:3000**     |
| ⚡ API server | http://localhost:8000         |
| 📖 API docs   | http://localhost:8000/docs    |

### Stopping the app

```bash
docker compose down
```

---

## 🔑 Environment Variables

| Variable                  | Required | Description                                              |
|---------------------------|----------|----------------------------------------------------------|
| `GROQ_API_KEY`            | ✅       | Groq API key for LLM inference                          |
| `SUPABASE_DB_URI`         | ⬜       | Postgres URI for LangGraph checkpoint persistence        |
| `USE_MCP`                 | ⬜       | Enable MCP tool server (`true`/`false`, default `false`) |
| `NEXT_PUBLIC_API_URL`     | ✅       | FastAPI base URL baked into the Next.js bundle (set in `docker-compose.yml`) |
| `RITUAL_TIMEOUT_SECONDS`  | ⬜       | LLM timeout for ritual generation (default `25`)         |
| `REFLECT_TIMEOUT_SECONDS` | ⬜       | LLM timeout for real-time reflection (default `12`)      |
| `INTENTION_TIMEOUT_SECONDS`| ⬜      | LLM timeout for guided intention (default `12`)          |

---

## 🗂️ Project Structure

```
Mental-Health-Wellbeing/
├── agent_core.py              # LangGraph graph, WellbeingState, nodes
├── api.py                     # FastAPI app — all endpoints
├── mcp_wellbeing_server.py    # MCP tool server
├── Dockerfile                 # Backend image
├── Dockerfile.mcp             # MCP server image
├── docker-compose.yml
├── requirements.txt
│
└── frontend/
    ├── app/
    │   ├── page.tsx            # Landing page
    │   ├── checkin/page.tsx    # Daily check-in (3-step wizard)
    │   ├── wellness/page.tsx   # Ritual generator
    │   ├── retreats/page.tsx   # Retreat matchmaker + sanctuary preview
    │   ├── about/page.tsx      # Philosophy & mission
    │   └── testimonials/page.tsx
    ├── lib/
    │   └── api.ts              # All fetch functions + TypeScript types
    └── public/
        └── nature-bg.jpg       # Background image
```

---

## 📡 API Endpoints

| Method | Path                    | Description                                      |
|--------|-------------------------|--------------------------------------------------|
| GET    | `/health`               | Liveness probe                                   |
| POST   | `/chat`                 | Run LangGraph pipeline, return support plan      |
| GET    | `/session/{thread_id}`  | Reload a prior session from Supabase             |
| POST   | `/api/intention`        | Generate personalised morning insight            |
| POST   | `/api/reflect`          | Real-time compassionate reflection on feelings   |
| POST   | `/api/wellness/generate`| Generate a bespoke wellness ritual               |
| POST   | `/api/retreats/match`   | Match user to retreats via LLM ranking           |

Full interactive docs at **http://localhost:8000/docs** (Swagger UI).

---

## 🧪 Running Tests

```bash
# Integration tests (requires running backend)
docker compose run --rm backend pytest test_integration.py -v

# Safety router tests
docker compose run --rm backend pytest test_safety_router.py -v

# State mapping tests
docker compose run --rm backend pytest test_state_mapping.py -v
```

---

## 🖼️ Adding a Background Image

The background image is served via a Docker volume mount — no rebuild required:

```bash
# Copy your image to the public folder
cp your-image.jpg frontend/public/nature-bg.jpg

# Restart the frontend container (no --build needed)
docker compose up -d --force-recreate frontend
```

---

## ⚠️ Crisis Resources

Soulora is a **supportive tool** and does not replace professional mental health care.

If you or someone you know is in crisis:

| Resource | Contact |
|---|---|
| US National Crisis Line | Call or text **988** |
| Crisis Text Line | Text **HOME** to **741741** |
| Emergency Services | **911** |
| International Association for Suicide Prevention | https://www.iasp.info/resources/Crisis_Centres/ |

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with intention · Powered by compassionate AI
</p>
