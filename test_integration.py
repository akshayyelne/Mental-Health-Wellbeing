"""
test_integration.py — Stage 4 SIT (System Integration Testing)

Suite 1 — Safety Router      : pure-function tests, zero LLM calls
Suite 2 — Graph (crisis path): full graph run, LLM intentionally bypassed
Suite 3 — Supabase Persistence: real DB round-trip, LLM mocked for non-crisis

Run:
    pytest test_integration.py -v
    pytest test_integration.py -v -k "not Supabase"   # skip DB tests
"""

from __future__ import annotations

import importlib.util
import os
import sys
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────────────────────────────────────
# Load agent_core directly — no Streamlit stub needed
# ─────────────────────────────────────────────────────────────────────────────
_agent_path = Path(__file__).parent / "agent_core.py"
_spec = importlib.util.spec_from_file_location("agent_core", _agent_path)
_agent = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_agent)

WellbeingState     = _agent.WellbeingState
CRISIS_KEYWORDS    = _agent.CRISIS_KEYWORDS
safety_router      = _agent.safety_router
route_after_safety = _agent.route_after_safety
build_graph        = _agent.build_graph

SUPABASE_DB_URI = os.getenv("SUPABASE_DB_URI", "")


# ═════════════════════════════════════════════════════════════════════════════
# Suite 1 — Safety Router (pure functions, no I/O)
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.parametrize("keyword", sorted(CRISIS_KEYWORDS))
def test_each_crisis_keyword_triggers_crisis_risk(keyword: str) -> None:
    """Every word/phrase in CRISIS_KEYWORDS must individually set risk_level=crisis."""
    state = WellbeingState(mental_state=keyword)
    result = safety_router(state)
    assert result["risk_level"] == "crisis", (
        f"Keyword '{keyword}' was NOT detected — safety gate has a gap"
    )


def test_crisis_phrase_detected_in_mental_state() -> None:
    state = WellbeingState(mental_state="I want to end it all, I see no way out")
    result = safety_router(state)
    assert result["risk_level"] == "crisis"


def test_crisis_phrase_detected_in_recent_changes() -> None:
    """safety_router scans BOTH mental_state and recent_changes."""
    state = WellbeingState(mental_state="feeling down", recent_changes="I want to die alone")
    result = safety_router(state)
    assert result["risk_level"] == "crisis"


def test_non_crisis_text_is_not_flagged() -> None:
    state = WellbeingState(mental_state="I have been feeling anxious at work", stress_level=5)
    result = safety_router(state)
    assert result["risk_level"] != "crisis"


def test_stress_level_9_yields_elevated() -> None:
    state = WellbeingState(mental_state="very stressed", stress_level=9)
    result = safety_router(state)
    assert result["risk_level"] == "elevated"


def test_stress_level_7_yields_moderate() -> None:
    state = WellbeingState(mental_state="tired", stress_level=7)
    result = safety_router(state)
    assert result["risk_level"] == "moderate"


def test_route_sends_crisis_state_to_crisis_response_node() -> None:
    state = WellbeingState(risk_level="crisis")
    assert route_after_safety(state) == "crisis_response"


def test_route_sends_non_crisis_state_to_assessment_node() -> None:
    state = WellbeingState(risk_level="low")
    assert route_after_safety(state) == "assessment_node"


# ═════════════════════════════════════════════════════════════════════════════
# Suite 2 — Full graph, crisis path (LLM is never called)
# ═════════════════════════════════════════════════════════════════════════════

def test_graph_crisis_path_returns_emergency_resources() -> None:
    """Graph.invoke with crisis input must return 988/crisis hotline text."""
    graph = build_graph(checkpointer=None)
    initial = WellbeingState(
        mental_state="I want to kill myself",
        sleep_hours=4,
        stress_level=10,
    ).model_dump()

    result = graph.invoke(initial)

    assert result["risk_level"] == "crisis"
    assert "988" in result["synthesis"] or "Crisis" in result["synthesis"]


def test_graph_crisis_path_never_calls_llm() -> None:
    """crisis_response is hardcoded — _get_llm must NOT be called."""
    graph = build_graph(checkpointer=None)
    initial = WellbeingState(
        mental_state="I want to end my life",
        stress_level=10,
    ).model_dump()

    with patch.object(_agent, "_get_llm") as mock_get_llm:
        graph.invoke(initial)
        mock_get_llm.assert_not_called()


def test_graph_crisis_path_produces_empty_assessment() -> None:
    """Assessment node must be skipped — assessment field stays empty."""
    graph = build_graph(checkpointer=None)
    initial = WellbeingState(mental_state="I want to die").model_dump()
    result = graph.invoke(initial)
    assert result.get("assessment", "") == ""


