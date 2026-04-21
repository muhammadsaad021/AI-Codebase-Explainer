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

# Separate system prompts for different use cases
SUMMARY_SYSTEM_PROMPT = (
    "You are a senior software engineer reviewing source code files. "
    "You receive the FULL content of a specific source file and must give a structured summary.\n\n"
    "FORMAT YOUR RESPONSE EXACTLY LIKE THIS:\n"
    "1. Start with a one-sentence **Purpose** of the file.\n"
    "2. List all key functions/classes with a brief description of each using bullet points.\n"
    "3. Include the most important code snippet(s) using markdown fenced code blocks "
    "(```language\\ncode\\n```).\n"
    "4. End with a short **How it connects** section explaining how this file relates to the rest of the project.\n\n"
    "RULES:\n"
    "- Use markdown formatting: **bold** for emphasis, `backticks` for identifiers.\n"
    "- Be concise but complete — cover every function/class in the file.\n"
    "- ONLY use the provided code. Never invent or hallucinate content."
)

QUESTION_SYSTEM_PROMPT = (
    "You are a senior code explanation assistant. You receive relevant code "
    "snippets retrieved from a repository and a developer's question.\n\n"
    "FORMAT YOUR RESPONSE LIKE THIS:\n"
    "1. Start with a direct, clear answer to the question.\n"
    "2. Show the most relevant code snippet(s) using markdown fenced code blocks "
    "(```language\\ncode\\n```). Only include the lines that matter — do NOT dump the entire file.\n"
    "3. Explain HOW the code works step by step.\n"
    "4. Reference specific file names and line numbers.\n\n"
    "RULES:\n"
    "- Use markdown formatting: **bold**, `backticks`, bullet points, numbered lists.\n"
    "- Keep it focused — answer ONLY what was asked.\n"
    "- ONLY use the provided code snippets. If the answer isn't in the code, say so."
)


def explain_code_hf(code_chunks, question="Explain this code in simple terms", is_file_summary=False):
    """
    Sends one or more code chunks to Groq (Llama 3.3 70B) for a unified explanation.
    Uses different prompts for file summaries vs general questions.
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

    system_prompt = SUMMARY_SYSTEM_PROMPT if is_file_summary else QUESTION_SYSTEM_PROMPT

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Question: {question}\n\nRelevant code:\n{context}"},
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