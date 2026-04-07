"""
Mental Wellbeing Agent — LangGraph + MCP Edition

Migrated from AutoGen Swarm to LangGraph StateGraph with:
  • Typed state (Pydantic) for deterministic data flow
  • Explicit graph edges replacing implicit swarm hand-offs
  • Safety router node for crisis detection
  • Optional MCP tool server for crisis resources, coping techniques,
    and wellness scoring
  • Streamlit UI (preserved from original)
"""

from __future__ import annotations

import asyncio
import os
import sys
import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

import streamlit as st
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from langgraph.graph import END, START, StateGraph
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg_pool import ConnectionPool
from pydantic import BaseModel, Field

load_dotenv()

# ── Optional MCP integration ────────────────────────────────────────────────
# Set USE_MCP=true and ensure mcp_wellbeing_server.py is next to this file.
USE_MCP = os.getenv("USE_MCP", "false").lower() == "true"

# ── Postgres / Supabase persistence ─────────────────────────────────────────
SUPABASE_DB_URI = os.getenv("SUPABASE_DB_URI", "")

mcp_tools: list = []  # populated at runtime if MCP is enabled


# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  1.  STATE  — the single typed object flowing through every node        ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

class WellbeingState(BaseModel):
    """Shared state passed through every LangGraph node."""

    # ── User intake ──
    mental_state: str = ""
    sleep_hours: int = 7
    stress_level: int = 5
    support_system: list[str] = Field(default_factory=list)
    recent_changes: str = ""
    symptoms: list[str] = Field(default_factory=list)

    # ── Agent outputs ──
    assessment: str = ""
    action_plan: str = ""
    followup: str = ""
    synthesis: str = ""

    # ── Router flag ──
    risk_level: str = "unknown"  # low | moderate | elevated | crisis

    # ── MCP tool results (optional) ──
    wellness_score: dict = Field(default_factory=dict)
    coping_techniques: list[str] = Field(default_factory=list)
    crisis_resources: dict = Field(default_factory=dict)


# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  2.  SYSTEM PROMPTS  — one per agent node                               ║
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
# ║  3.  NODE FUNCTIONS  — each receives & returns WellbeingState            ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

def _build_intake_summary(state: WellbeingState) -> str:
    """Format user intake data into a prompt-ready summary."""
    support = ", ".join(state.support_system) if state.support_system else "None reported"
    symptoms = ", ".join(state.symptoms) if state.symptoms else "None reported"
    parts = [
        f"Emotional State: {state.mental_state}",
        f"Sleep: {state.sleep_hours} hours per night",
        f"Stress Level: {state.stress_level}/10",
        f"Support System: {support}",
        f"Recent Changes: {state.recent_changes}",
        f"Current Symptoms: {symptoms}",
    ]
    # Include MCP-derived data if available
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


# ── 3a. MCP tools node (optional) ──────────────────────────────────────────

def mcp_tools_node(state: WellbeingState) -> dict:
    """Call MCP tools to enrich state before agent nodes run.

    This node is only added to the graph when USE_MCP=true.
    Falls back gracefully if the MCP server is unavailable.
    """
    results: dict[str, Any] = {}

    # We run MCP tool calls synchronously via the loaded tool objects
    for tool in mcp_tools:
        try:
            if tool.name == "calculate_wellness_score":
                score = tool.invoke({
                    "sleep_hours": state.sleep_hours,
                    "stress_level": state.stress_level,
                    "symptom_count": len(state.symptoms),
                    "has_support": bool(state.support_system and "None" not in state.support_system),
                })
                results["wellness_score"] = score

            elif tool.name == "get_coping_techniques":
                primary = state.symptoms[0] if state.symptoms else "stress"
                techniques = tool.invoke({"symptom": primary})
                results["coping_techniques"] = techniques

            elif tool.name == "lookup_crisis_resources":
                resources = tool.invoke({"category": "general"})
                results["crisis_resources"] = resources
        except Exception as exc:
            # MCP failures should never block the pipeline
            results.setdefault("_errors", []).append(f"{tool.name}: {exc}")

    return results


