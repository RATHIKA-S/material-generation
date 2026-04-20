import { useState } from "react";

export default function AILabAssistant({ onAsk, loading, answer }) {
  const [message, setMessage] = useState("How does this design balance thermal stability and recyclability?");

  const submit = async (event) => {
    event.preventDefault();
    await onAsk(message);
  };

  return (
    <section className="glass-panel flex h-full flex-col gap-5">
      <div>
        <h2 className="section-title text-lg">AI Lab Assistant</h2>
        <p className="section-subtitle">Ask for scientific reasoning, trade-offs, or synthesis guidance.</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="space-y-2 text-sm font-medium text-slate-200">
          <span>Ask for scientific reasoning</span>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            className="input-field"
          />
        </label>
        <button type="submit" disabled={loading} className="primary-btn w-full">
          {loading ? "Thinking..." : "Ask Assistant"}
        </button>
      </form>
      <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4 text-sm leading-6 text-slate-200">
        <strong className="block text-sm font-semibold text-emerald-200">Response</strong>
        <p className="mt-2 whitespace-pre-line">{answer || "Ask a question to inspect mechanism, synthesis practicality, or trade-offs."}</p>
      </div>
    </section>
  );
}
