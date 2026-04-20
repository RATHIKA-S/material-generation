import { useEffect, useMemo, useState } from "react";
import { chatAssistant, designMaterial } from "./api";
import StructureViewer3D from "./components/StructureViewer3D";

const SIDEBAR_ITEMS = [
  { id: "structure", icon: "🧠", label: "Structure Architect" },
  { id: "chemist", icon: "⚗️", label: "Digital Chemist" },
  { id: "research", icon: "🤖", label: "Research Agent" },
  { id: "experiments", icon: "📊", label: "Experiments" },
  { id: "saved", icon: "📁", label: "Saved Designs" },
];

const TOP_TABS = ["Tasks", "Results", "Logs"];
const ENGINE_TABS = ["Property Prediction", "Reaction Outcome", "Retrosynthesis"];
const MATERIAL_TYPES = ["Crystal", "MOF", "Electrolyte", "Polymer"];

const DEFAULT_GENERATION = {
  materialType: "Crystal",
  bandgap: 2.4,
  density: 3.8,
  stability: 0.86,
};

const SAMPLE_DATASETS = [
  { id: "exp-104", name: "Aromatic polymer scaffold", bandgap: 2.1, stability: 0.91, version: "v3.2" },
  { id: "exp-108", name: "Li-rich electrolyte lattice", bandgap: 4.8, stability: 0.79, version: "v1.8" },
  { id: "exp-113", name: "Porous MOF catalyst", bandgap: 1.4, stability: 0.88, version: "v2.1" },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatScore(value) {
  return Number(value || 0).toFixed(2);
}

function formatCount(value) {
  return String(value).padStart(2, "0");
}

function formatExplanation(explanation) {
  if (!explanation) {
    return "No design run yet.";
  }
  if (typeof explanation === "string") {
    return explanation;
  }
  if (typeof explanation === "object") {
    const parts = [];
    if (explanation.chemical_rationale) {
      parts.push(`Chemical rationale: ${explanation.chemical_rationale}`);
    }
    if (explanation.performance_delta) {
      parts.push(`Performance delta: ${explanation.performance_delta}`);
    }
    if (explanation.application_outlook) {
      parts.push(`Application outlook: ${explanation.application_outlook}`);
    }
    if (explanation.synthesis_notes) {
      parts.push(`Synthesis notes: ${explanation.synthesis_notes}`);
    }
    if (explanation.confidence) {
      parts.push(`Confidence: ${explanation.confidence}`);
    }
    if (explanation.validity_status) {
      parts.push(`Validity: ${explanation.validity_status}`);
    }
    return parts.join("\n\n") || "No design run yet.";
  }
  return String(explanation);
}

function downloadTextFile(filename, content, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  window.URL.revokeObjectURL(url);
}

function useAnimatedParticles() {
  return useMemo(
    () =>
      Array.from({ length: 22 }, (_, index) => ({
        id: index,
        size: 4 + (index % 5) * 3,
        top: (index * 9) % 96,
        left: (index * 13) % 96,
        delay: `${(index % 7) * 0.6}s`,
        duration: `${14 + (index % 6) * 2}s`,
      })),
    []
  );
}

function ParticleField() {
  const particles = useAnimatedParticles();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="absolute rounded-full bg-cyan-300/25 blur-sm animate-float"
          style={{
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            top: `${particle.top}%`,
            left: `${particle.left}%`,
            animationDelay: particle.delay,
            animationDuration: particle.duration,
          }}
        />
      ))}
    </div>
  );
}

function StatCard({ label, value, accent = "text-cyan-300" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.35)] backdrop-blur-xl">
      <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

function MiniSparkline({ values, stroke = "#22d3ee" }) {
  const width = 220;
  const height = 78;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.001);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / span) * (height - 12) - 6;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[78px] w-full">
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" points={points} />
      <polygon fill="url(#spark-fill)" points={`${points} ${width},${height} 0,${height}`} />
    </svg>
  );
}

function PipelineStepper({ active }) {
  const steps = ["Generate", "Predict", "Analyze"];

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-3">
      {steps.map((step, index) => {
        const isActive = index === active;
        const isComplete = index < active;
        return (
          <div key={step} className="flex items-center gap-3">
            <div
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] ${
                isActive
                  ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-200 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
                  : isComplete
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                    : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              {step}
            </div>
            {index < steps.length - 1 ? <span className="h-px w-8 bg-white/15" /> : null}
          </div>
        );
      })}
    </div>
  );
}

