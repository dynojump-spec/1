




import { NovelDocument, AppSettings, FontType, SnippetType, AVAILABLE_MODELS, Snippet } from '../types';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'novelcraft_docs';
const SETTINGS_KEY = 'novelcraft_settings';

// Default Snippets Preset
const DEFAULT_SNIPPETS: Snippet[] = [
  {
    "id": "19639840-2fc2-4e09-8c3c-6038d02f9e94",
    "trigger": "Alt+Q",
    "text": "grammar",
    "type": SnippetType.AI_COMMAND
  },
  {
    "id": "dd4c5fea-eaff-4fae-afb5-b344377c366c",
    "trigger": "Alt+2",
    "text": "‘{|}’",
    "type": SnippetType.TEXT
  },
  {
    "id": "12abc19a-3af6-4385-b942-ec48d7b6db71",
    "trigger": "Alt+3",
    "text": "[{|}]",
    "type": SnippetType.TEXT
  },
  {
    "id": "f3ac8020-8a1e-4d4c-9e5c-b4f1ba26962c",
    "trigger": "Alt+4",
    "text": "『{|}』",
    "type": SnippetType.TEXT
  },
  {
    "id": "c7e411dd-d84c-46d8-afff-a3e2f82fc154",
    "trigger": "Alt+5",
    "text": "「{|}」",
    "type": SnippetType.TEXT
  },
  {
    "id": "dc6ead1d-ceb0-41ed-9918-f4f5d437415e",
    "trigger": "Alt+6",
    "text": "【{|}】",
    "type": SnippetType.TEXT
  },
  {
    "id": "f46ca8fd-f664-4d0b-82f9-4f414b3d76f4",
    "trigger": "Alt+7",
    "text": "〔{|}〕",
    "type": SnippetType.TEXT
  },
  {
    "id": "56b4f4d6-cdef-40c8-8d54-3f1ad4d43c2c",
    "trigger": "Alt+8",
    "text": "―",
    "type": SnippetType.TEXT
  },
  {
    "id": "6ab25ae0-581d-4dca-894e-5f8f2a644e0b",
    "trigger": "Alt+Shift+1",
    "text": "#facc15",
    "type": SnippetType.COLOR
  },
  {
    "id": "e128432b-2597-49e8-8a92-7a3201e53d0d",
    "trigger": "Alt+Shift+2",
    "text": "#b7012e",
    "type": SnippetType.COLOR
  },
  {
    "id": "bee6d834-111c-49f5-8ba2-f47bdc07d697",
    "trigger": "Alt+Shift+3",
    "text": "#ffffff",
    "type": SnippetType.COLOR
  },
  {
    "id": "096627dc-a461-45b3-b860-3a5db6d4cefe",
    "trigger": "Alt+Q",
    "text": "grammar",
    "type": SnippetType.AI_COMMAND
  },
  {
    "id": "ae62b494-6fdd-4027-82a2-a247dec9dfc9",
    "trigger": "Alt+W",
    "text": "polish",
    "type": SnippetType.AI_COMMAND
  },
  {
    "id": "622feef5-66d2-4975-8ce4-4660138ca60c",
    "trigger": "Alt+E",
    "text": "compact",
    "type": SnippetType.AI_COMMAND
  },
  {
    "id": "1bb1696e-99bd-4a67-bc69-c6fbe1736536",
    "trigger": "Alt+R",
    "text": "scenery",
    "type": SnippetType.AI_COMMAND
  }
];

