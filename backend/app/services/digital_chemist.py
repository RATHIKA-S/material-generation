from typing import Dict

from app.schemas import PredictionResult, StructureCandidate, StructuredInput
from app.services.validation import validate_structure


class DigitalChemist:
    """Engine 2: Predictor + validator layer for generated candidates."""

    def evaluate(self, candidate: StructureCandidate, structured: StructuredInput, synthesis_requested: bool) -> PredictionResult:
        valid, flags, reasons = validate_structure(candidate)
        atom_count = len(candidate.atoms)
        unique_atoms = len(set(candidate.atoms))

        stability = max(0.0, min(1.0, 0.55 + (unique_atoms / max(atom_count, 1)) * 0.25))
        energy = max(0.0, 1.0 - stability + 0.08)
        reactivity = max(0.0, min(1.0, 0.25 + unique_atoms * 0.05))

        predicted = {
            "stability": round(stability, 4),
            "formation_energy": round(energy, 4),
            "reactivity": round(reactivity, 4),
            "thermal_stability": round(min(1.0, stability + 0.06), 4),
            "safety": round(max(0.0, 0.9 - reactivity * 0.4), 4),
        }

        soft_targets = structured.soft_targets or {}
        target_alignment = self._target_alignment(predicted, soft_targets)

        scores = {
            "recyclability": round(0.5 + 0.2 * ("O" in candidate.atoms), 4),
            "efficiency": round(0.4 + stability * 0.5, 4),
            "sustainability": round(0.45 + target_alignment * 0.45, 4),
            "overall": round((stability + target_alignment + (1.0 if valid else 0.2)) / 3.0, 4),
        }

        reaction_feasibility = None
        if synthesis_requested:
            # Placeholder for transformer-based synthesis model score.
            reaction_feasibility = round(max(0.0, min(1.0, 0.4 + stability * 0.4 - reactivity * 0.2)), 4)

        confidence = round(min(0.99, 0.45 + scores["overall"] * 0.45 + (0.08 if valid else 0.0)), 4)
        if not valid:
            reasons.append("Candidate failed one or more validity checks.")

        return PredictionResult(
            confidence=confidence,
            predicted_properties=predicted,
            reaction_feasibility=reaction_feasibility,
            scores=scores,
            validity_flags=flags,
            reasons=reasons,
        )

    def _target_alignment(self, predicted: Dict[str, float], targets: Dict[str, float]) -> float:
        if not targets:
            return 0.65

        diffs = []
        for key, target in targets.items():
            estimate = predicted.get(key, 0.5)
            diffs.append(abs(estimate - target))

        avg_diff = sum(diffs) / len(diffs)
        return max(0.0, min(1.0, 1.0 - avg_diff))
