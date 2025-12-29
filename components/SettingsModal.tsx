
import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Keyboard, Command, Type, Palette, Cpu, Download, Upload, AlignJustify, AlignLeft, Wand2, Key, Eye, EyeOff, MessageSquare, Volume2, Indent, Bot, PanelLeft, PanelRight, BookOpen, UserCircle, PenTool, FileUp, FileText, RotateCcw, ExternalLink, Database, Save, FolderUp, Folder, PaintBucket, AlertTriangle, CheckCircle2, Cloud, Loader2, Info, HelpCircle } from 'lucide-react';
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
  
  // Assistant Tab State
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
    if (!settings.driveClientId) {
      alert("Google Drive 백업을 위해 'Client ID'를 먼저 설정해주세요.");
      return;
    }

    setIsDriveLoading(true);
    setDriveStatus('loading');
    
    try {
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

      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: settings.driveClientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            console.error("Token Error:", tokenResponse.error);
            setDriveStatus('error');
            setIsDriveLoading(false);
            
            // Handle specific 403 access_denied
            if (tokenResponse.error === 'access_denied') {
              alert(
                "⚠️ 액세스가 거부되었습니다.\n\n" +
                "해결 방법:\n" +
                "1. Google Cloud Console의 'OAuth 동의 화면' 메뉴로 이동합니다.\n" +
                "2. '테스트 사용자(Test users)' 섹션에 본인의 이메일을 추가했는지 확인하세요.\n" +
                "3. 추가하지 않았다면 본인 이메일을 등록해야만 앱을 사용할 수 있습니다."
              );
            } else {
              alert(`인증 오류가 발생했습니다: ${tokenResponse.error_description || tokenResponse.error}`);
            }
            return;
          }
          
          const accessToken = tokenResponse.access_token;
          let fileId = settings.driveFileId;
          
          if (!fileId) {
             const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${filename}' and trashed=false`, {
               headers: { Authorization: `Bearer ${accessToken}` }
             });
             const searchData = await searchRes.json();
             if (searchData.files && searchData.files.length > 0) fileId = searchData.files[0].id;
          }

          const metadata = { name: filename, mimeType: 'application/json' };
          const form = new FormData();
          form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
          form.append('file', new Blob([content], { type: 'application/json' }));

          const url = fileId ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart` : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
          const method = fileId ? 'PATCH' : 'POST';

          const uploadRes = await fetch(url, { method, headers: { Authorization: `Bearer ${accessToken}` }, body: form });
          if (!uploadRes.ok) throw new Error("Upload failed");
          
          const uploadData = await uploadRes.json();
          onUpdate({ ...settings, driveFileId: uploadData.id, lastCloudBackup: new Date().toLocaleString() });
          setDriveStatus('success');
          setIsDriveLoading(false);
        },
      });
      client.requestAccessToken();
    } catch (error: any) {
      console.error(error);
      setDriveStatus('error');
      setIsDriveLoading(false);
      alert("백업 프로세스 중 치명적인 오류가 발생했습니다. Client ID가 유효한지 확인해주세요.");
    }
  };

  // --- Shortcut Helpers ---
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

  // --- Assistant Helpers ---
  const getAssistantConfig = () => {
    return assistantTabMode === 'left' ? {
      model: settings.leftAssistantModel || AVAILABLE_MODELS[1].id,
      persona: settings.leftAssistantPersona
    } : {
      model: settings.rightAssistantModel || AVAILABLE_MODELS[1].id,
      persona: settings.rightAssistantPersona
    };
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
                resolve({ id: uuidv4(), name: file.name, content: (event.target?.result as string) || '', size: file.size });
            };
            reader.readAsText(file);
        });
    };
    const results = await Promise.all(Array.from(files).map(file => readFile(file as File)));
    const currentFiles = getAssistantConfig().persona?.files || [];
    updateAssistantConfig('files', [...currentFiles, ...results.filter(f => f.content)]);
    if (knowledgeFileInputRef.current) knowledgeFileInputRef.current.value = '';
  };

  const handleReset = () => {
    if (window.confirm("설정을 초기화하시겠습니까? (API 키와 단축키는 유지됩니다)")) {
      const defaults = getDefaultSettings();
      onUpdate({ ...defaults, apiKey: settings.apiKey, snippets: settings.snippets });
    }
  };

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
          <button onClick={() => setActiveTab('general')} className={`pb-2 px-4 text-sm font-medium transition-colors relative ${activeTab === 'general' ? 'text-blue-400' : 'text-zinc-400'}`}>
            일반
            {activeTab === 'general' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />}
          </button>
          <button onClick={() => setActiveTab('assistants')} className={`pb-2 px-4 text-sm font-medium transition-colors relative ${activeTab === 'assistants' ? 'text-purple-400' : 'text-zinc-400'}`}>
            어시스턴트
            {activeTab === 'assistants' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400" />}
          </button>
          <button onClick={() => setActiveTab('shortcuts')} className={`pb-2 px-4 text-sm font-medium transition-colors relative ${activeTab === 'shortcuts' ? 'text-blue-400' : 'text-zinc-400'}`}>
            단축키
            {activeTab === 'shortcuts' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />}
          </button>
        </div>

        <div className="overflow-y-auto flex-1 pr-2">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="bg-blue-900/10 p-4 rounded-lg border border-blue-900/30">
                <label className="block mb-2 text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <Key size={16} className="text-blue-400" /> Google AI (Gemini) API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={settings.apiKey || ''}
                    onChange={(e) => onUpdate({ ...settings, apiKey: e.target.value })}
                    placeholder="Gemini API 키를 입력하세요"
                    className="w-full p-3 pr-10 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 text-sm focus:border-blue-500 font-mono"
                  />
                  <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-zinc-500 flex items-center gap-1"><Info size={10}/> AI 수정 및 채팅 기능에 필요합니다.</p>
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-zinc-400 flex items-center gap-2">
                  <Cpu size={16} /> 기본 AI 모델 설정
                </label>
                <select value={settings.aiModel} onChange={(e) => onUpdate({ ...settings, aiModel: e.target.value })} className="w-full p-3 rounded border border-zinc-700 bg-zinc-800 text-zinc-200 text-sm">
                  {AVAILABLE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>

              {/* Enhanced Drive Sync Section with Troubleshooting */}
              <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-800">
                <label className="block mb-3 text-sm font-bold text-zinc-200 flex items-center gap-2">
                  <Cloud size={16} className="text-blue-400" /> Google Drive 클라우드 백업
                </label>
                <div className="space-y-4">
                   <div className="p-3 bg-red-900/10 border border-red-800/30 rounded-lg">
                     <p className="text-[10px] text-red-400 font-bold mb-1 flex items-center gap-1"><HelpCircle size={10}/> 403: access_denied 오류 해결법</p>
                     <p className="text-[9px] text-zinc-400 leading-relaxed">
                       구글 콘솔의 <strong>'OAuth 동의 화면'</strong> 메뉴에서 하단의 <strong>'테스트 사용자'</strong>에 본인 이메일을 추가해야 합니다.
                     </p>
                   </div>

                   <div>
                     <label className="block mb-1 text-xs text-zinc-400 flex items-center justify-between">
                       <span>Google OAuth Client ID</span>
                       <a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1 text-[10px]">콘솔 동의화면 <ExternalLink size={10}/></a>
                     </label>
                     <input
                       type="text"
                       value={settings.driveClientId || ''}
                       onChange={(e) => onUpdate({ ...settings, driveClientId: e.target.value })}
                       placeholder="예: 12345-abcde.apps.googleusercontent.com"
                       className="w-full p-2.5 rounded border border-zinc-700 bg-zinc-900 text-zinc-300 text-xs focus:border-blue-500 font-mono"
                     />
                   </div>

                   <div className="flex items-center justify-between p-3 bg-zinc-950 rounded border border-zinc-800">
                      <div className="flex flex-col">
                        <span className="text-xs text-zinc-300 font-bold">마지막 백업</span>
                        <span className="text-[10px] text-zinc-500">{settings.lastCloudBackup ? settings.lastCloudBackup : '기록 없음'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                         {driveStatus === 'success' && <div className="flex items-center gap-1 text-[10px] text-green-500 font-bold"><CheckCircle2 size={12} /> 성공</div>}
                         {driveStatus === 'error' && <div className="flex items-center gap-1 text-[10px] text-red-500 font-bold"><AlertTriangle size={12} /> 실패</div>}
                      </div>
                   </div>
                   
                   <button 
                     onClick={handleGoogleDriveBackup} 
                     disabled={isDriveLoading || !settings.driveClientId} 
                     className="w-full flex items-center justify-center gap-2 py-3 bg-white hover:bg-zinc-100 text-zinc-900 rounded-lg font-bold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
                   >
                     {isDriveLoading ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} />}
                     구글 드라이브에 지금 백업
                   </button>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-800">
                <label className="block mb-3 text-sm font-medium text-zinc-400 flex items-center gap-2">
                  <Database size={16} /> 로컬 데이터 관리
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => {}} className="flex items-center justify-center gap-2 px-3 py-2.5 bg-zinc-700 text-zinc-200 rounded-lg text-xs font-bold hover:bg-zinc-600 transition-colors"><Save size={14} /> 수동 다운로드</button>
                  <button onClick={() => backupFileInputRef.current?.click()} className="flex items-center justify-center gap-2 px-3 py-2.5 bg-green-900/30 text-green-200 rounded-lg border border-green-800/50 text-xs font-bold hover:bg-green-900/50 transition-colors"><FolderUp size={14} /> 데이터 복원</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'assistants' && (
            <div className="space-y-6">
              <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                <button onClick={() => setAssistantTabMode('left')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${assistantTabMode === 'left' ? 'bg-zinc-800 text-purple-400 shadow-sm' : 'text-zinc-500'}`}>
                  <PanelLeft size={16} /> 왼쪽 패널
                </button>
                <button onClick={() => setAssistantTabMode('right')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${assistantTabMode === 'right' ? 'bg-zinc-800 text-purple-400 shadow-sm' : 'text-zinc-500'}`}>
                  <PanelRight size={16} /> 오른쪽 패널
                </button>
              </div>

              <div className="bg-zinc-800/30 rounded-lg p-5 border border-zinc-800 space-y-5 animate-in fade-in duration-200">
                <div>
                   <label className="block mb-2 text-xs font-bold text-zinc-400 uppercase tracking-tighter">AI 모델</label>
                   <select value={getAssistantConfig().model} onChange={(e) => updateAssistantConfig('model', e.target.value)} className="w-full p-3 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 text-sm outline-none focus:border-purple-500">
                     {AVAILABLE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                   </select>
                </div>

                <div className="pt-4 border-t border-zinc-700/50 space-y-4">
                  <h4 className="text-sm font-bold text-zinc-300 flex items-center gap-2"><UserCircle size={16} className="text-purple-400"/> 페르소나 설정</h4>
                  
                  <div>
                    <label className="block mb-1 text-xs text-zinc-400">이름</label>
                    <input type="text" value={getAssistantConfig().persona?.name || ''} onChange={(e) => updateAssistantConfig('name', e.target.value)} placeholder="예: 아이디어 뱅크" className="w-full p-2 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 text-sm focus:border-purple-500" />
                  </div>

                  <div>
                    <label className="block mb-1 text-xs text-zinc-400">역할 및 지침 (System Instruction)</label>
                    <textarea value={getAssistantConfig().persona?.instruction || ''} onChange={(e) => updateAssistantConfig('instruction', e.target.value)} placeholder="지침을 입력하세요." className="w-full p-2 rounded border border-zinc-700 bg-zinc-900 text-zinc-300 text-sm min-h-[100px] leading-relaxed focus:border-purple-500 outline-none" />
                  </div>

                  <div>
                    <label className="block mb-1 text-xs text-zinc-400">기본 지식 텍스트 (Knowledge)</label>
                    <textarea value={getAssistantConfig().persona?.knowledge || ''} onChange={(e) => updateAssistantConfig('knowledge', e.target.value)} placeholder="참조할 텍스트 정보를 입력하세요." className="w-full p-2 rounded border border-zinc-700 bg-zinc-900 text-zinc-300 text-sm min-h-[80px] focus:border-purple-500 outline-none" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-zinc-400">참조 파일 목록</label>
                      <button onClick={() => knowledgeFileInputRef.current?.click()} className="text-[10px] px-2 py-1 bg-zinc-800 text-zinc-300 rounded border border-zinc-700 hover:bg-zinc-700 transition-colors"><FileUp size={10} className="inline mr-1" /> 파일 추가</button>
                    </div>
                    <div className="space-y-2">
                      {(getAssistantConfig().persona?.files || []).map((file) => (
                         <div key={file.id} className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-zinc-800 text-xs group">
                            <span className="truncate text-zinc-300 max-w-[200px] flex items-center gap-2"><FileText size={12} className="text-zinc-500" />{file.name}</span>
                            <button onClick={() => updateAssistantConfig('files', getAssistantConfig().persona.files?.filter(f => f.id !== file.id))} className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
                         </div>
                      ))}
                      {(getAssistantConfig().persona?.files?.length === 0) && <p className="text-center text-[10px] text-zinc-600 py-4 border border-dashed border-zinc-800 rounded">참조 파일이 없습니다.</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => {}} className="px-3 py-2.5 bg-zinc-800 text-zinc-300 rounded-lg border border-zinc-700 text-xs font-bold hover:bg-zinc-700">목록 내보내기</button>
                <button onClick={() => {}} className="px-3 py-2.5 bg-blue-900/30 text-blue-200 rounded-lg border border-blue-800/50 text-xs font-bold hover:bg-blue-900/50">목록 불러오기</button>
              </div>

              <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-800 space-y-4">
                <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2"><Plus size={16} className="text-blue-400" /> 새 단축키 추가</h3>
                
                <button onClick={() => { setIsRecording(true); setNewTrigger(''); }} className={`w-full p-3 rounded border text-left text-sm flex items-center gap-2 transition-all ${isRecording ? 'border-blue-500 bg-blue-900/20 text-blue-200 animate-pulse' : 'bg-zinc-950 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                  {isRecording ? <Keyboard size={16} /> : <Command size={16} />}
                  {isRecording ? '키를 입력하세요...' : newTrigger || '클릭하여 키 설정'}
                </button>
                {isRecording && <input type="text" className="opacity-0 absolute h-0 w-0" autoFocus onKeyDown={handleKeyDownCapture} />}

                <div className="flex gap-2 bg-zinc-950 p-1 rounded border border-zinc-800">
                  <button onClick={() => setNewSnippetType(SnippetType.TEXT)} className={`flex-1 py-1.5 text-xs rounded transition-all font-medium ${newSnippetType === SnippetType.TEXT ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><Type size={12} className="inline mr-1" /> 텍스트</button>
                  <button onClick={() => setNewSnippetType(SnippetType.COLOR)} className={`flex-1 py-1.5 text-xs rounded transition-all font-medium ${newSnippetType === SnippetType.COLOR ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><Palette size={12} className="inline mr-1" /> 색상</button>
                  <button onClick={() => setNewSnippetType(SnippetType.AI_COMMAND)} className={`flex-1 py-1.5 text-xs rounded transition-all font-medium ${newSnippetType === SnippetType.AI_COMMAND ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><Wand2 size={12} className="inline mr-1" /> AI 교정</button>
                </div>

                <div>
                  {newSnippetType === SnippetType.TEXT && (
                    <textarea value={newSnippetValue} onChange={(e) => setNewSnippetValue(e.target.value)} placeholder='예: "말하기" {|}' className="w-full p-2.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 min-h-[60px] focus:border-blue-500 outline-none" />
                  )}
                  {newSnippetType === SnippetType.COLOR && (
                    <div className="flex items-center gap-3 p-2 bg-zinc-950 rounded border border-zinc-700">
                      <input type="color" value={newSnippetValue} onChange={(e) => setNewSnippetValue(e.target.value)} className="h-10 w-14 bg-transparent cursor-pointer rounded overflow-hidden border-none" />
                      <span className="text-sm font-mono text-zinc-400 font-bold">{newSnippetValue}</span>
                    </div>
                  )}
                  {newSnippetType === SnippetType.AI_COMMAND && (
                    <select value={newSnippetValue} onChange={(e) => setNewSnippetValue(e.target.value)} className="w-full p-2.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 focus:border-blue-500 outline-none">
                      {Object.entries(AI_MODE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  )}
                </div>

                <button onClick={addSnippet} disabled={!newTrigger || !newSnippetValue} className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg disabled:opacity-30 transition-all shadow-lg active:scale-95">단축키 등록</button>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">등록된 단축키</h3>
                <div className="grid gap-2">
                  {(settings.snippets || []).map((s) => {
                    const isColor = s.type === SnippetType.COLOR;
                    const isAI = s.type === SnippetType.AI_COMMAND;
                    const isText = s.type === SnippetType.TEXT;

                    let itemClasses = "flex items-center justify-between p-3 rounded-lg border transition-all group ";
                    let triggerClasses = "px-2 py-1 text-[10px] font-mono rounded border ";

                    if (isAI) {
                      itemClasses += "bg-purple-900/10 border-purple-800/30 hover:bg-purple-900/20";
                      triggerClasses += "bg-purple-900/30 text-purple-300 border-purple-700/50";
                    } else if (isColor) {
                      itemClasses += "bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800";
                      triggerClasses += "bg-zinc-700 text-blue-300 border-zinc-600";
                    } else {
                      itemClasses += "bg-zinc-900 border-zinc-800 hover:bg-zinc-800/50";
                      triggerClasses += "bg-zinc-800 text-zinc-400 border-zinc-700";
                    }

                    return (
                      <div key={s.id} className={itemClasses}>
                        <div className="flex items-center gap-3 overflow-hidden">
                          <span className={triggerClasses}>{s.trigger}</span>
                          <div className="flex items-center gap-2 overflow-hidden">
                            {isColor && (
                              <div 
                                className="w-4 h-4 rounded-full border border-zinc-600 shrink-0 shadow-sm"
                                style={{ backgroundColor: s.text }}
                              />
                            )}
                            {isAI && <Wand2 size={12} className="text-purple-400 shrink-0" />}
                            {isText && <Type size={12} className="text-zinc-500 shrink-0" />}
                            
                            <span className={`text-xs truncate max-w-[180px] font-medium ${isAI ? 'text-purple-200' : 'text-zinc-300'}`}>
                              {isColor ? s.text : isAI ? AI_MODE_LABELS[s.text] : s.text}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeSnippet(s.id)} 
                          className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-between shrink-0">
          <button onClick={handleReset} className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors">기본값으로 초기화</button>
          <button onClick={onClose} className="px-8 py-2.5 bg-zinc-100 hover:bg-white text-zinc-900 font-bold rounded-lg transition-all active:scale-95">완료</button>
        </div>
        <input type="file" ref={knowledgeFileInputRef} onChange={handleKnowledgeFileAdd} className="hidden" accept=".txt,.md,.csv,.json" multiple />
        <input type="file" ref={backupFileInputRef} onChange={() => {}} className="hidden" accept=".json" />
      </div>
    </div>
  );
};

export default SettingsModal;
