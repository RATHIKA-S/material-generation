# MatGenAI: An AI-Driven Multi-Engine Framework for Intelligent Material Design and Property Optimization

## I INTRODUCTION

MatGenAI is designed as an intelligent framework for computational material design where generation, scientific evaluation, and research interpretation are handled by three dedicated engines working in sequence. The core challenge in modern material discovery is not just creating a candidate molecular structure, but creating one that is scientifically meaningful, measurable against target properties, and usable in an engineering workflow. This project addresses that challenge by combining model-based generation, evaluation matrices, and an interactive reasoning layer into a unified system with a dashboard-first user experience.

The system is built for practical research and rapid experimentation. A user can provide a design goal, constraints, and target properties, then receive generated structures, quantified property predictions, and interpretable analysis. The project also supports experiment traceability through a dedicated page for saving experiment outputs, which allows iterative comparison and reproducibility.

In conventional workflows, design decisions are often delayed because exploratory generation, evaluation scripts, and interpretation tools are handled in separate environments. MatGenAI reduces this process overhead by providing a single coordinated lifecycle: capture intent, generate candidate, evaluate performance, interpret implications, and preserve evidence. This reduces context switching for researchers and improves confidence in design decisions because each output can be traced to a specific input condition and iteration stage.

The framework is also intended to support both learning and production-like usage. For new users, the dashboard presents guided stages and clear metrics; for advanced users, the platform provides structured outputs suitable for further analysis pipelines, comparative studies, and documentation. This dual usability model makes the project suitable for final-year project presentation, prototype validation, and future research extension.

### 1.1 PROBLEM DEFINITION

Material scientists and engineers often face a fragmented workflow where structure generation, property screening, and expert interpretation happen in disconnected tools. This creates delays, inconsistent formats, and weak traceability across design iterations. In addition, many generated structures from generic systems are not directly aligned with practical property requirements such as thermal stability, sustainability, safety, or manufacturability. A second challenge is that existing systems may produce outputs that are difficult for users to interpret in terms of design trade-offs and deployment value.

The project defines the problem as an end-to-end computational design gap: there is a need for a single framework that can generate material candidates from objective-driven inputs, validate and score them using evaluation matrices, and provide a research-assistant experience for understanding results and next steps. The framework must support domain flexibility across crystals, polymers, electrolytes, catalysts, and general material classes.

Another critical problem is reproducibility. In many experimental software stacks, a candidate may look promising in one run but cannot be reliably reconstructed later because parameter history, scoring context, and rationale were not preserved together. MatGenAI addresses this by preserving iteration details and connecting them to analysis output, so users can revisit not only what was generated, but why it was selected and how it compared against alternatives.

Finally, the project targets the communication gap between numerical outputs and engineering decisions. Raw metrics such as stability scores alone are insufficient for deployment choices. By integrating an analysis engine with experimental tracking, the platform converts metrics into a decision-support narrative that is easier to review in technical reports and design reviews.

### 1.2 PROJECT OBJECTIVE

The primary objective is to build a multi-engine material design platform that transforms user intent into scientifically evaluated candidate materials. The first objective is intelligent generation, where candidate structures are produced using trained models and validated data sources. The second objective is quantitative evaluation, where each candidate is assessed through molecular and multi-objective scoring metrics. The third objective is research assistance, where users can ask context-specific questions and receive actionable explanations via conversational interaction.

A parallel objective is usability for technical workflows: the system must provide a professional dashboard interface, clear status and results views, and experiment persistence through a saved experiments page. Another objective is engineering reliability, ensuring the platform supports repeatable analysis cycles, confidence-aware reporting, and compatibility with API-driven deployment.

An additional objective is modular extensibility. Each engine should be independently improvable without requiring full-system redesign. This means model updates in Engine 1, scoring refinements in Engine 2, and conversational upgrades in Engine 3 can be delivered incrementally while maintaining a stable orchestrated workflow. This is important for research settings where algorithms evolve over time.

The project also aims to support objective-driven optimization rather than one-shot prediction. Instead of treating generation as a final endpoint, the system is designed for iterative convergence toward design targets using feedback from evaluation metrics. This objective aligns with practical material development where refinement cycles are essential.

### 1.3 SCOPE

The project scope includes end-to-end material design flow from input prompt to generated structure, property prediction, analytical interpretation, and experiment storage. It includes backend services for orchestration, molecular generation, scoring, and chat support, and frontend modules for interactive design, result visualization, and research query handling.

