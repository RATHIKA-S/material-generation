import { useState } from "react";

const DOMAIN_OPTIONS = ["general", "crystal", "polymer", "catalyst", "electrolyte"];

export default function MaterialDesigner({ onSubmit, loading }) {
  const [prompt, setPrompt] = useState("Design a recyclable polymer with high thermal resistance and low toxicity.");
  const [domain, setDomain] = useState("polymer");
  const [synthesisRequested, setSynthesisRequested] = useState(true);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      prompt,
      domain,
      synthesis_requested: synthesisRequested,
      target_properties: {
        thermal_stability: 0.85,
        recyclability: 0.8,
      },
      constraints: {
        toxicity: "low",
      },
    });
  };

  return (
    <section className="glass-panel flex h-full flex-col gap-5">
      <div>
        <h2 className="section-title text-lg">Material Designer</h2>
        <p className="section-subtitle">
          Describe the material goal. GenMat-Omni will structure intent, generate a 3D candidate, and evaluate feasibility.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
        <label className="space-y-2 text-sm font-medium text-slate-200">
          <span>Material Objective</span>
          <textarea
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
            className="input-field min-h-[120px] resize-y"
          />
        </label>

        <label className="space-y-2 text-sm font-medium text-slate-200">
          <span>Domain</span>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="input-field"
          >
            {DOMAIN_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={synthesisRequested}
            onChange={(e) => setSynthesisRequested(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-400 focus:ring-cyan-400/30"
          />
          Include synthesis feasibility estimate
        </label>

        <button type="submit" disabled={loading} className="primary-btn mt-auto w-full">
          {loading ? "Generating..." : "Generate Candidate"}
        </button>
      </form>
    </section>
  );
}
