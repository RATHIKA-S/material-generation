# GenMat-Omni

GenMat-Omni is a unified AI platform for autonomous material discovery.

## What It Implements

- Groq-powered prompt structuring into chemically relevant constraints (with fallback parser)
- Engine 1: structure generation into XYZ and CIF (3D coordinates)
- Engine 2: predictive validation (stability, reactivity, scores, feasibility placeholder)
- Engine 3: research agent with lightweight RAG-style contextual explanations
- Iterative optimization loop that refines constraints based on prediction feedback
- React dashboard with:
  - Material Designer
  - Prediction Viewer
  - AI Lab Assistant
  - Interactive 3D molecular viewer

## Repository Layout

- `backend/` FastAPI orchestration and AI engines
- `frontend/` React + Vite dashboard
- `package.json` root runner for full-stack dev mode

## One-Command Dev Run

After completing the one-time setup below, run the full stack with:

1. `npm install`
2. `npm run dev`

This starts both services together:

- Backend on `http://localhost:8000`
- Frontend on `http://localhost:5173`

## Backend Setup

1. `cd backend`
2. `python -m venv .venv`
3. Windows: `.venv\\Scripts\\activate`
4. `pip install -r requirements.txt`
5. `copy .env.example .env`
6. Add your Groq key to `.env` as `GROQ_API_KEY=...`
7. `uvicorn app.main:app --reload --port 8000`

## Frontend Setup

1. `cd frontend`
2. `npm install`
3. Optional: set `VITE_API_BASE=http://localhost:8000`
4. `npm run dev`

## API Endpoints

- `GET /health`
- `POST /api/v1/design`
- `POST /api/v1/chat`

## Example Design Request

```json
{
  "prompt": "Design a recyclable polymer with high thermal resistance",
  "domain": "polymer",
  "target_properties": {
    "thermal_stability": 0.9,
    "recyclability": 0.8
  },
  "constraints": {
    "toxicity": "low"
  },
  "synthesis_requested": true
}
```

## Notes

- The generation, GNN prediction, and transformer synthesis blocks are structured with production-ready interfaces, but currently contain deterministic placeholder heuristics so the whole stack can run immediately in a fresh environment.
- Replace internals in `backend/app/services/structure_architect.py` and `backend/app/services/digital_chemist.py` with trained diffusion/VAE and GNN/transformer models to move from scaffold to full scientific deployment.
