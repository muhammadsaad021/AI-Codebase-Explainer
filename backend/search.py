# backend/search.py
import numpy as np


def search_code(query, index, chunks, top_k=3, embed_model=None):
    """
    Semantic search using FAISS.

    Parameters:
        query: str — natural language question
        index: FAISS index
        chunks: list of chunk dicts with 'code', 'file_path', etc.
        top_k: number of top results
        embed_model: SentenceTransformer model to encode query

    Returns:
        results: list of chunk dicts
        distances: numpy array of distances
    """
    if embed_model is None:
        raise ValueError("embed_model must be provided for query encoding.")

    query_vec = embed_model.encode([query])
    D, I = index.search(np.array(query_vec), top_k)
    results = [chunks[i] for i in I[0] if i < len(chunks)]
    return results, D