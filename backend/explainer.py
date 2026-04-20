# backend/explainer.py
import os
import requests
from dotenv import load_dotenv

load_dotenv()

# Groq API (free tier — 14,400 requests/day)
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

headers = {
    "Authorization": f"Bearer {GROQ_API_KEY}",
    "Content-Type": "application/json",
}


def explain_code_hf(code_chunks, question="Explain this code in simple terms"):
    """
    Sends one or more code chunks to Groq (Llama 3.3 70B) for a unified explanation.
    """
    # Build context from chunks
    if isinstance(code_chunks, str):
        context = code_chunks
    elif isinstance(code_chunks, list):
        parts = []
        for i, chunk in enumerate(code_chunks, 1):
            if isinstance(chunk, dict):
                header = f"--- {chunk.get('file_path', 'unknown')} (lines {chunk.get('start_line', '?')}-{chunk.get('end_line', '?')}) ---"
                parts.append(f"{header}\n{chunk['code']}")
            else:
                parts.append(str(chunk))
        context = "\n\n".join(parts)
    else:
        context = str(code_chunks)

    messages = [
        {
            "role": "system",
            "content": (
                "You are a senior code explanation assistant. You receive relevant code "
                "snippets from a repository and a user question. Give ONE clear, "
                "well-structured answer that directly addresses the question. "
                "IMPORTANT RULES:\n"
                "1. Always include the most relevant code snippets in your answer using "
                "markdown fenced code blocks (```language\\ncode\\n```).\n"
                "2. Reference specific file names and line numbers when relevant.\n"
                "3. Explain WHAT the code does and HOW it works.\n"
                "4. Keep explanations concise but thorough.\n"
                "5. Only use information from the provided code. If the code doesn't "
                "contain the answer, say so — do NOT make up information."
            ),
        },
        {
            "role": "user",
            "content": f"Question: {question}\n\nRelevant code:\n{context}",
        },
    ]

    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 1024,
    }

    try:
        response = requests.post(GROQ_URL, headers=headers, json=payload, timeout=30)

        if response.status_code == 200:
            data = response.json()
            return data["choices"][0]["message"]["content"]
        else:
            return f"Error {response.status_code}: {response.text}"
    except Exception as e:
        return f"Request failed: {str(e)}"