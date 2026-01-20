import React, { useState, memo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message, Role } from '../types';
import { getFileIcon } from '../utils/fileUtils';

interface MessageBubbleProps {
  message: Message;
  isLast: boolean;
  onContinue: () => void;
  isLoading: boolean;
}

// Separate component for Code Block to handle copy state
const CodeBlock = ({ inline, className, children, ...props }: any) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : 'text';

  const handleCopy = () => {
    navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inline && match) {
    return (
      <div className="relative group my-4 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
        <div className="flex justify-between items-center bg-gray-50 px-4 py-2 text-xs text-gray-500 select-none border-b border-gray-200">
          <span className="font-mono font-semibold">{language.toUpperCase()}</span>
          <button 
            onClick={handleCopy}
            className="flex items-center space-x-1 hover:text-claude-accent transition-colors"
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-green-600">Скопировано</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                <span>Копировать</span>
              </>
            )}
          </button>
        </div>
        <SyntaxHighlighter
          {...props}
          style={vscDarkPlus}
          language={language}
          PreTag="div"
          customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.85em' }}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      </div>
    );
  }

  return (
    <code className={`${className} bg-gray-100 text-claude-accent rounded px-1 py-0.5 text-sm font-mono`} {...props}>
      {children}
    </code>
  );
};

const MessageBubble: React.FC<MessageBubbleProps> = memo(({ message, isLast, onContinue, isLoading }) => {
  const isUser = message.role === Role.USER;
  const [showSources, setShowSources] = useState(false);
  const hasSources = message.groundingSources && message.groundingSources.length > 0;
  const [displayedText, setDisplayedText] = useState(message.text);

  // Check if message is an error
  const isError = message.text.startsWith('Ошибка:') || message.text.includes('{"error":');

  useEffect(() => {
    const shouldAnimate = isLast && message.role === Role.MODEL && isLoading;

    if (!shouldAnimate) {
      setDisplayedText(message.text);
      return;
    }

    if (displayedText === message.text) return;

    if (message.text.length < displayedText.length) {
       setDisplayedText(message.text);
       return;
    }

    const timeout = setTimeout(() => {
       setDisplayedText(prev => {
          const delta = message.text.length - prev.length;
          const chunk = Math.max(1, Math.min(5, Math.ceil(delta / 2))); 
          return message.text.slice(0, prev.length + chunk);
       });
    }, 15);
    
    return () => clearTimeout(timeout);
  }, [message.text, isLast, isLoading, message.role, displayedText]);

  // Clean Error Rendering
  if (isError) {
    let cleanError = message.text.replace('Ошибка:', '').trim();
    // Try to remove raw JSON if it leaked
    if (cleanError.includes('{"error":')) {
       try {
         const jsonPart = cleanError.match(/\{.*\}/);
         if (jsonPart) {
           const parsed = JSON.parse(jsonPart[0]);
           cleanError = parsed.error?.message || "Неизвестная ошибка API";
         }
       } catch (e) {
         // keep original if parsing fails
       }
    }

    return (
      <div className={`flex w-full mb-6 justify-start animate-fadeIn`}>
         <div className="max-w-4xl w-full px-5 py-4 rounded-2xl bg-red-50 border border-red-100 text-red-800">
            <div className="flex items-center mb-2 font-bold text-red-600 text-sm uppercase tracking-wide">
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Ошибка генерации
            </div>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{cleanError}</p>
         </div>
      </div>
    );
  }

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
      <div 
        className={`
          max-w-4xl w-full px-5 py-4 rounded-2xl transition-all duration-300
          ${isUser 
            ? 'bg-[#f4f4f2] text-gray-800 rounded-tr-sm' 
            : 'bg-transparent text-gray-900 rounded-tl-sm'
          }
        `}
      >
        <div className="text-xs font-semibold mb-2 text-gray-400 uppercase tracking-wider flex items-center gap-2 select-none">
          {isUser ? 'Вы' : '1C Эксперт AI'}
        </div>

        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {message.attachments.map((att, idx) => (
              <div key={idx} className="flex items-center bg-white border border-gray-200 rounded-lg p-2 shadow-sm text-xs">
                 <div className="mr-2 text-base">
                   {getFileIcon(att.mimeType, att.name)}
                 </div>
                 <span className="truncate max-w-[150px] font-medium text-gray-700">{att.name}</span>
              </div>
            ))}
          </div>
        )}

        {hasSources && (
          <div className="mb-4">
            <button
              onClick={() => setShowSources(!showSources)}
              className="group flex items-center text-sm text-gray-500 hover:text-gray-800 transition-colors bg-transparent p-0 border-0 focus:outline-none"
            >
              <span className="mr-1">Проверено {message.groundingSources!.length} источников</span>
              <svg 
                className={`w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-transform duration-200 ${showSources ? '-rotate-90' : 'rotate-90'}`} 
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            
            {showSources && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 animate-fadeIn">
                {message.groundingSources!.map((source, idx) => (
                  <a 
                    key={idx}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col p-3 rounded-lg border border-gray-200 bg-white hover:border-claude-accent/50 hover:shadow-md transition-all text-decoration-none group"
                  >
                     <div className="text-xs font-semibold text-gray-800 truncate mb-1 group-hover:text-claude-accent">
                       {source.title}
                     </div>
                     <div className="flex items-center text-[10px] text-gray-400">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd"/></svg>
                        <span className="truncate">{new URL(source.uri || '').hostname}</span>
                     </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {message.isThinking ? (
           <div className="flex items-center space-x-1.5 text-gray-400 py-1">
             <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
             <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
             <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
           </div>
        ) : (
          <div className="markdown-body font-serif text-[0.95rem] leading-7 text-gray-800">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                code: CodeBlock
              }}
            >
              {displayedText}
            </ReactMarkdown>
          </div>
        )}
        
        {!isUser && isLast && !isLoading && !message.isThinking && (
          <div className="mt-3 animate-fadeIn">
             <button 
               onClick={onContinue}
               className="text-xs flex items-center text-claude-accent hover:text-[#b05a3e] transition-colors border border-claude-accent/30 rounded-full px-3 py-1 hover:bg-claude-accent/5"
             >
                <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                Продолжить генерацию
             </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default MessageBubble;