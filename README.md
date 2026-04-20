# AI Codebase Explainer 🧠💻

![License](https://img.shields.io/badge/license-MIT-blue) ![Python](https://img.shields.io/badge/python-3.10%2B-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-green)

A powerful, local, unified Retrieval-Augmented Generation (RAG) platform that allows you to instantly parse, visualize, and chat with any GitHub repository.

Driven by a custom fine-tuned `all-MiniLM-L6-v2` dense retrieval model and powered by Groq's API for lightning-fast Llama-3 inference, this tool turns massive unfamiliar codebases into highly readable, interactive architectural graphs and AI-summarized insights.

---

## ✨ Features

- 🎯 **Zero-Hallucination File Summaries:** Directly click on any file in the File Explorer to natively inject its exact contents into the Large Language Model, bypassing semantic retrieval noise for 100% accuracy.
- 🌌 **Premium D3 Architecture Graphs:** Visualize your codebase dependencies with a stunning WebGL-flavored Force Graph. Features interactive focus hovering, isolated proximity lighting, and animated data particles.
- ⚡ **Adaptive Groq RAG Engine:** Ask natural language questions like *"Where is authentication handled?"* and receive deep, multi-chunk contextual answers powered by Llama-3 70B instantly.
- 🧠 **Train Your Own Embeddings:** Includes a rigid, battle-tested ML Jupyter Notebook (`train_embeddings.ipynb`) that automatically parses your codebase to generate synthetic training datasets and rigorously fine-tunes the FAISS retrieval vectors using Contrastive Learning.

---

## 🚀 Quick Start

### 1. Prerequisites
Ensure you have Python 3.10+ installed. Next, create an API key at [Groq Cloud](https://console.groq.com/).

### 2. Installation
Clone the repository and install the backend modules:
```bash
git clone https://github.com/muhammadsaad021/AI-Codebase-Explainer.git
cd AI-Codebase-Explainer

python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Environment Variables
Create a `.env` file in the root directory and add your key:
```env
GROQ_API_KEY=gsk_your_groq_api_key_here
```

### 4. Run the Engine
Start up the FastAPI backend and static file server:
```bash
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
Then simply open `http://127.0.0.1:8000` in your browser!

---

## 🛠️ Architecture

- **`backend/main.py`:** Master API controller mapping REST endpoints and intercepting exact-file retrieval overrides.
- **`backend/search.py`:** Handles FAISS L2 flat indexing and cosine similarity matrix math.
- **`backend/embeddings.py`:** transparently swaps between standard HuggingFace embeddings and your dynamically fine-tuned `models/` weights.
- **`frontend/app.js`:** Pure Vanilla JS running D3-Force algorithms and HTTP pipeline controls.

## 📈 Fine-Tuning the Retrieval Model
If you want the semantic search to uniquely understand your organization's internal jargon:
1. Run `training/generate_dataset.py` to auto-fabricate 500+ QA pairs.
2. Open `training/train_embeddings.ipynb`.
3. Execute the ML blocks to automatically train, cross-validate, and map learning curves using `sklearn` and `sentence-transformers`.

## 📜 Project Origins
For a detailed look at the journey, challenges with LLM quotas, and architectural refactoring, review our inner [PROJECT_JOURNAL.md](./PROJECT_JOURNAL.md).
