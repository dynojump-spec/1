
import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Keyboard, Command, Type, Palette, Cpu, Download, Upload, AlignJustify, AlignLeft, Wand2, Key, Eye, EyeOff, MessageSquare, Volume2, Indent, Bot, PanelLeft, PanelRight, BookOpen, UserCircle, PenTool, FileUp, FileText, RotateCcw, ExternalLink, Database, Save, FolderUp, Folder, PaintBucket, AlertTriangle, CheckCircle2, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { AppSettings, FontType, Snippet, SnippetType, AVAILABLE_MODELS, AIRevisionMode, KnowledgeFile } from '../types';
import { getDefaultSettings } from '../services/storageService';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdate: (settings: AppSettings) => void;
}

const AI_MODE_LABELS: Record<string, string> = {
  [AIRevisionMode.GRAMMAR]: '맞춤법/교정',
  [AIRevisionMode.POLISH]: '윤문 (문장 다듬기)',
  [AIRevisionMode.ACTION]: '전투/액션 묘사',
  [AIRevisionMode.EMOTIONAL]: '감정선 강화',
  [AIRevisionMode.DIALOGUE]: '대사 톤앤매너',
  [AIRevisionMode.HANJA]: '한자 변환 (화룡(火龍))',
  [AIRevisionMode.COMPACT]: '벽돌체 다듬기 (간결/직관)',
  [AIRevisionMode.SCENERY]: '배경 묘사 생성 (150-300자)',
};

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, settings, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'assistants' | 'shortcuts'>('general');
  const [newTrigger, setNewTrigger] = useState('');
  const [newSnippetType, setNewSnippetType] = useState<SnippetType>(SnippetType.TEXT);
  const [newSnippetValue, setNewSnippetValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  
  // Google Drive State
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [driveStatus, setDriveStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
  const [assistantTabMode, setAssistantTabMode] = useState<'left' | 'right'>('right');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const knowledgeFileInputRef = useRef<HTMLInputElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsRecording(false);
      setNewTrigger('');
      setNewSnippetType(SnippetType.TEXT);
      setNewSnippetValue('');
      setShowApiKey(false);
      setDriveStatus('idle');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // --- Google Drive Backup Logic ---
  const handleGoogleDriveBackup = async () => {
    setIsDriveLoading(true);
    setDriveStatus('loading');
    
    try {
      // 1. Prepare Backup Content
      const docs = localStorage.getItem('novelcraft_docs');
      const savedSettings = localStorage.getItem('novelcraft_settings');
      const chatSessions = localStorage.getItem('novelcraft_chat_sessions');
      const chatSessionsLeft = localStorage.getItem('novelcraft_chat_sessions_left');
      
      const backupData = {
        version: 1,
        timestamp: new Date().toISOString(),
        data: {
          docs: docs ? JSON.parse(docs) : [],
          settings: savedSettings ? JSON.parse(savedSettings) : {},
          chatSessions: chatSessions ? JSON.parse(chatSessions) : [],
          chatSessionsLeft: chatSessionsLeft ? JSON.parse(chatSessionsLeft) : []
        }
      };
      
      const content = JSON.stringify(backupData, null, 2);
      const filename = 'novelcraft-backup.json';

      // 2. Google OAuth2 Token Request
      // We use the Identity Service Token Client
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: settings.driveClientId || '582490518744-84d4l6l6vj6j7m8n8m8m8m8m8m8m8m.apps.googleusercontent.com', // Placeholder if not provided
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            throw new Error(tokenResponse.error);
          }
          
          const accessToken = tokenResponse.access_token;
          
          // 3. Check for existing file
          let fileId = settings.driveFileId;
          
          if (!fileId) {
             const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${filename}' and trashed=false`, {
               headers: { Authorization: `Bearer ${accessToken}` }
             });
             const searchData = await searchRes.json();
             if (searchData.files && searchData.files.length > 0) {
               fileId = searchData.files[0].id;
             }
          }

          // 4. Upload/Update
          const metadata = {
            name: filename,
            mimeType: 'application/json',
          };
          
          const form = new FormData();
          form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
          form.append('file', new Blob([content], { type: 'application/json' }));

          const url = fileId 
            ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
            : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
          
          const method = fileId ? 'PATCH' : 'POST';

          const uploadRes = await fetch(url, {
            method: method,
            headers: { Authorization: `Bearer ${accessToken}` },
            body: form
          });

          if (!uploadRes.ok) throw new Error("Upload failed");
          
          const uploadData = await uploadRes.json();
          
          // 5. Update settings with File ID and Timestamp
          onUpdate({
            ...settings,
            driveFileId: uploadData.id,
            lastCloudBackup: new Date().toLocaleString()
          });
          
          setDriveStatus('success');
          setIsDriveLoading(false);
        },
      });

      client.requestAccessToken();

    } catch (error) {
      console.error("Drive backup failed:", error);
      setDriveStatus('error');
      setIsDriveLoading(false);
      alert("구글 드라이브 백업 중 오류가 발생했습니다. 권한 설정을 확인해주세요.");
    }
  };

  const handleKeyDownCapture = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
    const modifiers = [];
    if (e.ctrlKey) modifiers.push('Ctrl');
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');
    if (e.metaKey) modifiers.push('Cmd');
    let key = e.key.toUpperCase();
    if (e.code.startsWith('Digit')) key = e.code.replace('Digit', '');
    const trigger = [...modifiers, key].join('+');
    setNewTrigger(trigger);
    setIsRecording(false);
  };

  const addSnippet = () => {
    if (!newTrigger || !newSnippetValue) return;
    const newSnippet: Snippet = { id: uuidv4(), trigger: newTrigger, text: newSnippetValue, type: newSnippetType };
    onUpdate({ ...settings, snippets: [...(settings.snippets || []), newSnippet] });
    setNewTrigger('');
    if (newSnippetType === SnippetType.COLOR) setNewSnippetValue('#ffffff');
    else if (newSnippetType === SnippetType.AI_COMMAND) setNewSnippetValue(AIRevisionMode.GRAMMAR);
    else setNewSnippetValue('');
  };

  const removeSnippet = (id: string) => {
    onUpdate({ ...settings, snippets: settings.snippets.filter(s => s.id !== id) });
  };

  const insertCursorMarker = () => { setNewSnippetValue(prev => prev + '{|}'); };

  const handleExportSnippets = () => {
    const dataStr = JSON.stringify(settings.snippets || [], null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "novelcraft-snippets.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => { fileInputRef.current?.click(); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          const validSnippets: Snippet[] = parsed
            .filter((item: any) => item && typeof item === 'object' && item.trigger)
            .map((item: any) => ({
              id: item.id || uuidv4(),
              trigger: item.trigger,
              text: item.text || '',
              type: Object.values(SnippetType).includes(item.type) ? item.type : SnippetType.TEXT
            }));
          if (validSnippets.length > 0) {
            const existingSnippets = settings.snippets || [];
            if (existingSnippets.length === 0) {
              onUpdate({ ...settings, snippets: validSnippets });
            } else {
              if (window.confirm("추가하시겠습니까?")) {
                 const snippetMap = new Map();
                 existingSnippets.forEach(s => snippetMap.set(s.trigger, s));
                 validSnippets.forEach(s => snippetMap.set(s.trigger, s));
                 onUpdate({ ...settings, snippets: Array.from(snippetMap.values()) });
              }
            }
          }
        }
      } catch (err) { alert("파일을 읽는 중 오류가 발생했습니다."); }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getAssistantConfig = () => {
    return assistantTabMode === 'left' ? { model: settings.leftAssistantModel || AVAILABLE_MODELS[1].id, persona: settings.leftAssistantPersona } 
    : { model: settings.rightAssistantModel || AVAILABLE_MODELS[1].id, persona: settings.rightAssistantPersona };
  };

  const updateAssistantConfig = (field: string, value: any) => {
    if (assistantTabMode === 'left') {
      if (field === 'model') onUpdate({ ...settings, leftAssistantModel: value });
      else onUpdate({ ...settings, leftAssistantPersona: { ...settings.leftAssistantPersona, [field]: value } });
    } else {
      if (field === 'model') onUpdate({ ...settings, rightAssistantModel: value });
      else onUpdate({ ...settings, rightAssistantPersona: { ...settings.rightAssistantPersona, [field]: value } });
    }
  };

  const handleKnowledgeFileAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const readFile = (file: File): Promise<KnowledgeFile> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target?.result as string;
                resolve({ id: uuidv4(), name: file.name, content: content || '', size: file.size });
            };
            reader.readAsText(file);
        });
    };
    const results = await Promise.all(Array.from(files).map(file => readFile(file as File)));
    const currentFiles = getAssistantConfig().persona?.files || [];
    updateAssistantConfig('files', [...currentFiles, ...results.filter(f => f.content)]);
    if (knowledgeFileInputRef.current) knowledgeFileInputRef.current.value = '';
  };

  const handleFullBackup = () => {
    try {
      const docs = localStorage.getItem('novelcraft_docs');
      const savedSettings = localStorage.getItem('novelcraft_settings');
      const chatSessions = localStorage.getItem('novelcraft_chat_sessions');
      const chatSessionsLeft = localStorage.getItem('novelcraft_chat_sessions_left');
      const backupData = { version: 1, timestamp: new Date().toISOString(), data: { docs: docs ? JSON.parse(docs) : [], settings: savedSettings ? JSON.parse(savedSettings) : {}, chatSessions: chatSessions ? JSON.parse(chatSessions) : [], chatSessionsLeft: chatSessionsLeft ? JSON.parse(chatSessionsLeft) : [] } };
      const dataStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `novelcraft-backup-${new Date().toISOString().slice(0,10)}.json`;
      link.click();
    } catch (error) { alert("백업 실패"); }
  };

  const handleFullRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm("데이터를 복원하시겠습니까?")) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.data) {
          if (parsed.data.docs) localStorage.setItem('novelcraft_docs', JSON.stringify(parsed.data.docs));
          if (parsed.data.settings) localStorage.setItem('novelcraft_settings', JSON.stringify(parsed.data.settings));
          if (parsed.data.chatSessions) localStorage.setItem('novelcraft_chat_sessions', JSON.stringify(parsed.data.chatSessions));
          alert("복원 완료. 새로고침합니다.");
          window.location.reload();
        }
      } catch (error) { alert("복원 오류"); }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (window.confirm("초기화하시겠습니까?")) {
      const defaults = getDefaultSettings();
      onUpdate({ ...defaults, apiKey: settings.apiKey, snippets: settings.snippets });
    }
  };

  const BG_PRESETS = [
    { name: 'Dark', value: '#09090b' }, { name: 'Midnight', value: '#18181b' }, { name: 'Charcoal', value: '#27272a' }, { name: 'Sepia', value: '#1c1917' }, { name: 'Paper', value: '#ffffff' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <h2 className="text-xl font-bold text-zinc-100">설정 (Settings)</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-zinc-800 mb-6 shrink-0">
          {['general', 'assistants', 'shortcuts'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`pb-2 px-4 text-sm font-medium transition-colors relative capitalize ${
                activeTab === tab ? 'text-blue-400' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab === 'general' ? '일반' : tab === 'assistants' ? 'AI 어시스턴트' : '단축키'}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 pr-2">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="bg-blue-900/10 p-4 rounded-lg border border-blue-900/30">
                <label className="block mb-2 text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <Key size={16} className="text-blue-400" /> Google API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={settings.apiKey || ''}
                    onChange={(e) => onUpdate({ ...settings, apiKey: e.target.value })}
                    placeholder="API 키를 입력하세요"
                    className="w-full p-3 pr-10 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 text-sm focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-zinc-400 flex items-center gap-2">
                  <Cpu size={16} /> 에디터 AI 모델
                </label>
                <select
                  value={settings.aiModel}
                  onChange={(e) => onUpdate({ ...settings, aiModel: e.target.value })}
                  className="w-full p-3 rounded border border-zinc-700 bg-zinc-800 text-zinc-200 text-sm appearance-none cursor-pointer"
                >
                  {AVAILABLE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>

              {/* Cloud Backup Section */}
              <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-800">
                <label className="block mb-3 text-sm font-bold text-zinc-200 flex items-center gap-2">
                  <Cloud size={16} className="text-blue-400" /> Google Drive 클라우드 백업
                </label>
                <div className="space-y-4">
                   <p className="text-xs text-zinc-400 leading-relaxed">
                     데이터를 구글 드라이브에 안전하게 보관하세요. 언제 어디서든 '복원' 기능을 통해 작업을 이어갈 수 있습니다.
                   </p>
                   
                   <div className="flex items-center justify-between p-3 bg-zinc-900 rounded border border-zinc-700">
                      <div className="flex flex-col">
                        <span className="text-xs text-zinc-300 font-bold">백업 상태</span>
                        <span className="text-[10px] text-zinc-500">
                          {settings.lastCloudBackup ? `${settings.lastCloudBackup}에 마지막 백업` : '백업 기록 없음'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                         {driveStatus === 'success' && <CheckCircle2 size={16} className="text-green-500" />}
                         {driveStatus === 'error' && <AlertTriangle size={16} className="text-red-500" />}
                      </div>
                   </div>

                   <button 
                     onClick={handleGoogleDriveBackup}
                     disabled={isDriveLoading}
                     className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all active:scale-95 ${
                       isDriveLoading 
                       ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                       : 'bg-white hover:bg-zinc-100 text-zinc-900 shadow-lg'
                     }`}
                   >
                     {isDriveLoading ? (
                       <Loader2 size={16} className="animate-spin" />
                     ) : (
                       <Cloud size={16} />
                     )}
                     구글 드라이브에 백업 (자동 저장)
                   </button>
                   
                   <p className="text-[10px] text-zinc-500 text-center italic">
                     * 드라이브의 'novelcraft-backup.json' 파일을 생성하거나 업데이트합니다.
                   </p>
                </div>
              </div>

              <div className="mt-6 border-t border-zinc-800 pt-6">
                <label className="block mb-3 text-sm font-medium text-zinc-400 flex items-center gap-2">
                  <Database size={16} /> 로컬 데이터 관리
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={handleFullBackup} className="flex items-center justify-center gap-2 px-3 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg text-xs font-bold">
                    <Save size={14} /> 수동 다운로드
                  </button>
                  <button onClick={() => backupFileInputRef.current?.click()} className="flex items-center justify-center gap-2 px-3 py-2.5 bg-green-900/30 hover:bg-green-900/50 text-green-200 rounded-lg border border-green-800/50 text-xs font-bold">
                    <FolderUp size={14} /> 데이터 복원
                  </button>
                </div>
                <input type="file" ref={backupFileInputRef} onChange={handleFullRestore} className="hidden" accept=".json" />
              </div>
            </div>
          )}

          {activeTab === 'assistants' && (
            <div className="space-y-6">
              <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                <button onClick={() => setAssistantTabMode('left')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md ${assistantTabMode === 'left' ? 'bg-zinc-800 text-purple-400 shadow-sm' : 'text-zinc-500'}`}>
                  <PanelLeft size={16} /> 왼쪽 패널
                </button>
                <button onClick={() => setAssistantTabMode('right')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md ${assistantTabMode === 'right' ? 'bg-zinc-800 text-purple-400 shadow-sm' : 'text-zinc-500'}`}>
                  <PanelRight size={16} /> 오른쪽 패널
                </button>
              </div>
              <div className="bg-zinc-800/30 rounded-lg p-5 border border-zinc-800">
                <div className="mb-5">
                   <label className="block mb-2 text-xs font-bold text-zinc-400 uppercase">AI 모델</label>
                   <select value={getAssistantConfig().model} onChange={(e) => updateAssistantConfig('model', e.target.value)} className="w-full p-3 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 text-sm">
                     {AVAILABLE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                   </select>
                </div>
                <div className="space-y-4 pt-4 border-t border-zinc-700/50">
                  <input type="text" value={getAssistantConfig().persona?.name || ''} onChange={(e) => updateAssistantConfig('name', e.target.value)} placeholder="페르소나 이름" className="w-full p-2 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 text-sm" />
                  <textarea value={getAssistantConfig().persona?.instruction || ''} onChange={(e) => updateAssistantConfig('instruction', e.target.value)} placeholder="행동 지침" className="w-full p-2 rounded border border-zinc-700 bg-zinc-900 text-zinc-300 text-sm min-h-[100px]" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleExportSnippets} className="px-3 py-2.5 bg-zinc-800 text-zinc-300 rounded-lg border border-zinc-700 text-xs font-bold">내보내기</button>
                <button onClick={handleImportClick} className="px-3 py-2.5 bg-blue-900/30 text-blue-200 rounded-lg border border-blue-800/50 text-xs font-bold">불러오기</button>
              </div>
              <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-800">
                <button onClick={() => setIsRecording(true)} className={`w-full p-2 rounded border text-left text-sm ${isRecording ? 'border-blue-500 bg-blue-900/20' : 'bg-zinc-900 text-zinc-300'}`}>
                  {isRecording ? '키 입력 중...' : newTrigger || '클릭하여 키 설정'}
                </button>
                {isRecording && <input type="text" className="opacity-0 absolute h-0 w-0" autoFocus onBlur={() => setIsRecording(false)} onKeyDown={handleKeyDownCapture} />}
                <button onClick={addSnippet} className="w-full py-2 mt-3 font-bold text-zinc-900 bg-blue-500 rounded">추가</button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-between shrink-0">
          <button onClick={handleReset} className="text-sm font-medium text-red-400 hover:text-red-300">초기화</button>
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-900 bg-zinc-100 rounded">완료</button>
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
      </div>
    </div>
  );
};

export default SettingsModal;
