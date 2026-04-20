import hashlib
from typing import Any, Dict, List, Tuple
import re

from app.schemas import PredictionResult, StructuredInput, UserDesignRequest
from app.services.groq_service import GroqService
from app.services.pubchem_validator import PubChemValidator


class ResearchAgent:
    """Engine 3: Groq-powered interpretation + lightweight RAG explanations."""

    def __init__(self) -> None:
        self.groq = GroqService()
        self.pubchem = PubChemValidator()
        self.knowledge_base = {
            "polymer": "High thermal stability polymers often leverage aromatic backbones and cross-linking.",
            "electrolyte": "Electrolytes favor high ionic conductivity, oxidation stability, and low flammability.",
            "catalyst": "Catalyst design prioritizes active sites, turnover frequency, and durability.",
            "crystal": "Crystal structures are evaluated via formation energy, lattice stability, and symmetry constraints.",
            "sustainability": "Sustainable materials consider recyclability, toxicity, and precursor availability.",
        }
        self._smiles_to_name = {
            "C": "methane",
            "O": "water",
            "CCO": "ethanol",
            "CC(=O)O": "acetic acid",
            "OC(=O)O": "carbonic acid",
            "O=C=O": "carbon dioxide",
            "c1ccccc1": "benzene",
            "CC(=O)O[Li]": "lithium acetate",
            "CC(C)CC": "pentane-like alkane",
            "C1=NC=CN=C1": "nitrogen-rich heteroaromatic ring",
        }

    async def structure_prompt(self, request: UserDesignRequest) -> Tuple[StructuredInput, str]:
        raw: Dict[str, Any] = {}
        mode = "fallback"
        try:
            raw, mode = await self.groq.extract_structured_constraints(request.prompt, request.domain)
        except Exception as exc:
            mode = f"fallback:{type(exc).__name__}"

        smiles = self._normalize_smiles(raw.get("smiles"))
        graph_tokens = self._normalize_graph_tokens(raw.get("graph_tokens")) or self._tokens_from_smiles(smiles)
        rationale = self._normalize_text(raw.get("rationale")) or "Structured from user prompt."

        if not smiles and not graph_tokens:
            seed_raw: Dict[str, Any] = {}
            seed_mode = "fallback-seed"
            try:
                seed_raw, seed_mode = await self.groq.infer_structure_seed(request.prompt, request.domain, context=raw)
            except Exception as exc:
                seed_mode = f"fallback-seed:{type(exc).__name__}"

            mode = f"{mode}+{seed_mode}"
            smiles = self._normalize_smiles(seed_raw.get("smiles"))
            graph_tokens = self._normalize_graph_tokens(seed_raw.get("graph_tokens")) or self._tokens_from_smiles(smiles)
            rationale = self._normalize_text(seed_raw.get("rationale")) or rationale

        if not smiles and not graph_tokens:
            fallback = self._deterministic_fallback_structure(request.prompt, request.domain)
            smiles = fallback["smiles"]
            graph_tokens = fallback["graph_tokens"]
            rationale = self._normalize_text(fallback["rationale"]) or rationale
            mode = f"{mode}+heuristic"

        normalized_goal = self._normalize_text(raw.get("normalized_goal")) or request.prompt

        representation_type = self._normalize_representation_type(raw.get("representation_type"))
        soft_targets = {
            **self._normalize_soft_targets(raw.get("soft_targets") or {}),
            **self._normalize_soft_targets(request.target_properties or {}),
        }

        structured = StructuredInput(
            normalized_goal=normalized_goal,
            domain=request.domain,
            representation_type=representation_type,
            smiles=smiles,
            graph_tokens=graph_tokens,
            hard_constraints={**self._normalize_hard_constraints(raw.get("hard_constraints")), **request.constraints},
            soft_targets=soft_targets,
            synthesis_requested=request.synthesis_requested,
            rationale=rationale,
        )
        return structured, mode

    def _tokens_from_smiles(self, smiles: str | None) -> List[str]:
        if not smiles:
            return []
        return re.findall(r"Cl|Br|[A-Z][a-z]?", smiles)

    def _normalize_smiles(self, smiles: Any) -> str | None:
        if not isinstance(smiles, str):
            return None
        cleaned = smiles.strip()
        return cleaned or None

    def _normalize_text(self, value: Any) -> str | None:
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        return None

    def _normalize_graph_tokens(self, tokens: Any) -> List[str]:
        if not isinstance(tokens, list):
            return []
        normalized: List[str] = []
        for token in tokens:
            if isinstance(token, str) and token.strip():
                normalized.append(token.strip())
        return normalized

    def _normalize_representation_type(self, representation_type: Any) -> str:
        allowed = {"smiles", "graph", "constraints", "hybrid"}
        if isinstance(representation_type, str):
            normalized = representation_type.strip().lower()
            if normalized in allowed:
                return normalized
            if normalized in {"electrolyte", "polymer", "crystal", "mof"}:
                return "hybrid"
        return "hybrid"

    def _normalize_soft_targets(self, values: Any) -> Dict[str, float]:
        if not isinstance(values, dict):
            if isinstance(values, list):
                parsed: Dict[str, Any] = {}
                for idx, item in enumerate(values):
                    if isinstance(item, dict):
                        for key, value in item.items():
                            if isinstance(key, str):
                                parsed[key] = value
                    elif isinstance(item, str) and item.strip():
                        parsed[f"target_{idx + 1}"] = item.strip()
                values = parsed
            elif isinstance(values, str) and values.strip():
                values = {"target_1": values.strip()}
            else:
                values = {}

        mapped: Dict[str, float] = {}
        for key, value in values.items():
            if isinstance(value, (int, float)):
                mapped[key] = float(value)
                continue
            if isinstance(value, str):
                lower = value.strip().lower()
                if lower in {"high", "strong", "good"}:
                    mapped[key] = 0.85
                elif lower in {"medium", "moderate"}:
                    mapped[key] = 0.6
                elif lower in {"low", "weak", "poor"}:
                    mapped[key] = 0.3
                else:
                    try:
                        mapped[key] = float(lower)
                    except ValueError:
                        continue
        return mapped

    def _normalize_hard_constraints(self, constraints: Any) -> Dict[str, Any]:
        if isinstance(constraints, dict):
            return constraints
        if isinstance(constraints, list):
            normalized: Dict[str, Any] = {}
            for idx, item in enumerate(constraints):
                if isinstance(item, str):
                    normalized[f"constraint_{idx + 1}"] = item
                elif isinstance(item, dict):
                    for key, value in item.items():
                        if isinstance(key, str):
                            normalized[key] = value
            return normalized
        if isinstance(constraints, str) and constraints.strip():
            return {"constraint_1": constraints.strip()}
        return {}

    def _deterministic_fallback_structure(self, prompt: str, domain: str) -> Dict[str, Any]:
        prompt_lower = prompt.lower()
        template_pools = {
            "polymer": ["CC(C)CC", "c1ccccc1", "CCO"],
            "electrolyte": ["CC(=O)O[Li]", "CCO", "OC(=O)O"],
            "catalyst": ["O=C=O", "c1ccccc1", "C1=NC=CN=C1"],
            "crystal": ["c1ccccc1", "C1=NC=CN=C1", "O=C=O"],
            "general": ["CCO", "C", "O"],
        }

        keyword_templates = [
            (("benzene", "aromatic", "thermal", "resistance"), "c1ccccc1"),
            (("water",), "O"),
            (("methane",), "C"),
            (("carbon dioxide", "co2"), "O=C=O"),
            (("acetic acid", "ethanoic acid", "acid", "recycl"), "CC(=O)O"),
            (("ethanol", "alcohol"), "CCO"),
            (("electrolyte", "ionic", "conductivity", "salt"), "CC(=O)O[Li]"),
            (("catalyst", "active site", "transition-metal"), "O=C=O"),
            (("polymer", "repeat", "chain", "backbone"), "CC(C)CC"),
            (("porous", "porosity", "framework"), "c1ccccc1"),
        ]

        selected_smiles = None
        for keywords, smiles in keyword_templates:
            if any(keyword in prompt_lower for keyword in keywords):
                selected_smiles = smiles
                break

        if selected_smiles is None:
            pool = template_pools.get(domain, template_pools["general"])
            digest = hashlib.sha256(f"{domain}|{prompt_lower}".encode("utf-8")).hexdigest()
            selected_smiles = pool[int(digest[:8], 16) % len(pool)]

        graph_tokens = [token for token in re.findall(r"[A-Za-z]+", prompt_lower) if len(token) > 2][:8]
        if not graph_tokens:
            graph_tokens = [domain]

        return {
            "smiles": selected_smiles,
            "graph_tokens": graph_tokens,
            "rationale": "Deterministic fallback structure selected from prompt and domain heuristics because the LLM response did not contain a usable structure.",
        }

    def explain_design(
        self,
        structured: StructuredInput,
        prediction: PredictionResult,
        citations: List[str],
    ) -> Dict[str, str]:
        """
        Generate a generic, material-generation-focused explanation.

        The response stays structured, but the content is broad enough to cover
        any material class without hard-coded domain-specific diagnostics.
        """
        property_lines = self._summarize_properties(prediction)
        target_lines = self._summarize_targets(structured, prediction)
        application_lines = self._suggest_applications(prediction, structured)
        synthesis_lines = self._summarize_synthesis_risk(structured, prediction)
        context_lines = self._summarize_context(structured, citations)

        return {
            "chemical_rationale": " ".join(context_lines + property_lines),
            "performance_delta": target_lines,
            "application_outlook": application_lines,
            "synthesis_notes": synthesis_lines,
            "confidence": f"{prediction.confidence:.2%}",
            "validity_status": "passed" if all(prediction.validity_flags.values()) else "failed",
        }

    def _summarize_context(self, structured: StructuredInput, citations: List[str]) -> List[str]:
        parts = [
            f"The material request is framed as a {structured.domain} design problem.",
            f"The representation mode is {structured.representation_type}, so the system balances structure, constraints, and target properties.",
        ]
        if structured.smiles:
            parts.append("A candidate molecular representation is available for downstream validation and refinement.")
        elif structured.graph_tokens:
            parts.append("The prompt was converted into graph-oriented tokens for structure reasoning.")
        else:
            parts.append("No explicit structure was provided, so the agent is inferring a candidate from the prompt and constraints.")

        if citations:
            parts.append("Reference context was retrieved to anchor the explanation in known materials heuristics.")
        return parts

    def _summarize_properties(self, prediction: PredictionResult) -> List[str]:
        props = prediction.predicted_properties or {}
        scores = prediction.scores or {}
        parts = []

        if props:
            dominant = sorted(props.items(), key=lambda item: item[1], reverse=True)[:2]
            top_text = ", ".join(f"{key}={value:.2f}" for key, value in dominant)
            parts.append(f"The predicted property profile is anchored by {top_text}, which drives the current assessment.")

        if scores:
            strongest = sorted(scores.items(), key=lambda item: item[1], reverse=True)[:2]
            score_text = ", ".join(f"{key}={value:.2f}" for key, value in strongest)
            parts.append(f"The scoring layer currently favors {score_text}, suggesting the design is better aligned with some targets than others.")

        if not parts:
            parts.append("The prediction layer does not expose enough detail to isolate a single dominant property trend, so the design is being treated as a general candidate.")

        return parts

    def _summarize_targets(self, structured: StructuredInput, prediction: PredictionResult) -> str:
        targets = structured.soft_targets or {}
        if not targets:
            return "No explicit target values were supplied, so the design is being judged against broad material-generation heuristics rather than a strict specification."

        predicted = prediction.predicted_properties or {}
        comparisons = []
        for key, target in targets.items():
            estimate = predicted.get(key)
            if estimate is None:
                comparisons.append(f"{key} was requested but is not directly estimated by the predictor.")
                continue
            gap = estimate - target
            if abs(gap) < 0.1:
                comparisons.append(f"{key} is close to target ({estimate:.2f} vs {target:.2f}).")
            elif gap > 0:
                comparisons.append(f"{key} is above target ({estimate:.2f} vs {target:.2f}), which may help performance but can trade off other properties.")
            else:
                comparisons.append(f"{key} is below target ({estimate:.2f} vs {target:.2f}), so the design likely needs further refinement.")

        return " ".join(comparisons)

    def _suggest_applications(self, prediction: PredictionResult, structured: StructuredInput) -> str:
        props = prediction.predicted_properties or {}
        scores = prediction.scores or {}
        stability = props.get("stability", 0.0)
        thermal = props.get("thermal_stability", 0.0)
        sustainability = scores.get("sustainability", 0.0)
        efficiency = scores.get("efficiency", 0.0)

        applications: List[str] = []
        if thermal >= 0.75 and stability >= 0.7:
            applications.append("High-temperature structural components")
        if sustainability >= 0.65:
            applications.append("Safer and more sustainable material platforms")
        if efficiency >= 0.65:
            applications.append("Performance-focused engineered materials")
        if structured.domain == "electrolyte" or thermal < 0.55:
            applications.append("Exploratory formulations that still need iteration before deployment")

        if not applications:
            applications.append("Early-stage research candidate with broad material-discovery potential")

        return "Potential use cases: " + "; ".join(applications[:3]) + "."

    def _summarize_synthesis_risk(self, structured: StructuredInput, prediction: PredictionResult) -> str:
        confidence = prediction.confidence
        if structured.synthesis_requested:
            synthesis_hint = "The request implies synthesis relevance, so the design should be checked for precursor availability and route feasibility."
        else:
            synthesis_hint = "Synthesis was not explicitly requested, but feasibility still matters for downstream translation."

        if confidence >= 0.8:
            risk = "The current candidate looks relatively mature, though final validation is still recommended."
        elif confidence >= 0.6:
            risk = "The candidate is plausible, but intermediate validation and refinement would be prudent."
        else:
            risk = "The candidate is still exploratory and should be treated as a low-confidence starting point."

        return f"{synthesis_hint} {risk}"

    def _friendly_scaffold_name(self, smiles: str | None, structured: StructuredInput | None = None) -> str:
        if smiles and smiles in self._smiles_to_name:
            return self._smiles_to_name[smiles]

        if structured and structured.domain == "polymer":
            if structured.smiles == "c1ccccc1":
                return "benzene-like aromatic scaffold"
            if structured.smiles == "CCO":
                return "alcohol-like chain scaffold"
            return "polymer scaffold"

        if structured and structured.domain == "electrolyte":
            return "electrolyte-compatible scaffold"

        if structured and structured.domain == "catalyst":
            return "catalyst scaffold"

        return "candidate scaffold"

    async def retrieve_context(self, structured: StructuredInput) -> List[str]:
        citations: List[str] = []
        for key in (structured.domain, "sustainability"):
            if key in self.knowledge_base:
                citations.append(f"KB:{key} -> {self.knowledge_base[key]}")
        return citations

    async def validate_and_enhance_smiles(self, smiles: str | None, normalized_goal: str) -> Tuple[str | None, Dict[str, Any]]:
        """
        Validate SMILES using PubChem and enrich with metadata.
        Returns (validated_smiles, pubchem_metadata).
        """
        if not smiles:
            return None, {}

        try:
            is_valid, details = await self.pubchem.validate_smiles_correctness(smiles)
            if is_valid:
                return details.get("canonical_smiles", smiles), details
            else:
                # Attempt correction
                suggestions = self.pubchem.suggest_corrections(smiles)
                for suggestion in suggestions:
                    is_valid, details = await self.pubchem.validate_smiles_correctness(suggestion)
                    if is_valid:
                        return details.get("canonical_smiles", suggestion), details
        except Exception:
            pass

        return smiles, {}

    async def answer_chat(self, message: str, context: Dict[str, Any]) -> Tuple[str, List[str]]:
        lower = message.lower()
        citations: List[str] = []
        source = str(context.get("source") or "")

        structured = context.get("structuredInput") or {}
        prediction = context.get("prediction") or {}
        selected_structure = context.get("selectedStructure") or {}
        design_summary = context.get("designSummary") or context.get("explanation") or ""

        goal = structured.get("normalized_goal") or "the requested material"
        domain = structured.get("domain") or "general"
        smiles = structured.get("smiles") or selected_structure.get("smiles") or "not specified"
        friendly_scaffold = self._friendly_scaffold_name(smiles, None if not structured else StructuredInput(
            normalized_goal=structured.get("normalized_goal") or "",
            domain=domain,
            representation_type=structured.get("representation_type") or "hybrid",
            smiles=structured.get("smiles"),
            graph_tokens=structured.get("graph_tokens") or [],
            hard_constraints=structured.get("hard_constraints") or {},
            soft_targets=structured.get("soft_targets") or {},
            rationale=structured.get("rationale") or "",
        ))

        predicted_properties = prediction.get("predicted_properties") or {}
        scores = prediction.get("scores") or {}
        validity_flags = prediction.get("validity_flags") or {}
        has_design_context = bool(structured or prediction or selected_structure)

        stability = predicted_properties.get("stability", 0.0)
        thermal_stability = predicted_properties.get("thermal_stability", 0.0)
        recyclability = scores.get("recyclability", 0.0)
        sustainability = scores.get("sustainability", 0.0)
        confidence = prediction.get("confidence", 0.0)
        accepted = all(validity_flags.values()) if validity_flags else False

        if not has_design_context:
            return self._answer_general_material_query(message), citations

        if source == "research_agent_chat":
            llm_context = {
                "goal": goal,
                "domain": domain,
                "question": message,
                "smiles": smiles,
                "structuredInput": structured,
                "selectedStructure": selected_structure,
                "predicted_properties": predicted_properties,
                "scores": scores,
                "validity_flags": validity_flags,
                "confidence": confidence,
                "design_summary": design_summary,
            }
            try:
                answer, mode = await self.groq.review_generated_molecule(message, llm_context)
                citations.append(mode)
                return answer, citations
            except Exception:
                # Fall back to deterministic logic if LLM call fails.
                pass

            if not has_design_context:
                return self._answer_general_material_query(message), citations

        if bool(context.get("llmReview")) and context:
            llm_context = {
                "goal": goal,
                "domain": domain,
                "smiles": smiles,
                "selectedStructure": selected_structure,
                "predicted_properties": predicted_properties,
                "scores": scores,
                "validity_flags": validity_flags,
                "confidence": confidence,
                "design_summary": design_summary,
            }
            try:
                answer, mode = await self.groq.review_generated_molecule(message, llm_context)
                citations.append(mode)
                return answer, citations
            except Exception:
                # Use a deterministic explanation when LLM review is unavailable.
                answer = (
                    f"Molecule review for {goal}: structure={smiles}, domain={domain}. "
                    f"Key properties: stability={stability:.2f}, thermal_stability={thermal_stability:.2f}, "
                    f"recyclability={recyclability:.2f}, sustainability={sustainability:.2f}, confidence={confidence:.2f}. "
                    f"Validity checks are {'passed' if accepted else 'not fully passed'}. "
                    f"Interpretation: prioritize improving weak metrics first, then re-run prediction to confirm trade-offs "
                    f"between stability and sustainability before selecting for downstream use."
                )
                return answer, citations

        if any(term in lower for term in ("thermal", "stability", "recycl")) and has_design_context:
            answer = (
                f"For {goal}, the design is balanced by comparing the predicted thermal stability and recyclability signals. "
                f"The current candidate uses a {friendly_scaffold} in the {domain} domain. "
                f"Predicted stability is {stability:.2f}, thermal stability is {thermal_stability:.2f}, recyclability is {recyclability:.2f}, "
                f"and sustainability is {sustainability:.2f}. Confidence is {confidence:.2f}. "
                f"The validity checks are {'passed' if accepted else 'not fully passed'}, so the design is {'chemically acceptable' if accepted else 'still needs refinement'} before being treated as final. "
                f"In practical terms, higher thermal stability usually comes from rigid or aromatic motifs, while recyclability improves when the scaffold avoids overly permanent crosslinking and can be broken down under mild conditions."
            )
        elif has_design_context:
            answer = (
                f"For {goal}, the current candidate structure is a {friendly_scaffold} in the {domain} domain. "
                f"Predicted stability is {stability:.2f}, thermal stability is {thermal_stability:.2f}, and overall sustainability is {sustainability:.2f}. "
                f"The model confidence is {confidence:.2f}, and the validity checks are {'passed' if accepted else 'not fully passed'}. "
                f"This means the candidate is {'reasonable' if accepted else 'not yet optimal'} based on the current generation and prediction loop."
            )
        else:
            answer = "I can help with material design, property prediction, and synthesis feasibility reasoning, but I need a generated design context first."

        if design_summary and design_summary != "No design run yet." and has_design_context:
            answer += f"\n\nDesign summary: {design_summary}"

        for key, text in self.knowledge_base.items():
            if key in lower:
                citations.append(f"KB:{key}")
                if key == "polymer":
                    answer += " High thermal stability polymers often benefit from aromatic backbones and restrained chain motion."
                elif key == "sustainability":
                    answer += " Sustainability improves when the scaffold avoids toxic or hard-to-recycle motifs."
                elif key == "electrolyte":
                    answer += " Electrolyte designs should also preserve ionic mobility while keeping flammability low."

        return answer, citations

    def _answer_general_material_query(self, message: str) -> str:
        lower = message.lower()

        if "polymer" in lower:
            return (
                "A polymer is a large molecule made of many repeating small units called monomers linked into long chains or networks. "
                "Polymers can be natural (like cellulose and proteins) or synthetic (like polyethylene and nylon). "
                "Their properties depend on chain length, monomer chemistry, branching, and cross-linking, which is why polymers can range "
                "from soft elastomers to rigid high-performance engineering materials."
            )

        if "electrolyte" in lower:
            return (
                "An electrolyte is a medium containing mobile ions that can carry ionic charge. In materials engineering, electrolytes are "
                "critical for batteries and electrochemical devices, where conductivity, electrochemical stability window, and safety are key metrics."
            )

        if "catalyst" in lower:
            return (
                "A catalyst is a material that increases reaction rate by lowering activation energy without being consumed overall. "
                "Catalyst performance is usually evaluated by activity, selectivity, stability, and resistance to deactivation."
            )

        if "crystal" in lower:
            return (
                "A crystal is a solid whose atoms are arranged in a periodic lattice. Crystal properties are strongly influenced by lattice symmetry, "
                "bonding environment, and defects, which affect electronic, thermal, and mechanical behavior."
            )

        return (
            "I can answer material-generation questions even without a current design run. "
            "Ask about concepts like polymers, catalysts, electrolytes, crystal structures, or property trade-offs, "
            "or run a design first for molecule-specific analysis."
        )