// Expose Default Settings for Reset functionality
export const getDefaultSettings = (): AppSettings => ({
  fontSize: 18,
  assistantFontSize: 14,
  fontType: FontType.SERIF,
  alignment: 'justify',
  enableIndentation: true,
  editorBackgroundColor: '#09090b', // Default Dark (Zinc-950)
  snippets: DEFAULT_SNIPPETS,
  aiModel: 'gemini-2.5-flash', // Updated default
  
  // Default Assistant Models
  leftAssistantModel: 'gemini-2.5-flash',
  rightAssistantModel: 'gemini-2.5-flash',

  // Default Personas
  leftAssistantPersona: {
    name: '웹소설 편집자',
    instruction: `1.너는 한국에서 일하는 웹소설의 편집자이자 독자야.
2.소설의 내용을 파악하고 평점을 내려주고. 
3.대사와 독백문장과 서술 문장의 연결의 이음새가 어색하거나 부자연스러운 곳을 찾아서  수정안을 써줘.
4.완성되지 않은 문장은 앞뒤의 내용들의 맥락을 파악해서 어색하지 않게 작성해줘.
5.최종 결과물만 채팅창에 바로 써줘.
6.분석 문제점은 쓰지말고 오로지 수정 결과물만 대답해줘.
7.수정된 문장은 굵은 글씨로 표시해서 한눈에 알아보기 쉽게 표시해줘.
8.문장간의 화면 전환이나 상황 전환의 연결이 어색하고 매끄럽지 못하면 너가 보완 수정해줘.
9.웹소설 내용들을 파악하고, 맥락이 맞는지 정밀하게 검토해줘.`,
    knowledge: '',
    files: []
  },
  rightAssistantPersona: {
    name: '설정 및 고증 담당',
    instruction: `당신은 설정 및 고증 담당 전문 편집자다.
주요 역할은 다음과 같다:

1. 설정 consistency 유지

세계관의 내부 논리를 면밀히 검토한다.

앞뒤 설정 충돌, 시간축 오류, 인물 행동·성격의 불일치 등을 정확히 짚어낸다.

작가가 제시한 세계관의 규칙, 사회 구조, 능력 체계 등 모든 로직을 기반으로 판단한다.

2. 고증 정확도 검토

역사, 문화, 지리, 물리, 생물학, 언어 등 작가가 설정한 범위 내에서 고증 오류를 확인하고 조언한다.

현실 기반 요소가 있을 경우 한국 기준의 일반적인 학술·상식적 관점으로 평가한다.

개연성 부족 요소는 논리적 근거를 들어 명확하게 설명한다.

3. 문제점 지적 방식

무조건적인 비판이 아니라, 구체적이고 개선 가능한 방향으로 피드백한다.

‘문제점 → 이유 → 개선안’ 구조로 정리해 제시한다.

작가의 의도와 세계관 스타일을 존중하면서 보완점을 제안한다.

4. 톤 & 매너

한국 편집자 특유의 차분하고 전문적인 분석 스타일을 유지한다.

불필요하게 가혹하거나 공격적인 표현은 사용하지 않는다.

세부 설정을 꼼꼼하게 읽고, 작가가 놓친 부분을 정교하게 잡아준다.

5. 작동 방식

사용자가 제공하는 텍스트·설정·세계관을 분석한다.

필요 시 설정 요약, 문제점 정리, 세계관 설계 보완까지 수행한다.

요청이 없으면 임의로 세계관을 크게 변형하지 않는다.`,
    knowledge: '',
    files: []
  },

  apiKey: '',
  soundVolume: 0.5,
  enableSaveAsDialog: true, // Default to true
});

// Helper to get raw list
export const getDocuments = (): NovelDocument[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  const docs = data ? JSON.parse(data) : [];
  return docs.map((d: any) => ({ ...d, isDeleted: !!d.isDeleted }));
};

// Save a single document (Update Only)
export const saveDocument = (doc: NovelDocument): NovelDocument[] => {
  const docs = getDocuments();
  const index = docs.findIndex((d) => d.id === doc.id);

  if (index >= 0) {
    if (docs[index].isDeleted) {
      console.warn(`Blocked save attempt on deleted document: ${doc.id}`);
      return docs; 
    }

    docs[index] = { ...doc, lastModified: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  }
  
  return docs;
};

// Soft Delete: Mark as deleted
export const softDeleteDocument = (id: string): NovelDocument[] => {
  const docs = getDocuments();
  const index = docs.findIndex((d) => d.id === id);
  if (index >= 0) {
    docs[index].isDeleted = true;
    docs[index].lastModified = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  }
  return docs;
};

// Restore: Mark as active
export const restoreDocument = (id: string): NovelDocument[] => {
  const docs = getDocuments();
  const index = docs.findIndex((d) => d.id === id);
  if (index >= 0) {
    docs[index].isDeleted = false;
    docs[index].lastModified = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  }
  return docs;
};

// Permanent Delete: Remove from array
export const permanentlyDeleteDocument = (id: string): NovelDocument[] => {
  const docs = getDocuments();
  const newDocs = docs.filter((d) => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newDocs));
  return newDocs;
};

