import React, { useState, useRef } from 'react';
import { Attachment } from '../types';
import { fileToBase64, formatFileSize, isValidFileType, getFileIcon } from '../utils/fileUtils';

interface InputAreaProps {
  onSend: (text: string, attachments: Attachment[], useSearch: boolean) => void;
  isLoading: boolean;
}

const QUICK_PROMPTS = [
  { label: 'Написать код', text: 'Напиши код на 1С для следующей задачи: ' },
  { label: 'Исправить ошибку', text: 'У меня возникает ошибка в 1С. Вот текст ошибки: ' },
  { label: 'Создать структуру БД', text: 'Предложи структуру метаданных (справочники, документы, регистры) для решения задачи: ' },
  { label: 'Запрос 1С', text: 'Помоги написать запрос на языке запросов 1С для выборки: ' },
  { label: 'Инструкция', text: 'Напиши пошаговую инструкцию для пользователя 1С по теме: ' },
];

const InputArea: React.FC<InputAreaProps> = ({ onSend, isLoading }) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [useSearch, setUseSearch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if ((!text.trim() && attachments.length === 0) || isLoading) return;
    onSend(text, attachments, useSearch);
    setText('');
    setAttachments([]);
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newAttachments: Attachment[] = [];
      const files = Array.from(e.target.files) as File[];
      
      for (const file of files) {
        if (!isValidFileType(file)) {
          alert(`Неподдерживаемый тип файла: ${file.name}`);
          continue;
        }

        // Soft limit warning
        if (file.size > 20 * 1024 * 1024) { 
          const confirm = window.confirm(`Файл ${file.name} большой (>20MB). Обработка может занять время. Продолжить?`);
          if (!confirm) continue;
        }

        try {
          const base64Data = await fileToBase64(file);
          newAttachments.push({
            name: file.name,
            mimeType: file.type,
            data: base64Data,
            size: file.size
          });
        } catch (err) {
          console.error(`Error reading ${file.name}`, err);
          alert(`Ошибка чтения файла ${file.name}.`);
        }
      }

      setAttachments(prev => [...prev, ...newAttachments]);
      
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
    setText(target.value);
  };

  const handleQuickPrompt = (promptText: string) => {
    setText(promptText);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-6 sticky bottom-0 bg-[#fcfcf9] pt-2">
      
      {/* Quick Prompts Chips */}
      {text.length === 0 && attachments.length === 0 && (
        <div className="flex gap-2 overflow-x-auto pb-3 mb-1 no-scrollbar mask-gradient">
          {QUICK_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleQuickPrompt(prompt.text)}
              className="flex-shrink-0 bg-white border border-gray-200 hover:border-claude-accent/50 hover:bg-gray-50 text-gray-600 text-xs px-3 py-1.5 rounded-full transition-all whitespace-nowrap shadow-sm"
            >
              {prompt.label}
            </button>
          ))}
        </div>
      )}

      <div className="relative bg-white border border-gray-300 rounded-xl shadow-sm focus-within:ring-1 focus-within:ring-claude-accent focus-within:border-claude-accent transition-all">
        
        {/* Robust Attachments Preview */}
        {attachments.length > 0 && (
          <div className="px-3 pt-3 flex flex-wrap gap-3">
            {attachments.map((att, idx) => (
              <div 
                key={idx} 
                className="relative flex items-center bg-gray-50 border border-gray-200 rounded-lg p-2 pr-8 group animate-appear shadow-sm hover:shadow-md transition-shadow"
                style={{ maxWidth: '200px' }}
              >
                {/* Thumbnail or Icon */}
                <div className="mr-3 flex-shrink-0 w-10 h-10 flex items-center justify-center bg-white rounded overflow-hidden border border-gray-100">
                  {att.mimeType.startsWith('image/') ? (
                    <img 
                      src={`data:${att.mimeType};base64,${att.data}`} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl">{getFileIcon(att.mimeType, att.name)}</span>
                  )}
                </div>

                {/* File Info */}
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate text-xs font-semibold text-gray-700" title={att.name}>
                    {att.name}
                  </span>
                  <span className="text-[10px] text-gray-400 uppercase font-mono">
                    {att.name.split('.').pop()} • {formatFileSize(att.size)}
                  </span>
                </div>

                {/* Remove Button */}
                <button 
                  onClick={() => removeAttachment(idx)}
                  className="absolute top-1 right-1 p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={autoResize}
          onKeyDown={handleKeyDown}
          placeholder="Спросите о конфигурации, коде 1С или загрузите базу..."
          className="w-full bg-transparent border-0 focus:ring-0 outline-none resize-none py-3 px-4 max-h-[200px] text-gray-800 placeholder-gray-400 font-sans"
          rows={1}
        />

        {/* Toolbar */}
        <div className="flex justify-between items-center px-2 pb-2">
          <div className="flex items-center space-x-1">
            {/* File Upload Trigger */}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              multiple
              onChange={handleFileChange}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Прикрепить файл"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>

            {/* Search Toggle */}
            <button 
              onClick={() => setUseSearch(!useSearch)}
              className={`p-2 rounded-lg transition-colors flex items-center space-x-1 ${useSearch ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              title="Поиск в интернете"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              {useSearch && <span className="text-xs font-semibold">Web</span>}
            </button>
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={isLoading || (!text.trim() && attachments.length === 0)}
            className={`
              p-2 rounded-lg transition-all duration-200
              ${(text.trim() || attachments.length > 0) && !isLoading
                ? 'bg-claude-accent text-white shadow-md hover:bg-[#c26646]' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
            `}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        </div>
      </div>
      <div className="text-center mt-2">
         <p className="text-xs text-gray-400">ИИ может ошибаться. Пожалуйста, проверяйте код 1С.</p>
      </div>
    </div>
  );
};

export default InputArea;