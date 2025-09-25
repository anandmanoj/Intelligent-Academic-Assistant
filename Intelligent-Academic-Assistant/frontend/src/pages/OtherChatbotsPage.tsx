import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Bot, ArrowLeft } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export const OtherChatbotsPage: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link 
            to="/"
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors mb-6"
          >
            <ArrowLeft size={20} />
            Back to Main Chat
          </Link>
          
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Other Chatbots
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Choose a specialized AI assistant for your specific needs
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Link
            to="/chatbots/pdf-summarizer"
            className="group bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all hover:shadow-xl transform hover:-translate-y-1"
          >
            <div className="flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl mb-6 group-hover:scale-110 transition-transform">
              <FileText size={32} className="text-blue-600 dark:text-blue-400" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
              PDF Summarizer
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Upload PDF documents and get intelligent summaries and key insights extracted automatically.
            </p>
            
            <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium">
              Get Started
              <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </Link>

          <Link
            to="/chatbots/rag-bot"
            className="group bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 hover:border-emerald-500 dark:hover:border-emerald-400 transition-all hover:shadow-xl transform hover:-translate-y-1"
          >
            <div className="flex items-center justify-center w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl mb-6 group-hover:scale-110 transition-transform">
              <Bot size={32} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
              RAG-based Chatbot
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Advanced conversational AI with Retrieval-Augmented Generation for context-aware responses.
            </p>
            
            <div className="flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
              Get Started
              <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};