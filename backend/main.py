# backend/main.py
import os
from pathlib import Path
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
import faiss
import numpy as np

from backend.repo_parser import clone_repo, get_code_files
from backend.chunker import chunk_code
from backend.embeddings import embed_chunks, embed_model
from backend.search import search_code
from backend.explainer import explain_code_hf
from backend.architecture import build_architecture_graph

load_dotenv()

app = FastAPI(title="AI Codebase Explainer")

# CORS — allow frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global storage
repo_chunks = []
repo_index = None
repo_files = []
current_repo_path = None


@app.get("/load_repo")
def load_repo(url: str = Query(...)):
    global repo_chunks, repo_index, repo_files, current_repo_path

    repo_path = clone_repo(url)
    current_repo_path = repo_path
    files = get_code_files(repo_path)
    repo_files = files

    all_chunks = []
    for file_info in files:
        try:
            with open(file_info["path"], "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
                all_chunks.extend(
                    chunk_code(
                        text,
                        file_path=file_info["relative_path"],
                        language=file_info["language"],
                    )
                )
        except Exception:
            continue

    repo_chunks = all_chunks

    if not repo_chunks:
        return {"message": "No code files found in repository.", "chunks": 0, "files": 0}

    embeddings = embed_chunks([c["code"] for c in repo_chunks])

    dim = embeddings.shape[1]
    repo_index = faiss.IndexFlatL2(dim)
    repo_index.add(np.array(embeddings))

    return {
        "message": f"Repository loaded with {len(repo_chunks)} code chunks from {len(files)} files",
        "chunks": len(repo_chunks),
        "files": len(files),
    }


@app.get("/query")
def query_code(q: str = Query(...), top_k: int = 3, file_path: str = None):
    if not repo_chunks or repo_index is None:
        return {"error": "Load a repository first."}

    if file_path:
        # BYPASS FAISS: User exactly requested a specific file, get native chunks.
        # Normalize path separators for cross-platform matching
        norm_requested = file_path.replace("\\", "/").strip("/")
        results = [
            c for c in repo_chunks
            if c["file_path"].replace("\\", "/").strip("/") == norm_requested
        ]
        
        # If it happens to be huge, we just limit to Top N contiguous chunks to not blow context
        if len(results) > 15:
            results = results[:15]
            
        if not results:
            return {"error": f"Could not find exact path {file_path} in chunks."}
    else:
        # 1. Semantic search — retrieve top relevant chunks across all codebase
        results, distances = search_code(
            query=q,
            index=repo_index,
            chunks=repo_chunks,
            top_k=top_k,
            embed_model=embed_model,
        )

    # 2. Generate ONE unified explanation from all retrieved chunks
    explanation = explain_code_hf(results, q)

    # 3. Build source references
    sources = [
        {
            "file": chunk["file_path"],
            "language": chunk["language"],
            "lines": f"{chunk['start_line']}-{chunk['end_line']}",
        }
        for chunk in results
    ]

    return {
        "query": q,
        "explanation": explanation,
        "sources": sources,
    }


@app.get("/architecture")
def get_architecture():
    """Return the dependency graph of the loaded repository."""
    if not repo_files or current_repo_path is None:
        return {"error": "Load a repository first."}

    graph = build_architecture_graph(current_repo_path, repo_files)
    return graph


@app.get("/files")
def get_files():
    """Return the list of discovered source code files."""
    if not repo_files:
        return {"error": "Load a repository first."}

    return {
        "files": [
            {"path": f["relative_path"], "language": f["language"]}
            for f in repo_files
        ]
    }


# ----- Serve frontend -----
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


@app.get("/")
def serve_frontend():
    return FileResponse(FRONTEND_DIR / "index.html")


# Mount static files AFTER API routes so they don't shadow them
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR)), name="frontend")