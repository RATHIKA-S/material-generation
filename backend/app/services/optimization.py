from copy import deepcopy

from app.schemas import PredictionResult, StructuredInput


def refine_constraints(structured: StructuredInput, prediction: PredictionResult, iteration: int) -> StructuredInput:
    updated = deepcopy(structured)

    if prediction.predicted_properties.get("stability", 0.0) < 0.65:
        updated.hard_constraints["packing_density"] = "increase"
        updated.soft_targets["stability"] = max(updated.soft_targets.get("stability", 0.7), 0.75)

    if prediction.scores.get("sustainability", 0.0) < 0.6:
        updated.hard_constraints["green_precursors"] = True
        updated.soft_targets["recyclability"] = max(updated.soft_targets.get("recyclability", 0.7), 0.78)

    updated.rationale = (
        f"Refined after iteration {iteration}: boosted stability/sustainability constraints "
        "using predictor feedback."
    )
    return updated
