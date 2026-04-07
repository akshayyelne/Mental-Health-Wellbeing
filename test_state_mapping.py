"""Verify every Streamlit UI input maps correctly to WellbeingState."""
import sys, os, types

# Stub all heavy imports so WellbeingState loads without a running UI
for mod in ["streamlit", "langchain_core", "langchain_core.messages",
            "langchain_openai", "langgraph", "langgraph.graph"]:
    sys.modules.setdefault(mod, types.ModuleType(mod))
sys.modules["streamlit"].session_state = {}
sys.modules["langgraph.graph"].END = "END"
sys.modules["langgraph.graph"].START = "START"
sys.modules["langgraph.graph"].StateGraph = object
sys.modules["langchain_core.messages"].HumanMessage = object
sys.modules["langchain_core.messages"].SystemMessage = object
sys.modules["langchain_openai"].ChatOpenAI = object

import importlib.util
spec = importlib.util.spec_from_file_location(
    "agent",
    os.path.join(os.path.dirname(__file__), "ai_mental_wellbeing_agent (1).py"),
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
WellbeingState = mod.WellbeingState

# ── Simulate exactly what Streamlit widgets return ────────────────────────────
# st.text_area  -> str
mental_state     = "I have been feeling overwhelmed and exhausted lately."
# st.select_slider (options are strings) -> str  [cast to int at line 413]
sleep_pattern    = "6"
# st.slider -> int
stress_level     = 8
# st.multiselect -> list[str]
support_system   = ["Family", "Friends"]
# st.text_area -> str
recent_changes   = "Lost my job last month."
# st.multiselect -> list[str]
current_symptoms = ["Anxiety", "Fatigue"]

# ── Exact construction used in the app (lines 411-418) ───────────────────────
initial_state = WellbeingState(
    mental_state=mental_state,
    sleep_hours=int(sleep_pattern),   # select_slider returns str, cast here
    stress_level=stress_level,
    support_system=support_system,
    recent_changes=recent_changes,
    symptoms=current_symptoms,
)

dump = initial_state.model_dump()

# ── Mapping table: (field, expected_value, expected_type) ────────────────────
mappings = [
    ("mental_state",   mental_state,       dump["mental_state"],   str),
    ("sleep_hours",    int(sleep_pattern), dump["sleep_hours"],    int),
    ("stress_level",   stress_level,       dump["stress_level"],   int),
    ("support_system", support_system,     dump["support_system"], list),
    ("recent_changes", recent_changes,     dump["recent_changes"], str),
    ("symptoms",       current_symptoms,   dump["symptoms"],       list),
]

print("=" * 62)
print("Streamlit UI -> WellbeingState field mapping verification")
print("=" * 62)

all_ok = True
for field, ui_val, state_val, expected_type in mappings:
    type_ok  = isinstance(state_val, expected_type)
    value_ok = state_val == ui_val
    status   = "PASS" if (type_ok and value_ok) else "FAIL"
    if status == "FAIL":
        all_ok = False
    print(f"\n[{status}] {field}")
    print(f"       UI widget   : {repr(ui_val)}")
    print(f"       State field : {repr(state_val)}  ({type(state_val).__name__} / expected {expected_type.__name__})")

print("\n" + "=" * 62)
print("Result:", "ALL MAPPINGS CORRECT" if all_ok else "SOME MAPPINGS FAILED")
print("=" * 62)

# ── Show what graph.invoke() actually receives ────────────────────────────────
print("\nDict passed to graph.invoke():")
for k, v in dump.items():
    if v not in (None, "", [], {}):
        print(f"  {k}: {repr(v)}")
print(f"\nFields with defaults (not set by UI):")
for k, v in dump.items():
    if v in (None, "", [], {}):
        print(f"  {k}: {repr(v)}")
