"""
agent_core.py — Pure LangGraph business logic (no Streamlit, no FastAPI).

Imported by:
  • api.py            — FastAPI endpoint handlers
  • test_integration.py — pytest integration suite
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from langgraph.graph import END, START, StateGraph
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg_pool import ConnectionPool
from pydantic import BaseModel, Field

load_dotenv()

USE_MCP        = os.getenv("USE_MCP", "false").lower() == "true"
SUPABASE_DB_URI = os.getenv("SUPABASE_DB_URI", "")

mcp_tools: list = []  # populated at runtime if USE_MCP=true


# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  1.  STATE                                                               ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

class WellbeingState(BaseModel):
    """Shared state passed through every LangGraph node."""

    # ── User intake ──
    mental_state:   str       = ""
    sleep_hours:    int       = 7
    stress_level:   int       = 5
    support_system: list[str] = Field(default_factory=list)
    recent_changes: str       = ""
    symptoms:       list[str] = Field(default_factory=list)

    # ── Agent outputs ──
    assessment:  str = ""
    action_plan: str = ""
    followup:    str = ""
    synthesis:   str = ""

    # ── Router flag ──
    risk_level: str = "unknown"  # low | moderate | elevated | crisis

    # ── MCP tool results (optional) ──
    wellness_score:    dict      = Field(default_factory=dict)
    coping_techniques: list[str] = Field(default_factory=list)
    crisis_resources:  dict      = Field(default_factory=dict)


# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  2.  SYSTEM PROMPTS                                                      ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

ASSESSMENT_PROMPT = """You are an experienced mental health professional speaking directly to the user.

Your tasks:
1. Acknowledge their courage in seeking support
2. Analyse their emotional state with clinical precision and genuine empathy
3. Identify patterns in thoughts, behaviours, and relationships
4. Assess risk levels using validated screening approaches
5. Help them understand their current mental health in accessible language
6. Validate their experiences without minimising or catastrophising

Always address the user as "you". Blend clinical expertise with warmth.
Do NOT include action plans or follow-up strategies — those are handled by other agents.

Respond in Markdown. Start with: ## Situation Assessment"""

ACTION_PROMPT = """You are a crisis intervention and resource specialist speaking directly to the user.

Your tasks:
1. Provide immediate evidence-based coping strategies tailored to their situation
2. Prioritise interventions based on urgency and effectiveness
3. Connect them with mental health services (acknowledge barriers: cost, access, stigma)
4. Create a concrete daily wellness plan with specific times and activities
5. Suggest support communities with details on how to join
6. Teach simple self-regulation techniques they can use right now

Focus on practical, achievable steps that respect their current energy level.
Do NOT repeat the assessment or include long-term strategy.

Respond in Markdown. Start with: ## Action Plan & Resources"""

FOLLOWUP_PROMPT = """You are a mental health recovery planner speaking directly to the user.

Your tasks:
1. Design a personalised long-term support strategy with milestone markers
2. Create a progress monitoring system matching their preferences
3. Develop relapse prevention strategies based on their triggers
4. Map their existing support network
5. Build a graduated self-care routine that evolves with recovery
6. Plan for setbacks with self-compassion techniques
7. Set up a maintenance schedule with check-in mechanisms

Emphasise progress over perfection. Integrate with their lifestyle and values.
Do NOT repeat the assessment or action plan.

Respond in Markdown. Start with: ## Long-term Support Strategy"""


# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  3.  NODE FUNCTIONS                                                      ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

def _build_intake_summary(state: WellbeingState) -> str:
    support  = ", ".join(state.support_system) if state.support_system else "None reported"
    symptoms = ", ".join(state.symptoms)       if state.symptoms       else "None reported"
    parts = [
        f"Emotional State: {state.mental_state}",
        f"Sleep: {state.sleep_hours} hours per night",
        f"Stress Level: {state.stress_level}/10",
        f"Support System: {support}",
        f"Recent Changes: {state.recent_changes}",
        f"Current Symptoms: {symptoms}",
    ]
    if state.wellness_score:
        parts.append(f"Wellness Score: {state.wellness_score}")
    if state.coping_techniques:
        parts.append(f"Evidence-based Coping Techniques: {state.coping_techniques}")
    if state.crisis_resources:
        parts.append(f"Crisis Resources: {state.crisis_resources}")
    return "\n".join(parts)


def _get_llm() -> ChatGroq:
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        api_key=os.getenv("GROQ_API_KEY"),
        temperature=0.4,
    )


# ── 3a. MCP tools node ──────────────────────────────────────────────────────

def mcp_tools_node(state: WellbeingState) -> dict:
    results: dict[str, Any] = {}
    for tool in mcp_tools:
        try:
            if tool.name == "calculate_wellness_score":
                results["wellness_score"] = tool.invoke({
                    "sleep_hours":   state.sleep_hours,
                    "stress_level":  state.stress_level,
                    "symptom_count": len(state.symptoms),
                    "has_support":   bool(state.support_system and "None" not in state.support_system),
                })
            elif tool.name == "get_coping_techniques":
                primary = state.symptoms[0] if state.symptoms else "stress"
                results["coping_techniques"] = tool.invoke({"symptom": primary})
            elif tool.name == "lookup_crisis_resources":
                results["crisis_resources"] = tool.invoke({"category": "general"})
        except Exception as exc:
            results.setdefault("_errors", []).append(f"{tool.name}: {exc}")
    return results


