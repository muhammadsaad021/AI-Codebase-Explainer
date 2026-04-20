# AI Codebase Explainer – Project Journal

This document tracks the evolution of the **AI Codebase Explainer** platform, summarizing features implemented, architectural shifts, and roadblocks overcome during development.

## Phase 1: Foundational Architecture
**Goal:** Build a full-stack local application that parses Git repositories, chunks source code, generates vector embeddings, and performs RAG (Retrieval-Augmented Generation) using an LLM.

### What We Implemented:
- **Backend (FastAPI):** Modular pipeline separated into `chunker.py`, `repo_parser.py`, `embeddings.py`, `search.py`, and `explainer.py`.
- **Frontend (Vanilla HTML/JS/CSS):** Created a premium dark-mode interface with a chat panel, an interactive D3.js force-directed architecture graph, and a file summary explorer.
- **Dependency Graphing:** Abstract Syntax Tree (AST) parsing for Python and Regex for JS/TS to map imports/exports into graphical nodes and edges.
- **Unified AI Responses:** Refactored the LLM prompt to digest multiple snippets simultaneously, answering the user in one clean output rather than fragmented chunks.

---

## Phase 2: Open-Source API Migrations & Rate Limiting (The LLM Challenge)
**Goal:** Hook up a fast, free-tier LLM for inference and avoid severe quota limits.

### Challenges Faced & Solutions:
1. **Gemini API Exhaustion:** We initially used the `gemini-2.0-flash` model, but immediately hit a hard `RESOURCE_EXHAUSTED` (Quota exceeded limit: 0) error on the free tier. 
   - *Solution:* Migrated the inference pipeline entirely to **Groq**.
2. **Groq Model Deprecations (Mid-Development):** While building the dataset generation script, Groq actively decommissioned multiple models we tried to use in real-time (`llama3-8b-8192`, `mixtral-8x7b-32768`, and `gemma2-9b-it`).
   - *Solution:* Hardcoded inference to stable endpoints like `llama-3.3-70b-versatile` for deep explanations, and `llama-3.1-8b-instant` for bulk synthetic data generation.
3. **Groq Tokens-Per-Minute (TPM) Limits:** During bulk generation, generating 4 responses sequentially exceeded the strict 6,000 TPM limit, causing scripts to crash with HTTP 429 errors.
   - *Solution:* Implemented an **Adaptive Rate-Limiter** using Python's `re` module that intercepts the exact wait time requested by Groq (e.g., "try again in 12.2s") and seamlessly sleeps the thread to self-heal.

---

## Phase 3: Contrastive Learning Fine-Tuning Pipeline
**Goal:** Enable the app to self-improve its semantic search vector model (`all-MiniLM-L6-v2`) on local code logic without massive GPUs.

### What We Implemented:
- **Synthetic Data Generation:** A pipeline (`generate_dataset.py`) that generated EXACTLY 550 diverse QA/Code pairs by deliberately orchestrating the LLM to hallucinate realistic code across 18 domains (e.g., Rust APIs, C++ logic, React TS) to prevent bias.
- **Rigorous ML Notebook Training:** Created `train_embeddings.ipynb` using `sentence-transformers` and MultipleNegativesRankingLoss.
   - *Fixes:* Explicitly disabled multiprocessing dataloaders (`num_workers=0`, `batch_size=8`) and removed `tqdm` progress bars, which reliably cause Jupyter notebooks on VS Code/Windows to freeze and crash.
- **Cross Validation:** Integrated `InformationRetrievalEvaluator` holding out 10% as Validation and 10% as Test data, coupled with live `matplotlib` charting of the MRR@10 Metric.
- **Backend Model-Switching:** Configured `embeddings.py` to transparently load the newly fine-tuned `models/finetuned-explainer-model` dynamically on boot if found. 
   - *Check:* Appended `models/` to `.gitignore` to prevent massive GB binary blobs from crashing git pushes over the 100MB chunk limit.

---

## Phase 4: Precision Enhancements & UI Polish
**Goal:** Eradicate RAG hallucinations on direct queries and dramatically improve data visualization.

### What We Implemented:
- **Dense Retrieval Fallacy Fix:** We found that querying "Summarize chunker.py" relied purely on vector math, occasionally retrieving chunks from entirely different files that just scored high on the semantic word "summary." 
   - *Solution:* Created a FAISS bypass (`file_path` query argument). If the UI explicitly clicks a file, the backend fetches the physical array of chunks native to that file and passes them directly to the LLM. 100% precision, zero hallucination.
- **Architecture Visualization:** Overhauled the D3 Force-Graph aesthetic. Replaced flat node circles with glowing RGBA auras and added active animated directional particles to map codebase flow. 

---

## Phase 5: Production Bug Fixes
**Goal:** Fix critical bugs discovered during live testing with real repositories.

### Challenges Faced & Solutions:
1. **Stale Repository Cache:** The `clone_repo()` function cached cloned repos in the `repos/` directory and never refreshed them. If a repository was updated (e.g., files deleted), the app still served the stale old clone with ghost files like `testscript.py`.
   - *Solution:* Changed `repo_parser.py` to always `shutil.rmtree()` the old directory and do a clean re-clone. This guarantees every "Load Repo" click fetches the absolute latest state of the codebase.
2. **Cross-Platform Path Mismatch:** The FAISS bypass for file summaries silently failed on Windows. `os.path.relpath()` returns backslash paths (`backend\architecture.py`), but the frontend sends forward-slash paths (`backend/architecture.py`). The strict equality check `==` found zero matches, causing the LLM to receive wrong context.
   - *Solution:* Normalized both the requested path and all stored chunk paths to forward slashes before comparison, making matching platform-agnostic.

