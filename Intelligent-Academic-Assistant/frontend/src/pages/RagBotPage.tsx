import React, { useRef, useState } from 'react';
import { RagSidebar } from '../components/RagSidebar';
import { ChatWindow } from '../components/ChatWindow';
import { MessageInput } from '../components/MessageInput';
import { useRagChat } from '../contexts/RagChatContext';
import { ragUploadPdf, ragChat } from '../services/api';

export const RagBotPage: React.FC = () => {
  const { currentMessages, addMessage, createNewChat, currentChatId } = useRagChat();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null); // Your original logic for tracking the session

  const handleSendMessage = async (content: string) => {
    if (!sessionId) {
      addMessage("❌ Please upload a PDF first!", "assistant");
      return;
    }
    if (!currentChatId) {
      createNewChat();
    }
    addMessage(content, 'user');
    setTyping(true);
    try {
      const data = await ragChat(content, sessionId);
      addMessage(data.answer, "assistant");
    } catch (error: any) {
      addMessage(`Error: ${error.message}`, "assistant");
    } finally {
      setTyping(false);
    }
  };

  const handleUploadPDF = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // --- THIS IS THE FIX ---
    // Ensure a chat session exists BEFORE the upload happens.
    // This prevents a new chat from being created unexpectedly.
    if (!currentChatId) {
      createNewChat();
    }
    // --- END FIX ---

    setUploading(true);

    try {
      const data = await ragUploadPdf(file);
      setSessionId(data.session_id);

      addMessage(
        `✅ PDF "${data.filename}" uploaded and is ready for questions.`,
        "assistant"
      );
    } catch (error: any) {
      addMessage(`❌ Upload error: ${error.message}`, "assistant");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-900">
      <RagSidebar />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              RAG-based Chatbot
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Advanced AI with Retrieval-Augmented Generation
            </p>
          </div>

          {/* Upload PDF button */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept="application/pdf"
              onChange={handleUploadPDF}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload PDF"}
            </button>
          </div>
        </div>

        {/* Chat Window */}
        <ChatWindow messages={currentMessages} />

        {/* Typing Indicator */}
        {typing && (
          <div className="px-6 py-2 text-sm text-gray-500 dark:text-gray-400 animate-pulse">
            Assistant is typing...
          </div>
        )}

        {/* Input */}
        <MessageInput
          onSend={handleSendMessage}
          placeholder="Ask me anything (with RAG context)..."
        />
      </div>
    </div>
  );
};