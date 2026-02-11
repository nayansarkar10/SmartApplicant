import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, RefreshCw, Sparkles } from 'lucide-react';
import { ChatMessage } from '../types';
import { Button } from './Button';

interface ChatSectionProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  placeholder?: string;
}

export const ChatSection: React.FC<ChatSectionProps> = ({ 
  messages, 
  onSendMessage, 
  isLoading, 
  placeholder 
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <div className="w-full bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      {/* Messages Area - Only show if there are messages or loading to keep it clean */}
      {(messages.length > 0 || isLoading) && (
        <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto bg-gray-50/30 border-b border-gray-100">
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                ${msg.role === 'user' ? 'bg-black text-white' : 'bg-white border border-gray-200 text-blue-600'}
              `}>
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              
              <div className={`
                max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm
                ${msg.role === 'user' 
                  ? 'bg-white border border-gray-200 text-gray-900 rounded-tr-none' 
                  : 'bg-white border border-blue-100 text-gray-800 rounded-tl-none'}
              `}>
                {msg.text}
                {msg.isUpdate && (
                  <div className="mt-2 pt-2 border-t border-gray-100 text-xs font-medium text-green-600 flex items-center">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Updated Content
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start gap-3">
               <div className="w-8 h-8 rounded-full bg-white border border-gray-200 text-blue-600 flex items-center justify-center flex-shrink-0">
                 <Bot className="w-4 h-4" />
               </div>
               <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-1 shadow-sm">
                 <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                 <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                 <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input Area */}
      <div className="p-2 bg-white">
        <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
            <div className="absolute left-4 text-gray-400">
                <Sparkles className="w-4 h-4" />
            </div>
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={placeholder || "Ask AI to refine details, tone, or specific sections..."}
                disabled={isLoading}
                className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:border-gray-200 focus:ring-4 focus:ring-gray-100 transition-all text-sm outline-none"
            />
            <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 p-1.5 bg-black text-white rounded-md hover:bg-gray-800 disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors"
            >
                <Send className="w-4 h-4" />
            </button>
        </form>
      </div>
    </div>
  );
};

// Helper component for the check icon inside the chat
const CheckCircle = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);