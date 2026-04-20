from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.schemas import ChatRequest, ChatResponse, DesignResponse, UserDesignRequest
from app.services.orchestrator import GenMatOrchestrator
from app.services.research_agent import ResearchAgent

# Global references initialized in lifespan
orchestrator: GenMatOrchestrator | None = None
research_agent: ResearchAgent | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global orchestrator, research_agent
    orchestrator = GenMatOrchestrator()
    research_agent = ResearchAgent()
    yield
    # Shutdown (cleanup if needed)


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": settings.app_name, "version": settings.app_version}


@app.post("/api/v1/design", response_model=DesignResponse)
async def design_material(payload: UserDesignRequest) -> DesignResponse:
    if not orchestrator:
        raise RuntimeError("Orchestrator not initialized")
    return await orchestrator.run(payload)


@app.post("/api/v1/chat", response_model=ChatResponse)
async def chat_assistant(payload: ChatRequest) -> ChatResponse:
    if not research_agent:
        raise RuntimeError("Research agent not initialized")
    answer, citations = await research_agent.answer_chat(payload.message, payload.context)
    return ChatResponse(answer=answer, citations=citations)
