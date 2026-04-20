import hashlib
import json
import re
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import urlopen
from typing import Dict, List, Optional, Tuple

from rdkit import Chem
from rdkit.Chem import AllChem

from app.schemas import Atom3D, BondRecord, MoleculeValidation, StructureCandidate, StructuredInput


class StructureArchitect:
    """Engine 1: Produces chemically valid 3D molecules from structured constraints."""

    _name_to_smiles = {
        "methane": "C",
        "water": "O",
        "benzene": "c1ccccc1",
        "acetic acid": "CC(=O)O",
        "ethanoic acid": "CC(=O)O",
        "ethanol": "CCO",
        "carbonic acid": "OC(=O)O",
        "carbon dioxide": "O=C=O",
        "co2": "O=C=O",
        "aromatic": "c1ccccc1",
        "alkane": "CC",
        "alcohol": "CCO",
        "acid": "CC(=O)O",
        "ferrite": "[Fe+2].[Fe+3].[Fe+3].[O-2].[O-2].[O-2].[O-2]",
        "hematite": "[Fe+3].[Fe+3].[O-2].[O-2].[O-2]",
    }

    _keyword_templates = [
        (("benzene", "aromatic", "thermal", "resistance"), "c1ccccc1"),
        (("water",), "O"),
        (("methane",), "C"),
        (("carbon dioxide", "co2"), "O=C=O"),
        (("acetic acid", "ethanoic acid", "acid", "recycl"), "CC(=O)O"),
        (("ethanol", "alcohol"), "CCO"),
        (("electrolyte", "ionic", "conductivity", "salt"), "CC(=O)O[Li]"),
        (("catalyst", "active site", "transition-metal"), "O=C=O"),
        (("polymer", "repeat", "chain", "backbone"), "CC(C)CC"),
        (("porous", "porosity", "framework"), "c1ccccc1"),
    ]

    _property_palette = {
        "crystal": ["C", "CCO", "c1ccccc1", "OC(=O)O", "O=C=O", "C1=NC=CN=C1"],
        "mof": ["C1=NC=CN=C1", "c1ccccc1", "OC(=O)O", "CC(=O)O", "CC(=O)O[Li]", "O=C=O"],
        "electrolyte": ["CCO", "CC(=O)O", "CC(=O)O[Li]", "OC(=O)O", "O", "C1=NC=CN=C1"],
        "polymer": ["CC(C)CC", "CCO", "c1ccccc1", "CC(=O)O", "C1=NC=CN=C1", "O=C=O"],
    }

    _formula_pattern = re.compile(r"^(?:[A-Z][a-z]?\d*)+$")
    _formula_in_text_pattern = re.compile(r"\b(?:[A-Z][a-z]?\d*){2,}\b")
    _formula_to_smiles = {
        "H2O": "O",
        "CO2": "O=C=O",
    }

    _valency_rules: Dict[str, Tuple[int, ...]] = {
        "H": (1,),
        "O": (2,),
        "N": (3, 4),
        "C": (4,),
        "S": (2, 4, 6),
        "P": (3, 5),
        "F": (1,),
        "Cl": (1,),
        "Br": (1,),
        "I": (1,),
        "Li": (1,),
        "Si": (4,),
    }

    _metal_elements = {
        "Fe",
        "Cu",
        "Zn",
        "Ni",
        "Co",
        "Mn",
        "Cr",
        "Ti",
        "V",
        "Mo",
        "W",
    }
    _max_embed_attempts = 5

    def generate(self, structured: StructuredInput, seed_hint: str = "") -> StructureCandidate:
        signature = (
            f"{structured.normalized_goal}|{structured.domain}|{structured.smiles}|"
            f"{structured.graph_tokens}|{structured.soft_targets}|{structured.hard_constraints}|{seed_hint}"
        )
        seed = int(hashlib.md5(signature.encode("utf-8")).hexdigest(), 16) % 2_147_483_647

        candidates = self._smiles_candidates(structured)
        for smiles in candidates:
            candidate = self._build_candidate_from_smiles(smiles, structured, seed)
            if candidate is not None:
                return candidate

        raise ValueError(
            "Unable to generate a chemically valid structure from the provided input. "
            "Please provide a valid molecular SMILES string."
        )

    def _build_candidate_from_smiles(
        self,
        smiles: str,
        structured: StructuredInput,
        seed: int,
    ) -> Optional[StructureCandidate]:
        if not self._basic_smiles_sanity(smiles):
            return None

        # Step 1: pre-RDKit syntax check.
        base_mol = Chem.MolFromSmiles(smiles)
        if base_mol is None:
            return None
        if len(Chem.GetMolFrags(base_mol)) != 1:
            return None

        aromatic_atom_ids = [atom.GetIdx() for atom in base_mol.GetAtoms() if atom.GetIsAromatic()]

        # Kekulize first so aromatic bonds are converted to explicit single/double orders.
        mol = Chem.Mol(base_mol)
        try:
            Chem.Kekulize(mol, clearAromaticFlags=True)
        except Exception:
            mol = Chem.Mol(base_mol)

        mol = Chem.AddHs(mol)
        canonical_smiles = Chem.MolToSmiles(Chem.RemoveHs(base_mol), canonical=True)

        for attempt in range(self._max_embed_attempts):
            trial = Chem.Mol(mol)
            if not self._embed_and_optimize(trial, seed + attempt):
                continue

            if aromatic_atom_ids:
                self._enforce_aromatic_planarity(trial, aromatic_atom_ids)

            bonds = self._extract_bonds(trial)
            if not bonds and trial.GetNumAtoms() > 1:
                continue

            atoms_3d = self._extract_atoms_3d(trial)
            if not self._validate_valency(atoms_3d):
                continue

            geometry_ok, geometry_reasons = self._validate_geometry(trial, bonds, aromatic_atom_ids)
            if not geometry_ok:
                continue

            atoms = [atom.element for atom in atoms_3d]
            coordinates = [[atom.x, atom.y, atom.z] for atom in atoms_3d]
            pubchem_match = self._pubchem_reference_match(canonical_smiles)
            confidence = "high" if pubchem_match else "medium"

            return StructureCandidate(
                candidate_id=f"cand-{seed % 10_000}",
                representation_type=structured.representation_type,
                xyz=self._to_xyz(atoms_3d),
                cif=self._to_cif(atoms_3d),
                smiles=canonical_smiles,
                depiction_png_base64=None,
                depiction_source=None,
                atoms=atoms,
                coordinates=coordinates,
                atoms_3d=atoms_3d,
                bonds=bonds,
                aromatic_atom_ids=aromatic_atom_ids,
                validation=MoleculeValidation(
                    valency_ok=True,
                    geometry_ok=True,
                    pubchem_match=pubchem_match,
                    confidence=confidence,
                ),
                validity_notes=[
                    "Generated from RDKit molecule object.",
                    "Valency and bond-order checks passed.",
                    "Geometry checks passed (bond lengths, overlaps, aromatic planarity).",
                    *geometry_reasons,
                    "PubChem reference found." if pubchem_match else "Novel but valid candidate (not found in PubChem reference lookup).",
                ],
            )

        return None

    def _embed_and_optimize(self, mol: Chem.Mol, seed: int) -> bool:
        params = AllChem.ETKDGv3()
        params.randomSeed = int(seed)
        status = AllChem.EmbedMolecule(mol, params)
        if status != 0:
            status = AllChem.EmbedMolecule(mol, randomSeed=int(seed), useRandomCoords=True)
        if status != 0:
            return False

        if AllChem.MMFFHasAllMoleculeParams(mol):
            AllChem.MMFFOptimizeMolecule(mol, maxIters=700)
            return True
        if AllChem.UFFHasAllMoleculeParams(mol):
            AllChem.UFFOptimizeMolecule(mol, maxIters=700)
            return True
        return True

    def _enforce_aromatic_planarity(self, mol: Chem.Mol, aromatic_atom_ids: List[int]) -> None:
        conf = mol.GetConformer()
        if not aromatic_atom_ids:
            return

        z_mean = sum(conf.GetAtomPosition(i).z for i in aromatic_atom_ids) / float(len(aromatic_atom_ids))
        for idx in aromatic_atom_ids:
            pos = conf.GetAtomPosition(idx)
            conf.SetAtomPosition(idx, (pos.x, pos.y, z_mean))

    def _validate_geometry(self, mol: Chem.Mol, bonds: List[BondRecord], aromatic_atom_ids: List[int]) -> Tuple[bool, List[str]]:
        conf = mol.GetConformer()
        reasons: List[str] = []

        if len(bonds) != mol.GetNumBonds() or len(conf.GetPositions()) != mol.GetNumAtoms():
            return False, ["Structure consistency check failed (atom/bond count mismatch)."]

        # Bond length realism check.
        for bond in bonds:
            a = conf.GetAtomPosition(bond.from_atom)
            b = conf.GetAtomPosition(bond.to_atom)
            dx = a.x - b.x
            dy = a.y - b.y
            dz = a.z - b.z
            dist = (dx * dx + dy * dy + dz * dz) ** 0.5
            if dist < 0.9 or dist > 1.8:
                return False, [f"Bond length out of realistic range: {dist:.3f} A"]

        # Minimum inter-atomic distance overlap check.
        for i in range(mol.GetNumAtoms()):
            ai = conf.GetAtomPosition(i)
            for j in range(i + 1, mol.GetNumAtoms()):
                aj = conf.GetAtomPosition(j)
                dx = ai.x - aj.x
                dy = ai.y - aj.y
                dz = ai.z - aj.z
                dist = (dx * dx + dy * dy + dz * dz) ** 0.5
                if dist <= 0.45:
                    return False, ["Atom overlap detected after optimization."]

        if aromatic_atom_ids:
            max_abs_z = 0.0
            for idx in aromatic_atom_ids:
                z = abs(conf.GetAtomPosition(idx).z)
                if z > max_abs_z:
                    max_abs_z = z
            if max_abs_z >= 0.3:
                return False, ["Aromatic planarity check failed (|z| >= 0.3 A)."]
            reasons.append("Aromatic planarity enforced.")

        return True, reasons

    def _pubchem_reference_match(self, smiles: str) -> bool:
        if not smiles:
            return False
        url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/{quote(smiles, safe='')}/JSON"
        try:
            with urlopen(url, timeout=5) as response:
                if response.status != 200:
                    return False
                payload = response.read()
                parsed = json.loads(payload.decode("utf-8"))
                return bool(parsed.get("PC_Compounds"))
        except HTTPError as exc:
            # 404 means not found in PubChem; treat as novel but valid.
            if exc.code == 404:
                return False
            return False
        except (URLError, TimeoutError, ValueError, OSError):
            return False

    def _smiles_candidates(self, structured: StructuredInput) -> List[str]:
        seen = set()
        out: List[str] = []

        def add(smiles: Optional[str]):
            if not smiles:
                return
            smiles = smiles.strip()
            if not smiles or smiles in seen:
                return
            seen.add(smiles)
            out.append(smiles)

        if structured.smiles:
            add(self._formula_to_smiles.get(structured.smiles.strip().upper()))
            if not self._parse_formula(structured.smiles):
                add(structured.smiles)

        goal_formula_atoms = self._extract_formula_from_text(structured.normalized_goal)
        if goal_formula_atoms:
            formula_text = self._atoms_to_formula(goal_formula_atoms)
            add(self._formula_to_smiles.get(formula_text.upper()))

        add(self._select_template_smiles(structured))

        return out

    def _basic_smiles_sanity(self, smiles: str) -> bool:
        # Fast checks to reject obvious malformed strings before RDKit parsing.
        if not isinstance(smiles, str):
            return False

        text = smiles.strip()
        if not text:
            return False

        # Guard against runaway generations that are very likely malformed.
        if len(text) > 400:
            return False

        if text.count("(") != text.count(")"):
            return False

        if text.count("[") != text.count("]"):
            return False

        # Ring digits (0-9) should typically appear in pairs in basic SMILES.
        for digit in "0123456789":
            if text.count(digit) % 2 != 0:
                return False

        return True

    def _extract_bonds(self, mol: Chem.Mol) -> List[BondRecord]:
        try:
            Chem.Kekulize(mol, clearAromaticFlags=True)
        except Exception:
            pass

        bonds: List[BondRecord] = []
        order_map = {
            Chem.BondType.SINGLE: 1,
            Chem.BondType.DOUBLE: 2,
            Chem.BondType.TRIPLE: 3,
            Chem.BondType.AROMATIC: 1,
        }
        for bond in mol.GetBonds():
            order = order_map.get(bond.GetBondType(), 1)
            bonds.append(
                BondRecord(
                    from_atom=bond.GetBeginAtomIdx(),
                    to_atom=bond.GetEndAtomIdx(),
                    order=order,
                )
            )
        return bonds

    def _extract_atoms_3d(self, mol: Chem.Mol) -> List[Atom3D]:
        conf = mol.GetConformer()

        atoms: List[Atom3D] = []
        for atom in mol.GetAtoms():
            idx = atom.GetIdx()
            pos = conf.GetAtomPosition(idx)
            symbol = atom.GetSymbol()
            bonds_used = int(atom.GetTotalValence())
            max_valency = self._max_valency(symbol, bonds_used)

            atoms.append(
                Atom3D(
                    id=idx,
                    element=symbol,
                    x=round(float(pos.x), 4),
                    y=round(float(pos.y), 4),
                    z=round(float(pos.z), 4),
                    bonds_used=bonds_used,
                    max_valency=max_valency,
                )
            )
        return atoms

    def _max_valency(self, element: str, observed: int) -> int:
        if element in self._metal_elements:
            return max(observed, 6)
        rules = self._valency_rules.get(element)
        if rules:
            return max(rules)
        return max(observed, 4)

    def _validate_valency(self, atoms_3d: List[Atom3D]) -> bool:
        for atom in atoms_3d:
            if atom.element in self._metal_elements:
                continue

            allowed = self._valency_rules.get(atom.element)
            if not allowed:
                continue

            if atom.bonds_used > atom.max_valency:
                return False

            # Enforce upper-bound valency semantics (e.g., C<=4, O<=2, N<=4).
            if atom.bonds_used > max(allowed):
                return False

            if atom.element == "H" and atom.bonds_used != 1:
                return False

        return True

    def _select_template_smiles(self, structured: StructuredInput) -> Optional[str]:
        lower_goal = structured.normalized_goal.lower()
        material_type = self._normalize_material_type(str(structured.hard_constraints.get("material_type", "")))
        domain_key = self._normalize_material_type(structured.domain)
        targets = structured.soft_targets or {}
        bandgap = float(targets.get("bandgap", 0.0) or 0.0)
        density = float(targets.get("density", 0.0) or 0.0)
        stability = float(targets.get("stability", targets.get("thermal_stability", 0.0)) or 0.0)

        if material_type in self._property_palette:
            return self._pick_property_template(material_type, bandgap, density, stability)

        if domain_key in self._property_palette:
            return self._pick_property_template(domain_key, bandgap, density, stability)

        for name, canonical_smiles in self._name_to_smiles.items():
            if name in lower_goal:
                return canonical_smiles

        for keywords, canonical_smiles in self._keyword_templates:
            if all(keyword in lower_goal for keyword in keywords):
                return canonical_smiles

        if domain_key == "polymer":
            return self._pick_property_template("polymer", bandgap, density, stability)

        if domain_key == "electrolyte":
            return self._pick_property_template("electrolyte", bandgap, density, stability)

        if domain_key == "catalyst":
            return "O=C=O"

        if domain_key == "crystal":
            return self._pick_property_template("crystal", bandgap, density, stability)

        return None

    def _normalize_material_type(self, value: str) -> str:
        return (value or "").strip().lower().replace("-", "_").replace(" ", "_")

    def _pick_property_template(self, material_type: str, bandgap: float, density: float, stability: float) -> Optional[str]:
        palette = self._property_palette.get(material_type, ["CCO"])
        if not palette:
            return None

        bandgap_bin = min(55, max(0, int(round((bandgap - 0.5) * 10))))
        density_bin = min(75, max(0, int(round((density - 0.5) * 10))))
        stability_bin = min(80, max(0, int(round((stability - 0.2) * 100))))
        base_idx = (bandgap_bin * 7) + (density_bin * 11) + (stability_bin * 13)

        signature = f"{material_type}|{bandgap_bin}|{density_bin}|{stability_bin}"
        mix = int(hashlib.md5(signature.encode("utf-8")).hexdigest(), 16)
        idx = (base_idx + mix) % len(palette)
        return palette[idx]

    def _parse_formula(self, value: str) -> List[str]:
        if not isinstance(value, str):
            return []
        formula = value.strip()
        if not formula or not self._formula_pattern.fullmatch(formula):
            return []

        atoms: List[str] = []
        for match in re.finditer(r"([A-Z][a-z]?)(\d*)", formula):
            symbol = match.group(1)
            count_text = match.group(2)
            count = int(count_text) if count_text else 1
            count = max(1, min(count, 80))
            atoms.extend([symbol] * count)
        return atoms

    def _atoms_to_formula(self, atoms: List[str]) -> str:
        counts: Dict[str, int] = {}
        for atom in atoms:
            counts[atom] = counts.get(atom, 0) + 1
        return "".join(f"{atom}{counts[atom] if counts[atom] > 1 else ''}" for atom in sorted(counts.keys()))

    def _extract_formula_from_text(self, text: str) -> List[str]:
        if not isinstance(text, str) or not text.strip():
            return []
        for token in self._formula_in_text_pattern.findall(text):
            parsed = self._parse_formula(token)
            if len(parsed) >= 2:
                return parsed
        return []

    def apply_feedback(self, candidate: StructureCandidate, pressure: float) -> StructureCandidate:
        adjusted_atoms: List[Atom3D] = []
        scale = 1 - pressure * 0.02
        for atom in candidate.atoms_3d:
            adjusted_atoms.append(
                Atom3D(
                    id=atom.id,
                    element=atom.element,
                    x=round(atom.x * scale, 4),
                    y=round(atom.y * scale, 4),
                    z=round(atom.z * scale, 4),
                    bonds_used=atom.bonds_used,
                    max_valency=atom.max_valency,
                )
            )

        atoms = [atom.element for atom in adjusted_atoms]
        coordinates = [[atom.x, atom.y, atom.z] for atom in adjusted_atoms]

        return StructureCandidate(
            candidate_id=f"{candidate.candidate_id}-r",
            representation_type=candidate.representation_type,
            xyz=self._to_xyz(adjusted_atoms),
            cif=self._to_cif(adjusted_atoms),
            smiles=candidate.smiles,
            depiction_png_base64=candidate.depiction_png_base64,
            depiction_source=candidate.depiction_source,
            atoms=atoms,
            coordinates=coordinates,
            atoms_3d=adjusted_atoms,
            bonds=candidate.bonds,
            aromatic_atom_ids=candidate.aromatic_atom_ids,
            validation=candidate.validation,
            validity_notes=candidate.validity_notes + [f"Feedback compression applied (pressure={pressure:.2f})."],
        )

    def _to_xyz(self, atoms_3d: List[Atom3D]) -> str:
        lines = [str(len(atoms_3d)), "GenMat-Omni generated structure"]
        for atom in atoms_3d:
            lines.append(f"{atom.element} {atom.x:.4f} {atom.y:.4f} {atom.z:.4f}")
        return "\n".join(lines)

    def _to_cif(self, atoms_3d: List[Atom3D]) -> str:
        lines = [
            "data_genmat_omni",
            "_symmetry_space_group_name_H-M    'P1'",
            "loop_",
            "_atom_site_label",
            "_atom_site_type_symbol",
            "_atom_site_fract_x",
            "_atom_site_fract_y",
            "_atom_site_fract_z",
        ]
        for atom in atoms_3d:
            lines.append(f"{atom.element}{atom.id + 1} {atom.element} {atom.x:.4f} {atom.y:.4f} {atom.z:.4f}")
        return "\n".join(lines)
