from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # OpenAI
    openai_api_key: str
    openai_embedding_model: str = "text-embedding-3-small"
    openai_chat_model: str = "gpt-4o-mini"

    # Pinecone
    pinecone_api_key: str
    pinecone_index_name: str
    pinecone_environment: str

    # MongoDB
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "rag_backend"

    # Admin
    admin_username: str = "admin"
    admin_password: str = "change-me"

    # App
    app_env: str = 'development'  # "production"
    log_level: str = "INFO"
    max_upload_size_mb: int = 50
    chunk_size: int = 800
    chunk_overlap: int = 80
    top_k_results: int = 3
    cache_ttl_seconds: int = 3600
    session_ttl_seconds: int = 86400

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
