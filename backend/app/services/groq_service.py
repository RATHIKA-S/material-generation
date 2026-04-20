import json
from typing import Any, Dict, Tuple

import httpx

from app.config import settings


class GroqService:
    def __init__(self) -> None:
        self.api_key = settings.groq_api_key
        self.model = settings.groq_model
        self.model_candidates = [
            self.model,
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
        ]
        self.endpoint = "https://api.groq.com/openai/v1/chat/completions"

    async def extract_structured_constraints(self, prompt: str, domain: str) -> Tuple[Dict[str, Any], str]:
        if not self.api_key:
            raise RuntimeError("GROQ_API_KEY is required for LLM-only generation mode.")

        system = (
            "You are a computational chemistry expert system in a molecular generation pipeline. "
            "Return STRICT JSON only. Primary output schema keys: normalized_goal, representation_type, smiles, "
            "graph_tokens, hard_constraints, soft_targets, rationale. "
            "Rules: smiles must be syntactically valid and chemistry-consistent, with closed rings and plausible valency. "
            "Do not emit random or approximate structures. If a valid molecule cannot be produced, set smiles to null. "
            "No markdown, no prose outside JSON."
        )
        user = f"Domain: {domain}\nPrompt: {prompt}"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        last_error = "Unknown Groq error"
        async with httpx.AsyncClient(timeout=20) as client:
            for model in self.model_candidates:
                payload = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "temperature": 0.2,
                    "max_tokens": 500,
                }
                try:
                    response = await client.post(self.endpoint, headers=headers, json=payload)
                    response.raise_for_status()
                    content = response.json()["choices"][0]["message"]["content"]
                    parsed = self._parse_json_payload(content)
                    normalized = self._normalize_structured_payload(parsed, prompt=prompt)
                    return normalized, f"groq:{model}"
                except httpx.HTTPStatusError as exc:
                    body = exc.response.text
                    last_error = f"{exc} | response={body}"
                    continue
                except Exception as exc:
                    last_error = str(exc)
                    continue

        raise RuntimeError(f"Groq structuring request failed for all configured models. Last error: {last_error}")

    async def infer_structure_seed(self, prompt: str, domain: str, context: Dict[str, Any] | None = None) -> Tuple[Dict[str, Any], str]:
        if not self.api_key:
            raise RuntimeError("GROQ_API_KEY is required for LLM-only generation mode.")

        system = (
            "You are a computational chemistry expert system. Return STRICT JSON only with this schema: "
            "{\"smiles\": string|null, \"valid\": boolean, \"reasoning\": string, "
            "\"constraints\": {\"valency_satisfied\": boolean, \"no_overbonding\": boolean, \"connected_graph\": boolean}}. "
            "Rules: emit only RDKit-parsable, chemically meaningful SMILES. "
            "If invalid or uncertain, set smiles=null and valid=false. No markdown."
        )
        user = f"Domain: {domain}\nPrompt: {prompt}\nContext: {json.dumps(context or {}, ensure_ascii=True)}"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        last_error = "Unknown Groq error"
        async with httpx.AsyncClient(timeout=20) as client:
            for model in self.model_candidates:
                payload = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "temperature": 0.1,
                    "max_tokens": 300,
                }
                try:
                    response = await client.post(self.endpoint, headers=headers, json=payload)
                    response.raise_for_status()
                    content = response.json()["choices"][0]["message"]["content"]
                    parsed = self._parse_json_payload(content)
                    normalized = self._normalize_seed_payload(parsed)
                    return normalized, f"groq-seed:{model}"
                except httpx.HTTPStatusError as exc:
                    body = exc.response.text
                    last_error = f"{exc} | response={body}"
                    continue
                except Exception as exc:
                    last_error = str(exc)
                    continue

        raise RuntimeError(f"Groq structure seed request failed for all configured models. Last error: {last_error}")

    async def review_generated_molecule(self, question: str, context: Dict[str, Any]) -> Tuple[str, str]:
        """Generate an LLM review for a generated molecule and its predicted properties."""
        if not self.api_key:
            raise RuntimeError("GROQ_API_KEY is required for LLM review mode.")

        system = (
            "You are a senior computational materials scientist. "
            "Given a generated molecule and evaluation context, provide a clear, practical explanation. "
            "Focus on: (1) overall molecule assessment, (2) meaning of key properties and scores, "
            "(3) trade-offs, and (4) likely applications/industries. "
            "Be concise, technical, and useful for engineering decisions."
        )
        user = (
            f"User question: {question}\n"
            f"Material context JSON: {json.dumps(context, ensure_ascii=True)}"
        )

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        last_error = "Unknown Groq error"
        async with httpx.AsyncClient(timeout=25) as client:
            for model in self.model_candidates:
                payload = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "temperature": 0.25,
                    "max_tokens": 700,
                }
                try:
                    response = await client.post(self.endpoint, headers=headers, json=payload)
                    response.raise_for_status()
                    content = response.json()["choices"][0]["message"]["content"]
                    return content.strip(), f"groq-review:{model}"
                except httpx.HTTPStatusError as exc:
                    body = exc.response.text
                    last_error = f"{exc} | response={body}"
                    continue
                except Exception as exc:
                    last_error = str(exc)
                    continue

        raise RuntimeError(f"Groq molecule review request failed for all configured models. Last error: {last_error}")

    def _parse_json_payload(self, content: str) -> Dict[str, Any]:
        payload = content.strip()
        if payload.startswith("```"):
            payload = payload.strip("`")
            payload = payload.replace("json", "", 1).strip()
        parsed = json.loads(payload)
        if not isinstance(parsed, dict):
            raise ValueError("Groq response must be a JSON object.")
        return parsed

    def _normalize_seed_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        # Supports both legacy schema (smiles/graph_tokens/rationale) and strict schema
        # (smiles/valid/reasoning/constraints).
        smiles = payload.get("smiles") if isinstance(payload.get("smiles"), str) else None
        graph_tokens = payload.get("graph_tokens") if isinstance(payload.get("graph_tokens"), list) else []

        if "valid" in payload and isinstance(payload.get("valid"), bool):
            valid = payload.get("valid", False)
            constraints = payload.get("constraints") if isinstance(payload.get("constraints"), dict) else {}
            valency_ok = bool(constraints.get("valency_satisfied", False))
            overbond_ok = bool(constraints.get("no_overbonding", False))
            connected_ok = bool(constraints.get("connected_graph", False))
            if not (valid and valency_ok and overbond_ok and connected_ok):
                smiles = None
            rationale = payload.get("reasoning") if isinstance(payload.get("reasoning"), str) else "Seed response normalized from strict chemistry schema."
            return {
                "smiles": smiles,
                "graph_tokens": graph_tokens,
                "rationale": rationale,
            }

        rationale = payload.get("rationale") if isinstance(payload.get("rationale"), str) else "Seed response normalized from legacy schema."
        return {
            "smiles": smiles,
            "graph_tokens": graph_tokens,
            "rationale": rationale,
        }

    def _normalize_structured_payload(self, payload: Dict[str, Any], prompt: str) -> Dict[str, Any]:
        # Accept strict chemistry JSON and adapt it to the pipeline schema.
        if "normalized_goal" in payload and "representation_type" in payload:
            return payload

        smiles = payload.get("smiles") if isinstance(payload.get("smiles"), str) else None
        valid = payload.get("valid") if isinstance(payload.get("valid"), bool) else None
        constraints = payload.get("constraints") if isinstance(payload.get("constraints"), dict) else {}

        if valid is False:
            smiles = None

        if constraints:
            valency_ok = constraints.get("valency_satisfied", True)
            overbond_ok = constraints.get("no_overbonding", True)
            connected_ok = constraints.get("connected_graph", True)
            if not (valency_ok and overbond_ok and connected_ok):
                smiles = None

        reasoning = payload.get("reasoning") if isinstance(payload.get("reasoning"), str) else "Structured response normalized from strict chemistry schema."
        return {
            "normalized_goal": prompt,
            "representation_type": "smiles",
            "smiles": smiles,
            "graph_tokens": [],
            "hard_constraints": constraints,
            "soft_targets": {},
            "rationale": reasoning,
        }
