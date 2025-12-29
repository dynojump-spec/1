
import React, { useState, useEffect, useRef } from 'react';
import { Menu, Settings, Download, CheckCircle2, AlertCircle, Search, X, ArrowDown, ArrowUp, Replace, CopyCheck, Loader2, ListFilter, Bot, MessageSquarePlus, PanelLeft, PanelRight, Square, Cloud, CloudUpload, CloudOff } from 'lucide-react';
import { NovelDocument, AppSettings, FontType, AVAILABLE_MODELS } from './types';
import * as StorageService from './services/storageService';
import Sidebar from './components/Sidebar';
import Editor, { EditorHandle } from './components/Editor';
import SettingsModal from './components/SettingsModal';
import Assistant from './components/Assistant';

const SIDEBAR_STORAGE_KEY = 'novelcraft_sidebar_open';
const ASSISTANT_LEFT_OPEN_KEY = 'novelcraft_assistant_left_open';
const ASSISTANT_RIGHT_OPEN_KEY = 'novelcraft_assistant_right_open';

const App: React.FC = () => {
  // State
  const [documents, setDocuments] = useState<NovelDocument[]>([]);
  const [currentDoc, setCurrentDoc] = useState<NovelDocument | null>(null);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (saved !== null) return JSON.parse(saved);
    return typeof window !== 'undefined' ? window.innerWidth >= 768 : false;
  });

  const [isLeftAssistantOpen, setIsLeftAssistantOpen] = useState(() => {
    const saved = localStorage.getItem(ASSISTANT_LEFT_OPEN_KEY);
    return saved !== null ? JSON.parse(saved) : false;
  });

  const [isRightAssistantOpen, setIsRightAssistantOpen] = useState(() => {
    const saved = localStorage.getItem(ASSISTANT_RIGHT_OPEN_KEY);
    return saved !== null ? JSON.parse(saved) : false;
  });

  const [isGlobalAIProcessing, setIsGlobalAIProcessing] = useState(false);

  // Panel Widths (Percentage)
  const [leftPanelWidth, setLeftPanelWidth] = useState(25);
  const [rightPanelWidth, setRightPanelWidth] = useState(25);
  
  const isResizingLeftRef = useRef(false);
  const isResizingRightRef = useRef(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  
  // Search & Replace State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const editorRef = useRef<EditorHandle>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [settings, setSettings] = useState<AppSettings>(() => {
    const local = StorageService.getLocalSettings();
    return local || {
      fontSize: 18,
      fontType: FontType.SERIF,
      snippets: [],
      aiModel: AVAILABLE_MODELS[0].id
    };
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  useEffect(() => {
    localStorage.setItem(ASSISTANT_LEFT_OPEN_KEY, JSON.stringify(isLeftAssistantOpen));
  }, [isLeftAssistantOpen]);

  useEffect(() => {
    localStorage.setItem(ASSISTANT_RIGHT_OPEN_KEY, JSON.stringify(isRightAssistantOpen));
  }, [isRightAssistantOpen]);

  useEffect(() => {
    const docs = StorageService.getDocuments();
    setDocuments(docs);
    
    const activeDocs = docs.filter(d => !d.isDeleted);
    if (activeDocs.length > 0) {
      setCurrentDoc(activeDocs[0]);
    } else if (docs.length === 0) {
      handleCreateDoc();
    } else {
      handleCreateDoc();
    }
  }, []);

  useEffect(() => {
    StorageService.saveLocalSettings(settings);
  }, [settings]);

  // --- SPLIT PANE RESIZING LOGIC ---
  const startResizingLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingLeftRef.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const startResizingRight = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRightRef.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizingLeftRef.current && !isResizingRightRef.current) return;
    
    let containerWidth = window.innerWidth;
    let offset = 0;
    
    if (isSidebarOpen && window.innerWidth >= 768) {
      containerWidth -= 256; 
      offset = 256;
    }
    
    const relativeX = e.clientX - offset;
    const minWidthPercent = 5; 
    const minEditorPercent = 10; 
    
    if (isResizingLeftRef.current) {
      let newPercent = (relativeX / containerWidth) * 100;
      if (newPercent < minWidthPercent) newPercent = minWidthPercent;
      let maxPercent = 100 - minEditorPercent;
      if (isRightAssistantOpen) maxPercent -= rightPanelWidth;
      if (newPercent > 90) newPercent = 90;
      if (newPercent > maxPercent) newPercent = maxPercent;
      setLeftPanelWidth(newPercent);
    } else if (isResizingRightRef.current) {
      let newPercent = ((containerWidth - relativeX) / containerWidth) * 100;
      if (newPercent < minWidthPercent) newPercent = minWidthPercent;
      let maxPercent = 100 - minEditorPercent;
      if (isLeftAssistantOpen) maxPercent -= leftPanelWidth;
      if (newPercent > 90) newPercent = 90;
      if (newPercent > maxPercent) newPercent = maxPercent;
      setRightPanelWidth(newPercent);
    }
  };

  const stopResizing = () => {
    isResizingLeftRef.current = false;
    isResizingRightRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  const getEditorWidth = () => {
    let width = 100;
    if (isLeftAssistantOpen) width -= leftPanelWidth;
    if (isRightAssistantOpen) width -= rightPanelWidth;
    return width < 0 ? 0 : width;
  };

  // --- AUTO SAVE LOGIC ---
  useEffect(() => {
    if (!currentDoc) return;
    if (currentDoc.isDeleted) {
      setSaveStatus('saved'); 
      return; 
    }
    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const updatedDocs = StorageService.saveDocument(currentDoc);
      setDocuments(updatedDocs);
      setSaveStatus('saved');
    }, 1000);

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = currentDoc.content;
    const text = tempDiv.innerText || tempDiv.textContent || "";
    setCharCount(text.length);
    setWordCount(text.trim() === '' ? 0 : text.trim().split(/\s+/).length);

    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [currentDoc]);

  // --- GLOBAL SHORTCUTS ---
  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchTerm('');
    setReplaceTerm('');
    window.getSelection()?.removeAllRanges();
    editorRef.current?.focus();
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'f')) {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => { if (searchInputRef.current) { searchInputRef.current.focus(); searchInputRef.current.select(); } }, 10);
      }
      if (isSearchOpen && e.key === 'Escape') { e.preventDefault(); closeSearch(); }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isSearchOpen]);

  const handleCreateDoc = () => {
    const updatedDocs = StorageService.createDocument();
    setDocuments(updatedDocs);
    const newDoc = updatedDocs[updatedDocs.length - 1];
    setCurrentDoc(newDoc);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleMoveToTrash = (id: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus('saved');
    const updatedDocs = StorageService.softDeleteDocument(id);
    setDocuments(updatedDocs);
    if (currentDoc?.id === id) {
      const activeDocs = updatedDocs.filter(d => !d.isDeleted);
      if (activeDocs.length > 0) setCurrentDoc(activeDocs[0]);
      else handleCreateDoc();
    }
  };

  const handleRestore = (id: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    const updatedDocs = StorageService.restoreDocument(id);
    setDocuments(updatedDocs);
    const restored = updatedDocs.find(d => d.id === id);
    if (restored) setCurrentDoc(restored);
  };

  const handlePermanentDelete = (id: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus('saved');
    const remainingDocs = StorageService.permanentlyDeleteDocument(id);
    setDocuments(remainingDocs);
    if (currentDoc?.id === id) {
      const activeDocs = remainingDocs.filter(d => !d.isDeleted);
      const trashDocs = remainingDocs.filter(d => d.isDeleted);
      if (activeDocs.length > 0) setCurrentDoc(activeDocs[0]);
      else if (trashDocs.length > 0) setCurrentDoc(trashDocs[0]);
      else handleCreateDoc();
    }
  };

  const handleEmptyTrash = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus('saved');
    const remainingDocs = StorageService.emptyTrash();
    setDocuments(remainingDocs);
    if (currentDoc?.isDeleted) {
      const activeDocs = remainingDocs.filter(d => !d.isDeleted);
      if (activeDocs.length > 0) setCurrentDoc(activeDocs[0]);
      else handleCreateDoc();
    }
  };

  const handleSelectDoc = (id: string) => {
    const doc = documents.find(d => d.id === id);
    if (doc) setCurrentDoc(doc);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleContentChange = (html: string) => {
    if (currentDoc && !currentDoc.isDeleted) {
      setCurrentDoc({ ...currentDoc, content: html });
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (currentDoc && !currentDoc.isDeleted) {
      setCurrentDoc({ ...currentDoc, title: e.target.value });
    }
  };

  const handleExportTxt = async () => {
    if (!currentDoc) return;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = currentDoc.content;
    const diffNodes = tempDiv.querySelectorAll('.diff-interactive');
    diffNodes.forEach(node => {
        const state = node.getAttribute('data-state');
        const modified = node.getAttribute('data-modified');
        if (state === 'modified' && (!modified || modified === '')) { node.remove(); return; }
    });
    let html = tempDiv.innerHTML;
    html = html.replace(/<\/div>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/h[1-6]>/gi, '\n').replace(/<\/li>/gi, '\n').replace(/<br\s*\/?>/gi, '\n');
    let text = html.replace(/<[^>]+>/g, '');
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    text = textarea.value.replace(/\n{3,}/g, '\n\n');
    const fileName = `${currentDoc.title || 'novel'}.txt`;
    const triggerDownloadLegacy = () => {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    if (settings.enableSaveAsDialog !== false && 'showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({ suggestedName: fileName, types: [{ description: 'Text Files', accept: { 'text/plain': ['.txt'] } }] });
          const writable = await handle.createWritable();
          await writable.write(text);
          await writable.close();
        } catch (err: any) {
          if (err.name === 'AbortError') return;
          triggerDownloadLegacy();
        }
    } else triggerDownloadLegacy();
  };
  
  useEffect(() => {
    if (!searchTerm || !currentDoc) { setMatchCount(0); return; }
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = currentDoc.content;
      const text = tempDiv.textContent || '';
      const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedTerm, 'gi');
      const matches = text.match(regex);
      setMatchCount(matches ? matches.length : 0);
    } catch (e) { setMatchCount(0); }
  }, [searchTerm, currentDoc]);
  
  const handleFindNext = (direction: 'next' | 'prev' = 'next') => { if (!searchTerm || !editorRef.current) return; editorRef.current.find(searchTerm, direction); };
  const handleReplace = () => {
    if (!searchTerm || !editorRef.current) return;
    const selection = window.getSelection();
    let selectedText = '';
    if (selection && selection.rangeCount > 0) selectedText = selection.toString();
    if (selectedText.toLowerCase() === searchTerm.toLowerCase()) { editorRef.current.replace(replaceTerm); handleFindNext(); }
    else editorRef.current.find(searchTerm, 'next');
  };

  const handleStopAI = () => { if (editorRef.current) editorRef.current.cancelOperation(); };

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      <Sidebar
        isOpen={isSidebarOpen}
        documents={documents}
        currentDocId={currentDoc?.id || null}
        onCreate={handleCreateDoc}
        onMoveToTrash={handleMoveToTrash}
        onRestore={handleRestore}
        onPermanentDelete={handlePermanentDelete}
        onEmptyTrash={handleEmptyTrash}
        onSelect={handleSelectDoc}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <div className={`flex-1 flex flex-col h-full transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : ''} min-w-0 max-w-full`}>
        <header className="flex-col z-20 sticky top-0 shrink-0">
          <div className="h-16 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur flex items-center w-full transition-all duration-200">
            {isSearchOpen ? (
              <div className="flex items-center gap-2 w-full px-4 animate-in fade-in slide-in-from-top-1 duration-200">
                <Search size={16} className="text-zinc-500 shrink-0 hidden sm:block" />
                <div className="relative flex-1 min-w-[80px]">
                  <input ref={searchInputRef} type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => { if(e.key==='Enter'){ e.preventDefault(); e.shiftKey?handleFindNext('prev'):handleFindNext('next'); } }} placeholder="찾기..." className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-sm rounded pl-3 pr-16 py-1.5 focus:outline-none focus:border-blue-500 placeholder-zinc-600" autoFocus />
                  {searchTerm && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-mono pointer-events-none">
                      {matchCount > 0 ? <span className="text-blue-400 font-bold">{matchCount}개</span> : <span className="text-red-500">0개</span>}
                    </div>
                  )}
                </div>
                <div className="relative flex-1 min-w-[80px]">
                  <input type="text" value={replaceTerm} onChange={(e) => setReplaceTerm(e.target.value)} onKeyDown={(e) => { if(e.key==='Enter') handleReplace(); }} placeholder="바꾸기..." className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-sm rounded pl-3 pr-2 py-1.5 focus:outline-none focus:border-blue-500 placeholder-zinc-600" />
                </div>
                <div className="flex items-center bg-zinc-800 rounded border border-zinc-700 shrink-0">
                    <button onClick={() => handleFindNext('prev')} className="p-1.5 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 border-r border-zinc-700"><ArrowUp size={14}/></button>
                    <button onClick={() => handleFindNext('next')} className="p-1.5 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100"><ArrowDown size={14}/></button>
                </div>
                <button onClick={handleReplace} className="px-2 sm:px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded border border-zinc-700 shrink-0 whitespace-nowrap"><span className="hidden sm:block">바꾸기</span><Replace size={14} className="sm:hidden" /></button>
                <button onClick={closeSearch} className="ml-auto p-2 text-zinc-500 hover:text-zinc-100 rounded hover:bg-zinc-800"><X size={18} /></button>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full px-6 animate-in fade-in slide-in-from-bottom-1 duration-200">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded shrink-0"><Menu size={20} /></button>}
                  <input type="text" value={currentDoc?.title || ''} onChange={handleTitleChange} placeholder="제목 없는 소설" disabled={currentDoc?.isDeleted} className={`bg-transparent text-lg font-bold text-zinc-100 focus:outline-none placeholder-zinc-600 min-w-[120px] w-full max-w-[200px] sm:max-w-md truncate disabled:opacity-50 disabled:cursor-not-allowed ${currentDoc?.isDeleted ? 'line-through text-red-400' : ''}`} />
                  <div className="flex items-center gap-4 text-xs font-medium shrink-0">
                    {currentDoc?.isDeleted ? <span className="text-red-500 flex items-center gap-1 px-2 py-1 rounded bg-red-900/20 border border-red-900/50 whitespace-nowrap"><AlertCircle size={12} /> 휴지통</span> : (
                      <>
                        {saveStatus === 'saving' && <span className="text-zinc-500 flex items-center gap-1"><Loader2 size={12} className="animate-spin"/><span className="hidden sm:inline">저장 중...</span></span>}
                        {saveStatus === 'saved' && <span className="text-green-500 flex items-center gap-1"><CheckCircle2 size={12} /><span className="hidden sm:inline">저장됨</span></span>}
                        {saveStatus === 'unsaved' && <span className="text-yellow-500 flex items-center gap-1"><AlertCircle size={12} /><span className="hidden sm:inline">저장 안됨</span></span>}
                        <div className="w-px h-3 bg-zinc-800 hidden sm:block"></div>
                        <span className="text-zinc-400 whitespace-nowrap hidden sm:inline">{charCount.toLocaleString()}자</span>
                        {isGlobalAIProcessing && (
                             <>
                               <div className="w-px h-3 bg-zinc-800"></div>
                               <div className="flex items-center gap-2 text-blue-400 bg-blue-900/10 px-2 py-0.5 rounded border border-blue-900/30 animate-pulse">
                                  <Loader2 className="animate-spin" size={12} />
                                  <span className="hidden sm:inline font-bold">AI 수정 중...</span>
                                  <button onClick={handleStopAI} className="p-0.5 hover:text-red-400 hover:bg-red-900/20 rounded ml-1" title="작업 중지"><Square size={10} fill="currentColor" /></button>
                               </div>
                             </>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-4">
                  {settings.driveClientId && (
                    <button 
                      onClick={() => setIsSettingsOpen(true)} 
                      className={`p-2 rounded transition-colors ${settings.lastCloudBackup ? 'text-blue-400 hover:bg-blue-900/20' : 'text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800'}`}
                      title={settings.lastCloudBackup ? `마지막 백업: ${settings.lastCloudBackup}` : '구글 드라이브 설정 필요'}
                    >
                      <Cloud size={20} />
                    </button>
                  )}
                  <button onClick={() => setIsSearchOpen(!isSearchOpen)} className={`p-2 rounded transition-colors ${isSearchOpen ? 'text-blue-400 bg-blue-900/20' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}`}><Search size={20} /></button>
                  <button onClick={() => setIsLeftAssistantOpen(!isLeftAssistantOpen)} className={`p-2 rounded transition-colors ${isLeftAssistantOpen ? 'text-purple-400 bg-purple-900/20' : 'text-zinc-400 hover:text-purple-400 hover:bg-zinc-800'}`} title="왼쪽 AI"><PanelLeft size={20} /></button>
                  <button onClick={() => setIsRightAssistantOpen(!isRightAssistantOpen)} className={`p-2 rounded transition-colors ${isRightAssistantOpen ? 'text-purple-400 bg-purple-900/20' : 'text-zinc-400 hover:text-purple-400 hover:bg-zinc-800'}`} title="오른쪽 AI"><PanelRight size={20} /></button>
                  <button onClick={handleExportTxt} className="p-2 text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 rounded" title="텍스트(.txt) 내보내기"><Download size={20} /></button>
                  <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded"><Settings size={20} /></button>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden w-full relative">
          {isLeftAssistantOpen && (
             <>
               <div className="flex flex-col h-full overflow-hidden z-10" style={{ width: `${leftPanelWidth}%` }}>
                 <Assistant isOpen={isLeftAssistantOpen} onClose={() => setIsLeftAssistantOpen(false)} settings={settings} storageId="left" />
               </div>
               <div className="w-1.5 hover:bg-blue-500/50 cursor-col-resize flex items-center justify-center z-20 transition-colors group" onMouseDown={startResizingLeft}><div className="h-8 w-0.5 bg-zinc-700 group-hover:bg-blue-400 rounded-full"></div></div>
             </>
          )}
          <div className="flex flex-col h-full overflow-hidden transition-all duration-75" style={{ width: `${getEditorWidth()}%` }}>
             <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
               {currentDoc ? <Editor ref={editorRef} content={currentDoc.content} onChange={handleContentChange} settings={settings} readOnly={currentDoc.isDeleted} onRestore={() => handleRestore(currentDoc.id)} onPermanentDelete={() => handlePermanentDelete(currentDoc.id)} onProcessingChange={setIsGlobalAIProcessing} /> : <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4"><div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center"><AlertCircle size={32} className="opacity-50" /></div><p>선택된 문서가 없습니다.</p><button onClick={handleCreateDoc} className="px-4 py-2 text-sm font-bold text-zinc-950 bg-blue-500 rounded hover:bg-blue-400">새 소설 작성하기</button></div>}
             </div>
          </div>
          {isRightAssistantOpen && (
            <>
              <div className="w-1.5 hover:bg-blue-500/50 cursor-col-resize flex items-center justify-center z-20 transition-colors group" onMouseDown={startResizingRight}><div className="h-8 w-0.5 bg-zinc-700 group-hover:bg-blue-400 rounded-full"></div></div>
              <div className="flex flex-col h-full overflow-hidden z-10" style={{ width: `${rightPanelWidth}%` }}><Assistant isOpen={isRightAssistantOpen} onClose={() => setIsRightAssistantOpen(false)} settings={settings} storageId="default" /></div>
            </>
          )}
        </div>

        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onUpdate={setSettings} />
      </div>
    </div>
  );
};

export default App;