Engine 1 scope covers model-based and dataset-driven material generation using Materials Project API, QM9, and PubChem API integrations, along with trained models including models/full_qm9_v3.h5 and CHGNet-based modeling assets for structure-informed prediction workflows. Engine 2 scope covers evaluation matrices and scientific validation logic for candidate ranking and feasibility interpretation. Engine 3 scope covers natural-language research interaction using Groq API for chatbot reasoning. Out of scope are wet-lab execution automation, full synthesis route automation at industrial scale, and direct laboratory instrument integration.

The scope also includes operational concerns such as API request handling, response schema consistency, dashboard-based progress visibility, and experiment-level result persistence. It includes tracking of run-time metadata required for reporting and comparative analysis. This ensures the platform is not limited to isolated demos but can serve as a repeatable computational experiment framework.

The scope intentionally excludes full enterprise concerns such as multi-tenant identity management, cross-lab governance policy enforcement, and regulated production qualification processes. Those areas can be integrated in future phases after algorithmic and workflow maturity is demonstrated.

## II SYSTEM ANALYSIS

### 2.1 SYSTEM DESCRIPTION

MatGenAI is a modular, service-oriented application composed of a Python backend and a React-based frontend dashboard. The backend provides API endpoints for design generation and research chat interactions. The frontend provides an integrated workspace with distinct sections for structure generation, evaluation insights, research discussion, and experiment tracking.

The operational flow begins when the user submits a design intent. The system structures the input into normalized constraints and target signals, then Engine 1 generates candidate structures. Engine 2 evaluates each candidate with validity checks and scoring matrices. Engine 3 provides interactive analysis in natural language to support decision-making. The user can review outputs visually and store valuable runs in the saved experiments page for future comparison.

Internally, the system emphasizes explicit hand-off contracts between engines. Engine 1 outputs structured molecular candidates and metadata. Engine 2 consumes these outputs and produces confidence-linked evaluation vectors, including objective alignment and validity indicators. Engine 3 consumes both contextual input and evaluated state to answer scientific queries and communicate implications. This explicit contract design reduces hidden coupling and simplifies maintenance.

The description also includes user interaction behavior. Users can either run complete generation-evaluation-analysis sequences or inspect stages independently through dashboard views. This stage-based transparency is useful for identifying whether issues come from generation quality, evaluation thresholds, or interpretation depth.

### 2.2 SOFTWARE REQUIREMENTS SPECIFICATION

The software stack includes Python-based backend services, REST APIs, and a frontend dashboard built with React and Vite. Scientific computing requirements include molecular structure handling, property estimation logic, and data exchange with Materials Project API, QM9-derived model artifacts, and PubChem API metadata services. The system also requires a conversational inference service for Engine 3 via Groq API.

Functional requirements include design submission, candidate generation, evaluation reporting, chat-based assistant interaction, and experiment saving. Non-functional requirements include responsiveness, modular maintainability, reproducibility of iterations, and clear interpretability of outputs. Reliability requirements include robust error handling for external API dependencies, deterministic handling of iteration states, and consistent response schema across design and chat endpoints.

Performance-oriented requirements include low-latency interaction for common operations such as design submission and chat response under typical development workload. Compatibility requirements include stable behavior across local development environments and deployment hosts. Observability requirements include health checks, structured logging, and enough runtime metadata to diagnose incomplete runs and recover failed experiment records.

Data requirements include structured storage of prompts, domain context, selected candidate summaries, prediction vectors, and explanatory output. Security-related requirements include controlled handling of API keys and environment variables, along with transport-level protections in deployed environments.

### 2.3 USE CASE MODEL

The primary actor is a researcher or materials engineer. The actor submits material objectives such as property targets and constraints, then receives candidate structure outputs with evaluation scores and confidence indicators. The actor can ask follow-up questions in the research panel to understand design rationale, trade-offs, and safety considerations. The actor can then save promising runs in the experiment section.

Secondary use cases include iterative tuning, where the user modifies constraints after viewing evaluation metrics, and comparative analysis, where saved experiment records are used to choose the best candidate for downstream modeling or synthesis planning. The system supports a closed-loop use case where generation, evaluation, and interpretation are repeatedly executed until acceptance thresholds are achieved.