# ── 3b. Safety router ────────────────────────────────────────────────────────

CRISIS_KEYWORDS = {
    "suicide", "suicidal", "kill myself", "end my life", "self-harm",
    "self harm", "cutting", "overdose", "don't want to live",
    "not worth living", "better off dead",
    "end it all", "want to die", "no reason to live",
}


def safety_router(state: WellbeingState) -> dict:
    """Classify risk level. Pure function — no LLM call."""
    text = f"{state.mental_state} {state.recent_changes}".lower()
    if any(kw in text for kw in CRISIS_KEYWORDS):
        return {"risk_level": "crisis"}
    score = state.wellness_score.get("risk_level", "")
    if score == "elevated" or state.stress_level >= 9:
        return {"risk_level": "elevated"}
    if score == "moderate" or state.stress_level >= 7:
        return {"risk_level": "moderate"}
    return {"risk_level": "low"}


def route_after_safety(state: WellbeingState) -> str:
    if state.risk_level == "crisis":
        return "crisis_response"
    return "assessment_node"


# ── 3c. Crisis response ──────────────────────────────────────────────────────

def crisis_response(state: WellbeingState) -> dict:
    msg = (
        "## Immediate Support\n\n"
        "Thank you for sharing — that takes real courage. "
        "Based on what you've described, I want to make sure you're connected "
        "with someone who can help right now.\n\n"
        "**Please reach out immediately:**\n\n"
        "- **988 Suicide & Crisis Lifeline** — call or text **988**\n"
        "- **Crisis Text Line** — text **HOME** to **741741**\n"
        "- **Emergency Services** — call **911**\n\n"
        "You are not alone, and help is available 24/7.\n\n"
        "*This application is a supportive tool and does not replace "
        "professional mental health care.*"
    )
    return {"synthesis": msg}


# ── 3d. Agent nodes ──────────────────────────────────────────────────────────

def assessment_node(state: WellbeingState) -> dict:
    llm    = _get_llm()
    intake = _build_intake_summary(state)
    resp   = llm.invoke([
        SystemMessage(content=ASSESSMENT_PROMPT),
        HumanMessage(content=f"Here is the user's intake:\n\n{intake}"),
    ])
    return {"assessment": resp.content}


def action_node(state: WellbeingState) -> dict:
    llm     = _get_llm()
    intake  = _build_intake_summary(state)
    context = f"Intake:\n{intake}\n\nAssessment summary:\n{state.assessment}"
    resp    = llm.invoke([
        SystemMessage(content=ACTION_PROMPT),
        HumanMessage(content=context),
    ])
    return {"action_plan": resp.content}


def followup_node(state: WellbeingState) -> dict:
    llm     = _get_llm()
    intake  = _build_intake_summary(state)
    context = (
        f"Intake:\n{intake}\n\n"
        f"Assessment:\n{state.assessment}\n\n"
        f"Action Plan:\n{state.action_plan}"
    )
    resp = llm.invoke([
        SystemMessage(content=FOLLOWUP_PROMPT),
        HumanMessage(content=context),
    ])
    return {"followup": resp.content}


def synthesiser_node(state: WellbeingState) -> dict:
    parts = [state.assessment, state.action_plan, state.followup]
    return {"synthesis": "\n\n---\n\n".join(parts)}


# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  4.  GRAPH CONSTRUCTION                                                  ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

def build_graph(checkpointer=None):
    builder = StateGraph(WellbeingState)

    if USE_MCP:
        builder.add_node("mcp_tools", mcp_tools_node)
    builder.add_node("safety_router",   safety_router)
    builder.add_node("crisis_response", crisis_response)
    builder.add_node("assessment_node", assessment_node)
    builder.add_node("action_node",     action_node)
    builder.add_node("followup_node",   followup_node)
    builder.add_node("synthesiser",     synthesiser_node)

    if USE_MCP:
        builder.add_edge(START, "mcp_tools")
        builder.add_edge("mcp_tools", "safety_router")
    else:
        builder.add_edge(START, "safety_router")

    builder.add_conditional_edges(
        "safety_router",
        route_after_safety,
        {"crisis_response": "crisis_response", "assessment_node": "assessment_node"},
    )
    builder.add_edge("crisis_response", END)
    builder.add_edge("assessment_node", "action_node")
    builder.add_edge("action_node",     "followup_node")
    builder.add_edge("followup_node",   "synthesiser")
    builder.add_edge("synthesiser",     END)

    return builder.compile(checkpointer=checkpointer)


# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  5.  CHECKPOINTER SINGLETON (lru_cache replaces @st.cache_resource)     ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

@lru_cache(maxsize=1)
def get_checkpointer():
    """Open one connection pool for the process lifetime. Returns None if
    SUPABASE_DB_URI is unset so callers degrade gracefully."""
    if not SUPABASE_DB_URI:
        return None
    try:
        pool = ConnectionPool(
            conninfo=SUPABASE_DB_URI,
            max_size=10,
            open=True,
            kwargs={"autocommit": True},  # required for CREATE INDEX CONCURRENTLY
        )
        saver = PostgresSaver(pool)
        saver.setup()
        return saver
    except Exception as exc:
        print(f"[agent_core] Persistence unavailable — {exc}")
        return None
