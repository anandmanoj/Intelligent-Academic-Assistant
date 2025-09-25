import React, { createContext, useContext, useState } from 'react';

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  file?: File;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

interface ChatContextType {
  chats: Chat[];
  currentChatId: string | null;
  currentMessages: Message[];
  createNewChat: () => string;
  selectChat: (chatId: string) => void;
  addMessage: (content: string, sender: 'user' | 'assistant', file?: File) => void;
  renameChat: (chatId: string, newTitle: string) => void;
  deleteChat: (chatId: string) => void;
  clearCurrentChat: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  const currentMessages = currentChatId 
    ? chats.find(chat => chat.id === currentChatId)?.messages || []
    : [];

  const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

  const createNewChat = () => {
    const newChat: Chat = {
      id: generateId(),
      title: 'New Chat',
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

    const newMessage: Message = {
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
        
        // Update title if this is the first user message
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
    <ChatContext.Provider value={{
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
    </ChatContext.Provider>
  );
};