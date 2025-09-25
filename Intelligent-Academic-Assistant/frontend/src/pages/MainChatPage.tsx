import React, { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { ChatWindow } from '../components/ChatWindow';
import { MessageInput } from '../components/MessageInput';
import { useChat } from '../contexts/ChatContext';
import { agenticUpload, agenticChat } from '../services/api'; // 1. Import API functions

export const MainChatPage: React.FC = () => {
  const { currentMessages, addMessage, createNewChat, currentChatId } = useChat();

  // 2. Add state for file handling and session management
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadStatus(`Selected: ${file.name}`);
    }
  };

  // 3. New handler for the "Upload" button
  const handleFileUpload = async () => {
    if (!selectedFile) {
      setUploadStatus('Please select a file first.');
      return;
    }

    setIsUploading(true);
    setUploadStatus(`Processing ${selectedFile.name}...`);
    // Create a new chat session when a PDF is uploaded
    if (!currentChatId) {
        createNewChat();
    }

    try {
      // Call the upload API
      const response = await agenticUpload(selectedFile);
      setSessionId(response.session_id); // Store the session ID from the backend
      setUploadStatus(`✅ Ready to answer questions about ${response.filename}.`);
      // Add a system message to the chat window for clear feedback
      addMessage(`Successfully processed "${response.filename}". You can ask me questions about it now.`, 'system');

    } catch (error) {
      console.error("Upload failed:", error);
      const errorMessage = "❌ Error uploading file. It might be corrupted or empty. Please try another.";
      setUploadStatus(errorMessage);
      addMessage(errorMessage, 'system');
    } finally {
      setIsUploading(false);
    }
  };

  // 4. Update send message handler to call the chat API
  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    if (!currentChatId) {
      createNewChat();
    }
    
    addMessage(content, 'user');
    
    try {
      // Call the chat API with the user's message and the current session ID
      const response = await agenticChat(content, sessionId);
      
      // Update session ID if it's the first message in a session
      if (!sessionId) {
        setSessionId(response.session_id);
      }

      // Add the assistant's real response to the chat
      addMessage(response.answer, 'assistant');

    } catch (error) {
      console.error("Chat API error:", error);
      addMessage("Sorry, I encountered an error while trying to respond. Please try again.", 'assistant');
    }
  };

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Intelligent Academic Assistant
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            AI-powered Agentic RAG based conversation assistant
          </p>
        </div>

        <ChatWindow messages={currentMessages} />
        
        {/* 5. Add the new file upload UI */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
          <div className="flex items-center space-x-3">
             <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <button
              onClick={handleFileUpload}
              disabled={!selectedFile || isUploading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isUploading ? 'Processing...' : 'Upload PDF'}
            </button>
          </div>
          {uploadStatus && (
            <p className="text-xs mt-2 text-gray-500 dark:text-gray-400">{uploadStatus}</p>
          )}
        </div>
        
        <MessageInput 
          onSend={handleSendMessage}
          placeholder={sessionId ? "Ask a question about the document..." : "Ask a general question or upload a PDF to begin..."}
        />
      </div>
    </div>
  );
};