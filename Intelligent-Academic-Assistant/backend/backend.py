import os
import shutil
import uvicorn
import json
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

import chromadb
from ollama import Client


# Import helpers
from extract_and_store import extract_text_from_pdf, chunk_text, store_in_chroma
from summarize_pdf import summarize

# Config
UPLOAD_DIR = os.path.abspath("./uploads")
DB_DIR = os.path.abspath("./chroma_db")   # always reused but cleared per upload
COLLECTION_NAME = "pdf_chunks"

# Ensure dirs
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(DB_DIR, exist_ok=True)

# FastAPI + Ollama
app = FastAPI()
ollama_client = Client()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # change for prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------
# Utility: reset vector DB
# -------------------------------
# 
# def reset_chroma():
#     """Clear old Chroma DB so each upload starts fresh."""
#     if os.path.exists(DB_DIR):
#         shutil.rmtree(DB_DIR)
#     os.makedirs(DB_DIR, exist_ok=True)
#
# -------------------------------
# Utility: reset chroma collection
# -------------------------------
def reset_chroma():
    """Drop and recreate collection instead of deleting folder."""
    client = chromadb.PersistentClient(path=DB_DIR)
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass  # ignore if it doesn’t exist
    client.create_collection(COLLECTION_NAME)



# -------------------------------
# API: Upload + Summarize in one step
# -------------------------------
@app.post("/upload-and-summarize/")
async def upload_and_summarize(
    file: UploadFile = File(...),
    max_chars: int = Form(1000),
    overlap: int = Form(200),
    model: str = Form("gemma3:1b"),
    query: str = Form("Summarize this PDF"),
):
    try:
        # Save uploaded file
        dest_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(dest_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # Extract text
        text = extract_text_from_pdf(dest_path)
        if not text.strip():
            return JSONResponse(status_code=400, content={"error": "No text found in PDF"})

        # Reset chroma (overwrite old DB)
        reset_chroma()

        # Chunk + store
        chunks = chunk_text(text, max_chars=max_chars, overlap=overlap)
        metas = [{"source": file.filename, "chunk_index": i} for i in range(len(chunks))]
        store_in_chroma(chunks, metas, db_dir=DB_DIR, collection_name=COLLECTION_NAME)

        # Summarize
        summary = summarize(DB_DIR, query, model=model)
        return {
            "message": "success",
            "filename": file.filename,
            "num_chunks": len(chunks),
            "summary": summary,
        }

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# -------------------------------
# API: Upload only (prepare chunks)
# -------------------------------
@app.post("/upload-pdf-only/")
async def upload_pdf_only(
    file: UploadFile = File(...),
    max_chars: int = Form(1000),
    overlap: int = Form(200),
):
    try:
        dest_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(dest_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        text = extract_text_from_pdf(dest_path)
        if not text.strip():
            return JSONResponse(status_code=400, content={"error": "No text found in PDF"})

        # Reset chroma
        reset_chroma()

        # Chunk + store
        chunks = chunk_text(text, max_chars=max_chars, overlap=overlap)
        metas = [{"source": file.filename, "chunk_index": i} for i in range(len(chunks))]
        store_in_chroma(chunks, metas, db_dir=DB_DIR, collection_name=COLLECTION_NAME)

        return {"message": "indexed", "filename": file.filename, "num_chunks": len(chunks)}

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# -------------------------------
# API: Summarize existing (current PDF only)
# -------------------------------
@app.post("/summarize-existing/")
async def summarize_existing(
    query: str = Form("Summarize this PDF"),
    model: str = Form("gemma3:1b"),
):
    try:
        summary = summarize(DB_DIR, query, model=model)
        return {"message": "success", "summary": summary}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
# -------------------------------

# =====================================================
# ✅ RAG APIs (PDF Upload & RAG-based Q&A)
# =====================================================

import os
import shutil
import uuid
import json
from fastapi import UploadFile, File, Form
from fastapi.responses import JSONResponse

# PDF & text splitting
from PyPDF2 import PdfReader
from langchain.text_splitter import RecursiveCharacterTextSplitter

# Vector DB
import chromadb

# Ollama client
from ollama import Client

# Initialize Ollama client
ollama = Client()

# -------------------------
# Folders
# -------------------------
RAG_DB_DIR = "rag_db"
RAG_HISTORY_DIR = "rag_history"
os.makedirs(RAG_DB_DIR, exist_ok=True)
os.makedirs(RAG_HISTORY_DIR, exist_ok=True)

# -------------------------
# Helper functions
# -------------------------
def get_history_file(session_id: str, rag: bool = False):
    base = RAG_HISTORY_DIR if rag else "history"
    return os.path.join(base, f"{session_id}.json")

def load_history(file_path: str):
    if os.path.exists(file_path):
        with open(file_path, "r") as f:
            return json.load(f)
    return []

def save_history(history, file_path: str):
    with open(file_path, "w") as f:
        json.dump(history, f, indent=2)

def chunk_pdf(file_path: str, max_chars: int = 1000, overlap: int = 200):
    try:
        reader = PdfReader(file_path)
    except Exception as e:
        raise Exception(f"Failed to read PDF: {e}")

    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text

    if not text.strip():
        raise Exception("PDF contains no extractable text")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=max_chars,
        chunk_overlap=overlap,
        length_function=len
    )
    return splitter.split_text(text)

# -------------------------
# Upload PDF and create RAG DB
# -------------------------
@app.post("/rag-upload-pdf/")
async def rag_upload_pdf(
    file: UploadFile = File(...),
    max_chars: int = Form(1000),
    overlap: int = Form(200)
):
    """
    Upload a PDF, split into chunks, and store into a dedicated RAG vector DB.
    Returns a session_id for later queries.
    """
    try:
        session_id = str(uuid.uuid4())
        os.makedirs("uploads", exist_ok=True)
        file_location = f"uploads/{session_id}_{file.filename}"

        with open(file_location, "wb") as f:
            f.write(await file.read())

        # Chunk PDF
        chunks = chunk_pdf(file_location, max_chars, overlap)

        # Create vector DB
        pdf_db_dir = os.path.join(RAG_DB_DIR, session_id)
        if os.path.exists(pdf_db_dir):
            shutil.rmtree(pdf_db_dir)
        os.makedirs(pdf_db_dir, exist_ok=True)

        client = chromadb.PersistentClient(path=pdf_db_dir)
        collection = client.create_collection("pdf_chunks")

        for i, chunk in enumerate(chunks):
            collection.add(ids=[f"{session_id}_{i}"], documents=[chunk])

        return {
            "message": "success",
            "filename": file.filename,
            "num_chunks": len(chunks),
            "session_id": session_id
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})

