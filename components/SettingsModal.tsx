
import React, { useState, useEffect, useRef } from 'react';
// Added CloudUpload to the lucide-react imports to fix the missing component error on line 264
import { X, Plus, Trash2, Keyboard, Command, Type, Palette, Cpu, Download, Upload, AlignJustify, AlignLeft, Wand2, Key, Eye, EyeOff, MessageSquare, Volume2, Indent, Bot, PanelLeft, PanelRight, BookOpen, UserCircle, PenTool, FileUp, FileText, RotateCcw, ExternalLink, Database, Save, FolderUp, Folder, PaintBucket, AlertTriangle, CheckCircle2, Cloud, CloudUpload, Loader2, Info, HelpCircle, List, ShieldAlert } from 'lucide-react';
import { AppSettings, FontType, Snippet, SnippetType, AVAILABLE_MODELS, AIRevisionMode, KnowledgeFile } from '../types';
import { getDefaultSettings } from '../services/storageService';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdate: (settings: AppSettings) => void;
}

interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
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
  const [lastBackupFile, setLastBackupFile] = useState('');
  const [driveBackups, setDriveBackups] = useState<DriveBackupFile[]>([]);
  const [isFetchingBackups, setIsFetchingBackups] = useState(false);
  const [showDriveGuide, setShowDriveGuide] = useState(false);
  
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
      setDriveBackups([]);
      setShowDriveGuide(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
      const backupData = { version: 1, timestamp: new Date().toISOString(), data: { docs: docs ? JSON.parse(docs) : [], settings: savedSettings ? JSON.parse(savedSettings) : {}, chatSessions: chatSessions ? JSON.parse(chatSessions) : [], chatSessionsLeft: chatSessionsLeft ? JSON.parse(chatSessionsLeft) : [] } };
      const content = JSON.stringify(backupData, null, 2);
      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
      const filename = `novelcraft-backup-${timestamp}.json`;
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: settings.driveClientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            setDriveStatus('error');
            setIsDriveLoading(false);
            if (tokenResponse.error === 'access_denied') { setShowDriveGuide(true); }
            return;
          }
          const accessToken = tokenResponse.access_token;
          const folderName = 'NovelCraft_Backups';
          let folderId = '';
          const folderSearchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`, { headers: { Authorization: `Bearer ${accessToken}` } });
          const folderSearchData = await folderSearchRes.json();
          if (folderSearchData.files && folderSearchData.files.length > 0) { folderId = folderSearchData.files[0].id; }
          else {
            const createFolderRes = await fetch('https://www.googleapis.com/drive/v3/files', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder' }) });
            const folderData = await createFolderRes.json();
            folderId = folderData.id;
          }
          const metadata = { name: filename, mimeType: 'application/json', parents: [folderId] };
          const form = new FormData();
          form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
          form.append('file', new Blob([content], { type: 'application/json' }));
          const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form });
          if (!uploadRes.ok) throw new Error("Upload failed");
          const uploadData = await uploadRes.json();
          setLastBackupFile(filename);
          onUpdate({ ...settings, lastCloudBackup: new Date().toLocaleString() });
          setDriveStatus('success');
          setIsDriveLoading(false);
          if (driveBackups.length > 0) handleFetchDriveBackups();
        },
      });
      client.requestAccessToken();
    } catch (error: any) { console.error(error); setDriveStatus('error'); setIsDriveLoading(false); }
  };

  const handleFetchDriveBackups = async () => {
    if (!settings.driveClientId) { alert("Client ID를 먼저 설정해주세요."); return; }
    setIsFetchingBackups(true);
    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: settings.driveClientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) { setIsFetchingBackups(false); if (tokenResponse.error === 'access_denied') setShowDriveGuide(true); return; }
          const accessToken = tokenResponse.access_token;
          const folderName = 'NovelCraft_Backups';
          const folderSearchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`, { headers: { Authorization: `Bearer ${accessToken}` } });
          const folderSearchData = await folderSearchRes.json();
          if (!folderSearchData.files || folderSearchData.files.length === 0) { setDriveBackups([]); setIsFetchingBackups(false); return; }
          const folderId = folderSearchData.files[0].id;
          const fileSearchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and mimeType='application/json' and trashed=false&fields=files(id, name, createdTime)&orderBy=createdTime desc`, { headers: { Authorization: `Bearer ${accessToken}` } });
          const fileSearchData = await fileSearchRes.json();
          setDriveBackups(fileSearchData.files || []);
          setIsFetchingBackups(false);
        }
      });
      client.requestAccessToken();
    } catch (error) { console.error(error); setIsFetchingBackups(false); }
  };

  const handleRestoreFromDrive = async (fileId: string, fileName: string) => {
    if (!window.confirm(`[${fileName}] 백업으로 복원하시겠습니까?\n모든 데이터가 덮어씌워집니다.`)) return;
    setIsDriveLoading(true);
    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: settings.driveClientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) { setIsDriveLoading(false); return; }
          const accessToken = tokenResponse.access_token;
          const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: { Authorization: `Bearer ${accessToken}` } });
          if (!downloadRes.ok) throw new Error("Download failed");
          const backupData = await downloadRes.json();
          if (backupData && backupData.data) {
            const { docs, settings: savedSettings, chatSessions, chatSessionsLeft } = backupData.data;
            localStorage.setItem('novelcraft_docs', JSON.stringify(docs || []));
            localStorage.setItem('novelcraft_settings', JSON.stringify(savedSettings || {}));
            localStorage.setItem('novelcraft_chat_sessions', JSON.stringify(chatSessions || []));
            localStorage.setItem('novelcraft_chat_sessions_left', JSON.stringify(chatSessionsLeft || []));
            alert("복원 완료! 페이지를 새로고침합니다.");
            window.location.reload();
          }
        }
      });
      client.requestAccessToken();
    } catch (error) { console.error(error); setIsDriveLoading(false); alert("복원 오류"); }
  };

  const handleKeyDownCapture = (e: React.KeyboardEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
    const modifiers = [];
    if (e.ctrlKey) modifiers.push('Ctrl');
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');
    if (e.metaKey) modifiers.push('Cmd');
    let key = e.key.toUpperCase();
    if (e.code.startsWith('Digit')) key = e.code.replace('Digit', '');
    setNewTrigger([...modifiers, key].join('+'));
    setIsRecording(false);
  };

  const addSnippet = () => {
    if (!newTrigger || !newSnippetValue) return;
    onUpdate({ ...settings, snippets: [...(settings.snippets || []), { id: uuidv4(), trigger: newTrigger, text: newSnippetValue, type: newSnippetType }] });
    setNewTrigger('');
    setNewSnippetValue(newSnippetType === SnippetType.COLOR ? '#ffffff' : newSnippetType === SnippetType.AI_COMMAND ? AIRevisionMode.GRAMMAR : '');
  };

  const getAssistantConfig = () => assistantTabMode === 'left' ? { model: settings.leftAssistantModel || AVAILABLE_MODELS[1].id, persona: settings.leftAssistantPersona } : { model: settings.rightAssistantModel || AVAILABLE_MODELS[1].id, persona: settings.rightAssistantPersona };
  const updateAssistantConfig = (field: string, value: any) => {
    if (assistantTabMode === 'left') { if (field === 'model') onUpdate({ ...settings, leftAssistantModel: value }); else onUpdate({ ...settings, leftAssistantPersona: { ...settings.leftAssistantPersona, [field]: value } }); }
    else { if (field === 'model') onUpdate({ ...settings, rightAssistantModel: value }); else onUpdate({ ...settings, rightAssistantPersona: { ...settings.rightAssistantPersona, [field]: value } }); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <h2 className="text-xl font-bold text-zinc-100">환경설정</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100"><X size={20} /></button>
        </div>

        <div className="flex border-b border-zinc-800 mb-6 shrink-0">
          {['general', 'assistants', 'shortcuts'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} className={`pb-2 px-4 text-sm font-medium transition-colors relative ${activeTab === tab ? 'text-blue-400' : 'text-zinc-400'}`}>
              {tab === 'general' ? '일반/드라이브' : tab === 'assistants' ? 'AI 어시스턴트' : '단축키 프리셋'}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 pr-2">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="bg-blue-900/10 p-4 rounded-lg border border-blue-900/30">
                <label className="block mb-2 text-sm font-bold text-zinc-300 flex items-center gap-2"><Key size={16} className="text-blue-400" /> Gemini API Key</label>
                <div className="relative">
                  <input type={showApiKey ? "text" : "password"} value={settings.apiKey || ''} onChange={(e) => onUpdate({ ...settings, apiKey: e.target.value })} placeholder="API 키를 입력하세요" className="w-full p-3 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 text-sm focus:border-blue-500 font-mono" />
                  <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">{showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>

              <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-800">
                <label className="block mb-3 text-sm font-bold text-zinc-200 flex items-center gap-2"><Cloud size={16} className="text-blue-400" /> Google Drive 클라우드 백업</label>
                <div className="space-y-4">
                   {showDriveGuide && (
                     <div className="p-4 bg-red-950/30 border border-red-800/50 rounded-lg animate-in fade-in slide-in-from-top-2">
                       <div className="flex items-start gap-3">
                         <ShieldAlert className="text-red-500 shrink-0 mt-0.5" size={18} />
                         <div>
                           <p className="text-sm font-bold text-red-400 mb-2">403: access_denied 오류 발생 시</p>
                           <ol className="text-xs text-zinc-400 space-y-1.5 list-decimal list-inside">
                             <li><a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" className="text-blue-400 hover:underline">Google Console</a>에 접속합니다.</li>
                             <li><strong>'OAuth 동의 화면'</strong> 메뉴를 선택합니다.</li>
                             <li>하단 <strong>'테스트 사용자'</strong> 섹션에서 <strong>[+ ADD USERS]</strong>를 누릅니다.</li>
                             <li>본인 이메일(<code>dynojump@gmail.com</code>)을 입력하고 <strong>저장</strong>합니다.</li>
                           </ol>
                           <button onClick={() => setShowDriveGuide(false)} className="mt-3 text-[10px] text-zinc-500 hover:text-zinc-300 underline">안내 숨기기</button>
                         </div>
                       </div>
                     </div>
                   )}

                   <div>
                     <label className="block mb-1 text-xs text-zinc-400 flex items-center justify-between">
                       <span>OAuth Client ID</span>
                       <button onClick={() => setShowDriveGuide(!showDriveGuide)} className="text-blue-400 flex items-center gap-1 text-[10px] hover:underline"><HelpCircle size={10}/> 403 오류 해결법</button>
                     </label>
                     <input type="text" value={settings.driveClientId || ''} onChange={(e) => onUpdate({ ...settings, driveClientId: e.target.value })} placeholder="Client ID를 입력하세요" className="w-full p-2.5 rounded border border-zinc-700 bg-zinc-900 text-zinc-300 text-xs focus:border-blue-500 font-mono" />
                   </div>

                   <div className="grid grid-cols-2 gap-2">
                     <button onClick={handleGoogleDriveBackup} disabled={isDriveLoading || !settings.driveClientId} className="flex items-center justify-center gap-2 py-3 bg-white hover:bg-zinc-100 text-zinc-900 rounded-lg font-bold text-sm disabled:opacity-30 shadow-lg">{isDriveLoading ? <Loader2 size={16} className="animate-spin" /> : <CloudUpload size={16} />} 백업하기</button>
                     <button onClick={handleFetchDriveBackups} disabled={isFetchingBackups || !settings.driveClientId} className="flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg font-bold text-sm disabled:opacity-30 border border-zinc-700">{isFetchingBackups ? <Loader2 size={16} className="animate-spin" /> : <List size={16} />} 목록 불러오기</button>
                   </div>

                   {driveBackups.length > 0 && (
                     <div className="mt-4 border border-zinc-800 rounded-lg bg-zinc-950 overflow-hidden">
                        <div className="px-3 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between"><span className="text-xs font-bold text-zinc-400">백업 히스토리 (NovelCraft_Backups/)</span><button onClick={() => setDriveBackups([])} className="text-zinc-500 hover:text-zinc-300"><X size={14}/></button></div>
                        <div className="max-h-[200px] overflow-y-auto divide-y divide-zinc-900">
                           {driveBackups.map(file => (
                             <div key={file.id} className="p-3 flex items-center justify-between hover:bg-zinc-900/50">
                                <div className="flex flex-col min-w-0"><span className="text-[11px] text-zinc-300 font-medium truncate">{file.name}</span><span className="text-[9px] text-zinc-500">{new Date(file.createdTime).toLocaleString()}</span></div>
                                <button onClick={() => handleRestoreFromDrive(file.id, file.name)} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white border border-blue-400/30 rounded text-[10px] font-bold">복원</button>
                             </div>
                           ))}
                        </div>
                     </div>
                   )}
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-800 grid grid-cols-2 gap-3">
                  <button onClick={() => {}} className="flex items-center justify-center gap-2 py-2.5 bg-zinc-800 text-zinc-300 rounded-lg text-xs font-bold border border-zinc-700"><Save size={14} /> 수동 다운로드</button>
                  <button onClick={() => backupFileInputRef.current?.click()} className="flex items-center justify-center gap-2 py-2.5 bg-zinc-800 text-zinc-300 rounded-lg text-xs font-bold border border-zinc-700"><FolderUp size={14} /> 로컬 복원</button>
              </div>
            </div>
          )}

          {activeTab === 'assistants' && (
            <div className="space-y-6">
              <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                {['left', 'right'].map(m => (
                  <button key={m} onClick={() => setAssistantTabMode(m as any)} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${assistantTabMode === m ? 'bg-zinc-800 text-purple-400 shadow-sm' : 'text-zinc-500'}`}>
                    {m === 'left' ? <PanelLeft size={16} /> : <PanelRight size={16} />} {m === 'left' ? '왼쪽 패널' : '오른쪽 패널'}
                  </button>
                ))}
              </div>
              <div className="bg-zinc-800/30 rounded-lg p-5 border border-zinc-800 space-y-5">
                <div><label className="block mb-2 text-xs font-bold text-zinc-400 uppercase">AI 모델</label><select value={getAssistantConfig().model} onChange={(e) => updateAssistantConfig('model', e.target.value)} className="w-full p-3 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 text-sm">{AVAILABLE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
                <div className="pt-4 border-t border-zinc-700/50 space-y-4">
                  <h4 className="text-sm font-bold text-zinc-300 flex items-center gap-2"><UserCircle size={16} className="text-purple-400"/> 페르소나 설정</h4>
                  <div><label className="block mb-1 text-xs text-zinc-400">이름</label><input type="text" value={getAssistantConfig().persona?.name || ''} onChange={(e) => updateAssistantConfig('name', e.target.value)} className="w-full p-2 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 text-sm" /></div>
                  <div><label className="block mb-1 text-xs text-zinc-400">지침 (System Instruction)</label><textarea value={getAssistantConfig().persona?.instruction || ''} onChange={(e) => updateAssistantConfig('instruction', e.target.value)} className="w-full p-2 rounded border border-zinc-700 bg-zinc-900 text-zinc-300 text-sm min-h-[100px]" /></div>
                  <div><label className="block mb-1 text-xs text-zinc-400">파일 참조</label><button onClick={() => knowledgeFileInputRef.current?.click()} className="text-[10px] px-2 py-1 bg-zinc-800 text-zinc-300 rounded border border-zinc-700"><FileUp size={10} className="inline mr-1" /> 파일 추가</button></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-6">
              <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-800 space-y-4">
                <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2"><Plus size={16} className="text-blue-400" /> 새 단축키 등록</h3>
                <button onClick={() => { setIsRecording(true); setNewTrigger(''); }} className={`w-full p-3 rounded border text-left text-sm ${isRecording ? 'border-blue-500 bg-blue-900/20 text-blue-200' : 'bg-zinc-950 border-zinc-700 text-zinc-400'}`}>{isRecording ? '키를 누르세요...' : newTrigger || '클릭하여 키 설정'}</button>
                {isRecording && <input type="text" className="opacity-0 absolute h-0 w-0" autoFocus onKeyDown={handleKeyDownCapture} />}
                <select value={newSnippetType} onChange={(e) => setNewSnippetType(e.target.value as any)} className="w-full p-2.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300">
                  <option value={SnippetType.TEXT}>일반 텍스트</option>
                  <option value={SnippetType.COLOR}>폰트 색상</option>
                  <option value={SnippetType.AI_COMMAND}>AI 교정 명령</option>
                </select>
                <textarea value={newSnippetValue} onChange={(e) => setNewSnippetValue(e.target.value)} placeholder="내용 입력..." className="w-full p-2.5 bg-zinc-950 border border-zinc-700 rounded text-sm text-zinc-300 min-h-[60px]" />
                <button onClick={addSnippet} disabled={!newTrigger || !newSnippetValue} className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg disabled:opacity-30">등록</button>
              </div>
              <div className="grid gap-2">
                {(settings.snippets || []).map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 group">
                    <div className="flex items-center gap-3"><span className="px-2 py-1 text-[10px] font-mono rounded bg-zinc-800 text-blue-400 border border-zinc-700">{s.trigger}</span><span className="text-xs text-zinc-300 truncate max-w-[150px]">{s.text}</span></div>
                    <button onClick={() => onUpdate({ ...settings, snippets: settings.snippets.filter(x => x.id !== s.id) })} className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-between shrink-0">
          <button onClick={() => onUpdate(getDefaultSettings())} className="text-sm text-red-400 hover:text-red-300">초기화</button>
          <button onClick={onClose} className="px-8 py-2.5 bg-zinc-100 hover:bg-white text-zinc-900 font-bold rounded-lg transition-all">완료</button>
        </div>
        <input type="file" ref={knowledgeFileInputRef} onChange={() => {}} className="hidden" multiple />
        <input type="file" ref={backupFileInputRef} onChange={() => {}} className="hidden" />
      </div>
    </div>
  );
};

export default SettingsModal;
