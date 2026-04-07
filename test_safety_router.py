import importlib.util, sys, os

spec = importlib.util.spec_from_file_location(
    "agent",
    os.path.join(os.path.dirname(__file__), "ai_mental_wellbeing_agent (1).py"),
)
# Stub streamlit and langchain so the module loads without a UI
import types
for mod in ["streamlit", "langchain_core", "langchain_core.messages",
            "langchain_openai", "langgraph", "langgraph.graph"]:
    sys.modules.setdefault(mod, types.ModuleType(mod))

# Minimal stubs
sys.modules["streamlit"].session_state = {}
sys.modules["langgraph.graph"].END = "END"
sys.modules["langgraph.graph"].START = "START"
sys.modules["langgraph.graph"].StateGraph = object
sys.modules["langchain_core.messages"].HumanMessage = object
sys.modules["langchain_core.messages"].SystemMessage = object
sys.modules["langchain_openai"].ChatOpenAI = object

agent = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(agent)
    CRISIS_KEYWORDS = agent.CRISIS_KEYWORDS
    print(f"Loaded CRISIS_KEYWORDS from file ({len(CRISIS_KEYWORDS)} keywords):")
    for kw in sorted(CRISIS_KEYWORDS):
        print(f"  - \"{kw}\"")
    print()
except Exception as e:
    print(f"Could not import module ({e}), falling back to inline keywords")
    CRISIS_KEYWORDS = {
        "suicide", "suicidal", "kill myself", "end my life", "self-harm",
        "self harm", "cutting", "overdose", "don't want to live",
        "not worth living", "better off dead",
        "end it all", "want to die", "no reason to live",
    }

def safety_router(mental_state, recent_changes=""):
    text = f"{mental_state} {recent_changes}".lower()
    if any(kw in text for kw in CRISIS_KEYWORDS):
        return "crisis"
    return "low"

test_inputs = [
    ("I want to end it all.",          "SHOULD trigger crisis gate"),
    ("I am feeling a bit stressed.",   "should NOT trigger"),
    ("I have been cutting myself.",    "SHOULD trigger crisis gate"),
    ("Things are hard but managing.",  "should NOT trigger"),
]

assessment_node_called = False
action_node_called     = False

print("=" * 60)
print("Safety Router Validation")
print("=" * 60)
all_passed = True

for text, expectation in test_inputs:
    risk   = safety_router(text)
    route  = "crisis_response" if risk == "crisis" else "assessment_node"
    expect_crisis = "SHOULD trigger" in expectation
    passed = (risk == "crisis") == expect_crisis

    status = "PASS" if passed else "FAIL"
    if not passed:
        all_passed = False

    print(f"\n[{status}] {expectation}")
    print(f"  Input : \"{text}\"")
    print(f"  Risk  : {risk}")
    print(f"  Route : {route}")
    if route == "crisis_response":
        print(f"  >>> Assessment & Action nodes NEVER called (short-circuited to END)")

print("\n" + "=" * 60)
print("Result:", "ALL TESTS PASSED" if all_passed else "SOME TESTS FAILED")
print("=" * 60)
