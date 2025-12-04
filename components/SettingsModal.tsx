
import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Keyboard, Command, Type, Palette, Cpu, Download, Upload, AlignJustify, AlignLeft, Wand2, Key, Eye, EyeOff, MessageSquare, Volume2, Indent, Bot, PanelLeft, PanelRight, BookOpen, UserCircle, PenTool, FileUp, FileText } from 'lucide-react';
import { AppSettings, FontType, Snippet, SnippetType, AVAILABLE_MODELS, AIRevisionMode, KnowledgeFile } from '../types';
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
  
  // Assistant Tab State
  const [assistantTabMode, setAssistantTabMode] = useState<'left' | 'right'>('right');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const knowledgeFileInputRef = useRef<HTMLInputElement>(null);

  // Reset inputs when opening/closing
  useEffect(() => {
    if (!isOpen) {
      setIsRecording(false);
      setNewTrigger('');
      setNewSnippetType(SnippetType.TEXT);
      setNewSnippetValue('');
      setShowApiKey(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDownCapture = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Ignore modifier-only presses
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

    const modifiers = [];
    if (e.ctrlKey) modifiers.push('Ctrl');
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');
    if (e.metaKey) modifiers.push('Cmd');

    // Normalize key logic
    let key = e.key.toUpperCase();

    // Standardize Digit keys (e.g., '!' -> '1', '¡' -> '1') to ensure Alt+Num works consistently
    if (e.code.startsWith('Digit')) {
      key = e.code.replace('Digit', '');
    }

    const trigger = [...modifiers, key].join('+');
    
    setNewTrigger(trigger);
    setIsRecording(false);
  };

  const addSnippet = () => {
    if (!newTrigger || !newSnippetValue) return;
    
    const newSnippet: Snippet = {
      id: uuidv4(),
      trigger: newTrigger,
      text: newSnippetValue,
      type: newSnippetType
    };

    onUpdate({
      ...settings,
      snippets: [...(settings.snippets || []), newSnippet]
    });

    setNewTrigger('');
    if (newSnippetType === SnippetType.COLOR) setNewSnippetValue('#ffffff');
    else if (newSnippetType === SnippetType.AI_COMMAND) setNewSnippetValue(AIRevisionMode.GRAMMAR);
    else setNewSnippetValue('');
  };

  const removeSnippet = (id: string) => {
    onUpdate({
      ...settings,
      snippets: settings.snippets.filter(s => s.id !== id)
    });
  };

  const insertCursorMarker = () => {
    setNewSnippetValue(prev => prev + '{|}');
  };

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

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

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
              alert(`${validSnippets.length}개의 단축키를 불러왔습니다.`);
            } else {
              if (window.confirm(`불러온 ${validSnippets.length}개의 단축키를 기존 목록에 '추가(Merge)' 하시겠습니까?\n\n[확인]: 기존 목록 뒤에 추가합니다. (중복 키는 덮어씌움)\n[취소]: 다음 단계로 이동 (전체 교체 여부 확인)`)) {
                 const snippetMap = new Map();
                 existingSnippets.forEach(s => snippetMap.set(s.trigger, s));
                 validSnippets.forEach(s => snippetMap.set(s.trigger, s));
                 
                 const mergedSnippets = Array.from(snippetMap.values());
                 onUpdate({ ...settings, snippets: mergedSnippets });
                 alert("성공적으로 추가(병합)되었습니다.");
              } else {
                if (window.confirm(`그렇다면 기존 목록을 모두 '삭제'하고 덮어쓰시겠습니까?\n\n[확인]: 기존 목록 삭제 후 덮어쓰기\n[취소]: 작업 취소`)) {
                  onUpdate({ ...settings, snippets: validSnippets });
                  alert("단축키 목록이 교체되었습니다.");
                }
              }
            }
          } else {
            alert("파일에서 유효한 단축키 정보를 찾을 수 없습니다.");
          }
        } else {
          alert("올바르지 않은 JSON 파일입니다.");
        }
      } catch (err) {
        console.error("Import Error:", err);
        alert("파일을 읽는 중 오류가 발생했습니다.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Helper to get current assistant config based on tab
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
      if (field === 'model') {
        onUpdate({ ...settings, leftAssistantModel: value });
      } else {
        onUpdate({ 
          ...settings, 
          leftAssistantPersona: { ...settings.leftAssistantPersona, [field]: value } 
        });
      }
    } else {
      if (field === 'model') {
        onUpdate({ ...settings, rightAssistantModel: value });
      } else {
        onUpdate({ 
          ...settings, 
          rightAssistantPersona: { ...settings.rightAssistantPersona, [field]: value } 
        });
      }
    }
  };

  const handleKnowledgeFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Size limit check removed as requested.
    // WARNING: Large files may exceed browser LocalStorage limits (approx 5-10MB).

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const newFile: KnowledgeFile = {
            id: uuidv4(),
            name: file.name,
            content: content,
            size: file.size
        };

        const currentFiles = getAssistantConfig().persona?.files || [];
        updateAssistantConfig('files', [...currentFiles, newFile]);
      }
    };
    reader.onerror = () => {
      alert("파일을 읽는데 실패했습니다.");
    };
    reader.readAsText(file);
    
    // Reset input
    if (knowledgeFileInputRef.current) knowledgeFileInputRef.current.value = '';
  };

  const removeKnowledgeFile = (id: string) => {
      if (!window.confirm("이 참조 파일을 삭제하시겠습니까?")) return;
      const currentFiles = getAssistantConfig().persona?.files || [];
      updateAssistantConfig('files', currentFiles.filter(f => f.id !== id));
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

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 mb-6 shrink-0">
          <button
            onClick={() => setActiveTab('general')}
            className={`pb-2 px-4 text-sm font-medium transition-colors relative ${
              activeTab === 'general' ? 'text-blue-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            일반 (General)
            {activeTab === 'general' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />}
          </button>
          <button
            onClick={() => setActiveTab('assistants')}
            className={`pb-2 px-4 text-sm font-medium transition-colors relative ${
              activeTab === 'assistants' ? 'text-purple-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            AI 어시스턴트 (Assistants)
            {activeTab === 'assistants' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400" />}
          </button>
          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`pb-2 px-4 text-sm font-medium transition-colors relative ${
              activeTab === 'shortcuts' ? 'text-blue-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            단축키 (Shortcuts)
            {activeTab === 'shortcuts' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />}
          </button>
        </div>

        <div className="overflow-y-auto flex-1 pr-2">
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* API Key Input */}
              <div className="bg-blue-900/10 p-4 rounded-lg border border-blue-900/30">
                <label className="block mb-2 text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <Key size={16} className="text-blue-400" /> Google API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={settings.apiKey || ''}
                    onChange={(e) => onUpdate({ ...settings, apiKey: e.target.value })}
                    placeholder="AI 기능을 사용하려면 API 키를 입력하세요"
                    className="w-full p-3 pr-10 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 text-sm focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button 
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  * 키는 로컬 브라우저에만 저장되며 서버로 전송되지 않습니다.
                </p>
              </div>

              {/* Editor AI Model */}
              <div>
                <label className="block mb-2 text-sm font-medium text-zinc-400 flex items-center gap-2">
                  <Cpu size={16} /> 에디터 AI 모델 (Editor / Revision)
                </label>
                <div className="relative">
                  <select
                    value={settings.aiModel || AVAILABLE_MODELS[0].id}
                    onChange={(e) => onUpdate({ ...settings, aiModel: e.target.value })}
                    className="w-full p-3 rounded border border-zinc-700 bg-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
                  >
                    {AVAILABLE_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t border-zinc-800 my-4"></div>

              {/* Typography Settings */}
              <div className="space-y-4">
                {/* Font Type */}
                <div>
                  <label className="block mb-2 text-sm font-medium text-zinc-400">글꼴 (Font Family)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => onUpdate({ ...settings, fontType: FontType.SERIF })}
                      className={`p-3 rounded border text-sm font-serif ${
                        settings.fontType === FontType.SERIF
                          ? 'border-blue-500 bg-blue-900/20 text-blue-100'
                          : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-750'
                      }`}
                    >
                      명조체 (Serif)
                    </button>
                    <button
                      onClick={() => onUpdate({ ...settings, fontType: FontType.SANS })}
                      className={`p-3 rounded border text-sm font-sans ${
                        settings.fontType === FontType.SANS
                          ? 'border-blue-500 bg-blue-900/20 text-blue-100'
                          : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-750'
                      }`}
                    >
                      고딕체 (Sans)
                    </button>
                  </div>
                </div>

                {/* Paragraph Alignment & Indentation */}
                <div>
                  <label className="block mb-2 text-sm font-medium text-zinc-400">문단 설정 (Alignment & Indent)</label>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <button
                      onClick={() => onUpdate({ ...settings, alignment: 'justify' })}
                      className={`p-3 rounded border text-sm flex items-center justify-center gap-2 ${
                        settings.alignment === 'justify'
                          ? 'border-blue-500 bg-blue-900/20 text-blue-100'
                          : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-750'
                      }`}
                    >
                      <AlignJustify size={16} />
                      양쪽 정렬
                    </button>
                    <button
                      onClick={() => onUpdate({ ...settings, alignment: 'left' })}
                      className={`p-3 rounded border text-sm flex items-center justify-center gap-2 ${
                        settings.alignment === 'left'
                          ? 'border-blue-500 bg-blue-900/20 text-blue-100'
                          : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-750'
                      }`}
                    >
                      <AlignLeft size={16} />
                      왼쪽 정렬
                    </button>
                  </div>
                  
                  {/* Indentation Toggle */}
                  <button
                    onClick={() => onUpdate({ ...settings, enableIndentation: !settings.enableIndentation })}
                    className={`w-full p-3 rounded border text-sm flex items-center justify-center gap-2 transition-colors ${
                      settings.enableIndentation
                        ? 'border-blue-500 bg-blue-900/20 text-blue-100'
                        : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-750'
                    }`}
                  >
                    <Indent size={16} />
                    {settings.enableIndentation ? '문단 들여쓰기 켜짐 (On)' : '문단 들여쓰기 꺼짐 (Off)'}
                  </button>
                </div>

                {/* Font Size */}
                <div>
                  <label className="block mb-2 text-sm font-medium text-zinc-400">
                    글자 크기 (Editor Font Size): {settings.fontSize}px
                  </label>
                  <input
                    type="range"
                    min="12"
                    max="32"
                    step="1"
                    value={settings.fontSize}
                    onChange={(e) => onUpdate({ ...settings, fontSize: parseInt(e.target.value) })}
                    className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between mt-1 text-xs text-zinc-500">
                    <span>12px</span>
                    <span>32px</span>
                  </div>
                </div>

                 {/* Assistant Font Size */}
                 <div>
                  <label className="block mb-2 text-sm font-medium text-zinc-400">
                    어시스턴트 글자 크기 (Assistant Font Size): {settings.assistantFontSize || 14}px
                  </label>
                  <input
                    type="range"
                    min="12"
                    max="24"
                    step="1"
                    value={settings.assistantFontSize || 14}
                    onChange={(e) => onUpdate({ ...settings, assistantFontSize: parseInt(e.target.value) })}
                    className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between mt-1 text-xs text-zinc-500">
                    <span>12px</span>
                    <span>24px</span>
                  </div>
                </div>

                {/* Sound Volume */}
                <div>
                  <label className="block mb-2 text-sm font-medium text-zinc-400 flex items-center gap-2">
                    <Volume2 size={16} /> 알림음 크기 (Sound Volume): {Math.round((settings.soundVolume ?? 0.5) * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.soundVolume ?? 0.5}
                    onChange={(e) => onUpdate({ ...settings, soundVolume: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                  />
                  <div className="flex justify-between mt-1 text-xs text-zinc-500">
                    <span>Mute</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'assistants' && (
            <div className="space-y-6">
              {/* Toggle for Left/Right */}
              <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                <button 
                  onClick={() => setAssistantTabMode('left')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                    assistantTabMode === 'left' ? 'bg-zinc-800 text-purple-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <PanelLeft size={16} /> 왼쪽 패널 설정
                </button>
                <button 
                  onClick={() => setAssistantTabMode('right')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                    assistantTabMode === 'right' ? 'bg-zinc-800 text-purple-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <PanelRight size={16} /> 오른쪽 패널 설정
                </button>
              </div>

              <div className="bg-zinc-800/30 rounded-lg p-5 border border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-200 mb-4 flex items-center gap-2">
                  <Bot size={16} className="text-purple-400" />
                  {assistantTabMode === 'left' ? '왼쪽 어시스턴트 구성' : '오른쪽 어시스턴트 구성'}
                </h3>

                {/* Model Selection */}
                <div className="mb-5">
                   <label className="block mb-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">AI 모델 선택</label>
                   <div className="relative">
                      <select
                        value={getAssistantConfig().model}
                        onChange={(e) => updateAssistantConfig('model', e.target.value)}
                        className="w-full p-3 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 text-sm focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
                      >
                        {AVAILABLE_MODELS.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                   </div>
                   <p className="text-[10px] text-zinc-500 mt-1">* 빠르고 가벼운 대화에는 'Flash', 복잡한 추론에는 'Pro' 모델을 추천합니다.</p>
                </div>

                {/* Persona Settings */}
                <div className="space-y-4 pt-4 border-t border-zinc-700/50">
                  <h4 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                    <UserCircle size={16} /> 페르소나 (Persona) 설정
                  </h4>
                  
                  {/* Name */}
                  <div>
                    <label className="block mb-1 text-xs text-zinc-400">이름 (Name)</label>
                    <input 
                      type="text" 
                      value={getAssistantConfig().persona?.name || ''}
                      onChange={(e) => updateAssistantConfig('name', e.target.value)}
                      placeholder="예: 설정 오류 탐지봇, 아이디어 뱅크"
                      className="w-full p-2 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  {/* System Instruction */}
                  <div>
                    <label className="block mb-1 text-xs text-zinc-400 flex items-center justify-between">
                      <span>역할 및 지침 (System Instruction)</span>
                      <PenTool size={12} />
                    </label>
                    <textarea 
                      value={getAssistantConfig().persona?.instruction || ''}
                      onChange={(e) => updateAssistantConfig('instruction', e.target.value)}
                      placeholder="AI에게 부여할 역할과 행동 지침을 입력하세요.&#13;&#10;예: 당신은 까칠하지만 유능한 웹소설 PD입니다. 독자의 흥미를 끄는 요소를 중심으로 피드백해주세요."
                      className="w-full p-2 rounded border border-zinc-700 bg-zinc-900 text-zinc-300 text-sm focus:outline-none focus:border-purple-500 min-h-[100px] leading-relaxed resize-none"
                    />
                  </div>

                  {/* Knowledge Base (Text) */}
                  <div>
                     <label className="block mb-1 text-xs text-zinc-400">
                        기본 지식 / 텍스트 (Knowledge Text)
                     </label>
                    <textarea 
                      value={getAssistantConfig().persona?.knowledge || ''}
                      onChange={(e) => updateAssistantConfig('knowledge', e.target.value)}
                      placeholder="간단한 메모나 텍스트 설정은 여기에 입력하세요."
                      className="w-full p-2 rounded border border-zinc-700 bg-zinc-900 text-zinc-300 text-sm focus:outline-none focus:border-purple-500 min-h-[80px] leading-relaxed resize-none font-mono text-xs mb-3"
                    />
                  </div>

                  {/* Knowledge Base (Files) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-zinc-400 flex items-center gap-1">
                        <span>참조 파일 목록 (Attached Knowledge Files)</span>
                        <BookOpen size={12} />
                      </label>
                      <button 
                        onClick={() => knowledgeFileInputRef.current?.click()}
                        className="text-[10px] flex items-center gap-1 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition-colors"
                      >
                        <FileUp size={10} />
                        파일 추가하기
                      </button>
                      <input 
                        type="file" 
                        ref={knowledgeFileInputRef}
                        onChange={handleKnowledgeFileAdd}
                        className="hidden" 
                        accept=".txt,.md,.csv,.json,.jsonl" 
                      />
                    </div>
                    
                    <div className="space-y-2">
                      {(getAssistantConfig().persona?.files || []).map((file) => (
                         <div key={file.id} className="flex items-center justify-between p-2 rounded bg-zinc-900 border border-zinc-700">
                            <div className="flex items-center gap-2 overflow-hidden">
                               <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-500">
                                  <FileText size={12} />
                               </div>
                               <div className="flex flex-col min-w-0">
                                  <span className="text-xs text-zinc-300 truncate font-medium">{file.name}</span>
                                  <span className="text-[10px] text-zinc-500">{(file.size / 1024).toFixed(1)} KB</span>
                               </div>
                            </div>
                            <button 
                               onClick={() => removeKnowledgeFile(file.id)}
                               className="p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
                            >
                               <Trash2 size={12} />
                            </button>
                         </div>
                      ))}
                      {(getAssistantConfig().persona?.files || []).length === 0 && (
                         <div className="text-center py-4 bg-zinc-900/50 border border-dashed border-zinc-800 rounded text-zinc-600 text-xs">
                            등록된 참조 파일이 없습니다.
                         </div>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-2">* 텍스트(.txt, .md, .csv) 파일만 지원합니다.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-6">
              {/* Import/Export Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handleExportSnippets}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg border border-zinc-700 text-xs font-bold transition-all active:scale-95 shadow-sm"
                >
                  <Download size={14} /> 목록 내보내기
                </button>
                <button 
                  onClick={handleImportClick}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-900/30 hover:bg-blue-900/50 text-blue-200 rounded-lg border border-blue-800/50 text-xs font-bold transition-all active:scale-95 shadow-sm"
                >
                  <Upload size={14} /> 목록 불러오기
                </button>
              </div>
              
              <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-200 mb-3 flex items-center gap-2">
                  <Plus size={16} /> 새 단축키 추가
                </h3>
                
                <div className="space-y-3">
                  {/* Trigger Input */}
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">단축키 (Trigger Key)</label>
                    <button
                      onClick={() => { setIsRecording(true); setNewTrigger(''); }}
                      className={`w-full p-2 rounded border text-left text-sm flex items-center gap-2 ${
                        isRecording 
                          ? 'border-blue-500 bg-blue-900/20 text-blue-200 animate-pulse' 
                          : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600'
                      }`}
                    >
                      {isRecording ? (
                        <>
                          <Keyboard size={16} /> 키를 입력하세요...
                        </>
                      ) : (
                        <>
                          <Command size={16} /> {newTrigger || '클릭하여 키 설정'}
                        </>
                      )}
                    </button>
                    
                    {isRecording && (
                       <input 
                         type="text" 
                         className="opacity-0 absolute h-0 w-0" 
                         autoFocus 
                         onBlur={() => setIsRecording(false)}
                         onKeyDown={handleKeyDownCapture}
                       />
                    )}
                  </div>

                  {/* Type Selector */}
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">기능 유형 (Action Type)</label>
                    <div className="flex gap-2 bg-zinc-900 p-1 rounded border border-zinc-700">
                      <button
                        onClick={() => { setNewSnippetType(SnippetType.TEXT); setNewSnippetValue(''); }}
                        className={`flex-1 py-1.5 text-xs rounded transition-colors flex items-center justify-center gap-1 ${
                          newSnippetType === SnippetType.TEXT ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <Type size={12} /> 텍스트
                      </button>
                      <button
                        onClick={() => { setNewSnippetType(SnippetType.COLOR); setNewSnippetValue('#60a5fa'); }}
                        className={`flex-1 py-1.5 text-xs rounded transition-colors flex items-center justify-center gap-1 ${
                          newSnippetType === SnippetType.COLOR ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <Palette size={12} /> 색상
                      </button>
                      <button
                        onClick={() => { setNewSnippetType(SnippetType.AI_COMMAND); setNewSnippetValue(AIRevisionMode.GRAMMAR); }}
                        className={`flex-1 py-1.5 text-xs rounded transition-colors flex items-center justify-center gap-1 ${
                          newSnippetType === SnippetType.AI_COMMAND ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <Wand2 size={12} /> AI 교정
                      </button>
                    </div>
                  </div>

                  {/* Value Input */}
                  <div>
                    {newSnippetType === SnippetType.TEXT && (
                      <>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-xs text-zinc-500">삽입할 텍스트</label>
                          <button 
                            onClick={insertCursorMarker}
                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-900/30 px-2 py-0.5 rounded border border-blue-800/50"
                          >
                            <Type size={10} /> 커서 위치 {"{|}"} 삽입
                          </button>
                        </div>
                        <textarea
                          value={newSnippetValue}
                          onChange={(e) => setNewSnippetValue(e.target.value)}
                          placeholder='예: "말하기" {|}'
                          className="w-full p-2 rounded border border-zinc-700 bg-zinc-900 text-zinc-300 text-sm focus:outline-none focus:border-blue-500 min-h-[60px]"
                        />
                      </>
                    )}
                    
                    {newSnippetType === SnippetType.COLOR && (
                      <>
                        <label className="block text-xs text-zinc-500 mb-1">변경할 색상</label>
                        <div className="flex items-center gap-3 p-2 bg-zinc-900 rounded border border-zinc-700">
                          <input
                            type="color"
                            value={newSnippetValue}
                            onChange={(e) => setNewSnippetValue(e.target.value)}
                            className="h-8 w-12 bg-transparent cursor-pointer"
                          />
                          <span className="text-sm text-zinc-300 font-mono">{newSnippetValue}</span>
                        </div>
                      </>
                    )}

                    {newSnippetType === SnippetType.AI_COMMAND && (
                       <>
                        <label className="block text-xs text-zinc-500 mb-1">실행할 AI 모드</label>
                        <select
                          value={newSnippetValue}
                          onChange={(e) => setNewSnippetValue(e.target.value)}
                          className="w-full p-2 rounded border border-zinc-700 bg-zinc-900 text-zinc-300 text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          {Object.entries(AI_MODE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                       </>
                    )}
                  </div>

                  <button
                    onClick={addSnippet}
                    disabled={!newTrigger || !newSnippetValue}
                    className="w-full py-2 text-sm font-bold text-zinc-900 bg-blue-500 rounded hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    추가하기
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-zinc-400 mb-3">등록된 단축키 목록</h3>
                <div className="space-y-2">
                  {(settings.snippets || []).map((snippet) => (
                    <div key={snippet.id} className="flex items-start gap-3 p-3 rounded bg-zinc-800 border border-zinc-700 group">
                      <div className="shrink-0 px-2 py-1 bg-zinc-700 rounded text-xs font-mono text-blue-300 border border-zinc-600 min-w-[60px] text-center mt-0.5">
                        {snippet.trigger}
                      </div>
                      <div className="flex-1 text-sm text-zinc-300 flex items-center gap-2">
                        {snippet.type === SnippetType.COLOR ? (
                          <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full border border-zinc-600" style={{ backgroundColor: snippet.text }}></span>
                            <span className="text-zinc-400 text-xs">색상 변경 ({snippet.text})</span>
                          </div>
                        ) : snippet.type === SnippetType.AI_COMMAND ? (
                          <div className="flex items-center gap-2">
                             <Wand2 size={12} className="text-purple-400" />
                             <span className="text-purple-300 font-medium">{AI_MODE_LABELS[snippet.text] || snippet.text}</span>
                             <span className="text-zinc-500 text-xs">(AI 교정)</span>
                          </div>
                        ) : (
                          <span className="whitespace-pre-wrap break-all">{snippet.text}</span>
                        )}
                      </div>
                      <button
                        onClick={() => removeSnippet(snippet.id)}
                        className="text-zinc-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  
                  {(settings.snippets || []).length === 0 && (
                    <p className="text-center text-zinc-600 text-xs py-4">
                      등록된 단축키가 없습니다.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-900 bg-zinc-100 rounded hover:bg-zinc-200"
          >
            완료 (Done)
          </button>
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".json" 
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
};

export default SettingsModal;