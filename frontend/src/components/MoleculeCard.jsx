import { buildBondIndexPairs, normalizeBondObjects, projectCoordinatesToCard } from "../utils/chemistry";

const ATOM_STYLE = {
  H: { fill: "#e8e8e8", stroke: "#a7a7a7", label: "#818181" },
  C: { fill: "#2c2c2c", stroke: "#141414", label: "#2c2c2c" },
  O: { fill: "#f15b5b", stroke: "#b42323", label: "#d93d3d" },
  N: { fill: "#4f86c6", stroke: "#2c5f93", label: "#2c5f93" },
  S: { fill: "#f1c232", stroke: "#b38b1b", label: "#8f6b10" },
  P: { fill: "#ff8c42", stroke: "#bb5f1c", label: "#b95c14" },
  F: { fill: "#a3e635", stroke: "#679f1b", label: "#4d7e12" },
  Cl: { fill: "#6ee7b7", stroke: "#1f9d76", label: "#1c8b67" },
  Br: { fill: "#b45309", stroke: "#7c2d12", label: "#7c2d12" },
  Li: { fill: "#f9fafb", stroke: "#9ca3af", label: "#6b7280" },
  Fe: { fill: "#9ca3af", stroke: "#4b5563", label: "#4b5563" },
};

export default function MoleculeCard({ structure }) {
  if (!structure) {
    return null;
  }

  const depictionSrc = structure.depiction_png_base64
    ? `${structure.depiction_source === "local-svg" ? "data:image/svg+xml;base64" : "data:image/png;base64"},${structure.depiction_png_base64}`
    : null;
  const downloadName = `${structure.candidate_id || "molecule"}.${structure.depiction_source === "local-svg" ? "svg" : "png"}`;

  const atoms = structure.atoms || [];
  const coordinates = structure.coordinates || [];
  const points2d = projectCoordinatesToCard(coordinates);
  const uniqueAtoms = Array.from(new Set(atoms));
  const fallbackBonds = buildBondIndexPairs(atoms, coordinates).map(([from, to]) => ({ from, to, order: 1 }));
  const bonds = normalizeBondObjects((structure.bonds && structure.bonds.length ? structure.bonds : fallbackBonds) || []);

  return (
    <section className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4 text-slate-100 backdrop-blur-xl">
      <h2 className="text-sm font-semibold text-white">Molecule</h2>
      <div className="element-legend" aria-label="Atom legend">
        {uniqueAtoms.map((atom) => (
          <span key={atom} className="element-pill">
            <span className="element-dot" style={{ background: (ATOM_STYLE[atom] || ATOM_STYLE.C).fill }} />
            {atom}
          </span>
        ))}
      </div>
      <div className="molecule-card">
        {depictionSrc ? (
          <img
            src={depictionSrc}
            alt="Generated molecule depiction"
            className="h-full w-full rounded-[18px] object-contain bg-white"
          />
        ) : (
          <svg viewBox="0 0 700 400" role="img" aria-label="Generated molecule depiction">
          <defs>
            <linearGradient id="molecule-bg" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="700" height="400" rx="18" fill="url(#molecule-bg)" />
          <g strokeLinecap="round">
            {bonds.map((bond, index) => {
              const i = bond.from;
              const j = bond.to;
              if (i < 0 || j < 0 || i >= points2d.length || j >= points2d.length) {
                return null;
              }

              const x1 = points2d[i][0];
              const y1 = points2d[i][1];
              const x2 = points2d[j][0];
              const y2 = points2d[j][1];
              const dx = x2 - x1;
              const dy = y2 - y1;
              const len = Math.max(Math.sqrt(dx * dx + dy * dy), 1e-6);
              const nx = -dy / len;
              const ny = dx / len;
              const offsets = bond.order === 1 ? [0] : bond.order === 2 ? [-3, 3] : [-5, 0, 5];

              return offsets.map((offset, subIdx) => (
                <line
                  key={`bond-${index}-${subIdx}`}
                  x1={x1 + nx * offset}
                  y1={y1 + ny * offset}
                  x2={x2 + nx * offset}
                  y2={y2 + ny * offset}
                  stroke="#a7a7a7"
                  strokeWidth="3"
                />
              ));
            })}
          </g>
          {points2d.map(([x, y], index) => {
            const atom = atoms[index] || "C";
            const style = ATOM_STYLE[atom] || ATOM_STYLE.C;
            const radius = atom === "H" ? 13 : atom === "C" ? 18 : 20;
            return (
              <g key={`${structure.candidate_id}-${index}`}>
                <circle cx={x} cy={y} r={radius} fill={style.fill} stroke={style.stroke} strokeWidth="2.5" />
                <text x={x} y={y + 5} textAnchor="middle" fill={atom === "H" ? "#cbd5e1" : "#ffffff"} fontSize="14" fontWeight="600">
                  {atom}
                </text>
                <text x={x} y={y + radius + 18} textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="600">
                  {atom}
                </text>
              </g>
            );
          })}
          </svg>
        )}
      </div>
      <div className="molecule-caption">
        <div>
          <strong className="text-slate-100">{structure.smiles || "Unknown structure"}</strong>
          <p className="text-slate-400">{structure.depiction_source ? `Depiction source: ${structure.depiction_source}` : "Rendered from generated structure"}</p>
        </div>
        {depictionSrc ? (
          <a
            href={depictionSrc}
            download={downloadName}
            className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
          >
            Download Image
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-500"
          >
            Download Image
          </button>
        )}
      </div>
    </section>
  );
}
