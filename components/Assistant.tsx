
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, X, Sparkles, ExternalLink, Paperclip, FileText, Image as ImageIcon, Trash2, Plus, MessageSquare, Menu } from 'lucide-react';
import { ChatMessage, AppSettings, ChatSession, Attachment } from '../types';
import { chatWithAssistant } from '../services/geminiService';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  storageId?: string; // To separate sessions between Left/Right panels
}

const Assistant: React.FC<Props> = ({ isOpen, onClose, settings, storageId = 'default' }) => {
  // Use unique storage keys based on the panel location
  const STORAGE_KEY_SESSIONS = storageId === 'default' ? 'novelcraft_chat_sessions' : `novelcraft_chat_sessions_${storageId}`;
  const STORAGE_KEY_ACTIVE = storageId === 'default' ? 'novelcraft_active_session_id' : `novelcraft_active_session_id_${storageId}`;
  
  // Determine Role settings based on Side
  const isLeft = storageId === 'left';
  const myModel = isLeft ? settings.leftAssistantModel : settings.rightAssistantModel;
  const myPersona = isLeft ? settings.leftAssistantPersona : settings.rightAssistantPersona;
  
  // Display Title: Persona Name or Default
  const displayTitle = myPersona?.name || (isLeft ? '왼쪽 어시스턴트' : '오른쪽 어시스턴트');

  // --- State: Sessions ---
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SESSIONS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) { console.error(e); }
    }
    return [];
  });
  
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY_ACTIVE) || null;
  });

  const [view, setView] = useState<'chat' | 'list'>('chat');

  // --- State: Active Chat ---
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---

  // Initialize if no sessions
  useEffect(() => {
    if (sessions.length === 0) {
      createNewSession();
    } else if (!activeSessionId) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions.length]);

  // Persist sessions
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
  }, [sessions, STORAGE_KEY_SESSIONS]);

  // Persist active session
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem(STORAGE_KEY_ACTIVE, activeSessionId);
    }
  }, [activeSessionId, STORAGE_KEY_ACTIVE]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (view === 'chat') {
      scrollToBottom();
    }
  }, [sessions, activeSessionId, view, isOpen]);

  // Focus input
  useEffect(() => {
    if (isOpen && view === 'chat') {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, view]);

  // --- Helpers ---

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getActiveSession = () => sessions.find(s => s.id === activeSessionId);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: uuidv4(),
      title: '새로운 대화',
      messages: [
        {
          id: 'welcome',
          role: 'model',
          text: `안녕하세요! '${displayTitle}' 입니다. 무엇을 도와드릴까요?`
        }
      ],
      lastModified: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setView('chat');
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("이 대화를 삭제하시겠습니까?")) return;
    
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    
    if (activeSessionId === id) {
      if (newSessions.length > 0) {
        setActiveSessionId(newSessions[0].id);
      } else {
        createNewSession();
      }
    }
  };

  const updateSessionMessages = (sessionId: string, newMessages: ChatMessage[], newTitle?: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return {
          ...s,
          messages: newMessages,
          title: newTitle || s.title,
          lastModified: Date.now()
        };
      }
      return s;
    }));
  };

  // Helper function to render text with Bold formatting
  const renderFormattedText = (text: string) => {
    if (!text) return null;
    
    // Split by markdown bold syntax (**bold**)
    // We use a regex that captures the delimiters to keep them in the array, then map.
    const parts = text.split(/(\*\*.*?\*\*)/g);
    
    return parts.map((part, index) => {
       if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
          // Remove asterisks and wrap in strong tag
          return <strong key={index} className="font-bold text-white">{part.slice(2, -2)}</strong>;
       }
       return part;
    });
  };

  // --- Handlers: Chat ---

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading || !activeSessionId) return;

    const userText = input.trim();
    const currentAttachments = [...attachments]; // Copy
    const session = getActiveSession();
    if (!session) return;

    // Create User Message
    const newMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      text: userText,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined
    };

    const updatedMessages = [...session.messages, newMessage];
    
    // Generate Title if it's the first user message
    let newTitle = session.title;
    if (session.messages.length <= 1 && userText) {
      newTitle = userText.length > 20 ? userText.substring(0, 20) + '...' : userText;
    }

    updateSessionMessages(activeSessionId, updatedMessages, newTitle);
    
    // Clear Input
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    try {
      // Pass myModel and myPersona to service
      const response = await chatWithAssistant(
        updatedMessages, 
        userText,
        myModel, 
        settings.apiKey,
        currentAttachments,
        myPersona
      );

      const botMessage: ChatMessage = {
        id: uuidv4(),
        role: 'model',
        text: response.text,
        sources: response.sources
      };
      
      updateSessionMessages(activeSessionId, [...updatedMessages, botMessage]);
    } catch (error) {
      console.error(error);
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        role: 'model',
        text: "죄송합니다. 오류가 발생했습니다. API 키나 인터넷 연결을 확인해주세요."
      };
      updateSessionMessages(activeSessionId, [...updatedMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- Handlers: File Upload ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processFile(file);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFile = (file: File) => {
    // Size limit check removed as requested.
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      
      let attachment: Attachment | null = null;

      if (file.type.startsWith('image/')) {
        const base64Data = result.split(',')[1];
        attachment = {
          id: uuidv4(),
          name: file.name,
          type: 'image',
          mimeType: file.type,
          data: base64Data
        };
      } else {
        attachment = {
          id: uuidv4(),
          name: file.name,
          type: 'text',
          mimeType: 'text/plain',
          data: result
        };
      }

      if (attachment) {
        setAttachments(prev => [...prev, attachment!]);
      }
    };

    if (file.type.startsWith('image/')) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // --- Render ---

  if (!isOpen) return null;

  const fontSizeStyle = { fontSize: `${settings.assistantFontSize || 14}px` };
  const activeSession = getActiveSession();

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-x border-zinc-800 w-full relative min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
           {view === 'chat' && (
             <button onClick={() => setView('list')} className="text-zinc-400 hover:text-zinc-100 transition-colors">
               <Menu size={20} />
             </button>
           )}
           <div className="flex items-center gap-2 text-zinc-100 font-bold overflow-hidden">
            <Bot size={18} className="text-purple-400 shrink-0" />
            <span className="truncate">{view === 'chat' ? (activeSession?.title || displayTitle) : `${displayTitle} (목록)`}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {view === 'chat' && (
            <button 
              onClick={createNewSession}
              className="p-1.5 text-zinc-400 hover:text-blue-400 rounded-md hover:bg-zinc-800 transition-colors"
              title="새 채팅"
            >
              <Plus size={18} />
            </button>
          )}
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 ml-2">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        
        {/* VIEW: Chat List */}
        {view === 'list' && (
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            <button 
              onClick={createNewSession}
              className="w-full p-3 flex items-center gap-3 rounded-lg border border-dashed border-zinc-700 text-zinc-400 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-900/10 transition-all mb-4 group"
            >
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-blue-500/20">
                <Plus size={16} />
              </div>
              <span className="font-bold text-sm">새로운 대화 시작하기</span>
            </button>

            {sessions.map(session => (
              <div 
                key={session.id}
                onClick={() => { setActiveSessionId(session.id); setView('chat'); }}
                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer border transition-all ${
                  activeSessionId === session.id 
                    ? 'bg-zinc-800 border-zinc-700' 
                    : 'bg-transparent border-transparent hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                   <MessageSquare size={16} className={activeSessionId === session.id ? 'text-blue-400' : 'text-zinc-600'} />
                   <div className="overflow-hidden">
                     <p className={`text-sm font-medium truncate ${activeSessionId === session.id ? 'text-zinc-200' : 'text-zinc-400'}`}>
                       {session.title}
                     </p>
                     <p className="text-[10px] text-zinc-600 truncate">
                       {new Date(session.lastModified).toLocaleString()}
                     </p>
                   </div>
                </div>
                <button 
                  onClick={(e) => deleteSession(e, session.id)}
                  className="p-1.5 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* VIEW: Chat Room */}
        {view === 'chat' && activeSession && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-zinc-700">
              {activeSession.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                    msg.role === 'user' ? 'bg-blue-600' : 'bg-zinc-700 border border-zinc-600'
                  }`}>
                    {msg.role === 'user' ? <User size={14} className="text-white" /> : <Bot size={14} className="text-purple-300" />}
                  </div>
                  
                  <div className={`max-w-[85%] flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-1">
                        {msg.attachments.map(att => (
                          att.type === 'image' ? (
                            <img 
                              key={att.id} 
                              src={`data:${att.mimeType};base64,${att.data}`} 
                              alt={att.name} 
                              className="w-32 h-32 object-cover rounded-lg border border-zinc-700"
                            />
                          ) : (
                            <div key={att.id} className="flex items-center gap-2 bg-zinc-800 p-2 rounded border border-zinc-700 text-xs text-zinc-300">
                              <FileText size={14} />
                              <span className="truncate max-w-[150px]">{att.name}</span>
                            </div>
                          )
                        ))}
                      </div>
                    )}

                    <div className={`rounded-lg p-3 ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-zinc-800 text-zinc-200'
                    }`}>
                      <div className="whitespace-pre-wrap leading-relaxed" style={fontSizeStyle}>
                        {renderFormattedText(msg.text)}
                      </div>

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-zinc-700/50">
                          <p className="text-[10px] font-bold text-zinc-500 mb-1.5 uppercase flex items-center gap-1">
                            <ExternalLink size={10} /> 출처
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((source, idx) => (
                              <a 
                                key={idx}
                                href={source.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs bg-zinc-700/50 hover:bg-zinc-700 text-blue-300 hover:text-blue-200 px-2 py-1 rounded truncate max-w-full transition-colors flex items-center gap-1"
                                title={source.title}
                              >
                                <span className="truncate max-w-[150px]">{source.title}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3">
                   <div className="w-8 h-8 rounded-full bg-zinc-700 border border-zinc-600 flex items-center justify-center shrink-0 animate-pulse mt-1">
                      <Bot size={14} className="text-purple-300" />
                   </div>
                   <div className="bg-zinc-800 rounded-lg p-3 flex items-center">
                      <Loader2 size={16} className="animate-spin text-zinc-400" />
                   </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-950 shrink-0">
              {attachments.length > 0 && (
                <div className="flex gap-2 mb-2 overflow-x-auto pb-2 scrollbar-none">
                  {attachments.map(att => (
                    <div key={att.id} className="relative group shrink-0">
                      {att.type === 'image' ? (
                        <div className="w-16 h-16 rounded overflow-hidden border border-zinc-700 relative">
                           <img 
                              src={`data:${att.mimeType};base64,${att.data}`} 
                              alt={att.name} 
                              className="w-full h-full object-cover" 
                           />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded bg-zinc-800 border border-zinc-700 flex flex-col items-center justify-center text-zinc-400 p-1">
                          <FileText size={20} className="mb-1" />
                          <span className="text-[8px] text-center w-full truncate">{att.name}</span>
                        </div>
                      )}
                      <button 
                        onClick={() => removeAttachment(att.id)}
                        className="absolute -top-1 -right-1 bg-zinc-700 text-zinc-300 rounded-full p-0.5 hover:bg-red-500 hover:text-white"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative flex items-end gap-2 bg-zinc-900 border border-zinc-700 rounded-lg p-2 focus-within:border-blue-500 transition-colors">
                 <button 
                   onClick={() => fileInputRef.current?.click()}
                   className="p-2 text-zinc-500 hover:text-blue-400 hover:bg-zinc-800 rounded-md transition-colors shrink-0 mb-0.5"
                   title="파일 첨부"
                   disabled={isLoading}
                 >
                   <Paperclip size={18} />
                 </button>
                 <input 
                   type="file" 
                   ref={fileInputRef}
                   onChange={handleFileSelect}
                   className="hidden" 
                 />

                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`'${displayTitle}'에게 메시지 보내기...`}
                  className="w-full bg-transparent border-none text-sm text-zinc-200 focus:outline-none resize-none min-h-[24px] max-h-[120px] scrollbar-thin scrollbar-thumb-zinc-700 py-2"
                  rows={1}
                  style={{ height: 'auto' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && attachments.length === 0) || isLoading}
                  className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shrink-0 mb-0.5"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Assistant;