# ── 3b. Safety router ──────────────────────────────────────────────────────

CRISIS_KEYWORDS = {
    "suicide", "suicidal", "kill myself", "end my life", "self-harm",
    "self harm", "cutting", "overdose", "don't want to live",
    "not worth living", "better off dead",
    "end it all", "want to die", "no reason to live",
}


def safety_router(state: WellbeingState) -> dict:
    """Classify risk level from intake data.  Pure function — no LLM call."""
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
    """Conditional edge: crisis → END with resources, else → assessment."""
    if state.risk_level == "crisis":
        return "crisis_response"
    return "assessment_node"


# ── 3c. Crisis response (short-circuits the graph) ─────────────────────────

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


# ── 3d. Agent nodes ────────────────────────────────────────────────────────

def assessment_node(state: WellbeingState) -> dict:
    llm = _get_llm()
    intake = _build_intake_summary(state)
    response = llm.invoke([
        SystemMessage(content=ASSESSMENT_PROMPT),
        HumanMessage(content=f"Here is the user's intake:\n\n{intake}"),
    ])
    return {"assessment": response.content}


def action_node(state: WellbeingState) -> dict:
    llm = _get_llm()
    intake = _build_intake_summary(state)
    context = f"Intake:\n{intake}\n\nAssessment summary:\n{state.assessment}"
    response = llm.invoke([
        SystemMessage(content=ACTION_PROMPT),
        HumanMessage(content=context),
    ])
    return {"action_plan": response.content}


def followup_node(state: WellbeingState) -> dict:
    llm = _get_llm()
    intake = _build_intake_summary(state)
    context = (
        f"Intake:\n{intake}\n\n"
        f"Assessment:\n{state.assessment}\n\n"
        f"Action Plan:\n{state.action_plan}"
    )
    response = llm.invoke([
        SystemMessage(content=FOLLOWUP_PROMPT),
        HumanMessage(content=context),
    ])
    return {"followup": response.content}


# ── 3e. Synthesiser ────────────────────────────────────────────────────────

def synthesiser_node(state: WellbeingState) -> dict:
    """Merge all three agent outputs into a cohesive plan."""
    parts = [state.assessment, state.action_plan, state.followup]
    return {"synthesis": "\n\n---\n\n".join(parts)}


# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  4.  GRAPH CONSTRUCTION                                                 ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

def build_graph(checkpointer=None) -> StateGraph:
    """Build and compile the LangGraph workflow.

    Args:
        checkpointer: Optional PostgresSaver instance. When provided, every
                      node's output is persisted after execution so the same
                      thread_id can resume or reload state across sessions.
    """

    builder = StateGraph(WellbeingState)

    # ── Register nodes ──
    if USE_MCP:
        builder.add_node("mcp_tools", mcp_tools_node)
    builder.add_node("safety_router", safety_router)
    builder.add_node("crisis_response", crisis_response)
    builder.add_node("assessment_node", assessment_node)
    builder.add_node("action_node", action_node)
    builder.add_node("followup_node", followup_node)
    builder.add_node("synthesiser", synthesiser_node)

    # ── Wire edges ──
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

    # Sequential agent pipeline (deterministic order)
    builder.add_edge("assessment_node", "action_node")
    builder.add_edge("action_node", "followup_node")
    builder.add_edge("followup_node", "synthesiser")
    builder.add_edge("synthesiser", END)

    return builder.compile(checkpointer=checkpointer)


@st.cache_resource
def get_checkpointer():
    """Create a connection pool and PostgresSaver, cached for the app lifetime.

    Returns None if SUPABASE_DB_URI is not configured so the app degrades
    gracefully without persistence.
    """
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
        saver.setup()   # creates langgraph checkpoint tables if they don't exist
        return saver
    except Exception as exc:
        st.warning(f"Persistence unavailable — could not connect to Supabase: {exc}")
        return None


# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  5.  STREAMLIT UI  — Soft Sage theme, tabbed layout                     ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

