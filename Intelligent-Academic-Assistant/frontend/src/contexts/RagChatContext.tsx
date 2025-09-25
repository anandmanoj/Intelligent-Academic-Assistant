import React, { createContext, useContext, useState } from 'react';

export interface RagMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  file?: File;
}

export interface RagChat {
  id: string;
  title: string;
  messages: RagMessage[];
  createdAt: Date;
  updatedAt: Date;
}

interface RagChatContextType {
  chats: RagChat[];
  currentChatId: string | null;
  currentMessages: RagMessage[];
  createNewChat: () => string;
  selectChat: (chatId: string) => void;
  addMessage: (content: string, sender: 'user' | 'assistant', file?: File) => void;
  renameChat: (chatId: string, newTitle: string) => void;
  deleteChat: (chatId: string) => void;
  clearCurrentChat: () => void;
}

const RagChatContext = createContext<RagChatContextType | undefined>(undefined);

export const useRagChat = () => {
  const context = useContext(RagChatContext);
  if (!context) {
    throw new Error('useRagChat must be used within a RagChatProvider');
  }
  return context;
};

export const RagChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [chats, setChats] = useState<RagChat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  const currentMessages = currentChatId 
    ? chats.find(chat => chat.id === currentChatId)?.messages || []
    : [];

  const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

  const createNewChat = () => {
    const newChat: RagChat = {
      id: generateId(),
      title: 'New RAG Chat',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    setChats(prev => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
    return newChat.id;
  };

  const selectChat = (chatId: string) => {
    setCurrentChatId(chatId);
  };

  const addMessage = (content: string, sender: 'user' | 'assistant', file?: File) => {
    if (!currentChatId) return;

    const newMessage: RagMessage = {
      id: generateId(),
      content,
      sender,
      timestamp: new Date(),
      file,
    };

    setChats(prev => prev.map(chat => {
      if (chat.id === currentChatId) {
        const updatedChat = {
          ...chat,
          messages: [...chat.messages, newMessage],
          updatedAt: new Date(),
        };
        
        if (chat.messages.length === 0 && sender === 'user') {
          updatedChat.title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
        }
        
        return updatedChat;
      }
      return chat;
    }));
  };

  const renameChat = (chatId: string, newTitle: string) => {
    setChats(prev => prev.map(chat => 
      chat.id === chatId ? { ...chat, title: newTitle, updatedAt: new Date() } : chat
    ));
  };

  const deleteChat = (chatId: string) => {
    setChats(prev => prev.filter(chat => chat.id !== chatId));
    if (currentChatId === chatId) {
      setCurrentChatId(null);
    }
  };

  const clearCurrentChat = () => {
    setCurrentChatId(null);
  };

  return (
    <RagChatContext.Provider value={{
      chats,
      currentChatId,
      currentMessages,
      createNewChat,
      selectChat,
      addMessage,
      renameChat,
      deleteChat,
      clearCurrentChat,
    }}>
      {children}
    </RagChatContext.Provider>
  );
};