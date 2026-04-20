import os
import sys
import json
import time
import random
import requests
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    print("Error: GROQ_API_KEY not found in .env file.")
    sys.exit(1)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
HEADERS = {
    "Authorization": f"Bearer {GROQ_API_KEY}",
    "Content-Type": "application/json",
}

OUTPUT_FILE = "training_data.jsonl"
TARGET_TOTAL = 550

DIVERSE_TOPICS = [
    "Python Pandas Data Science", "Python Django Backend", 
    "React TypeScript Frontend", "Node Express API",
    "Go Microservice", "Go Concurrent Worker",
    "Java Spring Boot Controller", "Java Database Entity",
    "C++ Memory Management", "C++ Game Engine Logic",
    "Rust Systems Code", "Rust CLI Tool",
    "Ruby on Rails Model", "PHP Laravel Routing",
    "C# .NET Core Service", "SQL Complex Analytics Query",
    "Shell Scripting CI/CD", "Docker Compose Config"
]

def generate_diverse_batch(topic):
    """
    Sends a prompt to Groq to hallucinate diverse code snippets and questions.
    Returns a list of dicts.
    """
    prompt = f"""You are generating training data for a Code Search RAG system.
Generate exactly 4 diverse, realistic code snippets for the topic: "{topic}".
For each snippet, write a natural language question a developer might ask to find this code.

You MUST respond strictly with a valid JSON array of objects. Do not include any markdown formatting like ```json or trailing text.
Format precisely like this:
[
  {{
    "question": "How do we initialize the database connection pool?",
    "code": "func InitDB() (*sql.DB, error) {{\\n  // ...\\n}}",
    "file_path": "database/connection.go",
    "language": "go"
  }}
]
"""

    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7,
        "max_tokens": 1500,
    }

    try:
        response = requests.post(GROQ_URL, headers=HEADERS, json=payload, timeout=20)
        if response.status_code == 200:
            data = response.json()
            content = data["choices"][0]["message"]["content"].strip()
            
            # Clean up potential markdown formatting from LLM
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
            
            parsed = json.loads(content)
            return parsed if isinstance(parsed, list) else []
        elif response.status_code == 429:
            import re
            data = response.json()
            err_msg = data.get("error", {}).get("message", "")
            print(f"\nRate Limit Hit! Groq says: {err_msg}")
            
            # Dynamic backoff
            match = re.search(r"try again in ([\d\.]+)s", err_msg)
            if match:
                delay = float(match.group(1)) + 1.0 # Add a 1s buffer
                print(f"Backing off dynamically for {delay:.2f} seconds...")
                time.sleep(delay)
            else:
                print("Backing off for 15 seconds...")
                time.sleep(15)
            return []
        else:
            print(f"\nGroq API Error {response.status_code}: {response.text}")
            return []
    except Exception as e:
        print(f"\nRequest failed: {str(e)}")
        return []

def main():
    output_path = os.path.join(os.path.dirname(__file__), OUTPUT_FILE)
    
    # Read existing count
    existing_count = 0
    if os.path.exists(output_path):
        with open(output_path, "r", encoding="utf-8") as f:
            existing_count = sum(1 for line in f if line.strip())
            
    print(f"Current entries in dataset: {existing_count}")
    print(f"Target is {TARGET_TOTAL}. Expanding dataset...")

    with open(output_path, "a", encoding="utf-8") as f:
        while existing_count < TARGET_TOTAL:
            topic = random.choice(DIVERSE_TOPICS)
            print(f"Generating batch for topic: {topic} ...", end=" ")
            
            new_entries = generate_diverse_batch(topic)
            
            if new_entries:
                for entry in new_entries:
                    if "question" in entry and "code" in entry:
                        f.write(json.dumps(entry) + "\n")
                        existing_count += 1
                f.flush()
                print(f"Added {len(new_entries)} entries. (Total: {existing_count}/{TARGET_TOTAL})")
            else:
                print("Failed or parse error.")
            
            time.sleep(1) # rate limits

    print(f"\nFinished! Dataset expanded successfully. Total size: {existing_count}")

if __name__ == "__main__":
    main()
