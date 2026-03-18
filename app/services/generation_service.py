from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from app.core.config import get_settings

settings = get_settings()

SYSTEM_PROMPT = """You are a helpful, professional AI assistant.
Answer the user's question using ONLY the context provided below.
If the answer is not found in the context, say: "I don't have enough information in my knowledge base to answer that."
Never make up information. Be concise, accurate, and helpful.

Context:
{context}
"""


def _build_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.openai_chat_model,
        openai_api_key=settings.openai_api_key,
        temperature=0.2,
        request_timeout=30,
        max_retries=2,
    )


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def generate_answer(
    question: str,
    context_texts: list[str],
    history: list[BaseMessage],
) -> str:
    """
    Build the full prompt with context + history and call GPT-4.
    Returns the answer string.
    """
    llm = _build_llm()

    # Build context string
    context = "\n\n---\n\n".join(context_texts) if context_texts else "No context available."

    # System message with injected context
    system_msg = SystemMessage(content=SYSTEM_PROMPT.format(context=context))

    # Full message list: system + history + current question
    messages = [system_msg] + history + [HumanMessage(content=question)]

    logger.info(f"Calling GPT-4 with {len(messages)} messages (history: {len(history)})")

    response = await llm.ainvoke(messages)
    answer = response.content

    logger.info(f"GPT-4 answered: {answer[:80]}...")
    return answer
