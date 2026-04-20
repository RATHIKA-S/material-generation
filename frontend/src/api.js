const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export async function designMaterial(payload) {
  const res = await fetch(`${API_BASE}/api/v1/design`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Design request failed: ${res.status}`);
  }
  return res.json();
}

export async function chatAssistant(payload) {
  const res = await fetch(`${API_BASE}/api/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Chat request failed: ${res.status}`);
  }
  return res.json();
}
