import React from 'react';
import { ChatSession } from '../types';
import { MODELS } from '../constants';

interface SidebarProps {
  isOpen: boolean;
  sessions: ChatSession[];
  currentSessionId: string | null;
  currentModelId: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onSelectModel: (id: string) => void;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  sessions, 
  currentSessionId,
  currentModelId,
  onSelectSession, 
  onNewChat,
  onDeleteSession,
  onSelectModel,
  toggleSidebar
}) => {
  
  const handleDelete = (id: string) => {
    if (window.confirm('Вы уверены, что хотите удалить этот чат?')) {
      onDeleteSession(id);
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-30 z-20 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar Content */}
      <div 
        className={`
          fixed inset-y-0 left-0 z-30 w-72 bg-claude-sidebar border-r border-gray-200 transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:static md:block flex flex-col
        `}
      >
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h1 className="font-serif font-bold text-xl text-gray-700">1C Эксперт AI</h1>
          <button onClick={toggleSidebar} className="md:hidden text-gray-500">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-3 space-y-3">
          <button 
            onClick={() => { onNewChat(); if(window.innerWidth < 768) toggleSidebar(); }}
            className="w-full flex items-center justify-center space-x-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 py-2 rounded-lg transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Новый чат</span>
          </button>

          {/* Model Selector */}
          <div className="relative">
             <label className="block text-xs font-semibold text-gray-400 mb-1 px-1 uppercase">Модель</label>
             <div className="relative">
                <select
                  value={currentModelId}
                  onChange={(e) => onSelectModel(e.target.value)}
                  className="w-full appearance-none bg-white border border-gray-300 text-gray-700 py-2 px-3 pr-8 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude-accent focus:border-claude-accent"
                >
                  {MODELS.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
             </div>
             <p className="text-[10px] text-gray-400 mt-1 px-1">
               {currentModelId.includes('flash') ? 'Быстрая, меньше ошибок лимитов.' : 'Умная, но могут быть лимиты.'}
             </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="text-xs font-semibold text-gray-400 px-2 mb-2 uppercase tracking-wide">История</div>
          {sessions.length === 0 ? (
            <div className="text-sm text-gray-400 px-2 italic">Нет предыдущих чатов</div>
          ) : (
            sessions.map(session => (
              <div
                key={session.id}
                className={`
                  group w-full flex items-center justify-between rounded-lg text-sm transition-colors relative
                  ${session.id === currentSessionId 
                    ? 'bg-gray-200 text-gray-900 font-medium' 
                    : 'text-gray-600 hover:bg-gray-200/50'}
                `}
              >
                {/* Session Title Button */}
                <button
                  onClick={() => { onSelectSession(session.id); if(window.innerWidth < 768) toggleSidebar(); }}
                  className="flex-1 text-left px-3 py-2.5 truncate focus:outline-none"
                >
                  {session.title || 'Новый чат'}
                </button>
                
                {/* Delete Button - Separated from the main click area */}
                <button 
                  onClick={() => handleDelete(session.id)}
                  className={`
                    p-2 mr-1 rounded-md hover:bg-gray-300 text-gray-400 hover:text-red-600 transition-all
                    ${session.id === currentSessionId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                  `}
                  title="Удалить чат"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-200 text-xs text-gray-400">
           История хранится локально.
        </div>
      </div>
    </>
  );
};

export default Sidebar;