_CSS = """
<style>
/* ── Rounded containers ───────────────────────────────────────────────── */
div[data-testid="stVerticalBlock"]
  > div[style*="flex-direction: column"]
  > div[data-testid="stVerticalBlock"] {
    border-radius: 12px;
}
div[data-testid="stExpander"] {
    border-radius: 12px;
    border: 1px solid #d0dcdc !important;
    overflow: hidden;
}
/* ── Chat message cards ──────────────────────────────────────────────── */
div[data-testid="stChatMessage"] {
    background-color: #F0F4F4;
    border-radius: 12px;
    border: 1px solid #c8d8d8;
    padding: 4px 12px;
    margin-bottom: 10px;
}
/* ── Status widget ───────────────────────────────────────────────────── */
div[data-testid="stStatus"] {
    border-radius: 12px;
    border: 1px solid #c8d8d8 !important;
}
/* ── Metric cards ────────────────────────────────────────────────────── */
div[data-testid="metric-container"] {
    background-color: #F0F4F4;
    border-radius: 12px;
    padding: 12px 16px;
    border: 1px solid #d0dcdc;
}
/* ── Primary button ──────────────────────────────────────────────────── */
.stButton > button[kind="primary"],
.stButton > button {
    border-radius: 8px;
    background-color: #7D9D9C;
    color: #ffffff;
    border: none;
    padding: 0.5rem 2.2rem;
    font-weight: 600;
    letter-spacing: 0.3px;
}
.stButton > button:hover {
    background-color: #6a8a89;
    color: #ffffff;
}
/* ── Footer ──────────────────────────────────────────────────────────── */
.wellbeing-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    background-color: #F0F4F4;
    border-top: 1px solid #d0dcdc;
    padding: 6px 16px;
    font-size: 0.75rem;
    color: #6b7e7e;
    text-align: center;
    z-index: 999;
}
</style>
"""

# Node → human-readable label shown inside st.status
_NODE_LABELS: dict[str, str] = {
    "mcp_tools":       "Fetching wellness tools...",
    "safety_router":   "Checking safety indicators...",
    "crisis_response": "Preparing crisis resources...",
    "assessment_node": "Analyzing clinical markers...",
    "action_node":     "Building your action plan...",
    "followup_node":   "Designing long-term strategy...",
    "synthesiser":     "Synthesizing your support plan...",
}


def _run_graph_with_status(graph, initial_state: WellbeingState, config: dict) -> dict:
    """Stream the graph and surface each node as a st.status update.

    Returns the accumulated result dict (same shape as graph.invoke).
    """
    accumulated: dict = {}
    with st.status("Building your support plan…", expanded=True) as status:
        for chunk in graph.stream(initial_state.model_dump(), config=config):
            for node_name, updates in chunk.items():
                label = _NODE_LABELS.get(node_name, node_name)
                status.write(f"✓ {label}")
                if isinstance(updates, dict):
                    accumulated.update(updates)
        status.update(label="Support plan ready ✓", state="complete", expanded=False)
    return accumulated