Another practical use case is evidence-oriented reporting. Users can assemble results from multiple runs and build a narrative for why a final candidate was selected. This is valuable for academic submissions, technical presentations, and supervisor reviews. The saved experiments feature supports this by enabling quick retrieval of prior configurations and outcomes.

The model also supports scenario-based what-if analysis. A user can intentionally alter one constraint or target property and observe how candidate selection and scoring behavior change. This allows sensitivity analysis and improves understanding of property trade-offs before further computational or laboratory commitment.

### 2.4 PROJECT MODULE

The project is organized into three engines and supporting interface modules.

Engine 1 is the material generation module and is explicitly model-based and dataset-driven. It uses Materials Project API, QM9 knowledge representation, and PubChem API validation context. It is supported by trained model assets such as models/full_qm9_v3.h5 and CHGNet-based modeling, enabling candidate generation aligned with input constraints.

Engine 2 is the Digital Chemist module and functions as an evaluation matrix core. It performs molecular property assessment, validity flag checks, scoring of multiple objectives, and confidence estimation. It converts raw generated outputs into decision-ready scientific metrics.

Engine 3 is the Research Agent module. It uses Groq API for natural-language interaction, allowing users to ask scientific queries about generated materials, interpretation of scores, implications of constraints, and practical reasoning for iterative refinement.

Supporting modules include the dashboard workspace, visualization views for structures and results, and a saved experiments page for persistent experiment management.

From a system perspective, each module has clear responsibility boundaries. The orchestration module controls sequence and state transitions. The generation module produces candidate structures and representations. The Digital Chemist module computes evaluation matrices and validity checks. The Research Agent module transforms technical state into interactive scientific reasoning. The frontend modules provide input capture, status visibility, and historical comparison views. This modular design supports targeted testing and independent iteration.

The project module definition also supports future extensibility. New model variants can be added to Engine 1, domain-specific evaluation dimensions can be added to Engine 2, and specialized scientific prompting templates can be layered into Engine 3 without changing the high-level user workflow.

### 2.5 TEST PLAN

Testing is planned across unit, integration, API, and UI layers. Engine 1 tests verify that structured inputs produce valid candidate payloads with expected molecular fields, iterative IDs, and constraints propagation. Engine 2 tests verify metric correctness, score bounds, validity flag integrity, and acceptance threshold behavior under different candidate profiles. Engine 3 tests verify contextual chat response quality, schema conformance, and stability under varying context payload sizes.

Integration tests validate full workflow execution from design request through result delivery and follow-up chat. API tests confirm endpoint reliability, status code correctness, and graceful failure behavior. Frontend tests verify user actions such as generation submission, query interaction, and saved experiment actions. Regression testing is required whenever model assets, scoring rules, or response schemas are modified.

The test plan should also include edge-case and stress-oriented scenarios. Examples include unusually long prompts, sparse constraints, conflicting target properties, and temporary external API unavailability. These cases validate resilience and user-facing error clarity. The plan should define acceptance criteria not only for correctness, but for response interpretability and workflow continuity.

For project documentation quality, each test cycle should produce structured evidence: screenshots for UI verification, payload-response logs for API verification, and metric snapshots for evaluation consistency. This evidence strengthens review credibility and simplifies troubleshooting during final demonstration.

## III SYSTEM DESIGN

### 3.1 ARCHITECTURAL DESIGN

The architecture follows a layered design. The presentation layer is the React dashboard, which handles user interaction, workflow navigation, and result presentation. The application layer is the backend orchestrator and service modules that coordinate generation, evaluation, and chat responses. The data layer includes external scientific APIs and local model artifacts.

The orchestrator acts as the control hub. It receives normalized input, invokes Engine 1 for candidate generation, passes candidates to Engine 2 for evaluation, and then provides context to Engine 3 for conversational analysis. This separation ensures each engine remains specialized while still supporting end-to-end delivery in one user transaction.

Architecturally, this is a pipeline with bounded stages and shared context contracts. The advantage of this design is that failures are easier to localize and improvements are easier to deploy. If generation quality needs tuning, changes stay within Engine 1. If ranking quality needs refinement, changes stay within Engine 2. If interpretation style needs improvement, changes are isolated to Engine 3. This isolation supports clean release management and safer evolution.

The design also supports horizontal growth in future versions. Additional engines, such as synthesis route planners or uncertainty quantification modules, can be attached to the orchestration pipeline as downstream stages while preserving existing API structures.

