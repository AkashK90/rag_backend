from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from app.core.config import get_settings

settings = get_settings()
FALLBACK_ANSWER = "I don't have enough information in my knowledge base to answer that."

SYSTEM_PROMPT = """You are a helpful, empathetic, professional AI assistant.
Answer the user's question using ONLY the context provided below.
If the answer is not found in the context, say exactly:
"I don't have enough information in my knowledge base to answer that."
Never make up information. Be concise, accurate, and helpful.

Formatting rules:
- Respond in Markdown.
- If the answer is a list, use bullet points.
- Use **bold** for titles and key terms when helpful.
- Keep descriptive text in normal (non-bold) style.
- Keep line breaks so the answer is easy to read.
- If a URL is included, format it as a clickable Markdown link: [label](url).

Context:
{context}
"""


def _build_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.openai_chat_model,
        openai_api_key=settings.openai_api_key,
        temperature=0.7,
        max_tokens=1000,
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
    Build the full prompt with context + history and call GPT-4o-mini.
    Returns the answer string.
    """
    llm = _build_llm()

    # Build context string
    if not context_texts:
        return FALLBACK_ANSWER
    context = "\n\n---\n\n".join(context_texts)

    # System message with injected context
    system_msg = SystemMessage(content=SYSTEM_PROMPT.format(context=context))

    # Full message list: system + history + current question
    messages = [system_msg] + history + [HumanMessage(content=question)]

    logger.info(f"Calling GPT-4o-mini with {len(messages)} messages (history: {len(history)})")

    response = await llm.ainvoke(messages)
    answer = response.content

    logger.info(f"GPT-4o-mini answered: {answer[:80]}...")
    return answer
