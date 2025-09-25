# retrieval.py
import os
from sentence_transformers import SentenceTransformer
import chromadb

DB_DIR = "agentic_rag_db"
RETRIEVED_DIR = "retrieved"

# Initialize db & embedder (same model used for ingestion)
client = chromadb.PersistentClient(path=DB_DIR)
collection = client.get_or_create_collection("academic_materials")
embedder = SentenceTransformer("all-MiniLM-L6-v2")

def query_collection(query: str, top_k: int = 3, source_filter: list | None = None):
    """
    Returns the raw chroma query results (dict containing documents and metadatas).
    If source_filter is provided (list of substrings), results are filtered by metadata['source'].
    """
    query_embedding = embedder.encode([query]).tolist()[0]
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        include=["documents", "metadatas"]
    )

    docs = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]

    # Optional simple client-side filtering by source filename substrings
    if source_filter:
        filtered_docs = []
        filtered_metas = []
        for d, m in zip(docs, metadatas):
            src = m.get("source", "") if isinstance(m, dict) else ""
            if any(s.lower() in src.lower() for s in source_filter):
                filtered_docs.append(d)
                filtered_metas.append(m)
        return {"documents": [filtered_docs], "metadatas": [filtered_metas]}

    return results

def retrieve_and_save(query: str, top_k: int = 3, source_filter: list | None = None):
    """
    Queries chroma, saves top_k chunks to RETRIEVED_DIR and returns a list of dicts:
    [{'file': filename, 'text': chunk_text, 'meta': metadata}, ...]
    """
    os.makedirs(RETRIEVED_DIR, exist_ok=True)
    results = query_collection(query, top_k=top_k, source_filter=source_filter)

    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]

    retrieved = []
    for d, m in zip(docs, metas):
        source = m.get("source", "unknown_source")
        chunk_id = m.get("chunk_id", "0")
        filename = f"{source}_chunk{chunk_id}.txt"
        out_path = os.path.join(RETRIEVED_DIR, filename)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(d)
        retrieved.append({"file": filename, "text": d, "meta": m})
    return retrieved
