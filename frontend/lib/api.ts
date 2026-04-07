const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface CheckinRequest {
  mental_state:   string;
  sleep_hours:    number;
  stress_level:   number;
  support_system: string[];
  recent_changes: string;
  symptoms:       string[];
  thread_id?:     string;
}

export interface SupportPlan {
  thread_id:         string;
  risk_level:        string;
  assessment:        string;
  action_plan:       string;
  followup:          string;
  synthesis:         string;
  wellness_score:    Record<string, unknown>;
  coping_techniques: string[];
  crisis_resources:  Record<string, unknown>;
}

export async function submitCheckin(data: CheckinRequest): Promise<SupportPlan> {
  const res = await fetch(`${API_BASE}/chat`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(data),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API error ${res.status}: ${detail}`);
  }
  return res.json() as Promise<SupportPlan>;
}

export interface RitualRequest {
  energy_level:   number;
  environment:    string;
  time_available: number;
}

export interface RitualStep {
  opening:     string;
  practice:    string;
  integration: string;
}

export interface Ritual {
  title: string;
  steps: RitualStep;
}

export async function generateRitual(data: RitualRequest): Promise<Ritual> {
  const res = await fetch(`${API_BASE}/api/wellness/generate`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(data),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API error ${res.status}: ${detail}`);
  }
  return res.json() as Promise<Ritual>;
}

export interface IntentionResponse {
  insight:   string;
  cta_label: string;
  cta_href:  string;
}

export async function getIntention(
  stress_level?: number,
  sleep_hours?:  number,
  time_of_day?:  string,
): Promise<IntentionResponse> {
  const res = await fetch(`${API_BASE}/api/intention`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ stress_level, sleep_hours, time_of_day }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<IntentionResponse>;
}

export async function getReflection(mental_state: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/reflect`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ mental_state }),
  });
  if (!res.ok) return "";
  const data = await res.json();
  return (data as { reflection: string }).reflection ?? "";
}

export interface RetreatDetail {
  id:            string;
  title:         string;
  description:   string;
  vibe_tags:     string[];
  price_tier:    string;
  duration_days: number;
  highlights:    string[];
  ai_insight:    string;
}

export interface RetreatMatchResponse {
  matches: RetreatDetail[];
}

export async function matchRetreats(query: string): Promise<RetreatMatchResponse> {
  const res = await fetch(`${API_BASE}/api/retreats/match`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ query }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API error ${res.status}: ${detail}`);
  }
  return res.json() as Promise<RetreatMatchResponse>;
}

export async function loadSession(threadId: string): Promise<SupportPlan | null> {
  const res = await fetch(`${API_BASE}/session/${threadId}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.found ? (data as SupportPlan) : null;
}