// Empty Trash: Remove all soft-deleted
export const emptyTrash = (): NovelDocument[] => {
  const docs = getDocuments();
  const newDocs = docs.filter((d) => !d.isDeleted);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newDocs));
  return newDocs;
};

// Create new
export const createDocument = (): NovelDocument[] => {
  const newDoc: NovelDocument = {
    id: uuidv4(),
    title: '무제 (Untitled)',
    content: '',
    lastModified: Date.now(),
    isDeleted: false,
  };
  const docs = getDocuments();
  docs.push(newDoc);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  return docs;
};

// Settings Helpers
export const saveLocalSettings = (settings: AppSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const getLocalSettings = (): AppSettings | null => {
  const data = localStorage.getItem(SETTINGS_KEY);
  
  if (!data) {
    return getDefaultSettings();
  }
  
  const parsed = JSON.parse(data);
  const defaults = getDefaultSettings();
  
  // Snippets Migration
  if (!parsed.snippets) {
    parsed.snippets = [];
  } else {
    parsed.snippets = parsed.snippets.map((s: any) => ({
      ...s,
      type: s.type || SnippetType.TEXT
    }));
  }

  // Model Migration Logic
  // Only migrate definitely broken/deprecated models. Allow updated 3.0/2.5 Pro models to persist.
  const migrateModel = (modelName: string) => {
    if (!modelName) return defaults.aiModel;
    
    // Explicitly migrate old 1.5 Pro to 2.5 Pro or similar
    if (modelName.includes('1.5-pro') || modelName === 'gemini-pro') {
      return 'gemini-2.5-pro-preview'; 
    }
    
    // Migrate old Flash to new Flash
    if (modelName.includes('1.5-flash')) {
      return 'gemini-2.5-flash';
    }

    // Do NOT auto-migrate 3.0 or 2.0 Pro models if user selected them.
    // We trust the user selection from the dropdown.

    return modelName;
  };

  parsed.aiModel = migrateModel(parsed.aiModel || defaults.aiModel);

  // Migration: If new fields missing, fill with defaults
  if (!parsed.leftAssistantModel) parsed.leftAssistantModel = defaults.leftAssistantModel;
  
  if (!parsed.rightAssistantModel) {
     parsed.rightAssistantModel = parsed.assistantModel ? migrateModel(parsed.assistantModel) : defaults.rightAssistantModel;
  } else {
     parsed.rightAssistantModel = migrateModel(parsed.rightAssistantModel);
  }
  
  parsed.leftAssistantModel = migrateModel(parsed.leftAssistantModel);

  if (!parsed.leftAssistantPersona) parsed.leftAssistantPersona = defaults.leftAssistantPersona;
  if (!parsed.rightAssistantPersona) parsed.rightAssistantPersona = defaults.rightAssistantPersona;

  if (parsed.leftAssistantPersona && !parsed.leftAssistantPersona.files) parsed.leftAssistantPersona.files = [];
  if (parsed.rightAssistantPersona && !parsed.rightAssistantPersona.files) parsed.rightAssistantPersona.files = [];

  if (!parsed.assistantFontSize) parsed.assistantFontSize = defaults.assistantFontSize;
  if (typeof parsed.soundVolume === 'undefined') parsed.soundVolume = defaults.soundVolume;
  if (!parsed.alignment) parsed.alignment = defaults.alignment;
  if (typeof parsed.enableIndentation === 'undefined') parsed.enableIndentation = defaults.enableIndentation;
  if (typeof parsed.enableSaveAsDialog === 'undefined') parsed.enableSaveAsDialog = defaults.enableSaveAsDialog;
  if (!parsed.editorBackgroundColor) parsed.editorBackgroundColor = defaults.editorBackgroundColor;

  if (typeof parsed.apiKey === 'undefined') parsed.apiKey = '';
  
  delete parsed.showFormattingMarks;
  
  return parsed;
};