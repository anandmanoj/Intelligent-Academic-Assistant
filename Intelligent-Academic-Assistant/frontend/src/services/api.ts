import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:8000", // FastAPI backend
});

// -----------------------------------------------
// Existing Services for Summarization
// -----------------------------------------------

/**
 * Uploads a PDF for the summarization/standard RAG modules.
 */
export const uploadPdf = async (
  file: File,
  maxChars: number = 1000,
  overlap: number = 200
) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("max_chars", maxChars.toString());
  formData.append("overlap", overlap.toString());

  // Note: I corrected a typo here from "multipart/-data" to "multipart/form-data"
  const response = await API.post("/upload-pdf-only/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response.data;
};

// =====================================================
// 🚀 NEW AGENTIC RAG SERVICES
// =====================================================

/**
 * Interface for the successful agentic upload response.
 */
export interface AgenticUploadResponse {
  message: string;
  session_id: string;
  filename: string;
  num_chunks: number;
}

/**
 * Interface for the agentic chat response.
 */
export interface AgenticChatResponse {
  answer: string;
  session_id: string;
  chat_history: { role: string; content: string }[];
  debug: any;
}

/**
 * Uploads a PDF to start a new Agentic RAG session.
 * @param file The PDF file to upload.
 * @returns A promise that resolves with the session details.
 */
export const agenticUpload = async (
  file: File
): Promise<AgenticUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  // Optional params can be added here if needed by the backend endpoint
  // formData.append('max_chars', '1000'); 
  // formData.append('overlap', '200');

  const response = await API.post<AgenticUploadResponse>(
    "/agentic-rag/upload/",
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

/**
 * Sends a query to the Agentic RAG chat endpoint.
 * @param query The user's question.
 * @param sessionId The current session ID. Can be null for the first message without a PDF.
 * @param model The AI model to use.
 * @returns A promise that resolves with the agent's answer.
 */
export const agenticChat = async (
  query: string,
  sessionId: string | null,
  model: string = 'gemma3:1b'
): Promise<AgenticChatResponse> => {
  const formData = new FormData();
  formData.append('query', query);
  formData.append('model', model);

  // Only include the session_id if it exists
  if (sessionId) {
    formData.append('session_id', sessionId);
  }

  const response = await API.post<AgenticChatResponse>(
    "/agentic-rag/chat/",
    formData
  );
  return response.data;
};