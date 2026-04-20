from pydantic import BaseModel
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "MatGenAI API"
    app_version: str = "0.1.0"
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")
    groq_model: str = "llama-3.3-70b-versatile"
    max_iterations: int = 4
    min_acceptance_score: float = 0.68


class RuntimeMetadata(BaseModel):
    llm_mode: str
    optimization_iterations: int


settings = AppSettings()
