"""
MCP Wellbeing Tool Server

Exposes three tools consumed by ai_mental_wellbeing_agent (1).py:
  • calculate_wellness_score   — scores sleep, stress, symptoms, support
  • get_coping_techniques      — returns evidence-based techniques for a symptom
  • lookup_crisis_resources    — returns hotlines and resource links by category

Run with:
    python mcp_wellbeing_server.py
"""

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Wellbeing Tools")


# ── Tool 1: Wellness Score ────────────────────────────────────────────────────

@mcp.tool()
def calculate_wellness_score(
    sleep_hours: int,
    stress_level: int,
    symptom_count: int,
    has_support: bool,
) -> dict:
    """
    Calculate a composite wellness score (0–100) and risk classification.

    Args:
        sleep_hours:   Hours of sleep per night (0–12).
        stress_level:  Self-reported stress 1–10.
        symptom_count: Number of symptoms selected by the user.
        has_support:   Whether the user has an active support system.

    Returns:
        dict with keys: wellness_score (int), risk_level (str), breakdown (dict)
    """
    # Sleep score: optimal 7–9 h = 25 pts
    if 7 <= sleep_hours <= 9:
        sleep_score = 25
    elif 6 <= sleep_hours <= 10:
        sleep_score = 18
    elif 5 <= sleep_hours <= 11:
        sleep_score = 10
    else:
        sleep_score = 4

    # Stress score: inverted (low stress = high score)
    stress_score = max(0, 25 - (stress_level - 1) * 2)

    # Symptom score: fewer symptoms = higher score
    symptom_score = max(0, 25 - symptom_count * 3)

    # Support score
    support_score = 25 if has_support else 10

    total = sleep_score + stress_score + symptom_score + support_score

    if total >= 75:
        risk_level = "low"
    elif total >= 55:
        risk_level = "moderate"
    elif total >= 35:
        risk_level = "elevated"
    else:
        risk_level = "crisis"

    return {
        "wellness_score": total,
        "risk_level": risk_level,
        "breakdown": {
            "sleep": sleep_score,
            "stress": stress_score,
            "symptoms": symptom_score,
            "support": support_score,
        },
    }


# ── Tool 2: Coping Techniques ─────────────────────────────────────────────────

COPING_MAP: dict[str, list[str]] = {
    "anxiety": [
        "Box breathing (4-4-4-4 pattern) — do 5 cycles right now",
        "5-4-3-2-1 grounding: name 5 things you see, 4 you hear, 3 you feel, 2 you smell, 1 you taste",
        "Progressive muscle relaxation starting from your feet",
        "Limit caffeine and check in with your body every 2 hours",
    ],
    "depression": [
        "Behavioural activation: schedule one small enjoyable activity today",
        "10-minute walk outside — sunlight regulates mood",
        "Reach out to one person today, even a short text",
        "Track three things you did (not just felt) before bed",
    ],
    "insomnia": [
        "Maintain a fixed wake time every day including weekends",
        "No screens 60 minutes before bed; use blue-light filter after sunset",
        "4-7-8 breathing to fall asleep (inhale 4s, hold 7s, exhale 8s)",
        "Reserve your bed only for sleep — avoid work or scrolling in bed",
    ],
    "fatigue": [
        "Take a 20-minute nap before 3 pm if needed — avoid longer naps",
        "Hydrate: aim for 8 glasses of water; fatigue is often mild dehydration",
        "Break tasks into 25-minute Pomodoro blocks with 5-minute breaks",
        "Gentle movement (a short walk) often increases energy more than rest",
    ],
    "stress": [
        "Write down the three biggest stressors and one small action for each",
        "Diaphragmatic breathing for 5 minutes lowers cortisol measurably",
        "Identify what is in your control vs. outside it — act only on the former",
        "Single-task: close all tabs except the one thing you are working on",
    ],
}

DEFAULT_COPING = [
    "Take 5 slow, deep breaths right now",
    "Drink a glass of water and step outside for 5 minutes",
    "Write freely for 10 minutes about what is on your mind",
    "Reach out to one trusted person today",
]


@mcp.tool()
def get_coping_techniques(symptom: str) -> list[str]:
    """
    Return evidence-based coping techniques for a given symptom.

    Args:
        symptom: One of anxiety, depression, insomnia, fatigue, stress
                 (case-insensitive). Falls back to general techniques.

    Returns:
        List of 4 actionable coping technique strings.
    """
    return COPING_MAP.get(symptom.lower().strip(), DEFAULT_COPING)


# ── Tool 3: Crisis Resources ──────────────────────────────────────────────────

CRISIS_RESOURCES: dict[str, dict] = {
    "general": {
        "hotlines": [
            {"name": "988 Suicide & Crisis Lifeline", "contact": "Call or text 988", "available": "24/7"},
            {"name": "Crisis Text Line", "contact": "Text HOME to 741741", "available": "24/7"},
            {"name": "SAMHSA Helpline", "contact": "1-800-662-4357", "available": "24/7, free, confidential"},
        ],
        "online": [
            {"name": "Crisis Chat (988lifeline.org)", "url": "https://988lifeline.org/chat/"},
            {"name": "7 Cups — free emotional support", "url": "https://www.7cups.com/"},
        ],
        "emergency": "Call 911 or go to your nearest emergency room for immediate danger.",
    },
    "anxiety": {
        "hotlines": [
            {"name": "ADAA Helpline", "contact": "1-240-485-1001", "available": "Business hours"},
            {"name": "988 Suicide & Crisis Lifeline", "contact": "Call or text 988", "available": "24/7"},
        ],
        "online": [
            {"name": "ADAA Find a Therapist", "url": "https://adaa.org/find-help"},
            {"name": "Anxiety Coach App", "url": "https://anxietycoach.com/"},
        ],
        "emergency": "Call 911 if experiencing a severe panic attack with chest pain.",
    },
    "depression": {
        "hotlines": [
            {"name": "988 Suicide & Crisis Lifeline", "contact": "Call or text 988", "available": "24/7"},
            {"name": "NAMI Helpline", "contact": "1-800-950-6264", "available": "Mon–Fri 10am–10pm ET"},
        ],
        "online": [
            {"name": "NAMI Support Groups", "url": "https://www.nami.org/Support-Education/Support-Groups"},
            {"name": "Depression & Bipolar Support Alliance", "url": "https://www.dbsalliance.org/"},
        ],
        "emergency": "Call 911 or 988 if you are having thoughts of self-harm.",
    },
}


@mcp.tool()
def lookup_crisis_resources(category: str = "general") -> dict:
    """
    Return crisis hotlines and online resources for a given category.

    Args:
        category: One of general, anxiety, depression (case-insensitive).
                  Defaults to general.

    Returns:
        Dict with keys: hotlines (list), online (list), emergency (str).
    """
    return CRISIS_RESOURCES.get(category.lower().strip(), CRISIS_RESOURCES["general"])


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Starting MCP Wellbeing Tool Server...")
    print("Tools available: calculate_wellness_score, get_coping_techniques, lookup_crisis_resources")
    print("Transport: stdio  (connect via langchain-mcp-adapters or mcp CLI)")
    mcp.run(transport="stdio")
