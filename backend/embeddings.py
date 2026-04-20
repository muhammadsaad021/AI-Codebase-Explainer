# backend/embeddings.py
from sentence_transformers import SentenceTransformer
import numpy as np

# ✅ Global embedding model
embed_model = SentenceTransformer("all-MiniLM-L6-v2")

def embed_chunks(chunks):
    """
    Converts a list of code chunks into embeddings.
    """
    return embed_model.encode(chunks)
import faiss

def create_index(embeddings):

    dimension = len(embeddings[0])
    index = faiss.IndexFlatL2(dimension)

    index.add(np.array(embeddings))

    return index