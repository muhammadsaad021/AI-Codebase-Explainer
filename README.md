# AI Codebase Explainer

![License](https://img.shields.io/badge/license-MIT-blue) ![Python](https://img.shields.io/badge/python-3.10%2B-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-green)

A local Retrieval-Augmented Generation (RAG) platform for parsing, visualizing, and querying any GitHub repository through natural language. Built on a custom fine-tuned dense retrieval model (`all-MiniLM-L6-v2`) and powered by Groq's Llama-3.3 70B inference API, the tool transforms unfamiliar codebases into interactive architectural graphs and structured AI-generated insights.

---

## Features

- **Precise File Summaries:** Click any file in the explorer to inject its exact source content into the LLM, bypassing semantic retrieval entirely for deterministic, hallucination-free output.
- **Interactive Dependency Graphs:** Visualize codebase architecture through a D3 Force-directed graph with proximity-based focus highlighting, animated directional particles, and per-language color coding.
- **Natural Language Code Search:** Ask questions like *"Where is authentication handled?"* and receive multi-chunk contextual answers grounded in the actual source code, with file and line references.
- **Custom Embedding Fine-Tuning:** Includes a complete ML pipeline for generating synthetic QA datasets and fine-tuning the FAISS retrieval vectors using contrastive learning, tailored to your codebase's domain vocabulary.

---

## Quick Start

### 1. Prerequisites

- Python 3.10 or higher
- A free API key from [Groq Cloud](https://console.groq.com/)

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/muhammadsaad021/AI-Codebase-Explainer.git
cd AI-Codebase-Explainer

python -m venv venv
# Windows:
venv\Scripts\activate
# macOS / Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Environment Variables

Create a `.env` file in the project root:

```env
GROQ_API_KEY=gsk_your_groq_api_key_here
```

### 4. Run the Server

Start the FastAPI backend and static file server:

```bash
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000` in your browser.

---

## Architecture

| Module | Responsibility |
|---|---|
| `backend/main.py` | FastAPI application controller. Routes REST endpoints, manages global FAISS index state, and handles the exact-file retrieval bypass for file summaries. |
| `backend/explainer.py` | LLM inference layer. Constructs system prompts, manages Groq API communication with retry logic and exponential backoff, and enforces deterministic output. |
| `backend/search.py` | Semantic search engine. Encodes queries via the embedding model and performs L2 nearest-neighbor lookup against the FAISS index. |
| `backend/embeddings.py` | Embedding model loader. Transparently selects between the base HuggingFace model and a locally fine-tuned model if one exists in `models/`. |
| `backend/chunker.py` | Source code splitter. Segments files into fixed-size line chunks with metadata (file path, language, line range) for indexing. |
| `backend/repo_parser.py` | Repository ingestion. Clones Git repositories, walks the file tree, and filters for supported source code extensions across 15 languages. |
| `backend/architecture.py` | Dependency graph builder. Parses language-specific import statements (Python, JS/TS, C/C++, Java, Go) and constructs a directed NetworkX graph. |
| `frontend/app.js` | Client-side application. Manages the chat interface, file explorer, and D3 Force-graph rendering with interactive hover and focus mechanics. |

---

## Fine-Tuning the Retrieval Model

To adapt the semantic search to domain-specific terminology:

1. Run `training/generate_dataset.py` to synthesize 500+ QA/code pairs across multiple programming languages.
2. Open `training/train_embeddings.ipynb` in Jupyter or VS Code.
3. Execute the training cells to fine-tune, cross-validate, and evaluate the model using `sentence-transformers` with `MultipleNegativesRankingLoss`.

The fine-tuned model is automatically saved to `models/finetuned-explainer-model/` and loaded by the backend on the next startup.

---

## Project History

For a detailed account of the development process, including LLM quota challenges, model deprecation workarounds, and architectural decisions, see the [Project Journal](./PROJECT_JOURNAL.md).

---

## License

This project is licensed under the MIT License.