### 3.2 BEHAVIOURAL DESIGN

System behavior is event-driven and stateful per user interaction. On design submission, the platform enters generation state, then transitions to evaluation state, and finally to analysis-ready state. If a candidate does not satisfy acceptance conditions, iterative refinement occurs and the cycle continues until threshold criteria are met or configured iteration limits are reached.

In chat behavior, each user query is appended to conversation state and answered using the latest design context, including structured inputs, predictions, and selected structure details. The saved experiments workflow captures a completed state snapshot so users can return to a previous run without regenerating from scratch. This behavior supports transparency, reproducibility, and controlled iterative research.

Behavioral design also includes state transition discipline. The system explicitly tracks generation loading, evaluation readiness, and analysis availability so that user actions are aligned with current process stage. This prevents ambiguous UI behavior and improves trust because users can clearly see what the platform is currently doing.

In iterative cycles, feedback-driven refinement is central. When acceptance conditions are not satisfied, the next iteration is informed by prior evaluation output rather than random restart. This creates a directional optimization behavior where each cycle attempts to move closer to constraints and target goals.

### 3.3 TABLE DESIGN

The table design for experiment persistence is centered on traceability and retrieval. A core Experiments table stores experiment ID, timestamp, user identifier, design prompt, domain, and status fields. A CandidateResults table stores selected structure attributes such as smiles, atom counts, coordinate summaries, and validity flags. A PredictionMetrics table stores confidence, predicted properties, and composite scores from Engine 2.

A ResearchLogs table stores user query text, assistant responses, and context references used for each conversation event. A RuntimeMetadata table stores llm_mode metadata for engine operation logs, optimization iteration count, and execution diagnostics. The schema is intentionally normalized enough for comparison and analytics while preserving direct reconstruction of key result views in the dashboard.

The table design should also support audit fields such as created_at, updated_at, run_status, and optional reviewer_notes for collaborative environments. Indexing strategy should prioritize experiment_id, timestamp, and domain fields to optimize retrieval for timeline views and comparative analysis queries.

For long-term scalability, partitioning strategy can be applied on experiment date ranges, and archival policies can move old research logs into cold storage while preserving summary-level metrics in active tables. This keeps operational queries responsive without losing historical experiment intelligence.

## IV IMPLEMENTATION

### 4.1 PSEUDOCODE

The implementation follows a deterministic orchestrated flow:

```text
INPUT: user_prompt, domain, constraints, target_properties

BEGIN
  structured_input = normalize_and_structure(user_prompt, domain, constraints, target_properties)

  FOR iteration in 1..max_iterations:
      candidate = Engine1.generate(structured_input, iteration)
      prediction = Engine2.evaluate(candidate, structured_input)

      record_iteration(iteration, candidate, prediction)

      IF prediction.confidence >= acceptance_threshold AND validity_flags_all_true(prediction):
          selected_candidate = candidate
          selected_prediction = prediction
          BREAK
      ELSE
          structured_input = refine_constraints(structured_input, prediction, iteration)

  context = Engine3.retrieve_context(structured_input)
  explanation = Engine3.explain(structured_input, selected_prediction, context)

  save_runtime_metadata()
  RETURN final_response(structured_input, selected_candidate, selected_prediction, explanation, iteration_log)
END
```

This pseudocode reflects how model-based generation, evaluation matrix scoring, and conversational explanation are linked into one execution chain.

Implementation-wise, this flow is designed to be deterministic at orchestration level even when model internals are probabilistic. The system ensures every cycle captures candidate IDs, evaluation outputs, and iteration reasons. This allows reproducible analysis of why one candidate was selected over another.

The pseudocode can be extended with optional hooks for persistence and analytics at each iteration boundary. For example, after each evaluation call, the system may store score vectors and validation flags, enabling later plotting of optimization trajectory across iterations.

### 4.2 USER INTERFACE DESIGN

The user interface is built as a multi-panel dashboard with engine-oriented navigation. The Structure section captures user goals and constraints, triggers generation, and displays candidate outputs. The Digital Chemist section presents prediction and scoring summaries, enabling users to understand objective alignment and validity status. The Research Agent section provides chat-based scientific interaction for deeper interpretation and decision support.