def test_graph_non_crisis_path_calls_llm_and_produces_synthesis() -> None:
    """Normal path: LLM is called and synthesis contains the mocked content."""
    mock_llm = MagicMock()
    mock_llm.invoke.return_value = MagicMock(content="## Mocked agent response")

    graph = build_graph(checkpointer=None)
    initial = WellbeingState(
        mental_state="feeling a bit stressed lately",
        stress_level=5,
    ).model_dump()

    with patch.object(_agent, "_get_llm", return_value=mock_llm):
        result = graph.invoke(initial)

    assert mock_llm.invoke.called, "LLM must be called on the normal assessment path"
    assert "Mocked agent response" in result["synthesis"]
    assert result["risk_level"] != "crisis"


# ═════════════════════════════════════════════════════════════════════════════
# Suite 3 — Supabase Persistence (real DB, LLM mocked where needed)
# ═════════════════════════════════════════════════════════════════════════════

@pytest.mark.skipif(not SUPABASE_DB_URI, reason="SUPABASE_DB_URI not set")
class TestSupabasePersistence:
    """Class-level setup opens one pool for all tests; teardown closes it."""

    pool = None
    saver = None

    @classmethod
    def setup_class(cls) -> None:
        from psycopg_pool import ConnectionPool
        from langgraph.checkpoint.postgres import PostgresSaver

        cls.pool = ConnectionPool(
            conninfo=SUPABASE_DB_URI,
            max_size=5,
            open=True,
            kwargs={"autocommit": True},
        )
        cls.saver = PostgresSaver(cls.pool)
        cls.saver.setup()

    @classmethod
    def teardown_class(cls) -> None:
        if cls.pool:
            cls.pool.close()

    # ── helpers ──────────────────────────────────────────────────────────────

    def _invoke_crisis(self, thread_id: str) -> dict:
        graph = build_graph(checkpointer=self.saver)
        initial = WellbeingState(
            mental_state="I want to end it all",
            sleep_hours=3,
            stress_level=10,
        ).model_dump()
        config = {"configurable": {"thread_id": thread_id}}
        return graph.invoke(initial, config=config), config

    # ── tests ─────────────────────────────────────────────────────────────────

    def test_connection_pool_is_open(self) -> None:
        assert self.pool is not None
        # A simple ping: borrow a connection and return it
        with self.pool.connection() as conn:
            conn.execute("SELECT 1")

    def test_saver_setup_succeeded(self) -> None:
        assert self.saver is not None
        # setup() is idempotent — calling again must not raise
        self.saver.setup()

    def test_graph_invoke_with_checkpointer_completes(self) -> None:
        result, _ = self._invoke_crisis(f"sit-invoke-{uuid.uuid4()}")
        assert "synthesis" in result
        assert result["risk_level"] == "crisis"

    def test_checkpoint_exists_after_invoke(self) -> None:
        thread_id = f"sit-ckpt-{uuid.uuid4()}"
        self._invoke_crisis(thread_id)

        checkpoint = self.saver.get({"configurable": {"thread_id": thread_id}})
        assert checkpoint is not None, "No checkpoint written after graph.invoke()"

    def test_checkpoint_round_trip_integrity(self) -> None:
        """Values in the DB must exactly match what graph.invoke() returned."""
        thread_id = f"sit-rt-{uuid.uuid4()}"
        result, config = self._invoke_crisis(thread_id)

        checkpoint = self.saver.get(config)
        saved = checkpoint["channel_values"]

        assert saved.get("synthesis") == result["synthesis"]
        assert saved.get("risk_level") == result["risk_level"]

    def test_second_graph_instance_reads_same_checkpoint(self) -> None:
        thread_id = f"sit-reload-{uuid.uuid4()}"
        result, config = self._invoke_crisis(thread_id)

        # Completely new graph object, same saver
        graph2 = build_graph(checkpointer=self.saver)
        reloaded = graph2.get_state(config)

        assert reloaded is not None
        assert reloaded.values is not None
        assert reloaded.values.get("risk_level") == "crisis"

    def test_different_thread_ids_are_isolated(self) -> None:
        """Crisis and non-crisis sessions must not bleed into each other."""
        graph = build_graph(checkpointer=self.saver)
        tid_a = f"sit-iso-a-{uuid.uuid4()}"
        tid_b = f"sit-iso-b-{uuid.uuid4()}"

        # tid_a: normal (mocked LLM so it's fast)
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = MagicMock(content="## Mock")
        normal_input = WellbeingState(mental_state="feeling okay", stress_level=3).model_dump()
        with patch.object(_agent, "_get_llm", return_value=mock_llm):
            graph.invoke(normal_input, config={"configurable": {"thread_id": tid_a}})

        # tid_b: crisis (no LLM call needed)
        crisis_input = WellbeingState(mental_state="I want to end it all").model_dump()
        graph.invoke(crisis_input, config={"configurable": {"thread_id": tid_b}})

        risk_a = self.saver.get({"configurable": {"thread_id": tid_a}})["channel_values"]["risk_level"]
        risk_b = self.saver.get({"configurable": {"thread_id": tid_b}})["channel_values"]["risk_level"]

        assert risk_b == "crisis"
        assert risk_a != "crisis", "Normal session was incorrectly flagged as crisis"
