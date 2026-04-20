export default function PredictionViewer({ result }) {
  if (!result) {
    return (
      <section className="glass-panel flex h-full flex-col gap-4">
        <h2 className="section-title text-lg">Prediction Viewer</h2>
        <p className="section-subtitle">
          No prediction yet. Submit a material request to view confidence, properties, and validity checks.
        </p>
      </section>
    );
  }

  const { prediction, iterations, runtime } = result;

  return (
    <section className="glass-panel flex h-full flex-col gap-5">
      <div>
        <h2 className="section-title text-lg">Prediction Viewer</h2>
        <p className="section-subtitle">Model confidence, property signals, and optimization trail.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <article className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
          <h3 className="text-xs uppercase tracking-[0.24em] text-slate-400">Confidence</h3>
          <strong className="mt-2 block text-2xl font-semibold text-cyan-300">{prediction.confidence.toFixed(3)}</strong>
        </article>
        <article className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
          <h3 className="text-xs uppercase tracking-[0.24em] text-slate-400">Overall Score</h3>
          <strong className="mt-2 block text-2xl font-semibold text-emerald-300">{prediction.scores.overall.toFixed(3)}</strong>
        </article>
        <article className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
          <h3 className="text-xs uppercase tracking-[0.24em] text-slate-400">Iterations</h3>
          <strong className="mt-2 block text-2xl font-semibold text-violet-300">{runtime.optimization_iterations}</strong>
        </article>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-200">Predicted Properties</h3>
        <ul className="space-y-2">
        {Object.entries(prediction.predicted_properties).map(([key, value]) => (
          <li key={key} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            <span className="text-slate-300">{key}</span>
            <strong className="font-semibold text-white">{value}</strong>
          </li>
        ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-200">Validity Flags</h3>
        <ul className="space-y-2">
        {Object.entries(prediction.validity_flags).map(([key, value]) => (
          <li key={key} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            <span className="text-slate-300">{key}</span>
            <strong className={value ? "text-emerald-300" : "text-rose-300"}>{String(value)}</strong>
          </li>
        ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-200">Optimization Trail</h3>
        <ul className="space-y-2">
        {iterations.map((step) => (
          <li key={`${step.iteration}-${step.candidate_id}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            <span className="text-slate-300">Iter {step.iteration} ({step.candidate_id})</span>
            <strong className={step.accepted ? "text-emerald-300" : "text-amber-300"}>{step.accepted ? "accepted" : "refined"}</strong>
          </li>
        ))}
        </ul>
      </div>
    </section>
  );
}
