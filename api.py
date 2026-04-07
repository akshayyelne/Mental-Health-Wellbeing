"""
api.py — FastAPI backend for the Mental Wellbeing Agent.

Endpoints:
  GET  /health        — liveness probe
  POST /chat          — run the LangGraph pipeline, return support plan
  GET  /session/{tid} — reload a prior session's checkpoint from Supabase

Run locally:
    uvicorn api:app --reload --port 8000

In Docker:
    CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
"""

from __future__ import annotations

import asyncio
import json
import os
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from pydantic import BaseModel, Field

from agent_core import (
    WellbeingState,
    build_graph,
    get_checkpointer,
)

app = FastAPI(
    title="Mental Wellbeing Agent API",
    description="LangGraph-powered mental health support pipeline",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",     # local dev
        "http://frontend:3000",      # Docker compose
    ],
    # Covers all Vercel preview + production URLs for this project
    allow_origin_regex=r"https://mental-health-wellbeing.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  Request / Response schemas                                              ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

class CheckinRequest(BaseModel):
    mental_state:   str       = Field("", description="Free-text emotional state")
    sleep_hours:    int       = Field(7,  ge=0, le=24)
    stress_level:   int       = Field(5,  ge=1, le=10)
    support_system: list[str] = Field(default_factory=list)
    recent_changes: str       = Field("")
    symptoms:       list[str] = Field(default_factory=list)
    thread_id:      str | None = Field(None, description="Omit to start a new session")


class SupportPlanResponse(BaseModel):
    thread_id:         str
    risk_level:        str
    assessment:        str
    action_plan:       str
    followup:          str
    synthesis:         str
    wellness_score:    dict
    coping_techniques: list[str]
    crisis_resources:  dict


class SessionResponse(BaseModel):
    thread_id:  str
    found:      bool
    risk_level: str       = ""
    assessment: str       = ""
    action_plan: str      = ""
    followup:   str       = ""
    synthesis:  str       = ""


class RitualRequest(BaseModel):
    energy_level:    int = Field(..., ge=1, le=10, description="Current energy level 1–10")
    environment:     str = Field(..., description="e.g. 'home office', 'outdoors', 'bedroom'")
    time_available:  int = Field(..., ge=1, description="Minutes available for the ritual")


class RitualStep(BaseModel):
    opening:     str
    practice:    str
    integration: str


class RitualResponse(BaseModel):
    title: str
    steps: RitualStep


# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  Endpoints                                                               ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

@app.get("/health", tags=["ops"])
def health() -> dict:
    return {"status": "ok"}


@app.post("/chat", response_model=SupportPlanResponse, tags=["agent"])
def chat(req: CheckinRequest) -> SupportPlanResponse:
    """Run the full LangGraph pipeline and return the support plan."""
    thread_id   = req.thread_id or str(uuid.uuid4())
    checkpointer = get_checkpointer()
    graph        = build_graph(checkpointer=checkpointer)

    initial = WellbeingState(
        mental_state=req.mental_state,
        sleep_hours=req.sleep_hours,
        stress_level=req.stress_level,
        support_system=req.support_system,
        recent_changes=req.recent_changes,
        symptoms=req.symptoms,
    )

    config = {"configurable": {"thread_id": thread_id}}
    try:
        result = graph.invoke(initial.model_dump(), config=config)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return SupportPlanResponse(
        thread_id=thread_id,
        risk_level=result.get("risk_level", ""),
        assessment=result.get("assessment", ""),
        action_plan=result.get("action_plan", ""),
        followup=result.get("followup", ""),
        synthesis=result.get("synthesis", ""),
        wellness_score=result.get("wellness_score", {}),
        coping_techniques=result.get("coping_techniques", []),
        crisis_resources=result.get("crisis_resources", {}),
    )


_RITUAL_SYSTEM = """\
You are the Wellness Alchemist for Soulora — a serene, encouraging guide who crafts \
bespoke micro-rituals. Your tone is warm, poetic yet practical, and grounded in \
evidence-based wellbeing.

Given the user's context, return ONLY a valid JSON object (no markdown, no extra text) \
with this exact shape:
{
  "title": "<evocative ritual name, 4–7 words>",
  "steps": {
    "opening":     "<1–2 gentle sentences to begin and arrive>",
    "practice":    "<2–3 sentences describing the core mindful activity>",
    "integration": "<1–2 sentences to seal the practice and carry it forward>"
  }
}
Keep each step concise enough to fit the time available. Avoid clinical language.\
"""

_RITUAL_TIMEOUT = int(os.getenv("RITUAL_TIMEOUT_SECONDS", "25"))


