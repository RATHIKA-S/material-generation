import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import MoleculeCard from "./MoleculeCard";
import { buildBondIndexPairs, buildOrderedBondSegments } from "../utils/chemistry";

function Atom({ position, atom }) {
  const colorMap = {
    H: "#e6f7ff",
    C: "#2f4858",
    O: "#ef6f6c",
    N: "#4f86c6",
    Li: "#f0c808",
    Fe: "#8b1e3f",
  };

  return (
    <mesh position={position}>
      <sphereGeometry args={[0.22, 24, 24]} />
      <meshStandardMaterial color={colorMap[atom] || "#59c9a5"} />
      <Html distanceFactor={10} position={[0, 0.35, 0]} center>
        <div className="rounded-full border border-white/20 bg-slate-950/85 px-2 py-0.5 text-[11px] font-semibold text-white shadow-lg">
          {atom}
        </div>
      </Html>
    </mesh>
  );
}

export default function StructureViewer3D({ structure }) {
  const [showBonds, setShowBonds] = useState(true);
  const [showLattice, setShowLattice] = useState(true);

  if (!structure) {
    return (
      <section className="flex h-full flex-col rounded-[24px] border border-white/10 bg-slate-950/55 p-4 text-slate-300 backdrop-blur-xl">
        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">3D Structure</div>
        <h2 className="mt-2 text-lg font-semibold text-white">Awaiting structure</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">Generated XYZ and CIF structures will appear in this viewer after a material is created.</p>
        <div className="mt-4 flex-1 rounded-3xl border border-dashed border-white/10 bg-white/5 p-4">
          <div className="grid h-full place-items-center rounded-2xl border border-white/10 bg-slate-950/60 text-sm text-slate-500">
            3D viewport inactive
          </div>
        </div>
      </section>
    );
  }

  const fallbackPairs = buildBondIndexPairs(structure.atoms || [], structure.coordinates || []);
  const fallbackBonds = fallbackPairs.map(([from, to]) => ({ from, to, order: 1 }));
  const bondSegments = buildOrderedBondSegments(
    structure.coordinates || [],
    (structure.bonds && structure.bonds.length ? structure.bonds : fallbackBonds) || []
  );

  return (
    <section className="flex h-full flex-col gap-5 rounded-[24px] border border-white/10 bg-slate-950/55 p-4 text-slate-100 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">3D Structure</div>
          <h2 className="mt-2 text-lg font-semibold text-white">Ball-and-stick molecule / lattice view</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Chemistry card, atom labels, and the generated structure in text form.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-200">
          <button type="button" onClick={() => setShowBonds((current) => !current)} className={`rounded-full border px-3 py-2 ${showBonds ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/5 text-slate-300"}`}>
            Bonds
          </button>
          <button type="button" onClick={() => setShowLattice((current) => !current)} className={`rounded-full border px-3 py-2 ${showLattice ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-100" : "border-white/10 bg-white/5 text-slate-300"}`}>
            Lattice
          </button>
        </div>
      </div>

      <MoleculeCard structure={structure} />

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/40">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-sm font-medium text-slate-300">
          <span>3D ball-and-stick view</span>
          <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Rotate / Zoom / Pan</span>
        </div>
        <div className="h-[340px]">
          <Canvas camera={{ position: [4, 4, 6], fov: 60 }}>
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 5, 4]} intensity={0.9} />
            {showBonds
              ? bondSegments.map((segment, idx) => (
                  <Line key={`${structure.candidate_id}-bond-${idx}`} points={segment.points} color="#a0a7ac" lineWidth={1.6} />
                ))
              : null}
            {showLattice
              ? structure.coordinates.map((coord, idx) => (
                  <Atom key={`${structure.candidate_id}-${idx}`} position={coord} atom={structure.atoms[idx]} />
                ))
              : null}
            <OrbitControls enablePan enableZoom enableRotate />
          </Canvas>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
          <h3 className="text-sm font-semibold text-slate-200">Compound Structure</h3>
          <div className="mt-3 space-y-3 text-sm text-slate-300">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">SMILES</div>
              <code className="mt-1 block overflow-auto rounded-2xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-cyan-300">{structure.smiles || "Not available"}</code>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Atoms</div>
              <code className="mt-1 block overflow-auto rounded-2xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-slate-100">{(structure.atoms || []).join("  ")}</code>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-4">
          <h3 className="text-sm font-semibold text-slate-200">XYZ Coordinates</h3>
          <pre className="mt-3 max-h-64 overflow-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-slate-200">{structure.xyz}</pre>
        </div>
      </div>

      <details className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
        <summary className="cursor-pointer select-none font-semibold text-slate-200">CIF</summary>
        <pre className="mt-3 max-h-64 overflow-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-slate-200">{structure.cif}</pre>
      </details>
    </section>
  );
}
