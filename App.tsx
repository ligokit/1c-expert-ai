import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Sidebar from './components/Sidebar';
import MessageBubble from './components/MessageBubble';
import InputArea from './components/InputArea';
import { ChatSession, Message, Role, Attachment } from './types';
import { streamGeminiResponse } from './services/geminiService';
import { DEFAULT_MODEL } from './constants';

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentModelId, setCurrentModelId] = useState<string>(DEFAULT_MODEL);

  // Load from local storage on mount
  useEffect(() => {
    const stored = localStorage.getItem('1c_chat_sessions');
    const storedModel = localStorage.getItem('1c_chat_model');
    
    if (storedModel) {
      setCurrentModelId(storedModel);
    }

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSessions(parsed);
        if (parsed.length > 0) {
          setCurrentSessionId(parsed[0].id);
        } else {
          createNewSession();
        }
      } catch (e) {
        console.error("Failed to load sessions", e);
        createNewSession();
      }
    } else {
      createNewSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save to local storage whenever sessions change
  useEffect(() => {
    const saveToStorage = () => {
      try {
        if (sessions.length > 0) {
          const safeSessions = sessions.map(session => ({
            ...session,
            messages: session.messages.map(msg => ({
              ...msg,
              attachments: msg.attachments?.map(att => ({
                ...att,
                data: '' 
              }))
            }))
          }));
          
          try {
             localStorage.setItem('1c_chat_sessions', JSON.stringify(safeSessions));
          } catch (innerError) {
             console.warn("LocalStorage save failed", innerError);
          }
        } else {
          localStorage.setItem('1c_chat_sessions', JSON.stringify([]));
        }
      } catch (e) {
        console.warn("LocalStorage error", e);
      }
    };
    
    const timeoutId = setTimeout(saveToStorage, 500);
    return () => clearTimeout(timeoutId);
  }, [sessions]);

  const handleModelChange = (modelId: string) => {
    setCurrentModelId(modelId);
    localStorage.setItem('1c_chat_model', modelId);
  };

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: uuidv4(),
      title: 'Новый чат',
      messages: [],
      updatedAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const deleteSession = (id: string) => {
    const updatedSessions = sessions.filter(s => s.id !== id);
    
    if (updatedSessions.length === 0) {
      const newSession = {
        id: uuidv4(),
        title: 'Новый чат',
        messages: [],
        updatedAt: Date.now()
      };
      setSessions([newSession]);
      setCurrentSessionId(newSession.id);
    } else {
      setSessions(updatedSessions);
      if (currentSessionId === id) {
        setCurrentSessionId(updatedSessions[0].id);
      }
    }
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);

  const processResponse = async (history: Message[], text: string, attachments: Attachment[], useSearch: boolean) => {
    setIsLoading(true);

    try {
      await streamGeminiResponse({
        history: history,
        newMessage: text,
        attachments: attachments,
        useSearch: useSearch,
        modelId: currentModelId,
        onChunk: (chunkText) => {
          setSessions(prev => prev.map(s => {
            if (s.id === currentSessionId) {
              const msgs = [...s.messages];
              const lastMsgIndex = msgs.length - 1;
              const lastMsg = msgs[lastMsgIndex];
              
              if (lastMsg.role === Role.MODEL) {
                msgs[lastMsgIndex] = {
                  ...lastMsg,
                  text: chunkText,
                  isThinking: false
                };
              }
              return { ...s, messages: msgs };
            }
            return s;
          }));
        },
        onGrounding: (sources) => {
          setSessions(prev => prev.map(s => {
            if (s.id === currentSessionId) {
              const msgs = [...s.messages];
              const lastMsgIndex = msgs.length - 1;
              const lastMsg = msgs[lastMsgIndex];

              if (lastMsg.role === Role.MODEL) {
                msgs[lastMsgIndex] = {
                  ...lastMsg,
                  groundingSources: sources
                };
              }
              return { ...s, messages: msgs };
            }
            return s;
          }));
        }
      });
    } catch (e) {
      console.error("Top level send error", e);
    } finally {
      setIsLoading(false);
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          const msgs = [...s.messages];
          const lastMsgIndex = msgs.length - 1;
          const lastMsg = msgs[lastMsgIndex];
          
          if (lastMsg.role === Role.MODEL && lastMsg.isThinking) {
             msgs[lastMsgIndex] = {
               ...lastMsg,
               isThinking: false,
               text: lastMsg.text || "Не удалось получить ответ от сервера. Попробуйте сменить модель."
             };
          }
          return { ...s, messages: msgs };
        }
        return s;
      }));
    }
  };

  const handleSendMessage = async (text: string, attachments: Attachment[], useSearch: boolean) => {
    if (!currentSessionId) return;

    const newMessage: Message = {
      id: uuidv4(),
      role: Role.USER,
      text: text,
      timestamp: Date.now(),
      attachments: attachments
    };

    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        const title = s.messages.length === 0 ? (text.slice(0, 30) + (text.length > 30 ? '...' : '')) : s.title;
        return {
          ...s,
          title: title || "Вложение",
          messages: [
            ...s.messages, 
            newMessage,
            { id: 'temp-ai', role: Role.MODEL, text: '', timestamp: Date.now(), isThinking: true }
          ],
          updatedAt: Date.now()
        };
      }
      return s;
    }));

    const history = currentSession?.messages || [];

    await processResponse(history, text, attachments, useSearch);
  };

  const handleContinue = async () => {
    if (!currentSessionId) return;

    const continueText = "Продолжи";
    
    const newMessage: Message = {
      id: uuidv4(),
      role: Role.USER,
      text: continueText,
      timestamp: Date.now()
    };

    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return {
          ...s,
          messages: [
            ...s.messages,
            newMessage,
            { id: 'temp-ai-continue', role: Role.MODEL, text: '', timestamp: Date.now(), isThinking: true }
          ],
          updatedAt: Date.now()
        };
      }
      return s;
    }));

    const history = [...(currentSession?.messages || [])];
    
    await processResponse(history, continueText, [], false);
  };

  return (
    <div className="flex h-screen bg-[#fcfcf9]">
      <Sidebar 
        isOpen={isSidebarOpen}
        sessions={sessions}
        currentSessionId={currentSessionId}
        currentModelId={currentModelId}
        onSelectSession={setCurrentSessionId}
        onNewChat={createNewSession}
        onDeleteSession={deleteSession}
        onSelectModel={handleModelChange}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center p-4 border-b bg-white">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-gray-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-serif font-bold ml-2">1C Эксперт AI</span>
        </div>

        {/* Chat Area - UPDATED LAYOUT */}
        {/* If messages exist, allow scrolling. If empty, center content without scroll. */}
        <div className={`flex-1 ${currentSession?.messages.length === 0 ? 'flex flex-col justify-center items-center p-4 overflow-hidden' : 'overflow-y-auto p-4 md:p-8 scroll-smooth'}`}>
          <div className={`${currentSession?.messages.length === 0 ? 'w-full max-w-lg' : 'max-w-4xl mx-auto w-full'}`}>
            {currentSession?.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center opacity-80 animate-fadeIn">
                 <div className="w-16 h-16 bg-[#d97757] rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                    <span className="text-3xl text-white font-serif">1C</span>
                 </div>
                 <h2 className="text-2xl font-serif text-gray-800 mb-2">Добро пожаловать в 1C Эксперт AI</h2>
                 <p className="text-gray-500 max-w-md mx-auto">
                   Я помогу создать базы 1С, написать код на встроенном языке и исправить ошибки конфигурации. 
                   Загрузите файлы (PDF, Excel, Word) или скриншоты для анализа.
                 </p>
              </div>
            ) : (
              currentSession?.messages.map((msg, idx) => (
                <MessageBubble 
                  key={idx} 
                  message={msg} 
                  isLast={idx === currentSession.messages.length - 1}
                  onContinue={handleContinue}
                  isLoading={isLoading}
                />
              ))
            )}
          </div>
        </div>

        {/* Input Area */}
        <InputArea onSend={handleSendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default App;