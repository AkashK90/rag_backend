import uuid
import asyncio
from pathlib import Path
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_not_exception_type

from langchain_community.document_loaders import PyMuPDFLoader, TextLoader, Docx2txtLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_pinecone import PineconeVectorStore

from app.core.config import get_settings
from app.core.dependencies import get_embeddings, get_pinecone_index
from app.services.document_version_service import (
    register_version,
    deregister_document,
    get_current_vector_ids,
    get_version_vector_ids,
    rollback_to_version as _rollback_registry,
)

settings = get_settings()

def _get_splitter() -> RecursiveCharacterTextSplitter:
    return RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        separators=["\n\n", "\n", ". ", " "],
    )

def _load_and_split(file_path: str, filename: str, version_id: str):
    """Sync: load file, split into chunks, stamp each chunk with version_id."""
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        loader = PyMuPDFLoader(file_path)
    elif ext == ".txt":
        loader = TextLoader(file_path, encoding="utf-8")
    elif ext == ".docx":
        loader = Docx2txtLoader(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}. Only PDF, TXT, and DOCX are supported.")

    try:
        documents = loader.load()
    except ModuleNotFoundError as e:
        if ext == ".docx":
            raise ModuleNotFoundError(
                "DOCX support requires 'docx2txt'. Install it in the active runtime with: "
                "pip install docx2txt==0.8"
            ) from e
        raise
    splitter = _get_splitter()
    chunks = splitter.split_documents(documents)

    vector_ids = []
    for i, chunk in enumerate(chunks):
        vid = str(uuid.uuid4())
        vector_ids.append(vid)
        chunk.metadata["filename"] = filename
        chunk.metadata["chunk_index"] = i
        chunk.metadata["doc_id"] = vid
        chunk.metadata["version_id"] = version_id

    return chunks, vector_ids


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_not_exception_type((ValueError, ModuleNotFoundError)),
)
async def ingest_document(file_path: str, filename: str) -> int:
    """
    Full ingestion pipeline:
    Load -> Split -> Embed -> Store in Pinecone -> Register version
    Returns number of chunks ingested.
    """
    logger.info(f"Starting ingestion: {filename}")

    version_id = f"v{uuid.uuid4().hex[:8]}"
    file_size = Path(file_path).stat().st_size

    loop = asyncio.get_event_loop()
    chunks, vector_ids = await loop.run_in_executor(
        None, _load_and_split, file_path, filename, version_id
    )
    logger.info(f"Split {filename} into {len(chunks)} chunks (version: {version_id})")

    vectorstore = PineconeVectorStore(
        index=get_pinecone_index(),
        embedding=get_embeddings(),
        text_key="text",
    )
    await vectorstore.aadd_documents(chunks, ids=vector_ids)
    logger.info(f"Stored {len(chunks)} vectors in Pinecone for {filename}")

    await register_version(
        filename=filename,
        chunks=len(chunks),
        size_bytes=file_size,
        vector_ids=vector_ids,
    )

    return len(chunks)


async def delete_document_by_filename(filename: str) -> int:
    """Delete ALL versions of a document from Pinecone + deregister from registry."""
    try:
        index = get_pinecone_index()
        results = index.query(
            vector=[0.0] * 1536,
            top_k=10000,
            filter={"filename": {"$eq": filename}},
            include_metadata=False,
        )
        ids = [match["id"] for match in results.get("matches", [])]
        if ids:
            index.delete(ids=ids)
            logger.info(f"Deleted {len(ids)} vectors for file: {filename}")
        await deregister_document(filename)
        return len(ids)
    except Exception as e:
        logger.error(f"Delete failed for {filename}: {e}")
        raise


async def rollback_document(filename: str, version_id: str) -> int:
    """
    Roll back document to a specific version.
    Old vectors are already in Pinecone — just delete current-only vectors
    and update registry to point to old version.
    Returns chunk count of restored version.
    """
    try:
        index = get_pinecone_index()
        old_vector_ids = await get_version_vector_ids(filename, version_id)
        if not old_vector_ids:
            raise ValueError(f"No vectors found for version {version_id} of {filename}")

        current_ids = await get_current_vector_ids(filename)
        if current_ids:
            to_delete = [vid for vid in current_ids if vid not in old_vector_ids]
            if to_delete:
                index.delete(ids=to_delete)
                logger.info(f"Deleted {len(to_delete)} current-only vectors during rollback")

        version_data = await _rollback_registry(filename, version_id)
        chunks = version_data.get("chunks", len(old_vector_ids))
        logger.info(f"Rolled back {filename} to {version_id} ({chunks} chunks)")
        return chunks
    except Exception as e:
        logger.error(f"Rollback failed for {filename} to {version_id}: {e}")
        raise
