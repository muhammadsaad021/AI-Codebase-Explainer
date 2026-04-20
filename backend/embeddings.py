# backend/embeddings.py
import os
from sentence_transformers import SentenceTransformer
import numpy as np

# Path where the finetuned model will be saved
FINETUNED_MODEL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
    "models", 
    "finetuned-explainer-model"
)

# Load finetuned model if available, else fallback to standard base model
if os.path.exists(FINETUNED_MODEL_PATH):
    print(f"Loading custom fine-tuned embedding model from {FINETUNED_MODEL_PATH}...")
    embed_model = SentenceTransformer(FINETUNED_MODEL_PATH)
else:
    print("Loading base embedding model...")
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