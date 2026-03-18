from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential
from langchain_pinecone import PineconeVectorStore
from app.core.config import get_settings
from app.core.dependencies import get_embeddings, get_pinecone_index
from app.utils.helpers import extract_source_label

settings = get_settings()


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def retrieve_relevant_chunks(query: str) -> tuple[list[str], list[str]]:
    """
    Embed the query and retrieve top-k relevant chunks from Pinecone.
    Returns (context_texts, source_labels)
    """
    vectorstore = PineconeVectorStore(
        index=get_pinecone_index(),
        embedding=get_embeddings(),
        text_key="text",
    )

    docs = await vectorstore.asimilarity_search(query, k=settings.top_k_results)
    logger.info(f"Retrieved {len(docs)} chunks for query: {query[:60]}...")

    context_texts = [doc.page_content for doc in docs]
    source_labels = [extract_source_label(doc.metadata) for doc in docs]

    return context_texts, source_labels