The interface includes dynamic workflow indicators, status feedback, and clear separation between input, processing, and result visualization. A saved experiments page supports reuse and comparison of historical runs, improving experiment continuity and reporting quality. The UI design emphasizes readability for technical users, short interaction paths, and immediate insight delivery after each engine step.

A strong UI principle in this project is progressive disclosure: users first see high-value summaries, then can drill down into detailed metrics, molecular views, and discussion context. This helps both beginner and expert users by avoiding information overload while still preserving depth.

The design also supports human-in-the-loop practice. By exposing results in explainable panels and allowing immediate follow-up queries, the interface becomes a collaborative scientific workspace rather than a static prediction screen.

## V SYSTEM TESTING

### 5.1 TEST CASES AND REPORTS

Test cases are structured around generation correctness, evaluation integrity, and interaction reliability. Representative cases include valid design prompt processing, constraint-heavy prompt handling, low-confidence candidate rejection, and successful acceptance flow after iterative refinement. Additional cases include chat queries with and without prior design context, API timeout simulation for external dependencies, and UI actions for experiment persistence.

Reports should capture test ID, test objective, input conditions, expected outcome, observed outcome, and pass or fail status. For Engine 1, reports track candidate validity and schema completeness. For Engine 2, reports track score ranges, consistency of validity flags, and confidence behavior. For Engine 3, reports track response completeness and relevance. Combined reports provide deployment-readiness evidence and help monitor model quality drift.

Testing reports should additionally include defect classification and resolution notes. Each failed case should map to root cause category such as data formatting, model output inconsistency, scoring threshold mismatch, API dependency failure, or UI state regression. This classification enables focused corrective action and more efficient retest planning.

A recommended reporting format is test matrix plus narrative summary. The matrix captures objective pass/fail data, while the narrative explains major findings, risk level, and mitigation actions before release approval.

## VI SYSTEM DEPLOYMENT

Deployment is structured for local development and service-hosted execution. The backend is deployed as an API service with environment-based configuration for model paths, external API credentials, and runtime thresholds. The frontend is deployed as a static build artifact served through standard web hosting. Configuration management ensures consistent endpoint mapping and secure secret handling.

Operational deployment includes health endpoints, logging, and runtime metadata capture for observability. For production-grade use, recommended additions include reverse-proxy routing, TLS, centralized logs, and autoscaling policies for inference-heavy workloads. The modular engine architecture allows independent upgrades of generation models, evaluation rules, and chat service integration without rewriting the full platform.

Deployment readiness also depends on configuration discipline. Environment variables for API credentials, model file paths, and threshold tuning must be separated by environment (development, staging, production) to reduce runtime misconfiguration risk. Versioned build artifacts and tagged model releases are recommended to keep software and model states synchronized.

For reliability in continuous operation, backup and recovery procedures should be documented for experiment records and runtime metadata stores. This ensures that system-level failures do not result in permanent loss of research evidence.

## VII CONCLUSION

MatGenAI demonstrates a practical and extensible approach to intelligent material design by combining model-based generation, scientific evaluation matrices, and conversational research support into one framework. The project transforms a fragmented experimental process into a coherent computational pipeline where candidate generation, property optimization, and interpretation are tightly integrated.

Engine 1 contributes dataset-driven and model-based generation using Materials Project API, QM9 context, PubChem API references, and trained model assets such as models/full_qm9_v3.h5 and CHGNet-based modeling. Engine 2 contributes evaluation rigor through multi-objective scoring and validation-oriented metrics. Engine 3 contributes natural-language reasoning via Groq API for human-centered analysis. Together with the dashboard and saved experiments workflow, the framework supports faster iteration, better decision quality, and stronger reproducibility for material discovery tasks.

The key project contribution is not only technical integration but workflow integration. By combining generation, evaluation, and conversational analysis in one platform, MatGenAI shortens the path from design intent to defensible decision. The presence of saved experiment tracking further improves evidence quality for reviews and presentations.

Overall, the framework establishes a strong foundation for future extensions such as richer domain-specific scoring matrices, advanced uncertainty estimation, and broader dataset/model integration. The current implementation already demonstrates meaningful value for intelligent material design and property optimization, while remaining extensible for research growth.

---

## Engine Summary for Presentation

Engine 1: Model-based generation, dataset-driven design, hybrid generation flow.

Engine 2: Evaluation matrix core, multi-objective scoring, scientific validation.

Engine 3: LLM-powered chat layer (Groq API), NLP interaction, reasoning support.