@app.post("/api/wellness/generate", response_model=RitualResponse, tags=["wellness"])
async def generate_ritual(req: RitualRequest) -> RitualResponse:
    """Generate a bespoke wellness ritual via the Wellness Alchemist LLM."""
    energy_label = (
        "low and depleted" if req.energy_level <= 3 else
        "calm and steady"  if req.energy_level <= 6 else
        "bright and energised"
    )
    user_prompt = (
        f"My energy feels {energy_label} (level {req.energy_level}/10). "
        f"I am in: {req.environment}. "
        f"I have about {req.time_available} minute(s). "
        "Please craft a ritual just for this moment."
    )

    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0.7,
        groq_api_key=os.getenv("GROQ_API_KEY", ""),
    )

    try:
        response = await asyncio.wait_for(
            llm.ainvoke([
                SystemMessage(content=_RITUAL_SYSTEM),
                HumanMessage(content=user_prompt),
            ]),
            timeout=_RITUAL_TIMEOUT,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="The Wellness Alchemist is taking a mindful pause — please try again shortly.",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    try:
        data = json.loads(response.content)
        return RitualResponse(
            title=data["title"],
            steps=RitualStep(**data["steps"]),
        )
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Unexpected response shape from LLM: {exc}",
        )


@app.get("/session/{thread_id}", response_model=SessionResponse, tags=["agent"])
def reload_session(thread_id: str) -> SessionResponse:
    """Reload a prior session's state from Supabase by thread_id."""
    checkpointer = get_checkpointer()
    if not checkpointer:
        return SessionResponse(thread_id=thread_id, found=False)

    config = {"configurable": {"thread_id": thread_id}}
    try:
        checkpoint = checkpointer.get(config)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    if not checkpoint:
        return SessionResponse(thread_id=thread_id, found=False)

    saved = checkpoint.get("channel_values", {})
    return SessionResponse(
        thread_id=thread_id,
        found=True,
        risk_level=saved.get("risk_level", ""),
        assessment=saved.get("assessment", ""),
        action_plan=saved.get("action_plan", ""),
        followup=saved.get("followup", ""),
        synthesis=saved.get("synthesis", ""),
    )


# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  AI Guided Intention                                                     ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

class IntentionRequest(BaseModel):
    stress_level: int | None = Field(None, ge=1, le=10)
    sleep_hours:  int | None = Field(None, ge=0, le=12)
    time_of_day:  str | None = Field(None, description="morning | afternoon | evening | night")


class IntentionResponse(BaseModel):
    insight:    str   # ≤20 words — the personalised nudge
    cta_label:  str   # button text
    cta_href:   str   # /wellness | /checkin | /retreats


_INTENTION_SYSTEM = """\
You are Soulora's gentle morning companion. Given the user's current context \
(time of day, stress level, sleep hours), craft a single short insight — \
15 to 20 words maximum — that names what they might be feeling and offers \
a compassionate micro-nudge toward one of three paths:
  • /wellness  (ritual)
  • /checkin   (reflection)
  • /retreats  (escape)

Return ONLY valid JSON (no markdown) in this exact shape:
{
  "insight":   "<15-20 word personalised nudge>",
  "cta_label": "<2-4 word button label>",
  "cta_href":  "</wellness | /checkin | /retreats>"
}

Tone: warm, non-clinical, like a compassionate friend who knows you well.
Do NOT mention sleep hours or stress numbers directly — translate them into feeling language.\
"""

_INTENTION_TIMEOUT = int(os.getenv("INTENTION_TIMEOUT_SECONDS", "12"))