function WorkflowChip({ title, subtitle, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 ${
        active ? "border-cyan-400/50 bg-cyan-400/10" : "border-white/10 bg-white/5"
      }`}
    >
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-1 text-xs leading-5 text-slate-400">{subtitle}</div>
    </button>
  );
}

function DiagramArrow() {
  return <div className="hidden h-px flex-1 rounded-full bg-white/15" />;
}

function PropertyBar({ label, value, accent = "from-cyan-400 to-emerald-400" }) {
  const percent = clamp(value * 100, 6, 100);
  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-semibold text-white">{formatScore(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-white/5">
        <div className={`h-2 rounded-full bg-gradient-to-r ${accent}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function FlowNode({ label, color }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center shadow-lg shadow-black/15">
      <div className={`text-xs uppercase tracking-[0.28em] ${color}`}>{label}</div>
    </div>
  );
}

function SequenceTimeline({ items }) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={item.title} className="flex gap-3">
          <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-cyan-200">
            {index + 1}
          </div>
          <div className="flex-1 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <div className="font-semibold text-white">{item.title}</div>
            <div className="mt-1 text-sm leading-6 text-slate-400">{item.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MoleculeDrawingCanvas() {
  const [strokes, setStrokes] = useState([]);
  const [currentStroke, setCurrentStroke] = useState(null);

  const getPoint = (event) => {
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const clientX = event.clientX ?? event.touches?.[0]?.clientX ?? 0;
    const clientY = event.clientY ?? event.touches?.[0]?.clientY ?? 0;
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x: clamp(x, 0, 100), y: clamp(y, 0, 100) };
  };

  const startDraw = (event) => {
    event.preventDefault();
    const point = getPoint(event);
    setCurrentStroke([point]);
  };

  const draw = (event) => {
    if (!currentStroke) {
      return;
    }
    event.preventDefault();
    const point = getPoint(event);
    setCurrentStroke((prev) => (prev ? [...prev, point] : [point]));
  };

  const endDraw = () => {
    if (!currentStroke || currentStroke.length < 2) {
      setCurrentStroke(null);
      return;
    }
    setStrokes((prev) => [...prev, currentStroke]);
    setCurrentStroke(null);
  };

  const toPath = (stroke) =>
    stroke
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");

  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Optional drawing canvas</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStrokes((prev) => prev.slice(0, -1))}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-200"
            disabled={!strokes.length}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => {
              setStrokes([]);
              setCurrentStroke(null);
            }}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-200"
            disabled={!strokes.length && !currentStroke}
          >
            Clear
          </button>
        </div>
      </div>

      <svg
        viewBox="0 0 100 100"
        className="h-40 w-full rounded-2xl border border-white/10 bg-slate-950/75 touch-none"
        onPointerDown={startDraw}
        onPointerMove={draw}
        onPointerUp={endDraw}
        onPointerLeave={endDraw}
      >
        <rect x="0" y="0" width="100" height="100" rx="6" fill="transparent" />
        {strokes.map((stroke, index) => (
          <path
            key={`stroke-${index}`}
            d={toPath(stroke)}
            fill="none"
            stroke="#67e8f9"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.4"
          />
        ))}
        {currentStroke ? (
          <path
            d={toPath(currentStroke)}
            fill="none"
            stroke="#a78bfa"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.4"
          />
        ) : null}
        {!strokes.length && !currentStroke ? (
          <text x="50" y="52" textAnchor="middle" fill="#94a3b8" fontSize="6">
            Draw a molecule here
          </text>
        ) : null}
      </svg>
    </div>
  );
}

