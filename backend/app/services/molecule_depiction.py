import base64
from typing import Optional, Tuple
from urllib.parse import quote

import httpx


class MoleculeDepictionService:
    """Generates chemistry-accurate 2D depictions from SMILES using public chemistry services."""

    async def render_structure_image_base64(
        self,
        smiles: Optional[str],
        atoms: Optional[list[str]] = None,
        coordinates: Optional[list[list[float]]] = None,
        bonds: Optional[list[dict]] = None,
    ) -> Tuple[Optional[str], str]:
        # Prefer local depiction from the generated molecule object so 2D and 3D stay consistent.
        svg_base64 = self._render_local_svg_base64(atoms or [], coordinates or [], bonds or [])
        if svg_base64:
            return svg_base64, "local-svg"

        if smiles:
            encoded = quote(smiles, safe="")
            pubchem_url = (
                "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/"
                f"{encoded}/PNG?image_size=600x600"
            )
            cactus_url = f"https://cactus.nci.nih.gov/chemical/structure/{encoded}/image?format=png"

            for url, source in ((pubchem_url, "pubchem"), (cactus_url, "nci-cactus")):
                png_base64 = await self._try_fetch_png_base64(url)
                if png_base64:
                    return png_base64, source

        return None, "unavailable"

    async def render_smiles_png_base64(self, smiles: Optional[str]) -> Tuple[Optional[str], str]:
        # Backward-compatible API for existing callers.
        return await self.render_structure_image_base64(smiles=smiles)

    async def _try_fetch_png_base64(self, url: str) -> Optional[str]:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.get(url)
                response.raise_for_status()
                content_type = response.headers.get("content-type", "")
                if "image" not in content_type:
                    return None
                return base64.b64encode(response.content).decode("ascii")
        except Exception:
            return None

    def _distance_3d(self, a: list[float], b: list[float]) -> float:
        dx = a[0] - b[0]
        dy = a[1] - b[1]
        dz = a[2] - b[2]
        return (dx * dx + dy * dy + dz * dz) ** 0.5

    def _build_bond_pairs(self, atoms: list[str], coordinates: list[list[float]]) -> list[tuple[int, int]]:
        covalent_radii = {
            "H": 0.31,
            "C": 0.76,
            "N": 0.71,
            "O": 0.66,
            "F": 0.57,
            "P": 1.07,
            "S": 1.05,
            "Cl": 1.02,
            "Br": 1.2,
            "Li": 1.28,
            "Fe": 1.24,
            "Si": 1.11,
        }
        valence_limits = {
            "H": 1,
            "C": 4,
            "N": 3,
            "O": 2,
            "F": 1,
            "P": 5,
            "S": 6,
            "Cl": 1,
            "Br": 1,
            "Li": 1,
            "Fe": 6,
            "Si": 4,
        }

        candidates: list[tuple[int, int, float]] = []
        for i in range(len(coordinates)):
            for j in range(i + 1, len(coordinates)):
                ai = atoms[i]
                aj = atoms[j]
                ri = covalent_radii.get(ai, 0.85)
                rj = covalent_radii.get(aj, 0.85)
                d = self._distance_3d(coordinates[i], coordinates[j])
                min_bond = 0.35 if (ai == "H" or aj == "H") else 0.55
                max_bond = (ri + rj) * 1.22
                if min_bond <= d <= max_bond:
                    candidates.append((i, j, d))

        candidates.sort(key=lambda item: item[2])
        neighbor_counts = [0 for _ in atoms]
        bond_keys: set[str] = set()
        bonds: list[tuple[int, int]] = []

        for i, j, _ in candidates:
            limit_i = valence_limits.get(atoms[i], 4)
            limit_j = valence_limits.get(atoms[j], 4)
            if neighbor_counts[i] >= limit_i or neighbor_counts[j] >= limit_j:
                continue
            key = f"{min(i, j)}-{max(i, j)}"
            if key in bond_keys:
                continue
            bond_keys.add(key)
            bonds.append((i, j))
            neighbor_counts[i] += 1
            neighbor_counts[j] += 1

        for i in range(len(coordinates)):
            if neighbor_counts[i] > 0:
                continue

            ai = atoms[i]
            best_j = -1
            best_d = 10_000.0
            for j in range(len(coordinates)):
                if i == j:
                    continue
                aj = atoms[j]
                if neighbor_counts[j] >= valence_limits.get(aj, 4):
                    continue
                ri = covalent_radii.get(ai, 0.85)
                rj = covalent_radii.get(aj, 0.85)
                d = self._distance_3d(coordinates[i], coordinates[j])
                min_bond = 0.3 if (ai == "H" or aj == "H") else 0.5
                max_bond = (ri + rj) * 1.45
                if d < min_bond or d > max_bond:
                    continue
                if d < best_d:
                    best_d = d
                    best_j = j

            if best_j >= 0:
                key = f"{min(i, best_j)}-{max(i, best_j)}"
                if key not in bond_keys:
                    bond_keys.add(key)
                    bonds.append((i, best_j))
                    neighbor_counts[i] += 1
                    neighbor_counts[best_j] += 1

        return bonds

    def _render_local_svg_base64(
        self,
        atoms: list[str],
        coordinates: list[list[float]],
        bonds: list[dict],
    ) -> Optional[str]:
        if not atoms or not coordinates or len(atoms) != len(coordinates):
            return None

        projected = [(point[0] + point[2] * 0.25, point[1] - point[2] * 0.2) for point in coordinates]
        xs = [point[0] for point in projected]
        ys = [point[1] for point in projected]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        width = max(max_x - min_x, 1e-6)
        height = max(max_y - min_y, 1e-6)

        def to_2d(point: tuple[float, float]) -> tuple[float, float]:
            x = 40 + ((point[0] - min_x) / width) * 620
            y = 40 + ((point[1] - min_y) / height) * 320
            return x, y

        points = [to_2d(point) for point in projected]
        bond_pairs: list[tuple[int, int]] = []
        if bonds:
            for bond in bonds:
                from_idx = bond.get("from", bond.get("from_atom", -1))
                to_idx = bond.get("to", bond.get("to_atom", -1))
                if isinstance(from_idx, int) and isinstance(to_idx, int):
                    if 0 <= from_idx < len(atoms) and 0 <= to_idx < len(atoms):
                        bond_pairs.append((from_idx, to_idx))
        else:
            bond_pairs = self._build_bond_pairs(atoms, coordinates)

        atom_colors = {
            "H": "#e2e8f0",
            "C": "#1f2937",
            "O": "#ef4444",
            "N": "#3b82f6",
            "Li": "#facc15",
            "Fe": "#6b7280",
        }

        lines = []
        for i, j in bond_pairs:
            xi, yi = points[i]
            xj, yj = points[j]
            lines.append(f'<line x1="{xi:.1f}" y1="{yi:.1f}" x2="{xj:.1f}" y2="{yj:.1f}" stroke="#a7a7a7" stroke-width="3" />')

        nodes = []
        for idx, atom in enumerate(atoms):
            x, y = points[idx]
            radius = 11 if atom == "H" else 15
            fill = atom_colors.get(atom, "#14b8a6")
            nodes.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{radius}" fill="{fill}" stroke="#0f172a" stroke-width="1.5" />')
            nodes.append(f'<text x="{x:.1f}" y="{y + 4:.1f}" text-anchor="middle" font-size="11" font-family="Arial" fill="#0f172a">{atom}</text>')

        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" width="700" height="400" viewBox="0 0 700 400">'
            '<rect x="0" y="0" width="700" height="400" fill="#ffffff" />'
            + "".join(lines)
            + "".join(nodes)
            + '</svg>'
        )
        return base64.b64encode(svg.encode("utf-8")).decode("ascii")