def main() -> None:
    st.set_page_config(
        page_title="Mental Wellbeing Agent",
        page_icon="🧠",
        layout="wide",
    )

    # ── Inject custom CSS ──
    st.markdown(_CSS, unsafe_allow_html=True)

    # ── Session state init ──
    if "output" not in st.session_state:
        st.session_state.output = {"assessment": "", "action": "", "followup": "",
                                   "risk_level": "", "wellness_score": {}}
    if "thread_id" not in st.session_state:
        st.session_state.thread_id = str(uuid.uuid4())
    if "history" not in st.session_state:
        st.session_state.history = []

    # ── Sidebar ───────────────────────────────────────────────────────────────
    st.sidebar.markdown("### 🧠 Mental Wellbeing")

    st.sidebar.markdown("---")
    st.sidebar.subheader("Session Persistence")
    thread_id = st.sidebar.text_input(
        "Thread ID",
        value=st.session_state.thread_id,
        help="Keep this ID to reload your session after a refresh. "
             "Change it to start a new session.",
    )
    st.session_state.thread_id = thread_id

    # Auto-reload prior state from Supabase when thread_id is entered
    checkpointer = get_checkpointer()
    if checkpointer and thread_id:
        config = {"configurable": {"thread_id": thread_id}}
        try:
            checkpoint = checkpointer.get(config)
            if checkpoint:
                saved = checkpoint.get("channel_values", {})
                if saved.get("assessment") and not st.session_state.output["assessment"]:
                    st.session_state.output.update({
                        "assessment":   saved.get("assessment", ""),
                        "action":       saved.get("action_plan", ""),
                        "followup":     saved.get("followup", ""),
                        "risk_level":   saved.get("risk_level", ""),
                        "wellness_score": saved.get("wellness_score", {}),
                    })
                    st.sidebar.success("Prior session reloaded.")
        except Exception as exc:
            st.sidebar.warning(f"Could not reload session: {exc}")

    st.sidebar.markdown("---")
    st.sidebar.warning(
        "**⚠️ Important Notice**\n\n"
        "This app is a supportive tool and does not replace professional "
        "mental health care. In a crisis:\n\n"
        "- Crisis Lifeline: **988**\n"
        "- Emergency Services: **911**\n"
        "- Crisis Text Line: text **HOME** to **741741**"
    )

    if USE_MCP:
        st.sidebar.info(
            "🔌 MCP tool server **enabled** — enriching state with "
            "wellness score, coping techniques, and crisis resources."
        )

    # ── Page header ───────────────────────────────────────────────────────────
    st.title("🧠 Mental Wellbeing Agent")
    st.caption(
        f"Powered by LangGraph{'  +  MCP' if USE_MCP else ''}  •  "
        "Assessment · Action · Follow-up · Safety"
    )
    st.markdown("---")

    # ── Tabs ──────────────────────────────────────────────────────────────────
    tab_checkin, tab_plan, tab_history = st.tabs(
        ["📋  Daily Check-in", "💬  Your Support Plan", "🕑  Session History"]
    )

    # ═══════════════════════════════════════════════════════════════════════════
    # Tab 1 — Daily Check-in
    # ═══════════════════════════════════════════════════════════════════════════
    with tab_checkin:
        st.subheader("How are you doing today?")
        st.caption(
            "Your responses are used only to generate your personalised support plan "
            "and are persisted securely with your session ID."
        )

        col1, col2 = st.columns(2)

        with col1:
            mental_state = st.text_area(
                "How have you been feeling recently?",
                placeholder="Describe your emotional state, thoughts, or concerns…",
                height=120,
            )
            sleep_pattern = st.select_slider(
                "Sleep Pattern (hours per night)",
                options=[str(i) for i in range(0, 13)],
                value="7",
            )

        with col2:
            stress_level = st.slider("Current Stress Level (1-10)", 1, 10, 5)
            support_system = st.multiselect(
                "Current Support System",
                ["Family", "Friends", "Therapist", "Support Groups", "None"],
            )

        recent_changes = st.text_area(
            "Any significant life changes or events recently?",
            placeholder="Job changes, relationships, losses, etc…",
            height=90,
        )

        current_symptoms = st.multiselect(
            "Current Symptoms",
            [
                "Anxiety", "Depression", "Insomnia", "Fatigue",
                "Loss of Interest", "Difficulty Concentrating",
                "Changes in Appetite", "Social Withdrawal",
                "Mood Swings", "Physical Discomfort",
            ],
        )

        st.markdown("")  # breathing room
        if st.button("Get Support Plan", type="primary"):
            try:
                checkpointer = get_checkpointer()
                graph = build_graph(checkpointer=checkpointer)

                initial_state = WellbeingState(
                    mental_state=mental_state,
                    sleep_hours=int(sleep_pattern),
                    stress_level=stress_level,
                    support_system=support_system,
                    recent_changes=recent_changes,
                    symptoms=current_symptoms,
                )

                config = {"configurable": {"thread_id": st.session_state.thread_id}}
                result = _run_graph_with_status(graph, initial_state, config)

                # Persist output to session state so Tab 2 can read it
                st.session_state.output.update({
                    "assessment":    result.get("assessment", ""),
                    "action":        result.get("action_plan", ""),
                    "followup":      result.get("followup", ""),
                    "risk_level":    result.get("risk_level", ""),
                    "wellness_score": result.get("wellness_score", {}),
                    "synthesis":     result.get("synthesis", ""),
                })

                # Append to history
                st.session_state.history.append({
                    "timestamp":  datetime.now().strftime("%Y-%m-%d %H:%M"),
                    "risk_level": result.get("risk_level", "unknown"),
                    "thread_id":  st.session_state.thread_id,
                    "symptoms":   ", ".join(current_symptoms) or "—",
                    "stress":     stress_level,
                })

                if result.get("risk_level") == "crisis":
                    st.error(result.get("synthesis", ""))
                else:
                    st.success("✨ Plan ready — switch to the **Your Support Plan** tab to read it.")

            except Exception as exc:
                st.error(f"An error occurred: {exc}")

        # Show cached results inline if they already exist
        if st.session_state.output.get("risk_level") == "crisis":
            st.error(st.session_state.output.get("synthesis", ""))

    # ═══════════════════════════════════════════════════════════════════════════
    # Tab 2 — Your Support Plan
    # ═══════════════════════════════════════════════════════════════════════════
    with tab_plan:
        output = st.session_state.output
        risk = output.get("risk_level", "")

        if risk == "crisis":
            st.error(output.get("synthesis", ""))

        elif output.get("assessment"):
            with st.chat_message("assistant", avatar="🧠"):
                st.markdown("**Situation Assessment**")
                st.markdown(output["assessment"])

            with st.chat_message("assistant", avatar="🎯"):
                st.markdown("**Action Plan & Resources**")
                st.markdown(output["action"])

            with st.chat_message("assistant", avatar="🔄"):
                st.markdown("**Long-term Support Strategy**")
                st.markdown(output["followup"])

            if output.get("wellness_score"):
                ws = output["wellness_score"]
                st.markdown("---")
                st.subheader("📊 Wellness Score (MCP)")
                m1, m2, m3 = st.columns(3)
                m1.metric("Overall Score", ws.get("wellness_score", "N/A"))
                m2.metric("Risk Level",    ws.get("risk_level", "N/A").capitalize())
                breakdown = ws.get("breakdown", {})
                m3.metric("Sleep Score",   breakdown.get("sleep_score", "N/A"))

        else:
            st.info(
                "No support plan yet. Complete the **Daily Check-in** tab "
                "and click **Get Support Plan**."
            )

    # ═══════════════════════════════════════════════════════════════════════════
    # Tab 3 — Session History
    # ═══════════════════════════════════════════════════════════════════════════
    with tab_history:
        st.subheader("Check-in History")
        st.caption("Each row is one completed check-in for this browser session.")

        if st.session_state.history:
            # Most-recent first
            for entry in reversed(st.session_state.history):
                risk_badge = {
                    "crisis":   "🔴 Crisis",
                    "elevated": "🟠 Elevated",
                    "moderate": "🟡 Moderate",
                    "low":      "🟢 Low",
                }.get(entry["risk_level"], "⚪ Unknown")

                with st.expander(f"{entry['timestamp']}  —  Risk: {risk_badge}"):
                    col_a, col_b = st.columns(2)
                    col_a.markdown(f"**Thread ID:** `{entry['thread_id']}`")
                    col_b.markdown(f"**Stress Level:** {entry['stress']}/10")
                    st.markdown(f"**Symptoms reported:** {entry['symptoms']}")
        else:
            st.info("No check-ins recorded yet in this session.")

        st.markdown("---")
        st.subheader("Session Controls")
        if st.button("Start Fresh Session"):
            st.session_state.thread_id = str(uuid.uuid4())
            st.session_state.output = {
                "assessment": "", "action": "", "followup": "",
                "risk_level": "", "wellness_score": {}
            }
            st.rerun()

    # ── Compliance footer ─────────────────────────────────────────────────────
    st.markdown(
        '<div class="wellbeing-footer">'
        "🔒 Secure Session: Data encrypted in transit and at rest. "
        "This tool does not replace professional mental health care."
        "</div>",
        unsafe_allow_html=True,
    )


if __name__ == "__main__":
    main()