function Sidebar({ activeEngine, setActiveEngine }) {
  return (
    <aside className="glass-panel flex h-full flex-col gap-6 border-white/10 bg-slate-950/65 p-4">
      <div>
        <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-200">
          Autonomous Material Discovery System
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">MatGenAI</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Scientific lab OS for generative materials, reaction prediction, and AI-assisted research.
        </p>
      </div>

      <nav className="space-y-2">
        {SIDEBAR_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveEngine(item.id)}
            className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition hover:border-cyan-400/35 hover:bg-cyan-400/8 ${
              activeEngine === item.id ? "border-cyan-400/40 bg-cyan-400/10 text-white" : "border-white/10 bg-white/5 text-slate-300"
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-cyan-400/10 p-4">
        <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Lab Status</div>
        <div className="mt-2 text-lg font-semibold text-emerald-300">Online</div>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Generate candidates, predict properties, then analyze results without leaving the dashboard.
        </p>
      </div>
    </aside>
  );
}

function Header({ activeTopTab, setActiveTopTab, result, engineLabel }) {
  return (
    <header className="glass-panel flex flex-col gap-4 border-white/10 bg-white/5 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="flex flex-wrap gap-2">
          <span className="badge border-cyan-400/20 bg-cyan-400/10 text-cyan-100">Lab Dashboard</span>
          <span className="badge border-violet-400/20 bg-violet-400/10 text-violet-100">GPU-Ready UI</span>
          <span className="badge border-emerald-400/20 bg-emerald-400/10 text-emerald-100">Multi-engine Workflow</span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          MatGenAI: An AI-Driven Multi-Engine Framework for Intelligent Material Design and Property Optimization
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          Futuristic AI-powered scientific platform for structure generation, predictive chemistry, and RAG-guided research.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {TOP_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTopTab(tab)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                activeTopTab === tab ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/5 text-slate-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-slate-300">
          Active engine: <span className="font-semibold text-white">{engineLabel}</span>
          <span className="mx-2 text-slate-500">•</span>
          Iterations: <span className="font-semibold text-cyan-200">{result?.runtime?.optimization_iterations ?? 0}</span>
        </div>
      </div>
    </header>
  );
}

function StructureArchitectWorkspace({ result, onGenerate, onExplain, loadingDesign, pipelineStep, setPipelineStep, notify }) {
  const [materialType, setMaterialType] = useState(DEFAULT_GENERATION.materialType);
  const [bandgap, setBandgap] = useState(DEFAULT_GENERATION.bandgap);
  const [density, setDensity] = useState(DEFAULT_GENERATION.density);
  const [stability, setStability] = useState(DEFAULT_GENERATION.stability);
  const [activePanel, setActivePanel] = useState("results");
  const selected = result?.selected_structure;

  const exportCif = () => {
    if (!selected?.cif) {
      notify("Generate a material first before exporting CIF.");
      return;
    }

    const filename = `${selected.candidate_id || "structure"}.cif`;
    downloadTextFile(filename, selected.cif, "chemical/x-cif");
    notify(`Exported ${filename}.`);
  };

  const exportJson = () => {
    if (!result) {
      notify("Generate a material first before exporting JSON.");
      return;
    }

    const filename = `${selected?.candidate_id || "structure"}.json`;
    downloadTextFile(filename, JSON.stringify(result, null, 2), "application/json");
    notify(`Exported ${filename}.`);
  };

  const explainMaterial = () => {
    if (!selected) {
      notify("Run Structure Architect first so there is a material to explain.");
      return;
    }

    setActivePanel("results");
    notify("Sending the current structure to the Research Agent for an explanation.");
    onExplain(
      `Explain this material in plain language. Use the generated structure, prediction, and design rationale to describe why it was selected, what the key trade-offs are, and any safety or synthesis concerns.\n\nStructure: ${selected.smiles || selected.candidate_id || "unknown"}`
    );
  };

  const runGenerate = async () => {
    setPipelineStep(0);
    notify("Structure Architect queued for generation.");
    await onGenerate({
      prompt: `Design a ${materialType.toLowerCase()} with bandgap ${bandgap.toFixed(1)} eV, density ${density.toFixed(1)} g/cm3, and stability ${stability.toFixed(2)}.`,
      domain: materialType === "Electrolyte" ? "electrolyte" : materialType === "Polymer" ? "polymer" : "crystal",
      synthesis_requested: true,
      target_properties: {
        bandgap,
        density,
        stability,
        thermal_stability: stability,
      },
      constraints: {
        material_type: materialType,
        workspace: "structure-architect",
      },
    });
    setPipelineStep(1);
  };

  return (
    <section className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="glass-panel flex flex-col gap-4 border-white/10 bg-white/5 p-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-200">Engine 1</div>
          <h2 className="mt-2 text-xl font-semibold text-white">Structure Architect</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Parameter-driven material generation with interactive 3D inspection.</p>
        </div>

        <label className="space-y-2 text-sm text-slate-200">
          <span>Material Type</span>
          <select className="input-field" value={materialType} onChange={(event) => setMaterialType(event.target.value)}>
            {MATERIAL_TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>

        <div className="space-y-4">
          <label className="space-y-2 text-sm text-slate-200">
            <div className="flex items-center justify-between">
              <span>Bandgap</span>
              <span className="text-cyan-200">{bandgap.toFixed(1)} eV</span>
            </div>
            <input type="range" min="0.5" max="6" step="0.1" value={bandgap} onChange={(event) => setBandgap(Number(event.target.value))} className="w-full accent-cyan-400" />
          </label>
          <label className="space-y-2 text-sm text-slate-200">
            <div className="flex items-center justify-between">
              <span>Density</span>
              <span className="text-violet-200">{density.toFixed(1)} g/cm3</span>
            </div>
            <input type="range" min="0.5" max="8" step="0.1" value={density} onChange={(event) => setDensity(Number(event.target.value))} className="w-full accent-violet-400" />
          </label>
          <label className="space-y-2 text-sm text-slate-200">
            <div className="flex items-center justify-between">
              <span>Stability</span>
              <span className="text-emerald-200">{stability.toFixed(2)}</span>
            </div>
            <input type="range" min="0.2" max="1" step="0.01" value={stability} onChange={(event) => setStability(Number(event.target.value))} className="w-full accent-emerald-400" />
          </label>
        </div>

        <button type="button" onClick={runGenerate} disabled={loadingDesign} className="primary-btn mt-auto w-full">
          {loadingDesign ? "Generating candidate..." : "Generate Material"}
        </button>
      </div>

      <div className="glass-panel flex min-h-[820px] flex-col gap-5 border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Workspace</div>
            <h3 className="text-lg font-semibold text-white">Interactive 3D molecule / crystal viewer</h3>
          </div>
          <div className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-slate-300">
            Current candidate: <span className="font-semibold text-white">{selected?.smiles || selected?.candidate_id || "Awaiting generation"}</span>
          </div>
        </div>

        <PipelineStepper active={pipelineStep} />

        <div className="grid flex-1 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="flex min-h-[520px] flex-col gap-4 rounded-[28px] border border-white/10 bg-slate-950/35 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Viewport</div>
                <div className="text-sm font-semibold text-white">Rotate, zoom, and inspect bonds or lattice</div>
              </div>
              <div className="flex gap-2">
                <button type="button" className={`rounded-full border px-3 py-2 text-xs font-semibold ${activePanel === "results" ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/5 text-slate-300"}`} onClick={() => setActivePanel("results")}>Results</button>
                <button type="button" className={`rounded-full border px-3 py-2 text-xs font-semibold ${activePanel === "preview" ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/5 text-slate-300"}`} onClick={() => setActivePanel("preview")}>Preview</button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-slate-950 via-slate-950/90 to-cyan-950/25 p-2">
              <StructureViewer3D structure={selected} compact />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Results</div>
                  <h4 className="mt-1 text-base font-semibold text-white">Output Intelligence</h4>
                </div>
                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  {selected ? "Generated" : "Idle"}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Chemical Formula</div>
                  <div className="mt-2 text-lg font-semibold text-white">{selected?.smiles || "C1=NC=CN=C1"}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Stability Score" value={selected ? formatScore(result?.prediction?.confidence) : "0.00"} accent="text-emerald-300" />
                  <StatCard label="Energy Value" value={selected ? formatScore(result?.prediction?.predicted_properties?.formation_energy) : "0.00"} accent="text-violet-300" />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <button type="button" onClick={exportCif} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-slate-200 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
                    Export CIF
                  </button>
                  <button type="button" onClick={exportJson} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-slate-200 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
                    Export JSON
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">AI Suggestions</div>
              <div className="mt-3 space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Increase aromaticity to improve thermal resistance.</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Balance density against ionic mobility for electrolyte candidates.</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Use the Predict step to refine the next generation loop automatically.</div>
              </div>
            </div>

            <button
              type="button"
              onClick={explainMaterial}
              className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
            >
              Explain this material
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Bandgap" value={selected ? formatScore(result?.prediction?.predicted_properties?.thermal_stability) : formatScore(bandgap)} accent="text-cyan-200" />
          <StatCard label="Density" value={formatScore(density)} accent="text-violet-200" />
          <StatCard label="Stability" value={selected ? formatScore(result?.prediction?.predicted_properties?.stability) : formatScore(stability)} accent="text-emerald-200" />
        </div>
      </div>

    </section>
  );
}

function DigitalChemistWorkspace({ result, activeChemistTab, setActiveChemistTab, onAnalyze, loadingChat, assistantAnswer, notify }) {
  const [smiles, setSmiles] = useState(result?.selected_structure?.smiles || "CCO");
  const [uploadName, setUploadName] = useState("");

  const prediction = result?.prediction;
  const selected = result?.selected_structure;

  const propertyCards = prediction
    ? [
        { label: "Bandgap", value: prediction.predicted_properties.thermal_stability, accent: "from-cyan-400 to-blue-400" },
        { label: "Conductivity", value: clamp(prediction.scores.efficiency, 0, 1), accent: "from-violet-400 to-fuchsia-400" },
        { label: "Stability", value: prediction.predicted_properties.stability, accent: "from-emerald-400 to-lime-400" },
      ]
    : [
        { label: "Bandgap", value: 0.58, accent: "from-cyan-400 to-blue-400" },
        { label: "Conductivity", value: 0.44, accent: "from-violet-400 to-fuchsia-400" },
        { label: "Stability", value: 0.72, accent: "from-emerald-400 to-lime-400" },
      ];

  const reactionSteps = [
    { title: "A + B", description: "Reactants enter the optimized pathway." },
    { title: "Catalyst Field", description: "Active site lowers activation energy." },
    { title: "Product", description: prediction ? `Predicted yield confidence ${formatScore(prediction.confidence)}` : "Awaiting simulation output." },
  ];

  const retrosynthesis = [
    { title: "Target scaffold", description: selected?.smiles || smiles || "Unknown target" },
    { title: "Disconnection 1", description: "Break aromatic or chain linkages to simpler precursors." },
    { title: "Disconnection 2", description: "Resolve functional group order and feasibility." },
  ];

  const runPredict = async () => {
    if (!result) {
      notify("Run Structure Architect first so the chemist has a candidate to evaluate.");
      return;
    }
    setActiveChemistTab("Property Prediction");
    await onAnalyze(
      "Explain the predicted bandgap, conductivity, and reaction outcome for the current design.",
      { switchToResearch: false, metric: "predictions" }
    );
  };

  const playSimulation = () => {
    if (!result) {
      notify("Generate a material first to play the simulation.");
      return;
    }

    const currentIndex = ENGINE_TABS.indexOf(activeChemistTab);
    const nextTab = ENGINE_TABS[(currentIndex + 1) % ENGINE_TABS.length];
    setActiveChemistTab(nextTab);
    notify(`Simulation advanced to ${nextTab}.`);
  };

  const explainMaterial = async () => {
    if (!result) {
      notify("Run Structure Architect first so there is a material to explain.");
      return;
    }

    await onAnalyze(
      `Explain this material from the Digital Chemist perspective for structure ${selected?.smiles || selected?.candidate_id || "unknown"}. Include all available molecule properties (predicted_properties, scores, confidence, validity flags, and feasibility), what each property means, and key trade-offs. Also provide practical applications and industries where this molecule could be used, with a short reason for each application.`,
      {
        switchToResearch: false,
        metric: "researchSummaries",
        contextOverrides: {
          llmReview: true,
          source: "digital_chemist_explain",
        },
      }
    );
  };

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="glass-panel flex min-h-[760px] flex-col gap-5 border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-violet-200">Engine 2</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Digital Chemist</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Prediction and reaction simulation environment with property insight and retrosynthesis support.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ENGINE_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveChemistTab(tab)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  activeChemistTab === tab ? "border-violet-400/40 bg-violet-400/15 text-violet-100" : "border-white/10 bg-white/5 text-slate-300"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Input Section</div>
            <div className="mt-4 space-y-4">
              <label className="space-y-2 text-sm text-slate-200">
                <span>Upload molecule file or SMILES</span>
                <input type="file" accept=".mol,.sdf,.xyz,.cif,.txt,.csv" className="input-field" onChange={(event) => setUploadName(event.target.files?.[0]?.name || "")} />
                <input value={smiles} onChange={(event) => setSmiles(event.target.value)} className="input-field" placeholder="Enter SMILES string" />
                {uploadName ? <div className="text-xs text-emerald-200">Loaded file: {uploadName}</div> : null}
              </label>

              <MoleculeDrawingCanvas />

              <button type="button" onClick={runPredict} className="primary-btn w-full">Run Prediction</button>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-slate-950/35 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Simulation Output</div>
                <h3 className="mt-1 text-lg font-semibold text-white">{activeChemistTab}</h3>
              </div>
              <button type="button" onClick={playSimulation} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200">Play Simulation</button>
            </div>

            <div className="mt-4 space-y-4">
              {activeChemistTab === "Property Prediction" ? (
                <div className="grid gap-3 lg:grid-cols-3">
                  {propertyCards.map((card) => (
                    <div key={card.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{card.label}</div>
                      <PropertyBar label={card.label} value={card.value} accent={card.accent} />
                    </div>
                  ))}
                </div>
              ) : null}

              {activeChemistTab === "Reaction Outcome" ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-slate-300">
                    <FlowNode label={reactionSteps[0].title} color="text-cyan-200" />
                    <span className="text-cyan-400/60">→</span>
                    <FlowNode label={reactionSteps[1].title} color="text-violet-200" />
                    <span className="text-cyan-400/60">→</span>
                    <FlowNode label={reactionSteps[2].title} color="text-emerald-200" />
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {reactionSteps.map((step) => (
                      <div key={step.title} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300">
                        <div className="font-semibold text-white">{step.title}</div>
                        <div className="mt-2 leading-6">{step.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeChemistTab === "Retrosynthesis" ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <SequenceTimeline items={retrosynthesis} />
                </div>
              ) : null}
            </div>

            <div className="mt-4 rounded-3xl border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300">
              {loadingChat ? "Analyzing current material..." : assistantAnswer || "Simulation and prediction results will appear here."}
            </div>
          </div>
        </div>

        <button type="button" onClick={explainMaterial} className="rounded-full border border-violet-400/30 bg-violet-400/10 px-4 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-400/15">
          Explain this material
        </button>
      </div>

      <div className="glass-panel flex flex-col gap-4 border-white/10 bg-white/5 p-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Summary</div>
          <h3 className="mt-2 text-lg font-semibold text-white">Property Intelligence</h3>
        </div>

        <div className="space-y-3">
          {propertyCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>{card.label}</span>
                <span className="font-semibold text-white">{formatScore(card.value)}</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/5">
                <div className={`h-2 rounded-full bg-gradient-to-r ${card.accent}`} style={{ width: `${clamp(card.value * 100, 18, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Reaction Flow</div>
          <div className="mt-4 flex items-center justify-between gap-2 text-sm text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">A</span>
            <span className="text-cyan-400">+</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">B</span>
            <span className="text-cyan-400">→</span>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-emerald-100">Product</span>
          </div>
          <MiniSparkline values={[0.22, 0.28, 0.41, 0.55, 0.62, 0.72]} stroke="#22d3ee" />
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Safety Warnings</div>
          <div className="mt-3 space-y-2 text-sm text-amber-100">
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2">Review hazard class before synthesis.</div>
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-2">Check solvent compatibility and disposal pathway.</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ResearchAgentWorkspace({ result, onAsk, onClearChat, loadingChat, assistantAnswer, notify, messages = [] }) {
  const [query, setQuery] = useState("Summarize the safety implications of this design and cite the key trade-offs.");
  const currentDesignText = formatExplanation(result?.explanation);
  const [sources, setSources] = useState([
    { title: "KB: polymer", excerpt: "Aromatic backbones and cross-linking improve thermal stability." },
    { title: "KB: sustainability", excerpt: "Avoid toxic motifs and hard-to-recycle precursors." },
    { title: "Current design", excerpt: currentDesignText || "Run Structure Architect first to populate the research context." },
  ]);

  useEffect(() => {
    setSources([
      { title: "KB: polymer", excerpt: "Aromatic backbones and cross-linking improve thermal stability." },
      { title: "KB: sustainability", excerpt: "Avoid toxic motifs and hard-to-recycle precursors." },
      { title: "Current design", excerpt: formatExplanation(result?.explanation) || "Run Structure Architect first to populate the research context." },
    ]);
  }, [result]);

  const handleAsk = async (event) => {
    event.preventDefault();
    const next = query.trim();
    if (!next) {
      notify("Please enter a question before sending.");
      return;
    }
    await onAsk(next);
    setQuery("");
  };

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="glass-panel flex min-h-[720px] flex-col gap-5 border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-emerald-200">Engine 3</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Research Agent</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Chat-first research companion with file ingestion, summaries, and safety guidance.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onClearChat} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
              Clear Chat
            </button>
            <button type="button" onClick={() => notify("Uploaded document queue is ready for PDF and SDS review.")} className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100">Upload PDF / SDS</button>
          </div>
        </div>

        <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex flex-col rounded-[28px] border border-white/10 bg-slate-950/35 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Chat Window</div>
            <div className="mt-4 flex-1 space-y-4 overflow-auto rounded-[24px] border border-white/10 bg-black/20 p-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[86%] rounded-2xl border p-4 text-sm leading-6 ${
                    message.role === "user"
                      ? "ml-auto border-violet-400/25 bg-violet-400/10 text-violet-50"
                      : message.state === "error"
                        ? "border-rose-400/30 bg-rose-400/10 text-rose-50"
                        : message.state === "pending"
                          ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-50"
                          : "border-white/10 bg-white/5 text-slate-200"
                  }`}
                >
                  {message.content}
                </div>
              ))}
              {!messages.length ? (
                <div className="max-w-[82%] rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm leading-6 text-cyan-50">
                  Ask about safety, design trade-offs, or synthesis practicality. The agent will summarize the candidate and surface context-aware warnings.
                </div>
              ) : null}
            </div>

            <form onSubmit={handleAsk} className="mt-4 space-y-3">
              <label className="space-y-2 text-sm text-slate-200">
                <span>Query</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="input-field" />
              </label>
              <button type="submit" className="primary-btn w-full">Ask Research Agent</button>
            </form>
          </div>

          <div className="space-y-4 rounded-[28px] border border-white/10 bg-slate-950/45 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Live Features</div>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">File upload, summary extraction, and safety warnings are surfaced here.</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Use the explainability button to switch from prediction to narrative analysis.</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">RAG citations are shown in the source rail and can be linked to design history.</div>
            </div>

            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
              Safety warnings are highlighted here when design or synthesis signals look risky.
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel flex flex-col gap-4 border-white/10 bg-white/5 p-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-emerald-200">RAG System</div>
          <h3 className="mt-2 text-lg font-semibold text-white">Retrieved Sources</h3>
        </div>
        <div className="space-y-3">
          {sources.map((source) => (
            <div key={source.title} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="text-sm font-semibold text-white">{source.title}</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">{source.excerpt}</div>
            </div>
          ))}
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Highlighted Text</div>
          <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
            <span className="rounded bg-cyan-400/15 px-1 py-0.5 text-cyan-100">Aromatic backbones</span> and <span className="rounded bg-emerald-400/15 px-1 py-0.5 text-emerald-100">cross-linking</span> improve thermal stability.
          </div>
        </div>
      </div>
    </section>
  );
}

function ExperimentsWorkspace({ result }) {
  const graphValues = [0.45, 0.53, 0.61, 0.58, 0.71, 0.77, 0.83];

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <div className="glass-panel flex flex-col gap-5 border-white/10 bg-white/5 p-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-200">Experiments</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">Tracking Dashboard</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Compare active materials, inspect trends, and monitor iteration performance.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {SAMPLE_DATASETS.map((dataset) => (
            <div key={dataset.id} className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{dataset.version}</div>
              <div className="mt-2 text-sm font-semibold text-white">{dataset.name}</div>
              <div className="mt-3 space-y-2 text-sm text-slate-400">
                <div>Bandgap: {dataset.bandgap.toFixed(2)}</div>
                <div>Stability: {dataset.stability.toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Graph View</div>
              <div className="mt-1 text-sm font-semibold text-white">Bandgap and stability trends</div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">Current run: {result?.runtime?.optimization_iterations ?? 0} iterations</div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <MiniSparkline values={graphValues} stroke="#22d3ee" />
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Bandgap trend</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <MiniSparkline values={[0.52, 0.56, 0.63, 0.68, 0.72, 0.79, 0.84]} stroke="#34d399" />
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Stability trend</div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel flex flex-col gap-4 border-white/10 bg-white/5 p-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-violet-200">Compare</div>
          <h3 className="mt-2 text-lg font-semibold text-white">Side-by-side Materials</h3>
        </div>
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Candidate A</div>
            <div className="mt-2 text-sm text-slate-300">Aromatic polymer scaffold</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Candidate B</div>
            <div className="mt-2 text-sm text-slate-300">Li-rich electrolyte lattice</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300">
            Delta summary: A is thermally stronger; B has higher ionic transport potential.
          </div>
        </div>
      </div>
    </section>
  );
}

function SavedDesignsWorkspace({ result }) {
  const savedEntries = [
    { version: "v3.2", name: "Aromatic polymer scaffold", note: "Aromatic backbone strengthened after prediction feedback.", status: "Pinned" },
    { version: "v3.1", name: "Recyclable chain candidate", note: "Recyclability improved using lower-crosslink density.", status: "Archived" },
    { version: "v3.0", name: "Baseline generated candidate", note: "Initial generated candidate stored for comparison.", status: "Archived" },
  ];

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="glass-panel flex flex-col gap-5 border-white/10 bg-white/5 p-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-violet-200">Saved Designs</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">Design Library</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Dedicated page for previously saved experiments, reusable templates, and version snapshots.</p>
        </div>

        <div className="space-y-3">
          {savedEntries.map((entry) => (
            <article key={entry.version} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{entry.version}</div>
                  <h3 className="mt-1 text-sm font-semibold text-white">{entry.name}</h3>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{entry.status}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">{entry.note}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">Load</button>
                <button type="button" className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">Duplicate</button>
                <button type="button" className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">Export</button>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="glass-panel flex flex-col gap-4 border-white/10 bg-white/5 p-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-200">Metadata</div>
          <h3 className="mt-2 text-lg font-semibold text-white">Snapshot Summary</h3>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300">
            Active runtime iterations: {result?.runtime?.optimization_iterations ?? 0}
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300">
            Last prediction confidence: {result?.prediction?.confidence?.toFixed(2) ?? "N/A"}
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300">
            Stored snapshots can be reopened from this page without entering the experiment dashboard.
          </div>
        </div>

        <button type="button" className="primary-btn mt-auto w-full">Save Current Experiment</button>
      </div>
    </section>
  );
}

const INITIAL_RESEARCH_MESSAGE = {
  id: "assistant-welcome",
  role: "assistant",
  content: "Ask about safety, design trade-offs, or synthesis practicality. The agent will summarize the candidate and surface context-aware warnings.",
  state: "done",
};

export default function GenMatDashboard() {
  const [loadingDesign, setLoadingDesign] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [result, setResult] = useState(null);
  const [assistantAnswer, setAssistantAnswer] = useState("");
  const [error, setError] = useState("");
  const [activeEngine, setActiveEngine] = useState("structure");
  const [activeTopTab, setActiveTopTab] = useState("Tasks");
  const [activeChemistTab, setActiveChemistTab] = useState("Property Prediction");
  const [pipelineStep, setPipelineStep] = useState(0);
  const [toast, setToast] = useState("System ready.");
  const [chatMessages, setChatMessages] = useState([INITIAL_RESEARCH_MESSAGE]);
  const [stats, setStats] = useState({
    generatedMaterials: 0,
    predictions: 0,
    researchSummaries: 0,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setToast("System ready."), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const summary = useMemo(() => {
    if (!result) {
      return "No design run yet.";
    }
    return formatExplanation(result.explanation);
  }, [result]);

  const notify = (message) => {
    setToast(message);
  };

  const onDesignSubmit = async (payload) => {
    setError("");
    setLoadingDesign(true);
    try {
      const data = await designMaterial(payload);
      setResult(data);
      const explanationText = formatExplanation(data.explanation);
      setAssistantAnswer(explanationText);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `assistant-design-${Date.now()}`,
          role: "assistant",
          content: `Design completed. ${explanationText}`,
          state: "done",
        },
      ]);
      setStats((prev) => ({
        ...prev,
        generatedMaterials: prev.generatedMaterials + 1,
        predictions: prev.predictions + (data?.prediction ? 1 : 0),
        researchSummaries: prev.researchSummaries + (data?.explanation ? 1 : 0),
      }));
      setPipelineStep(1);
      setToast("Material generated and routed to prediction.");
    } catch (err) {
      setError(err.message || "Design call failed.");
      setToast("Generation failed. Check the backend connection.");
    } finally {
      setLoadingDesign(false);
    }
  };

  const onAsk = async (message, options = {}) => {
    const cleanMessage = message.trim();
    if (!cleanMessage) {
      setToast("Please enter a question for the Research Agent.");
      return;
    }

    const { switchToResearch = true, metric = "researchSummaries", contextOverrides = {} } = options;

    const requestId = Date.now();
    setChatMessages((prev) => [
      ...prev,
      { id: `user-${requestId}`, role: "user", content: cleanMessage, state: "done" },
      { id: `assistant-pending-${requestId}`, role: "assistant", content: "Generating answer...", state: "pending" },
    ]);
    if (switchToResearch) {
      setActiveEngine("research");
    }
    setPipelineStep(2);
    setLoadingChat(true);

    try {
      const data = await chatAssistant({
        message: cleanMessage,
        context: {
          designSummary: summary,
          structuredInput: result?.structured_input || null,
          prediction: result?.prediction || null,
          selectedStructure: result?.selected_structure || null,
          iterationCount: result?.runtime?.optimization_iterations || 0,
          explanation: formatExplanation(result?.explanation),
          source: switchToResearch ? "research_agent_chat" : "digital_chemist_chat",
          ...contextOverrides,
        },
      });

      setAssistantAnswer(data.answer);
      setChatMessages((prev) =>
        prev.map((entry) =>
          entry.id === `assistant-pending-${requestId}`
            ? { ...entry, content: data.answer, state: "done" }
            : entry
        )
      );
      if (metric === "predictions") {
        setStats((prev) => ({ ...prev, predictions: prev.predictions + 1 }));
      } else {
        setStats((prev) => ({ ...prev, researchSummaries: prev.researchSummaries + 1 }));
      }
      setToast("Research Agent analyzed the current design.");
    } catch (err) {
      const fallback = err.message || "Assistant unavailable.";
      setAssistantAnswer(fallback);
      setChatMessages((prev) =>
        prev.map((entry) =>
          entry.id === `assistant-pending-${requestId}`
            ? { ...entry, content: fallback, state: "error" }
            : entry
        )
      );
      setToast("Research request failed.");
    } finally {
      setLoadingChat(false);
    }
  };

  const onClearChat = () => {
    setChatMessages([]);
    setAssistantAnswer("");
    setToast("Chat history cleared.");
  };

  const activeEngineLabel = SIDEBAR_ITEMS.find((item) => item.id === activeEngine)?.label || "Structure Architect";

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <ParticleField />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.15),transparent_28%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.14),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.14),transparent_24%)]" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-[1720px] gap-5 p-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-6">
        <Sidebar activeEngine={activeEngine} setActiveEngine={setActiveEngine} />

        <div className="flex min-w-0 flex-col gap-5">
          <Header activeTopTab={activeTopTab} setActiveTopTab={setActiveTopTab} result={result} engineLabel={activeEngineLabel} />

          {error ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 shadow-lg shadow-rose-950/20">
              {error}
            </div>
          ) : null}

          <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/5 px-4 py-3 text-sm text-cyan-50 shadow-lg shadow-cyan-950/20 backdrop-blur-xl">
            {toast}
          </div>

          {activeEngine === "structure" ? (
            <StructureArchitectWorkspace
              result={result}
              onGenerate={onDesignSubmit}
              onExplain={onAsk}
              loadingDesign={loadingDesign}
              pipelineStep={pipelineStep}
              setPipelineStep={setPipelineStep}
              notify={notify}
            />
          ) : null}

          {activeEngine === "chemist" ? (
            <DigitalChemistWorkspace
              result={result}
              activeChemistTab={activeChemistTab}
              setActiveChemistTab={setActiveChemistTab}
              onAnalyze={onAsk}
              loadingChat={loadingChat}
              assistantAnswer={assistantAnswer}
              notify={notify}
            />
          ) : null}

          {activeEngine === "research" ? (
            <ResearchAgentWorkspace
              result={result}
              onAsk={onAsk}
              onClearChat={onClearChat}
              loadingChat={loadingChat}
              assistantAnswer={assistantAnswer}
              notify={notify}
              messages={chatMessages}
            />
          ) : null}

          {activeEngine === "experiments" ? <ExperimentsWorkspace result={result} /> : null}

          {activeEngine === "saved" ? <SavedDesignsWorkspace result={result} /> : null}

          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Generated Materials" value={formatCount(stats.generatedMaterials)} accent="text-cyan-200" />
            <StatCard label="Predictions" value={formatCount(stats.predictions)} accent="text-violet-200" />
            <StatCard label="Research Summaries" value={formatCount(stats.researchSummaries)} accent="text-emerald-200" />
          </div>
        </div>
      </div>
    </main>
  );
}