@app.post("/api/intention", response_model=IntentionResponse, tags=["wellness"])
async def guided_intention(req: IntentionRequest) -> IntentionResponse:
    """Return a proactive, personalised morning insight based on recent context."""
    parts: list[str] = []
    if req.time_of_day:
        parts.append(f"Time of day: {req.time_of_day}.")
    if req.stress_level is not None:
        feel = "very stressed" if req.stress_level >= 8 else "moderately stressed" if req.stress_level >= 5 else "relatively calm"
        parts.append(f"The user is feeling {feel} (stress {req.stress_level}/10).")
    if req.sleep_hours is not None:
        rest = "poorly rested" if req.sleep_hours <= 5 else "reasonably rested" if req.sleep_hours <= 7 else "well rested"
        parts.append(f"They are {rest} ({req.sleep_hours} hrs sleep).")
    if not parts:
        parts.append("No prior context is available — offer a gentle universal nudge.")

    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0.72,
        groq_api_key=os.getenv("GROQ_API_KEY", ""),
    )
    try:
        response = await asyncio.wait_for(
            llm.ainvoke([
                SystemMessage(content=_INTENTION_SYSTEM),
                HumanMessage(content=" ".join(parts)),
            ]),
            timeout=_INTENTION_TIMEOUT,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Intention timed out.")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    raw = response.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1].lstrip("json").strip()

    try:
        data = json.loads(raw)
        return IntentionResponse(
            insight=data["insight"],
            cta_label=data["cta_label"],
            cta_href=data["cta_href"],
        )
    except (json.JSONDecodeError, KeyError) as exc:
        raise HTTPException(status_code=502, detail=f"Unexpected LLM shape: {exc}")


# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  Real-Time Reflection                                                    ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

class ReflectionRequest(BaseModel):
    mental_state: str = Field(..., min_length=8)


class ReflectionResponse(BaseModel):
    reflection: str


_REFLECTION_SYSTEM = """\
You are a compassionate, non-judgmental wellbeing companion for Soulora. \
The user has just shared how they are feeling. In 2–3 warm, gentle sentences, \
reflect back what you heard — name the emotions you detect, validate them, \
and close with a single brief encouragement. \
Do NOT give advice or ask questions. Sound like a caring friend writing in a \
journal entry. Keep the tone serene, never clinical.\
"""

_REFLECT_TIMEOUT = int(os.getenv("REFLECT_TIMEOUT_SECONDS", "12"))


@app.post("/api/reflect", response_model=ReflectionResponse, tags=["wellness"])
async def reflect(req: ReflectionRequest) -> ReflectionResponse:
    """Return a brief compassionate reflection on the user's stated feelings."""
    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0.6,
        groq_api_key=os.getenv("GROQ_API_KEY", ""),
    )
    try:
        response = await asyncio.wait_for(
            llm.ainvoke([
                SystemMessage(content=_REFLECTION_SYSTEM),
                HumanMessage(content=req.mental_state),
            ]),
            timeout=_REFLECT_TIMEOUT,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Reflection timed out.")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return ReflectionResponse(reflection=response.content.strip())


# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  Retreat Matchmaking                                                     ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

# ── Mock retreat catalogue ────────────────────────────────────────────────
_RETREATS: list[dict] = [
    {
        "id": "silent-forest-japan",
        "title": "Silent Forest Immersion · Kyoto, Japan",
        "vibe_tags": ["silence", "spiritual", "nature", "forest bathing", "zen", "introspection"],
        "description": (
            "Seven days of guided shinrin-yoku (forest bathing) in the cedar groves outside Kyoto. "
            "No phones. Tea ceremonies at dawn. Evening zazen with resident monks. "
            "Ideal for those who crave deep stillness and spiritual reset."
        ),
        "price_tier": "luxury",
        "duration_days": 7,
        "highlights": ["Forest bathing", "Zen meditation", "Tea ceremonies", "Digital detox"],
    },
    {
        "id": "coastal-yoga-portugal",
        "title": "Atlantic Sunrise Yoga · Alentejo Coast, Portugal",
        "vibe_tags": ["ocean", "yoga", "sunrise", "breathwork", "community", "warmth", "movement"],
        "description": (
            "Five-day oceanside yoga retreat on Portugal's wild Alentejo cliffs. "
            "Morning vinyasa sessions with Atlantic sunrise views, afternoon surf lessons, "
            "and group sound-healing circles under the stars. "
            "Perfect for those who need ocean air, movement, and warm human connection."
        ),
        "price_tier": "mid-range",
        "duration_days": 5,
        "highlights": ["Oceanside yoga", "Breathwork", "Sound healing", "Surf lessons"],
    },
    {
        "id": "desert-digital-detox",
        "title": "Desert Digital Detox · Wadi Rum, Jordan",
        "vibe_tags": ["silence", "detox", "technology-free", "stars", "solitude", "clarity", "adventure"],
        "description": (
            "Four nights in luxury Bedouin tents beneath the clearest skies on Earth. "
            "Guided sunrise hikes, no Wi-Fi, camel treks at dusk, and evening philosophy circles. "
            "Best for burned-out professionals who crave total disconnection and perspective."
        ),
        "price_tier": "mid-range",
        "duration_days": 4,
        "highlights": ["Stargazing", "Technology-free", "Desert hikes", "Philosophy circles"],
    },
    {
        "id": "ayurveda-kerala",
        "title": "Ayurvedic Renewal · Kerala Backwaters, India",
        "vibe_tags": ["healing", "body", "ayurveda", "warmth", "restoration", "fatigue", "burnout", "balance"],
        "description": (
            "Ten-day traditional Panchakarma programme in a certified Ayurvedic centre on Kerala's backwaters. "
            "Personalised dosha assessment, daily oil treatments, medicinal meals, yoga nidra, and herbal steam. "
            "Ideal for chronic fatigue, burnout, or anyone seeking a full-body reset."
        ),
        "price_tier": "mid-range",
        "duration_days": 10,
        "highlights": ["Panchakarma", "Personalised dosha plan", "Herbal treatments", "Yoga nidra"],
    },
    {
        "id": "nordic-sauna-finland",
        "title": "Nordic Sauna & Silence · Finnish Lakeland",
        "vibe_tags": ["cold", "sauna", "nordic", "quiet", "resilience", "nervous system", "winter", "grounding"],
        "description": (
            "Three nights in a private lakeside cabin in the Finnish wilderness. "
            "Daily smoke-sauna sessions, cold-water plunges, guided breathing (Wim Hof method), "
            "and optional solo forest walks. No schedule. No agenda. "
            "Designed for nervous-system reset and radical simplicity."
        ),
        "price_tier": "budget-friendly",
        "duration_days": 3,
        "highlights": ["Smoke sauna", "Ice plunge", "Wim Hof breathing", "Solo wilderness time"],
    },
]

# Serialise catalogue once so the LLM prompt is stable
_CATALOGUE_JSON = json.dumps(
    [{"id": r["id"], "title": r["title"], "vibe_tags": r["vibe_tags"],
      "description": r["description"], "price_tier": r["price_tier"]}
     for r in _RETREATS],
    indent=2,
)

_MATCHER_SYSTEM = f"""\
You are Soulora's Retreat Concierge — a warm, perceptive guide who deeply listens to how \
a person feels and matches them to transformative sanctuaries.

Below is the full retreat catalogue in JSON:
{_CATALOGUE_JSON}

Given the user's natural-language input describing their emotional state or needs, \
you must select the TOP 2 best-matching retreats and return ONLY a valid JSON array \
(no markdown, no extra text) with exactly this shape:
[
  {{
    "id": "<retreat id>",
    "ai_insight": "<2–3 warm, specific sentences explaining why this retreat resonates with what the user shared>"
  }},
  {{
    "id": "<retreat id>",
    "ai_insight": "<2–3 warm, specific sentences>"
  }}
]
Reference the user's exact words in at least one insight. Avoid clinical language. \
Speak as a compassionate friend who truly listened.\
"""

_MATCH_TIMEOUT = int(os.getenv("RETREAT_MATCH_TIMEOUT_SECONDS", "25"))


# ── Schemas ───────────────────────────────────────────────────────────────
class RetreatMatchRequest(BaseModel):
    query: str = Field(..., min_length=3, description="User's natural-language emotional input")


class RetreatDetail(BaseModel):
    id:            str
    title:         str
    description:   str
    vibe_tags:     list[str]
    price_tier:    str
    duration_days: int
    highlights:    list[str]
    ai_insight:    str


class RetreatMatchResponse(BaseModel):
    matches: list[RetreatDetail]


# ── Endpoint ──────────────────────────────────────────────────────────────
_RETREAT_INDEX = {r["id"]: r for r in _RETREATS}


@app.post("/api/retreats/match", response_model=RetreatMatchResponse, tags=["retreats"])
async def match_retreats(req: RetreatMatchRequest) -> RetreatMatchResponse:
    """Rank retreats by emotional fit using the LLM and return the top 2."""
    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0.55,
        groq_api_key=os.getenv("GROQ_API_KEY", ""),
    )

    try:
        response = await asyncio.wait_for(
            llm.ainvoke([
                SystemMessage(content=_MATCHER_SYSTEM),
                HumanMessage(content=req.query),
            ]),
            timeout=_MATCH_TIMEOUT,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="The Retreat Concierge is taking a mindful pause — please try again shortly.",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    # Strip accidental markdown fences the LLM might add
    raw = response.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        picks: list[dict] = json.loads(raw)
        if not isinstance(picks, list) or len(picks) < 1:
            raise ValueError("Expected a non-empty JSON array")
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"Unexpected LLM response shape: {exc}")

    matches: list[RetreatDetail] = []
    for pick in picks[:2]:
        retreat = _RETREAT_INDEX.get(pick.get("id", ""))
        if not retreat:
            continue
        matches.append(RetreatDetail(
            **{k: retreat[k] for k in ("id", "title", "description", "vibe_tags",
                                        "price_tier", "duration_days", "highlights")},
            ai_insight=pick.get("ai_insight", ""),
        ))

    if not matches:
        raise HTTPException(status_code=502, detail="LLM returned no valid retreat IDs.")

    return RetreatMatchResponse(matches=matches)


# ── Entry point (Render / local) ──────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("api:app", host="0.0.0.0", port=port)
