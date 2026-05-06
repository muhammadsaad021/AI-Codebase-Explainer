# backend/explainer.py
import os
import time
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
    "You receive the FULL content of a specific source file and must give a COMPLETE, structured summary.\n\n"
    "FORMAT YOUR RESPONSE EXACTLY LIKE THIS:\n"
    "1. Start with a one-sentence **Purpose** of the file.\n"
    "2. List ALL functions/classes/methods in the file with a description of each using bullet points. "
    "Do NOT skip any — you must cover every single function and class.\n"
    "3. Include the most important code snippet(s) using markdown fenced code blocks "
    "(```language\\ncode\\n```).\n"
    "4. End with a short **How it connects** section explaining how this file relates to the rest of the project.\n\n"
    "RULES:\n"
    "- Use markdown formatting: **bold** for emphasis, `backticks` for identifiers.\n"
    "- Be THOROUGH and COMPLETE — cover every function/class in the file. Do NOT truncate or abbreviate.\n"
    "- If the file has many functions, list them all. Completeness is more important than brevity.\n"
    "- ONLY use the provided code. Never invent or hallucinate content.\n"
    "- Always finish your response fully. Never stop mid-sentence or mid-list."
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
    "- Answer the question COMPLETELY. Do not cut short or give partial answers.\n"
    "- If the question asks about multiple things, address each one.\n"
    "- ONLY use the provided code snippets. If the answer isn't in the code, say so.\n"
    "- Always finish your response fully. Never stop mid-sentence."
)

# Model cascade: try the best model first, fall back on rate limits
PRIMARY_MODEL = "llama-3.3-70b-versatile"
FALLBACK_MODEL = "llama-3.1-8b-instant"

# Max retry attempts per model for transient API failures
MAX_RETRIES = 2
RETRY_BACKOFF_BASE = 1.5  # seconds


def _call_groq(messages, model, max_tokens):
    """
    Make a single Groq API call with retry logic.
    Returns (content, should_fallback) tuple.
    - content: the response string (or error string)
    - should_fallback: True if the caller should try a different model (rate limited)
    """
    last_error = None

    for attempt in range(MAX_RETRIES):
        try:
            payload = {
                "model": model,
                "messages": messages,
                "temperature": 0.0,
                "max_tokens": max_tokens,
            }

            response = requests.post(GROQ_URL, headers=headers, json=payload, timeout=60)

            if response.status_code == 200:
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                finish_reason = data["choices"][0].get("finish_reason", "unknown")

                if finish_reason == "length":
                    print(f"[WARN] {model} response truncated (hit max_tokens={max_tokens}).")

                print(f"[OK] Response from {model} ({finish_reason})")
                return content, False

            elif response.status_code == 429:
                # Rate limited — retry once, then signal fallback
                if attempt < MAX_RETRIES - 1:
                    wait_time = RETRY_BACKOFF_BASE * (2 ** attempt)
                    print(f"[RETRY] {model} rate limited (429). Waiting {wait_time:.1f}s "
                          f"(attempt {attempt + 1}/{MAX_RETRIES})")
                    time.sleep(wait_time)
                    last_error = f"Rate limited (429)"
                    continue
                else:
                    # Exhausted retries on this model — signal fallback
                    print(f"[FALLBACK] {model} rate limited after {MAX_RETRIES} attempts. "
                          f"Will try fallback model.")
                    return None, True

            elif response.status_code >= 500:
                wait_time = RETRY_BACKOFF_BASE * (2 ** attempt)
                print(f"[RETRY] {model} server error ({response.status_code}). "
                      f"Waiting {wait_time:.1f}s (attempt {attempt + 1}/{MAX_RETRIES})")
                time.sleep(wait_time)
                last_error = f"Error {response.status_code}: {response.text}"
                continue

            else:
                return f"Error {response.status_code}: {response.text}", False

        except requests.exceptions.Timeout:
            wait_time = RETRY_BACKOFF_BASE * (2 ** attempt)
            print(f"[RETRY] {model} timed out. Waiting {wait_time:.1f}s "
                  f"(attempt {attempt + 1}/{MAX_RETRIES})")
            time.sleep(wait_time)
            last_error = "Request timed out"
            continue

        except Exception as e:
            return f"Request failed: {str(e)}", False

    return f"Request failed after {MAX_RETRIES} attempts: {last_error}", False


def explain_code_hf(code_chunks, question="Explain this code in simple terms", is_file_summary=False):
    """
    Sends one or more code chunks to Groq for a unified explanation.
    Uses a model cascade: tries llama-3.3-70b first for quality,
    falls back to llama-3.1-8b-instant if rate limited.
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
    max_tokens = 4096 if is_file_summary else 2048

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Question: {question}\n\nRelevant code:\n{context}"},
    ]

    # 1. Try primary model (70B — best quality)
    result, should_fallback = _call_groq(messages, PRIMARY_MODEL, max_tokens)

    if result is not None and not should_fallback:
        return result

    # 2. Fallback to smaller model (8B — higher rate limits)
    print(f"[FALLBACK] Switching from {PRIMARY_MODEL} → {FALLBACK_MODEL}")
    result, _ = _call_groq(messages, FALLBACK_MODEL, max_tokens)

    if result is not None:
        return result

    return "All models exhausted. Please try again in a few minutes."