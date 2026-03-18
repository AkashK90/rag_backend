from functools import lru_cache
from pinecone import Pinecone
from langchain_openai import OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from app.core.config import get_settings

settings = get_settings()

@lru_cache()
def get_embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(
        model=settings.openai_embedding_model,
        openai_api_key=settings.openai_api_key,
    )

@lru_cache()
def get_pinecone_index():
    pc = Pinecone(api_key=settings.pinecone_api_key)
    return pc.Index(settings.pinecone_index_name)

def get_vectorstore() -> PineconeVectorStore:
    return PineconeVectorStore(
        index=get_pinecone_index(),
        embedding=get_embeddings(),
        text_key="text",
    )
