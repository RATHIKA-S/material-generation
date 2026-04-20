from typing import Dict, List, Tuple

from app.schemas import StructureCandidate

VALENCE_LIMITS: Dict[str, Tuple[int, ...]] = {
    "H": (1,),
    "C": (4,),
    "N": (3, 4),
    "O": (2,),
    "F": (1,),
    "P": (3, 5),
    "S": (2, 4, 6),
    "Cl": (1,),
    "Br": (1,),
    "Li": (1,),
    "Si": (4,),
}

METALS = {"Fe", "Cu", "Zn", "Ni", "Co", "Mn", "Cr", "Ti", "V", "Mo", "W"}


def _distance(a: List[float], b: List[float]) -> float:
    dx = a[0] - b[0]
    dy = a[1] - b[1]
    dz = a[2] - b[2]
    return (dx * dx + dy * dy + dz * dz) ** 0.5


def validate_structure(candidate: StructureCandidate) -> Tuple[bool, Dict[str, bool], List[str]]:
    flags = {
        "nonempty": bool(candidate.atoms),
        "no_overlaps": True,
        "valence_plausible": True,
        "bond_orders_valid": True,
        "connected_graph": True,
        "bond_lengths_realistic": True,
        "aromatic_planarity": True,
        "size_consistent": len(candidate.atoms) == len(candidate.coordinates),
    }
    reasons: List[str] = []

    if not flags["nonempty"]:
        reasons.append("No atoms present in candidate.")
    if not flags["size_consistent"]:
        reasons.append("Atoms and coordinate arrays are mismatched.")

    if candidate.bonds:
        for bond in candidate.bonds:
            if bond.order not in {1, 2, 3}:
                flags["bond_orders_valid"] = False
                reasons.append("Unsupported bond order detected.")
            if bond.from_atom < 0 or bond.to_atom < 0:
                flags["bond_orders_valid"] = False
                reasons.append("Bond index cannot be negative.")
            if bond.from_atom >= len(candidate.atoms) or bond.to_atom >= len(candidate.atoms):
                flags["bond_orders_valid"] = False
                reasons.append("Bond index out of atom range.")
            if 0 <= bond.from_atom < len(candidate.coordinates) and 0 <= bond.to_atom < len(candidate.coordinates):
                d = _distance(candidate.coordinates[bond.from_atom], candidate.coordinates[bond.to_atom])
                if d < 0.9 or d > 1.8:
                    flags["bond_lengths_realistic"] = False
                    reasons.append(f"Bond length out of realistic range: {d:.3f} A")

    for i in range(len(candidate.coordinates)):
        for j in range(i + 1, len(candidate.coordinates)):
            if _distance(candidate.coordinates[i], candidate.coordinates[j]) < 0.45:
                flags["no_overlaps"] = False
                reasons.append("Unphysical atom overlap detected.")
                break

    atom_counts: Dict[str, int] = {}
    bond_usage: List[int] = [0 for _ in candidate.atoms]
    adjacency: List[List[int]] = [[] for _ in candidate.atoms]
    for bond in candidate.bonds:
        if 0 <= bond.from_atom < len(bond_usage) and 0 <= bond.to_atom < len(bond_usage):
            bond_usage[bond.from_atom] += bond.order
            bond_usage[bond.to_atom] += bond.order
            adjacency[bond.from_atom].append(bond.to_atom)
            adjacency[bond.to_atom].append(bond.from_atom)

    if candidate.atoms:
        visited = set()
        stack = [0]
        while stack:
            node = stack.pop()
            if node in visited:
                continue
            visited.add(node)
            stack.extend(adjacency[node])
        if len(visited) != len(candidate.atoms):
            flags["connected_graph"] = False
            reasons.append("Molecular graph is disconnected.")

    for idx, atom in enumerate(candidate.atoms):
        atom_counts[atom] = atom_counts.get(atom, 0) + 1
        if atom in METALS:
            continue
        if atom not in VALENCE_LIMITS:
            flags["valence_plausible"] = False
            reasons.append(f"Unsupported element for valence checks: {atom}")
            continue

        if bond_usage and idx < len(bond_usage):
            if bond_usage[idx] > max(VALENCE_LIMITS[atom]):
                flags["valence_plausible"] = False
                reasons.append(f"Valency violation for {atom} at atom index {idx}.")
            if atom == "H" and bond_usage[idx] != 1:
                flags["valence_plausible"] = False
                reasons.append(f"Hydrogen valency violation at atom index {idx}.")

    if atom_counts.get("H", 0) > atom_counts.get("C", 1) * 6:
        flags["valence_plausible"] = False
        reasons.append("Hydrogen count too high for a stable candidate.")

    if candidate.aromatic_atom_ids:
        for idx in candidate.aromatic_atom_ids:
            if idx < 0 or idx >= len(candidate.coordinates):
                flags["aromatic_planarity"] = False
                reasons.append("Invalid aromatic atom index in candidate metadata.")
                continue
            z = abs(candidate.coordinates[idx][2])
            if z >= 0.3:
                flags["aromatic_planarity"] = False
                reasons.append(f"Aromatic planarity violation at atom index {idx} (|z|={z:.3f}).")

    is_valid = all(flags.values())
    if is_valid:
        reasons.append("Basic geometry and valence checks passed.")

    return is_valid, flags, reasons
