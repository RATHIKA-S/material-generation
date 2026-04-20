export const COVALENT_RADII = {
  H: 0.31,
  C: 0.76,
  N: 0.71,
  O: 0.66,
  F: 0.57,
  P: 1.07,
  S: 1.05,
  Cl: 1.02,
  Br: 1.2,
  Li: 1.28,
  Fe: 1.24,
  Si: 1.11,
};

export const MAX_VALENCE = {
  H: 1,
  C: 4,
  N: 3,
  O: 2,
  F: 1,
  P: 5,
  S: 6,
  Cl: 1,
  Br: 1,
  Li: 1,
  Fe: 6,
  Si: 4,
};

export function normalizeBondObjects(bonds = []) {
  if (!Array.isArray(bonds)) {
    return [];
  }

  const normalized = [];
  for (const bond of bonds) {
    if (!bond || typeof bond !== "object") {
      continue;
    }
    const from = Number.isInteger(bond.from) ? bond.from : bond.from_atom;
    const to = Number.isInteger(bond.to) ? bond.to : bond.to_atom;
    const orderRaw = Number.isInteger(bond.order) ? bond.order : 1;
    const order = Math.min(3, Math.max(1, orderRaw));

    if (!Number.isInteger(from) || !Number.isInteger(to)) {
      continue;
    }
    normalized.push({ from, to, order });
  }

  return normalized;
}

export function distance3d(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function buildBondIndexPairs(atoms = [], coordinates = []) {
  if (!Array.isArray(atoms) || !Array.isArray(coordinates) || atoms.length !== coordinates.length) {
    return [];
  }

  const candidates = [];
  for (let i = 0; i < coordinates.length; i += 1) {
    for (let j = i + 1; j < coordinates.length; j += 1) {
      const ai = atoms[i];
      const aj = atoms[j];
      const ri = COVALENT_RADII[ai] || 0.85;
      const rj = COVALENT_RADII[aj] || 0.85;
      const d = distance3d(coordinates[i], coordinates[j]);
      const minBond = ai === "H" || aj === "H" ? 0.35 : 0.55;
      const maxBond = (ri + rj) * 1.22;
      if (d >= minBond && d <= maxBond) {
        candidates.push({ i, j, d });
      }
    }
  }

  candidates.sort((a, b) => a.d - b.d);

  const counts = Array.from({ length: atoms.length }, () => 0);
  const bondKeys = new Set();
  const bonds = [];

  for (const candidate of candidates) {
    const limitI = MAX_VALENCE[atoms[candidate.i]] || 4;
    const limitJ = MAX_VALENCE[atoms[candidate.j]] || 4;
    if (counts[candidate.i] >= limitI || counts[candidate.j] >= limitJ) {
      continue;
    }

    const key = `${Math.min(candidate.i, candidate.j)}-${Math.max(candidate.i, candidate.j)}`;
    if (bondKeys.has(key)) {
      continue;
    }
    bondKeys.add(key);
    bonds.push([candidate.i, candidate.j]);
    counts[candidate.i] += 1;
    counts[candidate.j] += 1;
  }

  // Attach isolated atoms to nearest plausible neighbor to keep full connectivity visible.
  for (let i = 0; i < coordinates.length; i += 1) {
    if (counts[i] > 0) {
      continue;
    }

    const ai = atoms[i];
    const limitI = MAX_VALENCE[ai] || 4;
    if (limitI <= 0) {
      continue;
    }

    let best = null;
    for (let j = 0; j < coordinates.length; j += 1) {
      if (i === j) {
        continue;
      }

      const aj = atoms[j];
      const limitJ = MAX_VALENCE[aj] || 4;
      if (counts[j] >= limitJ) {
        continue;
      }

      const ri = COVALENT_RADII[ai] || 0.85;
      const rj = COVALENT_RADII[aj] || 0.85;
      const d = distance3d(coordinates[i], coordinates[j]);
      const minBond = ai === "H" || aj === "H" ? 0.3 : 0.5;
      const maxBond = (ri + rj) * 1.45;
      if (d < minBond || d > maxBond) {
        continue;
      }

      if (!best || d < best.d) {
        best = { i, j, d };
      }
    }

    if (best) {
      const key = `${Math.min(best.i, best.j)}-${Math.max(best.i, best.j)}`;
      if (!bondKeys.has(key)) {
        bondKeys.add(key);
        bonds.push([best.i, best.j]);
        counts[best.i] += 1;
        counts[best.j] += 1;
      }
    }
  }

  return bonds;
}

function normalize3(vec) {
  const len = Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2]);
  if (len < 1e-9) {
    return [0, 0, 1];
  }
  return [vec[0] / len, vec[1] / len, vec[2] / len];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function add(a, b, scale = 1) {
  return [a[0] + b[0] * scale, a[1] + b[1] * scale, a[2] + b[2] * scale];
}

export function buildOrderedBondSegments(coordinates = [], bonds = []) {
  if (!Array.isArray(coordinates) || !coordinates.length || !Array.isArray(bonds)) {
    return [];
  }

  const normalized = normalizeBondObjects(bonds);
  const segments = [];

  for (const bond of normalized) {
    if (bond.from < 0 || bond.to < 0 || bond.from >= coordinates.length || bond.to >= coordinates.length) {
      continue;
    }

    const p1 = coordinates[bond.from];
    const p2 = coordinates[bond.to];
    const dir = normalize3([p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]]);
    let normal = cross(dir, [0, 0, 1]);
    if (Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]) < 1e-6) {
      normal = cross(dir, [0, 1, 0]);
    }
    normal = normalize3(normal);

    const multipliers = bond.order === 1 ? [0] : bond.order === 2 ? [-0.5, 0.5] : [-1, 0, 1];
    const offset = 0.08;

    for (const m of multipliers) {
      segments.push({
        points: [add(p1, normal, m * offset), add(p2, normal, m * offset)],
        order: bond.order,
      });
    }
  }

  return segments;
}

export function projectCoordinatesToCard(coordinates = []) {
  if (!Array.isArray(coordinates) || !coordinates.length) {
    return [];
  }

  const projected = coordinates.map(([x, y, z]) => [x + z * 0.25, y - z * 0.2]);
  const xs = projected.map((point) => point[0]);
  const ys = projected.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 1e-6);
  const height = Math.max(maxY - minY, 1e-6);

  return projected.map(([x, y]) => [
    50 + ((x - minX) / width) * 600,
    50 + ((y - minY) / height) * 300,
  ]);
}