# -------------------------
# RAG-based Q&A
# -------------------------
@app.post("/rag-qa/")
async def rag_qa(
    query: str = Form(...),
    session_id: str = Form(...),
    model: str = Form("gemma3:1b"),
    n_results: int = Form(5),
    persistent: bool = Form(True)
):
    """
    Query the RAG DB for the given session_id and return an answer with context + history.
    """
    try:
        pdf_db_dir = os.path.join(RAG_DB_DIR, session_id)
        if not os.path.exists(pdf_db_dir):
            return JSONResponse(status_code=404, content={"error": "No DB found for this session"})

        # Load chat history
        history_file = get_history_file(session_id, rag=True)
        chat_history = load_history(history_file) if persistent else []

        # Query vector DB
        client = chromadb.PersistentClient(path=pdf_db_dir)
        collection = client.get_or_create_collection("pdf_chunks")

        results = collection.query(query_texts=[query], n_results=n_results)
        chunks = results["documents"][0] if results["documents"] else []
        context = "\n\n".join(chunks) if chunks else "No relevant context found."

        # Build messages
        system_message = {
            "role": "system",
            "content": "You are an assistant answering based on the PDF context and chat history."
        }
        context_message = {"role": "system", "content": f"Relevant PDF context:\n{context}"}
        messages = [system_message, context_message] + chat_history + [{"role": "user", "content": query}]

        # Call Ollama
        response = ollama.chat(model=model, messages=messages)
        answer = response["message"]["content"]

        # Save history
        chat_history.append({"role": "user", "content": query})
        chat_history.append({"role": "assistant", "content": answer})
        if persistent:
            save_history(chat_history, history_file)

        return {"message": "success", "answer": answer, "chat_history": chat_history}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})
# -------------------------------


# -------------------------------
@app.get("/")
async def root():
    return {"message": "Backend is running"}
