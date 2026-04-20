from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


DomainType = Literal["crystal", "mof", "polymer", "catalyst", "electrolyte", "general"]
RepresentationType = Literal["smiles", "graph", "constraints", "hybrid"]


class UserDesignRequest(BaseModel):
    prompt: str = Field(min_length=3, description="Natural language description of target material")
    domain: DomainType = "general"
    target_properties: Dict[str, float] = Field(default_factory=dict)
    constraints: Dict[str, Any] = Field(default_factory=dict)
    synthesis_requested: bool = False


class StructuredInput(BaseModel):
    normalized_goal: str
    domain: DomainType
    representation_type: RepresentationType
    smiles: Optional[str] = None
    graph_tokens: List[str] = Field(default_factory=list)
    hard_constraints: Dict[str, Any] = Field(default_factory=dict)
    soft_targets: Dict[str, float] = Field(default_factory=dict)
    synthesis_requested: bool = False
    rationale: str


class Atom3D(BaseModel):
    id: int
    element: str
    x: float
    y: float
    z: float
    bonds_used: int = 0
    max_valency: int = 0


class BondRecord(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_atom: int = Field(alias="from")
    to_atom: int = Field(alias="to")
    order: int = Field(ge=1, le=3)


class MoleculeValidation(BaseModel):
    valency_ok: bool = False
    geometry_ok: bool = False
    pubchem_match: Optional[bool] = None
    confidence: Literal["high", "medium", "low"] = "low"


class StructureCandidate(BaseModel):
    candidate_id: str
    representation_type: RepresentationType
    xyz: str
    cif: Optional[str] = None
    smiles: Optional[str] = None
    depiction_png_base64: Optional[str] = None
    depiction_source: Optional[str] = None
    atoms: List[str]
    coordinates: List[List[float]]
    atoms_3d: List[Atom3D] = Field(default_factory=list)
    bonds: List[BondRecord] = Field(default_factory=list)
    aromatic_atom_ids: List[int] = Field(default_factory=list)
    validation: MoleculeValidation = Field(default_factory=MoleculeValidation)
    validity_notes: List[str] = Field(default_factory=list)


class PredictionResult(BaseModel):
    confidence: float
    predicted_properties: Dict[str, float]
    reaction_feasibility: Optional[float] = None
    scores: Dict[str, float]
    validity_flags: Dict[str, bool]
    reasons: List[str] = Field(default_factory=list)


class IterationRecord(BaseModel):
    iteration: int
    candidate_id: str
    confidence: float
    accepted: bool
    reasons: List[str] = Field(default_factory=list)


class DiagnosticExplanation(BaseModel):
    """Structured diagnostic analysis of designed material."""
    chemical_rationale: str = Field(description="Why the molecule behaves this way")
    performance_delta: str = Field(description="Target vs result comparison")
    application_outlook: str = Field(description="Real-world application suggestions")
    synthesis_notes: str = Field(description="Likely synthesis method and risks")
    confidence: str = Field(description="Confidence level as percentage")
    validity_status: str = Field(description="passed or failed validity checks")


class DesignResponse(BaseModel):
    structured_input: StructuredInput
    selected_structure: StructureCandidate
    prediction: PredictionResult
    explanation: DiagnosticExplanation
    iterations: List[IterationRecord]
    runtime: Dict[str, Any]


class ChatRequest(BaseModel):
    message: str = Field(min_length=2)
    context: Dict[str, Any] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    answer: str
    citations: List[str] = Field(default_factory=list)
