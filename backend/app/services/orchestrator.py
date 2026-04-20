from app.config import RuntimeMetadata, settings
from app.schemas import DesignResponse, DiagnosticExplanation, IterationRecord, UserDesignRequest
from app.services.digital_chemist import DigitalChemist
from app.services.molecule_depiction import MoleculeDepictionService
from app.services.optimization import refine_constraints
from app.services.research_agent import ResearchAgent
from app.services.structure_architect import StructureArchitect


class GenMatOrchestrator:
    """Coordinates LLM refinement, structure generation, validation, and explanation."""

    def __init__(self) -> None:
        self.research_agent = ResearchAgent()
        self.architect = StructureArchitect()
        self.chemist = DigitalChemist()
        self.depictor = MoleculeDepictionService()

    async def run(self, request: UserDesignRequest) -> DesignResponse:
        structured, llm_mode = await self.research_agent.structure_prompt(request)

        iteration_records = []
        best_candidate = None
        best_prediction = None

        for i in range(1, settings.max_iterations + 1):
            if i == 1:
                candidate = self.architect.generate(structured, seed_hint=f"iter-{i}")
            else:
                pressure = min(1.0, i / settings.max_iterations)
                candidate = self.architect.apply_feedback(best_candidate, pressure=pressure)

            prediction = self.chemist.evaluate(candidate, structured, synthesis_requested=request.synthesis_requested)
            accepted = (
                prediction.confidence >= settings.min_acceptance_score
                and all(prediction.validity_flags.values())
            )

            iteration_records.append(
                IterationRecord(
                    iteration=i,
                    candidate_id=candidate.candidate_id,
                    confidence=prediction.confidence,
                    accepted=accepted,
                    reasons=prediction.reasons,
                )
            )

            if best_prediction is None or prediction.confidence > best_prediction.confidence:
                best_candidate = candidate
                best_prediction = prediction

            if accepted:
                break

            structured = refine_constraints(structured, prediction, i)

        citations = await self.research_agent.retrieve_context(structured)
        explanation_dict = self.research_agent.explain_design(structured, best_prediction, citations)
        explanation = DiagnosticExplanation(**explanation_dict)

        depiction_png, depiction_source = await self.depictor.render_structure_image_base64(
            smiles=structured.smiles or (best_candidate.smiles if best_candidate else None),
            atoms=(best_candidate.atoms if best_candidate else None),
            coordinates=(best_candidate.coordinates if best_candidate else None),
            bonds=(
                [bond.model_dump(by_alias=True) for bond in best_candidate.bonds]
                if best_candidate and best_candidate.bonds
                else None
            ),
        )
        if best_candidate:
            best_candidate.depiction_png_base64 = depiction_png
            best_candidate.depiction_source = depiction_source

        runtime = RuntimeMetadata(
            llm_mode=llm_mode,
            optimization_iterations=len(iteration_records),
        ).model_dump()

        return DesignResponse(
            structured_input=structured,
            selected_structure=best_candidate,
            prediction=best_prediction,
            explanation=explanation,
            iterations=iteration_records,
            runtime=runtime,
        )
