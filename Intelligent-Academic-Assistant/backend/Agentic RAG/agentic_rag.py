# agentic_rag.py
import os
import time
from typing import List, Dict, Any
from ollama import chat    # pip install ollama
from retrieval import retrieve_and_save, query_collection

# Set the model name you pulled into Ollama. You said: gemma3:1b
OLLAMA_MODEL = "gemma3:1b"

# Where to write final answers (and short logs)
ANSWERS_DIR = "answers"
os.makedirs(ANSWERS_DIR, exist_ok=True)

class AgenticRAG:
    def __init__(self, model: str = OLLAMA_MODEL, default_top_k: int = 3):
        self.model = model
        self.default_top_k = default_top_k

    # 1) Basic query complexity heuristic
    def analyze_query_complexity(self, query: str) -> str:
        q = query.strip()
        length = len(q)
        question_words = ("what", "why", "how", "when", "where", "who", "which", "explain", "compare", "summarize")
        if any(q.lower().startswith(w) for w in question_words) and length < 140:
            return "simple"
        # long queries, "explain with example", "compare X and Y" => complex
        if len(q.split()) > 20 or any(word in q.lower() for word in ["compare", "summarize", "evaluation", "critique", "detailed", "derive", "example", "project", "implementation"]):
            return "complex"
        # default
        return "medium"

    # 2) Choose retrieval strategy based on query type / heuristics
    def select_retrieval_strategy(self, query: str, complexity: str) -> Dict[str, Any]:
        """Return retrieval parameters: top_k and optional source_filters (list of substrings)."""
        top_k = self.default_top_k
        source_filters = None

        q_lower = query.lower()
        # If it's a definition-like question, prefer documents named 'syllabus' or 'notes' (heuristic)
        if q_lower.startswith("what is") or "define" in q_lower or "definition" in q_lower:
            top_k = max(2, self.default_top_k)
            source_filters = ["syllabus", "syllabi", "syllabus.pdf", "notes", "lecture"]
        # If user asks for summary of entire topic
        if "summarize" in q_lower or "give a summary" in q_lower:
            top_k = 6
        # Complex queries -> increase K
        if complexity == "complex":
            top_k = max(top_k, 5)

        return {"top_k": top_k, "source_filters": source_filters}

    # 3) Basic modality detection
    def detect_input_modality(self, query: str, uploaded_file: str | None = None) -> str:
        """
        Decide modality:
          - 'pdf_upload': if uploaded_file is provided
          - 'summarize': if query contains 'summarize'
          - 'question': default
        """
        if uploaded_file:
            return "pdf_upload"
        q = query.lower()
        if "summarize" in q or "summary" in q:
            return "summarize"
        return "question"

    # 4) Clarification heuristic
    def is_ambiguous(self, query: str) -> bool:
        q = query.strip()
        # too short + ambiguous words
        if len(q) < 6 or q.lower() in ("help", "explain", "notes", "summary"):
            return True
        # contains pronouns without context ("How to do this?") -> ambiguous
        if any(pr for pr in ["this", "that", "it"] if pr in q.lower()) and len(q.split()) < 6:
            return True
        return False

    # 5) Build a grounded prompt that asks the model to use the provided context and cite sources
    def build_messages(self, query: str, retrieved: List[Dict[str,Any]], response_style: str = "concise") -> List[Dict[str,str]]:
        # system prompt
        system_prompt = (
            "You are an academic assistant. Use ONLY the context provided to answer the user's question. "
            "When you directly use facts from the provided context, add citations in square brackets like [source:filename_chunkid]. "
            "If the context is insufficient to answer fully, say you couldn't find enough information in the user's materials and suggest next steps. "
            "Be concise when asked; otherwise provide detailed explanation with examples when helpful."
        )

        # build context: join retrieved chunks, but keep an overall length limit
        CONTEXT_CHAR_LIMIT = 6000  # conservative
        context_parts = []
        total = 0
        for r in retrieved:
            text = r["text"]
            meta = r["meta"]
            src = meta.get("source", "unknown")
            cid = meta.get("chunk_id", "0")
            header = f"[[{src}_chunk{cid}]]\n"
            piece = header + text + "\n\n"
            if total + len(piece) > CONTEXT_CHAR_LIMIT:
                # leave room for at least a small piece
                break
            context_parts.append(piece)
            total += len(piece)

        context_str = "\n".join(context_parts) if context_parts else "(no relevant context found)"

        # user prompt: instruct the model to ground answers, show format examples
        user_prompt = (
            f"Context:\n{context_str}\n\n"
            f"User query: {query}\n\n"
            "Instructions:\n"
            "- Answer the user's query based only on the context above.\n"
            "- Include brief inline citations where facts come from the context using the format [source:filename_chunkid].\n"
            f"- Response style: {response_style}.\n"
            "- If the context does not contain necessary information, say so and suggest whether to (a) upload additional material, (b) broaden the search, or (c) consult external resources."
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        return messages

    # 6) Call Ollama for generation (uses the ollama.chat wrapper)
    def generate_answer(self, messages: List[Dict[str,str]], stream: bool = False) -> str:
        """
        Uses ollama.chat to generate an answer. If stream=True, yields chunks (not implemented in this wrapper).
        """
        # Using non-streaming path for simplicity
        try:
            response = chat(model=self.model, messages=messages, stream=False)
            # The response from ollama.chat has response['message']['content']
            content = ""
            if isinstance(response, dict):
                # safe extraction
                content = response.get("message", {}).get("content", "")
            else:
                # fallback: object with attributes
                content = getattr(response, "message", getattr(response, "message", None))
                if content:
                    content = getattr(content, "content", str(content))
            return content
        except Exception as e:
            return f"[Error calling Ollama: {e}]"

    # 7) Format answer with explicit citations metadata summary and save to disk
    def format_and_save(self, answer_text: str, retrieved: List[Dict[str,Any]], query: str) -> str:
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        safe_query = "_".join(query.strip().split())[:60]
        fname = f"answer_{timestamp}_{safe_query}.txt"
        outpath = os.path.join(ANSWERS_DIR, fname)

        # Build sources list
        sources = []
        for r in retrieved:
            meta = r["meta"]
            src = meta.get("source", "unknown_source")
            chunk_id = meta.get("chunk_id", "0")
            sources.append(f"{src}_chunk{chunk_id}")

        with open(outpath, "w", encoding="utf-8") as f:
            f.write("=== Query ===\n")
            f.write(query + "\n\n")
            f.write("=== Answer ===\n")
            f.write(answer_text + "\n\n")
            f.write("=== Sources Retrieved ===\n")
            for s in sources:
                f.write(f"- {s}\n")
        return outpath

    # Top-level handler
    def handle_query(self, query: str, uploaded_file: str | None = None, response_style: str = "concise"):
        """
        Orchestrates: analyze -> retrieve -> generate -> format.
        Returns a dict with {'action': 'answer'|'clarify', 'payload': ...}
        """
        # 1. detect modality
        modality = self.detect_input_modality(query, uploaded_file)

        # 2. ambiguity check
        if self.is_ambiguous(query):
            # Minimal clarification prompt — you may implement interactive loop in your UI
            clarify_prompt = "Your question looks ambiguous. Could you briefly say what exactly you want? Examples:\n" \
                             "- 'Define dynamic programming with a short example.'\n" \
                             "- 'Summarize chapter 2 of my uploaded PDF.'\n" \
                             "- 'Give step-by-step solution for the sample question 3 in exam.pdf'\n"
            return {"action": "clarify", "prompt": clarify_prompt}

        # 3. analyze complexity & choose retrieval strategy
        complexity = self.analyze_query_complexity(query)
        strategy = self.select_retrieval_strategy(query, complexity)
        top_k = strategy["top_k"]
        source_filters = strategy["source_filters"]

        # 4. retrieval (and save the retrieved chunks to retrieved/)
        retrieved = retrieve_and_save(query, top_k=top_k, source_filter=source_filters)

        # 5. Check if enough context is found
        if not retrieved or len(retrieved) < 1 or all(not r['text'].strip() for r in retrieved):
            # not enough content from uploaded files
            print("⚠️ Lack of content in uploaded file.")
            use_web = input("Do you want to fetch data from the web? (yes/no): ").strip().lower()
            if use_web == "yes":
                from web_fetch import fetch_web_data
                web_chunks = fetch_web_data(query, top_k=3)
                # Wrap web chunks in the same format as retrieved
                retrieved = [{"file": f"web_chunk{i+1}.txt",
                              "text": chunk,
                              "meta": {"source": "web", "chunk_id": str(i+1)}}
                              for i, chunk in enumerate(web_chunks)]
            else:
                return {"action": "abort", "message": "User chose not to fetch from web. Cannot answer."}

        # 5. build messages and generate answer
        messages = self.build_messages(query, retrieved, response_style=response_style)
        answer = self.generate_answer(messages)

        # 6. format & save
        outpath = self.format_and_save(answer, retrieved, query)

        return {"action": "answer", "answer": answer, "sources": [r["meta"] for r in retrieved], "file": outpath}
