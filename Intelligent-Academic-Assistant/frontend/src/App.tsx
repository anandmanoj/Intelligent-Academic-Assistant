import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { ChatProvider } from './contexts/ChatContext';
import { RagChatProvider } from './contexts/RagChatContext';
import { MainChatPage } from './pages/MainChatPage';
import { OtherChatbotsPage } from './pages/OtherChatbotsPage';
import { PdfSummarizerPage } from './pages/PdfSummarizerPage';
import { RagBotPage } from './pages/RagBotPage';

function App() {
  return (
    <ThemeProvider>
      <ChatProvider>
        <RagChatProvider>
          <Router>
            <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen">
              <Routes>
                <Route path="/" element={<MainChatPage />} />
                <Route path="/chatbots" element={<OtherChatbotsPage />} />
                <Route path="/chatbots/pdf-summarizer" element={<PdfSummarizerPage />} />
                <Route path="/chatbots/rag-bot" element={<RagBotPage />} />
              </Routes>
            </div>
          </Router>
        </RagChatProvider>
      </ChatProvider>
    </ThemeProvider>
  );
}

export default App;