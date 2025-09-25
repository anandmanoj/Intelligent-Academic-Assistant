import os
import fitz  # PyMuPDF for PDF parsing
from sentence_transformers import SentenceTransformer
import chromadb

# Paths
DATA_DIR = "data"
DB_DIR = "agentic_rag_db"

# Initialize Chroma client
client = chromadb.PersistentClient(path=DB_DIR)
collection = client.get_or_create_collection("academic_materials")

# Load embedding model
embedder = SentenceTransformer("all-MiniLM-L6-v2")

def pdf_to_chunks(pdf_path, chunk_size=500, overlap=50):
    """Convert PDF into text chunks for embedding"""
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text("text")

    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i+chunk_size])
        chunks.append(chunk)
    return chunks

def ingest_pdfs():
    for file in os.listdir(DATA_DIR):
        if file.endswith(".pdf"):
            pdf_path = os.path.join(DATA_DIR, file)
            chunks = pdf_to_chunks(pdf_path)
            embeddings = embedder.encode(chunks).tolist()

            ids = [f"{file}_{i}" for i in range(len(chunks))]
            metadatas = [{"source": file, "chunk_id": i} for i in range(len(chunks))]

            collection.add(
                ids=ids,
                documents=chunks,
                embeddings=embeddings,
                metadatas=metadatas
            )
            print(f"✅ Ingested {file} with {len(chunks)} chunks.")

if __name__ == "__main__":
    ingest_pdfs()

