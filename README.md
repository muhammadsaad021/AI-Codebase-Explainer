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
- Jupyter Notebook or VS Code with the Jupyter extension (for the fine-tuning step)

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

### 4. Fine-Tune the Embedding Model

The semantic search engine requires a fine-tuned embedding model to understand the relationship between natural language questions and source code. This step must be completed before running the server.

The training dataset (`training/training_data.jsonl`) is already included in the repository — it was generated using `training/generate_dataset.py`, which calls the Groq API to synthesize 550 question/code pairs across 18 programming domains.

Open `training/train_embeddings.ipynb` in Jupyter or VS Code and run all cells in order. The notebook will:

1. Load and split the dataset (80% train / 10% validation / 10% test)
2. Fine-tune `all-MiniLM-L6-v2` using Multiple Negatives Ranking Loss
3. Evaluate continuously against the validation set using MRR@10
4. Save the best checkpoint to `models/finetuned-explainer-model/`

Training takes approximately 5-15 minutes depending on hardware. Once complete, the `models/finetuned-explainer-model/` directory will exist and the backend will load it automatically on startup.

> **Note:** If you skip this step, the backend will fail to start because `backend/embeddings.py` requires the fine-tuned model directory to exist. You must complete Step 4 before proceeding.

### 5. Run the Server

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
| `backend/explainer.py` | LLM inference layer. Constructs system prompts, manages Groq API communication with a model cascade (Llama-3.3-70B primary, Llama-3.1-8B fallback), retry logic, and exponential backoff. |
| `backend/search.py` | Semantic search engine. Encodes queries via the fine-tuned embedding model and performs L2 nearest-neighbor lookup against the FAISS index. |
| `backend/embeddings.py` | Embedding model loader. Loads the fine-tuned model from `models/finetuned-explainer-model/` on startup. |
| `backend/chunker.py` | Source code splitter. Segments files into fixed-size line chunks with metadata (file path, language, line range) for indexing. |
| `backend/repo_parser.py` | Repository ingestion. Clones Git repositories, walks the file tree, and filters for supported source code extensions across 15 languages. |
| `backend/architecture.py` | Dependency graph builder. Parses language-specific import statements (Python, JS/TS, C/C++, Java, Go) and constructs a directed NetworkX graph. |
| `frontend/app.js` | Client-side application. Manages the chat interface, file explorer, and D3 Force-graph rendering with interactive hover and focus mechanics. |

---

## Fine-Tuning the Retrieval Model

The fine-tuning pipeline adapts the base `all-MiniLM-L6-v2` sentence embedding model to understand the semantic relationship between developer questions and source code — a task the base model was not trained for.

**Why fine-tuning is required:**
The base model is trained on general English text and performs poorly on code retrieval tasks. A query like *"how are workers dispatched concurrently?"* will not reliably retrieve a Go goroutine implementation without domain adaptation. Fine-tuning on synthetic code/question pairs bridges this vocabulary gap.

**Pipeline overview:**

1. `training/generate_dataset.py` — Calls the Groq API to generate labeled (question, code) pairs across 18 domains.
2. `training/train_embeddings.ipynb` — Fine-tunes the model using `MultipleNegativesRankingLoss`, evaluates with `InformationRetrievalEvaluator` (MRR@10, NDCG@10, Accuracy@1/5/10), and saves the best checkpoint.
3. `backend/embeddings.py` — Loads the saved model automatically on backend startup.

The fine-tuned model improves MRR@10 from approximately 0.42 (base model) to approximately 0.74, a 76% relative improvement on the code retrieval task.

---

## Project History

For a detailed account of the development process, including LLM quota challenges, model deprecation workarounds, fine-tuning methodology, and architectural decisions, see the [Project Journal](./PROJECT_JOURNAL.md).

For the full academic report covering problem definition, methodology, failure analysis, results, and ethical implications, see [REPORT.md](./REPORT.md).

---

## License

This project is licensed under the MIT License.
